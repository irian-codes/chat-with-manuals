import {env} from '@/env';
import {queryCollection} from '@/server/db/chroma';
import {
  allowedAbsoluteDirPaths,
  writeToTimestampedFile,
} from '@/server/utils/fileStorage';
import {nonEmptyStringSchema} from '@/utils/strings';
import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI} from '@langchain/openai';
import {type Message} from '@prisma/client';
import {isWithinTokenLimit} from 'gpt-tokenizer/model/gpt-4o-mini';
import {type Document} from 'langchain/document';

// gpt-4o-mini context window (128k) size minus a 28k for the answer.
// Numbers chosen according to the findings that large contexts degrade model performance, these just feel right. 128k tokens are like 96k words, a "standard" 130 page novel is 40k words.
// @see https://platform.openai.com/tokenizer and https://themind.io/navigating-the-limits-of-long-context-windows-in-gpt-4
const TOKEN_LIMITS = {
  maxTokensAnswer: 2048, // Long enough. This is already a 1500 words (5.5 A4 sized pages) answer.
  maxTokensFinalPrompt: 16_000, // Long enough and balanced according to themind.com article. We'll se if we need to change it.
} as const;

const miniLlm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
  apiKey: env.OPENAI_API_KEY,
  timeout: 10 * 1000,
  maxTokens: TOKEN_LIMITS.maxTokensAnswer,
  maxRetries: 3,
});

const CHAT_TEMPLATES = {
  conversationHistory: 'CONVERSATION HISTORY (CONTEXT):\n{history}',
  documentDescription: 'DOCUMENT DESCRIPTION (CONTEXT):\n{description}',
  documentFragments: 'DOCUMENT FRAGMENTS (CONTEXT):\n{context}',
  userQuestion: 'USER QUESTION (PROMPT): {prompt}',
  answerPrefix: 'ANSWER:',
} as const;

export async function sendPrompt({
  prompt,
  collectionName,
  llmSystemPrompt,
  conversationHistory,
  documentDescription,
}: {
  prompt: string;
  collectionName: string;
  llmSystemPrompt: string;
  conversationHistory: Message[];
  documentDescription: string;
}) {
  const _prompt = nonEmptyStringSchema.parse(prompt, {
    errorMap: (_) => {
      return {
        message: 'Invalid prompt: prompt must be a non-empty string',
      };
    },
  });

  const _collectionName = nonEmptyStringSchema.parse(collectionName, {
    errorMap: (_) => {
      return {
        message:
          'Invalid collection name: collection name must be a non-empty string',
      };
    },
  });

  const _llmSystemPrompt = nonEmptyStringSchema.parse(llmSystemPrompt, {
    errorMap: (_) => {
      return {
        message:
          'Invalid LLM system prompt: LLM system prompt must be a non-empty string',
      };
    },
  });

  const _documentDescription = nonEmptyStringSchema
    .safeParse(documentDescription)
    .data?.trim();

  console.log('Retrieving context...');

  const retrievedContext = await retrieveContext({
    prompt: _prompt,
    collectionName: _collectionName,
  });

  // Trim conversation history to fit token limit
  const trimmedHistory = await trimConversationToTokenLimit(
    _llmSystemPrompt,
    conversationHistory,
    _prompt,
    retrievedContext
  );

  const chatTemplate = await createChatTemplate({
    trimmedHistory,
    retrievedContext,
    prompt: _prompt,
    documentDescription: _documentDescription,
  });

  const systemMessage = new SystemMessage(_llmSystemPrompt);

  console.log('Sending message to LLM...');

  // TODO: Send part of the conversation to the LLM as well, since now
  // we're only sending the last message.
  const response = await miniLlm.invoke([
    systemMessage,
    ...chatTemplate.toChatMessages(),
  ]);

  const responseContent = response.content.toString();

  if (env.NODE_ENV === 'development') {
    console.log('Message sent to the LLM: ', {
      prompt:
        systemMessage.content.toString() +
        '\n\n' +
        chatTemplate
          .toChatMessages()
          .map((m) => m.content)
          .join('\n\n'),
      response: responseContent,
    });

    // Logging response to file for debugging
    const answerFilePath = writeToTimestampedFile({
      content:
        `[PROMPT]: ${systemMessage.content.toString()}\n\n` +
        chatTemplate
          .toChatMessages()
          .map((m) => m.content)
          .join('\n\n') +
        '\n\n' +
        `[RESPONSE]: ${responseContent}\n`,
      destinationFolderPath: allowedAbsoluteDirPaths.publicLlmAnswers,
      fileName: 'llmAnswer',
      fileExtension: 'txt',
    });

    console.log('Saved answer to file:', answerFilePath);
  }

  return responseContent;
}

export async function retrieveContext({
  prompt,
  collectionName,
}: {
  prompt: string;
  collectionName: string;
}): Promise<string> {
  console.log('Getting similar chunks...');

  const similarChunks = await getSimilarChunks(20);

  return similarChunks.map((doc) => doc.pageContent).join('\n\n');

  // HELPER FUNCTIONS

  async function getSimilarChunks(
    maxChunks: number,
    dbCallTimeoutInMs = env.CHROMA_DB_TIMEOUT
  ): Promise<Document[]> {
    const timeout = new Promise<Document[]>((_, reject) =>
      setTimeout(
        () => reject(new Error('Timeout while querying ChromaDB')),
        dbCallTimeoutInMs
      )
    );

    const chunks = await Promise.race([
      queryCollection({
        collectionName,
        prompt,
        topK: maxChunks,
        throwOnEmptyReturn: true,
      }),
      timeout,
    ]);

    return chunks;
  }
}

export async function generateConversationTitle(
  messages: Message[]
): Promise<string> {
  if (messages.length === 0) {
    return '';
  }

  const systemMessage = new SystemMessage(
    'You are an online chat conversation title generator. You will be given a chat conversation between a human and an AI and you will need to generate a title for it. Be precise and concise.'
  );

  const chatText = `Generate a title for the following conversation:
  
  CONVERSATION:
  {conversation}
  
  TITLE: `;

  let responseContent = await (async () => {
    try {
      const chatTemplate = await ChatPromptTemplate.fromTemplate(
        chatText
      ).invoke({
        conversation: messages
          .map((msg) => {
            return `${msg.author.toUpperCase()}: ${msg.content}`;
          })
          .join('\n\n'),
      });

      const response = await miniLlm.invoke([
        systemMessage,
        ...chatTemplate.toChatMessages(),
      ]);

      return response.content.toString();
    } catch (error) {
      console.error('Error generating conversation title: ', error);

      return '';
    }
  })();

  // Removing surrounding quotes
  responseContent = responseContent.trim().replace(/^["|'](.*)["|']$/g, '$1');

  return responseContent?.slice(0, 255) ?? '';
}

async function trimConversationToTokenLimit(
  systemPrompt: string,
  conversationHistory: Message[],
  prompt: string,
  context: string
): Promise<Message[]> {
  if (conversationHistory.length === 0) {
    return [];
  }

  // Build template parts dynamically
  const templateParts = [
    systemPrompt,
    CHAT_TEMPLATES.documentFragments,
    CHAT_TEMPLATES.userQuestion,
    CHAT_TEMPLATES.answerPrefix,
  ];

  const template = templateParts.join('\n');

  // Fixed part of the prompt (everything except conversation history)
  const fixedPrompt = await ChatPromptTemplate.fromTemplate(template).invoke({
    context,
    prompt,
  });

  // Remove the "Human: " prefix from the fixed prompt
  const fixedPromptString = fixedPrompt.toString().replace(/^Human: /i, '');
  const fixedTokens = isWithinTokenLimit(
    fixedPromptString,
    TOKEN_LIMITS.maxTokensFinalPrompt
  );

  if (!fixedTokens) {
    throw new Error(
      'Fixed prompt already exceeds token limit! We cannot fit any messages.'
    );
  }

  const availableTokens = TOKEN_LIMITS.maxTokensFinalPrompt - fixedTokens;

  // Start with all messages
  let trimmedHistory = conversationHistory.slice();

  while (trimmedHistory.length > 0) {
    const historyText = `CONVERSATION HISTORY (CONTEXT):
${trimmedHistory
  .map((msg) => `${msg.author.toUpperCase()}: ${msg.content}`)
  .join('\n\n')}`;

    const historyTokens = isWithinTokenLimit(historyText, availableTokens);

    if (historyTokens !== false) {
      // We're within limits
      break;
    }

    // Remove oldest message combo
    trimmedHistory = trimmedHistory.slice(2);
  }

  return trimmedHistory;
}

// Depending on the token count of the chat history, we use one or the
// other. If the chat history is too long, we use the
// withoutChatHistoryTemplate. Or if there is no chat history too.
// Otherwise, we try to fit the chat history into the token limit and use
// the withChatHistoryTemplate.
// It's very unlikely that the chat history will be too long, but just in case...
// ... existing code ...
async function createChatTemplate({
  trimmedHistory,
  retrievedContext,
  prompt,
  documentDescription,
}: {
  trimmedHistory: Message[];
  retrievedContext: string;
  prompt: string;
  documentDescription?: string;
}) {
  // Build template parts dynamically
  const templateParts = [
    // Add conversation history if it exists
    ...(trimmedHistory.length > 0
      ? [CHAT_TEMPLATES.conversationHistory, '']
      : []),
    ...(documentDescription ? [CHAT_TEMPLATES.documentDescription, ''] : []),
    CHAT_TEMPLATES.documentFragments,
    '',
    CHAT_TEMPLATES.userQuestion,
    '',
    CHAT_TEMPLATES.answerPrefix,
  ];

  const template = templateParts.join('\n');

  return ChatPromptTemplate.fromTemplate(template).invoke({
    ...(trimmedHistory.length > 0 && {
      history: trimmedHistory
        .map((msg) => `${msg.author.toUpperCase()}: ${msg.content}`)
        .join('\n\n'),
    }),
    ...(documentDescription ? {description: documentDescription} : {}),
    context: retrievedContext,
    prompt,
  });
}

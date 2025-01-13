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
import {type Document} from 'langchain/document';

const miniLlm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
  apiKey: env.OPENAI_API_KEY,
  timeout: 10 * 1000,
});

export async function sendPrompt({
  prompt,
  collectionName,
  llmSystemPrompt,
}: {
  prompt: string;
  collectionName: string;
  llmSystemPrompt: string;
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

  console.log('Retrieving context...');

  const retrievedContext = await retrieveContext({
    prompt: _prompt,
    collectionName: _collectionName,
  });

  const chatText = `DOCUMENT FRAGMENTS (CONTEXT):
  {context}
  
  USER QUESTION (PROMPT): {prompt}
  
  ANSWER:`;

  const chatTemplate = await ChatPromptTemplate.fromTemplate(chatText).invoke({
    context: retrievedContext,
    prompt: _prompt,
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

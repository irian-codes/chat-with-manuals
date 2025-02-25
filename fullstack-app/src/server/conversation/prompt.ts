import {env} from '@/env';
import {getDocs, queryCollection} from '@/server/db/chroma';
import {prisma} from '@/server/db/prisma';
import {
  allowedAbsoluteDirPaths,
  writeToTimestampedFile,
} from '@/server/utils/fileStorage';
import {type ReconstructedSectionDoc} from '@/types/ReconstructedSectionDoc';
import {
  sectionChunkDocSchema,
  type SectionChunkDoc,
} from '@/types/SectionChunkDoc';
import {nonEmptyStringSchema} from '@/utils/strings';
import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI} from '@langchain/openai';
import {type Conversation, type Message} from '@prisma/client';
import {tasks} from '@trigger.dev/sdk/v3';
import {IncludeEnum} from 'chromadb';
import {isWithinTokenLimit} from 'gpt-tokenizer/model/gpt-4o-mini';
import {Document} from 'langchain/document';
import {createHash} from 'node:crypto';
import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';
import {type retrieveContextTask} from '../trigger/conversation';
import {getConversationLlmSystemPrompt} from './utils';

// gpt-4o(mini) context window (128k) size.
// Numbers chosen according to the findings that large contexts degrade model performance, these just feel right. 128k tokens are like 96k words, a "standard" 130 page novel is 40k words.
// @see https://platform.openai.com/tokenizer and https://themind.io/navigating-the-limits-of-long-context-windows-in-gpt-4
export const TOKEN_LIMITS = {
  maxTokensAnswer: 2048, // Long enough. This is already a 1500 words (5.5 A4 sized pages) answer.
  maxTokensFinalPrompt: 16_000, // Long enough and balanced according to themind.com article. We'll se if we need to change it.
  maxTokensPerSection: 600,
  maxTokensAllSections: 6000,
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
  documentFragments: `DOCUMENT SECTION FRAGMENTS (CONTEXT):
The fragments represent sections (classified with headers in the original document).
The fragments include at the top the header route of the section they belong to in the format "SECTION HEADER ROUTE: header>subheader>...".
The fragments are ordered as they appear in the original document.

{context}`,
  userQuestion: 'USER QUESTION (PROMPT): {prompt}',
  answerPrefix: 'ANSWER:',
} as const;

export async function sendPrompt({
  prompt,
  conversationId,
}: {
  prompt: string;
  conversationId: Conversation['id'];
}) {
  const _prompt = nonEmptyStringSchema.parse(prompt, {
    errorMap: (_) => {
      return {
        message: 'Invalid prompt: prompt must be a non-empty string',
      };
    },
  });

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: {
      id: conversationId,
    },
    include: {
      documents: {
        include: {
          file: true,
        },
      },
      messages: {
        orderBy: {createdAt: 'asc'},
        take: 50,
      },
    },
  });

  // TODO: Add support for multiple documents per conversation
  const collectionName = conversation.documents[0]!.file.vectorStoreId;
  const documentDescription = conversation.documents[0]!.description;
  const sectionPrefix = 'SECTION HEADER ROUTE: ';
  const systemPrompt = getConversationLlmSystemPrompt({
    conversation,
  });

  const hashedPrompt = createHash('sha256')
    .update(_prompt.toLowerCase())
    .digest('hex');

  const retrievedContext = await tasks.triggerAndPoll<
    typeof retrieveContextTask
  >(
    'retrieve-context',
    {
      prompt: _prompt,
      collectionName,
      sectionPrefix,
    },
    {
      pollIntervalMs: 500,
      idempotencyKey: [conversationId, hashedPrompt],
      idempotencyKeyTTL: '5m',
    }
  );

  if (retrievedContext.error != null) {
    throw new Error('Error retrieving context from Trigger.dev task', {
      cause: retrievedContext.error,
    });
  }

  // TODO: Probably this should go in Trigger.dev as it consumes CPU
  // Trim conversation history to fit token limit
  const trimmedHistory = await trimConversationToTokenLimit({
    systemPrompt,
    conversationHistory: conversation.messages,
    prompt: _prompt,
    context: retrievedContext.output!,
  });

  const chatTemplate = await createChatTemplate({
    trimmedHistory,
    retrievedContext: retrievedContext.output!,
    prompt: _prompt,
    documentDescription,
  });

  const systemMessage = new SystemMessage(systemPrompt);

  console.log('Sending message to LLM...');

  const structuredMiniLlm = miniLlm.withStructuredOutput(
    z.object({
      answer: z
        .string()
        .describe(
          "answer to the user's question in a markdown formatted string"
        ),
      sources: z
        .array(z.string())
        .describe(
          "if you didn't found the answer in the document, an empty array. Otherwise, this array contains the sources used to answer the user's question, should be one or more section headers."
        ),
    }),
    {
      strict: true,
    }
  );

  const response = await structuredMiniLlm.invoke([
    systemMessage,
    ...chatTemplate.toChatMessages(),
  ]);

  // TODO #82: For some reason, sometimes the LLM doesn't include the sources
  // in the response. We'll see if we can fix this.
  const sourcesText =
    response.sources.length > 0
      ? `\n\n📋: ${response.sources
          .map((source) => source.replace(sectionPrefix, '').trim())
          .join('\n')}`
      : '';

  const responseContent = `${response.answer}${sourcesText}`;

  if (env.NODE_ENV === 'development') {
    console.log('Message sent to the LLM: ', {
      prompt:
        JSON.stringify(systemMessage.content) +
        '\n\n' +
        chatTemplate
          .toChatMessages()
          .map((m) => JSON.stringify(m.content))
          .join('\n\n'),
      response: responseContent,
    });

    // Logging response to file for debugging
    const answerFilePath = await writeToTimestampedFile({
      content:
        `[PROMPT]: ${JSON.stringify(systemMessage.content)}\n\n` +
        chatTemplate
          .toChatMessages()
          .map((m) => JSON.stringify(m.content))
          .join('\n\n') +
        '\n\n' +
        `[RESPONSE]: ${responseContent}\n`,
      destinationFolderPath: allowedAbsoluteDirPaths.logLlmAnswers,
      fileName: 'llmAnswer',
      fileExtension: 'txt',
    });

    console.log('Saved answer to file:', answerFilePath);
  }

  return responseContent;
}

export async function getSimilarChunks({
  prompt,
  collectionName,
  maxChunks,
  dbCallTimeoutInMs = env.CHROMA_DB_TIMEOUT,
}: {
  prompt: string;
  collectionName: string;
  maxChunks: number;
  dbCallTimeoutInMs?: number;
}): Promise<SectionChunkDoc[]> {
  const timeout = new Promise<SectionChunkDoc[]>((_, reject) =>
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
    }) as Promise<SectionChunkDoc[]>,
    timeout,
  ]);

  return chunks;
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

      if (typeof response.content !== 'string') {
        throw new Error('Response content is not a string');
      }

      return response.content;
    } catch (error) {
      console.error('Error generating conversation title: ', error);

      return '';
    }
  })();

  // Removing surrounding quotes
  responseContent = responseContent.trim().replace(/^["|'](.*)["|']$/g, '$1');

  return responseContent?.slice(0, 255) ?? '';
}

async function trimConversationToTokenLimit({
  systemPrompt,
  conversationHistory,
  prompt,
  context,
}: {
  systemPrompt: string;
  conversationHistory: Message[];
  prompt: string;
  context: string;
}): Promise<Message[]> {
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

export async function reconstructSections({
  similarChunks,
  collectionName,
  leftTotalTokens,
  maxSectionTokens,
  dbCallTimeoutInMs = env.CHROMA_DB_TIMEOUT,
}: {
  similarChunks: SectionChunkDoc[];
  collectionName: string;
  leftTotalTokens: number;
  maxSectionTokens: number;
  dbCallTimeoutInMs?: number;
}): Promise<ReconstructedSectionDoc[]> {
  const groupedSectionChunks = await getGroupedSectionChunks();

  // Preparing now the pairs that we will need to reconstruct sections.
  // Transforming each Map entry from [string, SectionChunkDoc[]] to
  // [SectionChunkDoc, SectionChunkDoc[]] being the chunk the first chunk
  // in similarity order not yet processed. So, we're pairing each chunk
  // with the chunks that belong to the same section.
  const chunkPairs = (() => {
    const pairs: ([SectionChunkDoc, string] | null)[] = similarChunks.map(
      (c) => [c, c.metadata.headerRouteLevels] as const
    );

    const newPairs = [];

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (pair == null) continue;

      const arr = groupedSectionChunks.get(pair[1])!;
      newPairs.push([pair[0], arr] as const);
      pairs[i] = null;
    }

    return newPairs;
  })();

  // This is to avoid reconstructing the same section twice. Although it
  // needs refining (check reconstructSection() TODO comment)
  const seenSectionsIds = new Set();
  let _leftTotalTokens = leftTotalTokens;
  const result: ReconstructedSectionDoc[] = [];

  for (const [chunk, chunksInSection] of chunkPairs) {
    if (_leftTotalTokens <= 0) {
      break;
    }

    if (
      seenSectionsIds.has(chunk.metadata.sectionId) ||
      chunksInSection.length === 0
    ) {
      continue;
    }

    const reconstructedSection = await reconstructSection({
      chunk,
      chunksInSection,
      maxSectionTokens,
    });

    seenSectionsIds.add(chunk.metadata.sectionId);
    _leftTotalTokens = _leftTotalTokens - reconstructedSection.metadata.tokens;

    result.push(reconstructedSection);
  }

  return result;

  // HELPER FUNCTIONS

  /**
   * Retrieves chunks from ChromaDB and groups them based on their header
   * route level. E.g. It'll create an entry with the key "1>2>3" and the
   * value an array of chunks that have "1>2>3" as their Header Route Level
   * (thus, all section chunks with that header level will get grouped in
   * that Map entry). We only consider header route levels that are present
   * in the similarChunks array.
   */
  async function getGroupedSectionChunks() {
    const allHeaderRouteLevels = Array.from(
      new Set(similarChunks.map((c) => c.metadata.headerRouteLevels))
    );

    const chunks = await (async () => {
      const timeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Timeout while querying ChromaDB')),
          dbCallTimeoutInMs
        )
      );

      return (await Promise.race([
        getDocs({
          collectionName,
          throwOnEmptyReturn: true,
          dbQuery: {
            where: {
              $or: allHeaderRouteLevels.map((hr) => ({
                headerRouteLevels: hr,
              })),
            },
            include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
          },
        }),
        timeout,
      ])) as SectionChunkDoc[];
    })();

    const groupedChunks = Map.groupBy(
      chunks,
      (s) => s.metadata.headerRouteLevels
    );

    try {
      return z
        .map(z.string().min(1), z.array(sectionChunkDocSchema))
        .parse(groupedChunks);
    } catch (error) {
      throw new Error(
        'ChromaDB returned no valid chunks due to an unknown error.',
        {
          cause: error,
        }
      );
    }
  }
}

/**
 * Reconstructs a section from the given chunk and an array containing all
 * chunks of the same section.
 *
 * This function takes a chunk and reconstructs a section by adding chunks
 * above and below the initial chunk, ensuring that the total token count
 * does not exceed the specified maximum.
 */
async function reconstructSection({
  chunk,
  chunksInSection,
  maxSectionTokens,
}: {
  chunk: SectionChunkDoc;
  chunksInSection: SectionChunkDoc[];
  maxSectionTokens: number;
}): Promise<ReconstructedSectionDoc> {
  const {headerRoute, headerRouteLevels, order} = chunk.metadata;

  // Sort the chunks based on their order in the section
  const sortedChunks = chunksInSection.sort(
    (a, b) => a.metadata.order - b.metadata.order
  );

  // Initialize reconstruction with the current chunk
  const initialChunkIndex = order - 1;
  const initialChunk = sortedChunks[initialChunkIndex]!;
  const reconstructedChunks = [initialChunk];
  let currentTokenCount = initialChunk.metadata.tokens;

  // Reconstruct by adding chunks above and below
  let priorIndex = initialChunkIndex - 1;
  let afterIndex = initialChunkIndex + 1;

  while (priorIndex >= 0 || afterIndex < sortedChunks.length) {
    const chunkSkipped: {above?: boolean; below?: boolean} = {
      above: undefined,
      below: undefined,
    };

    // Add the chunk above if available and within token limit
    if (priorIndex >= 0) {
      const aboveChunk = sortedChunks[priorIndex]!;
      if (currentTokenCount + aboveChunk.metadata.tokens <= maxSectionTokens) {
        chunkSkipped.above = false;
        reconstructedChunks.unshift(aboveChunk);
        currentTokenCount += aboveChunk.metadata.tokens;
        priorIndex--;
      } else {
        chunkSkipped.above = true;
      }
    }

    // Add the chunk below if available and within token limit
    if (afterIndex < sortedChunks.length) {
      const belowChunk = sortedChunks[afterIndex]!;
      if (currentTokenCount + belowChunk.metadata.tokens <= maxSectionTokens) {
        chunkSkipped.below = false;
        reconstructedChunks.push(belowChunk);
        currentTokenCount += belowChunk.metadata.tokens;
        afterIndex++;
      } else {
        chunkSkipped.below = true;
      }
    }

    // We detect we could add at least one chunk, so we continue.
    if (!(chunkSkipped.above === false || chunkSkipped.below === false)) {
      break;
    }
  }

  // TODO: Return all the order numbers of tokens included in this section,
  // so we can check on the call if the current chunk was included or not.

  const finalText = reconstructedChunks
    .map((chunk) => chunk.pageContent)
    .join('\n');

  const finalDoc = new Document({
    id: uuidv4(),
    pageContent: finalText,
    metadata: {
      headerRoute,
      headerRouteLevels,
      tokens: currentTokenCount,
      charCount: finalText.length,
    },
  });

  return finalDoc;
}

export function sortReconstructedSectionsByHeaderRoute(
  sections: ReconstructedSectionDoc[]
): ReconstructedSectionDoc[] {
  return sections.sort((a, b) => {
    const routeA = a.metadata.headerRouteLevels
      .split('>')
      .map((str) => Number(str));

    const routeB = b.metadata.headerRouteLevels
      .split('>')
      .map((str) => Number(str));

    for (let i = 0; i < Math.max(routeA.length, routeB.length); i++) {
      const levelA = routeA[i] ?? 0;
      const levelB = routeB[i] ?? 0;

      if (levelA !== levelB) {
        return levelA - levelB;
      }
    }

    // If the code didn't return here it means they're equal
    return 0;
  });
}

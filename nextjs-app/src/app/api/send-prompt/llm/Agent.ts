import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI} from '@langchain/openai';
import {Document} from 'langchain/document';
import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';
import {queryCollection} from '../../db/vector-db/VectorDB';

const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0.5,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function sendPrompt(prompt: string, collectionName: string) {
  if (!z.string().min(1).safeParse(prompt).success) {
    throw new Error('Invalid prompt: prompt must be a non-empty string');
  }

  const retrievedContext = await retrieveContext(prompt, collectionName);

  console.log('heeey 2.4', {retrievedContext});

  const chatText = `Use the following pieces of text from the document as context to answer the user's question to the best of your ability.
  DOCUMENT FRAGMENTS: {context}
  USER QUESTION: {question}`;

  const chatTemplate = await ChatPromptTemplate.fromTemplate(chatText).invoke({
    context: retrievedContext.map((doc) => doc.pageContent).join('\n\n'),
    question: prompt,
  });

  const response = await llm.invoke([
    new SystemMessage(
      "You're a helpful AI assistant expert explaining documents in understandable terms. Your answers should be elaborate. If you don't know the answer just say 'I don't know'."
    ),
    ...chatTemplate.toChatMessages(),
  ]);

  return response.content;
}

export async function retrieveContext(prompt: string, collectionName: string) {
  const similarChunks = await queryCollection(collectionName, prompt);

  let leftTotalTokens = 4000;

  // This is to avoid reconstructing the same section twice. Although it
  // needs refining (check reconstructSection() TODO comment)
  let lastHeaderRoute = '';

  const reconstructedSections = await (async function () {
    const result: Document[] = [];

    for (const chunk of similarChunks) {
      if (leftTotalTokens <= 0) {
        break;
      }

      if (chunk.metadata.headerRoute === lastHeaderRoute) {
        continue;
      }

      const reconstructedSection = await reconstructSection(
        prompt,
        chunk,
        collectionName,
        1000
      );

      lastHeaderRoute = chunk.metadata.headerRoute;
      leftTotalTokens -= reconstructedSection.metadata.tokens;

      result.push(reconstructedSection);
    }

    return result;
  })();

  // TODO: Sort the reconstructed sections by headerRouteLevel

  return reconstructedSections;
}

async function reconstructSection(
  prompt: string,
  chunk: Document,
  collectionName: string,
  maxSectionTokens: number
): Promise<Document> {
  const {
    headerRoute,
    headerRouteLevels,
    order: currentChunkPosition,
  } = chunk.metadata;

  // Step 1: Query all chunks for the given section using the headerRoute filter
  const allChunksInSection = await queryCollection(
    collectionName,
    prompt,
    100,
    {
      filter: {headerRoute},
    }
  );

  // Step 2: Sort the chunks based on their order in the document
  const sortedChunks = allChunksInSection.sort(
    (a, b) => a.metadata.order - b.metadata.order
  );

  // Step 3: Initialize reconstruction with the current chunk
  const initialChunk = sortedChunks[currentChunkPosition];
  let reconstructedChunks = [initialChunk];
  let currentTokenCount = initialChunk.metadata.tokens;

  // Step 4: Reconstruct by adding chunks above and below
  let priorIndex = currentChunkPosition - 1;
  let afterIndex = currentChunkPosition + 1;

  while (priorIndex >= 0 || afterIndex < sortedChunks.length) {
    // Add the chunk above if available and within token limit
    if (priorIndex >= 0) {
      const aboveChunk = sortedChunks[priorIndex];
      if (currentTokenCount + aboveChunk.metadata.tokens <= maxSectionTokens) {
        reconstructedChunks.unshift(aboveChunk);
        currentTokenCount += aboveChunk.metadata.tokens;
        priorIndex--;
      }
    }

    // Add the chunk below if available and within token limit
    if (afterIndex < sortedChunks.length) {
      const belowChunk = sortedChunks[afterIndex];
      if (currentTokenCount + belowChunk.metadata.tokens <= maxSectionTokens) {
        reconstructedChunks.push(belowChunk);
        currentTokenCount += belowChunk.metadata.tokens;
        afterIndex++;
      }
    }
  }

  // TODO: Return all the order numbers of tokens included in this section,
  // so we can check on the call if the current chunk was included or not.

  const finalDoc = new Document({
    id: uuidv4(),
    pageContent: reconstructedChunks
      .map((chunk) => chunk.pageContent)
      .join('\n\n'),
    metadata: {
      headerRoute,
      headerRouteLevels,
      tokens: currentTokenCount,
    },
  });

  return finalDoc;
}

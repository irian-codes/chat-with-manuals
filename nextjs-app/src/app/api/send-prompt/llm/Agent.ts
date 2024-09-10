import {
  ReconstructedSectionDoc,
  reconstructedSectionMetadataSchema,
} from '@/app/common/types/ReconstructedSectionDoc';
import {
  SectionChunkDoc,
  sectionChunkMetadataSchema,
} from '@/app/common/types/SectionChunkDoc';
import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI} from '@langchain/openai';
import {Document} from 'langchain/document';
import {marked} from 'marked';
import assert from 'node:assert';
import sanitizeHtml from 'sanitize-html';
import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';
import {queryCollection} from '../../db/vector-db/VectorDB';
import {writeToTimestampedFile} from '../../utils/fileUtils';

export async function sendPrompt(
  prompt: string,
  documentDescription: string,
  collectionName: string
) {
  if (!z.string().trim().min(1).safeParse(prompt).success) {
    throw new Error('Invalid prompt: prompt must be a non-empty string');
  }

  if (!z.string().trim().min(1).safeParse(documentDescription).success) {
    documentDescription = '';
  }

  const sectionPrefix = 'SECTION HEADER ROUTE: ';
  const retrievedContext = (
    await retrieveContext(prompt, collectionName, sectionPrefix)
  )
    .replaceAll('\n. ', '.\n')
    .replaceAll('\n.', '.');

  const chatText = `{documentDescription}
From the following fragments of text extracted from the original document, use the relevant fragments as context to answer the user's question to the best of your ability.
  
USER QUESTION: {question}

The fragments represent sections (classified with headers in the original document).
The fragments include at the top the header route of the section they belong to in the format "{sectionPrefix}header>subheader>...".
The fragments are ordered as they appear in the original document.

DOCUMENT FRAGMENTS:
{context}`;

  const chatTemplate = await ChatPromptTemplate.fromTemplate(chatText).invoke({
    context: retrievedContext,
    question: prompt,
    documentDescription,
    sectionPrefix,
  });

  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.5,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemMessage = new SystemMessage(
    "You're a helpful AI assistant expert in explaining documents in understandable terms. Your answers should be elaborate. If you don't know the answer just say 'I couldn't find the answer in the provided document.'."
  );

  const response = await llm.invoke([
    systemMessage,
    ...chatTemplate.toChatMessages(),
  ]);

  console.log('Message sent to the LLM', {
    prompt:
      systemMessage.content +
      '\n\n' +
      chatTemplate
        .toChatMessages()
        .map((m) => m.content)
        .join('\n\n'),
    response: response.content,
  });

  // According to marked we better do this:
  // https://marked.js.org/#usage
  const responseContent = response.content
    .toString()
    .replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, '');

  const finalHtml = sanitizeHtml(await marked.parse(responseContent));

  const answerFilePath = writeToTimestampedFile({
    content:
      `[PROMPT]: ${systemMessage.content}\n` +
      chatTemplate
        .toChatMessages()
        .map((m) => m.content)
        .join('\n\n') +
      '\n\n' +
      `[RESPONSE]: ${responseContent}\n`,
    destinationFolderPath: 'tmp',
    fileName: 'llmAnswer',
    fileExtension: 'txt',
  });

  console.log('Saved answer to file:', answerFilePath);

  return finalHtml;
}

export async function retrieveContext(
  prompt: string,
  collectionName: string,
  sectionHeaderPrefix: string
): Promise<string> {
  const similarChunks = (await queryCollection(
    collectionName,
    prompt,
    30
  )) as SectionChunkDoc[];

  assert(
    similarChunks
      .map((c) => sectionChunkMetadataSchema.safeParse(c.metadata))
      .every((r) => r.success),
    'Invalid chunk metadata'
  );

  let leftTotalTokens = 3000;

  // This is to avoid reconstructing the same section twice. Although it
  // needs refining (check reconstructSection() TODO comment)
  const seenHeaderRoutes = new Set();

  const reconstructedSections = await (async function () {
    const result: ReconstructedSectionDoc[] = [];

    for (const chunk of similarChunks) {
      if (leftTotalTokens <= 0) {
        break;
      }

      if (
        seenHeaderRoutes.has(chunk.metadata.headerRoute.trim().toUpperCase())
      ) {
        continue;
      }

      const reconstructedSection = await reconstructSection(
        prompt,
        chunk,
        collectionName,
        1000
      );

      seenHeaderRoutes.add(chunk.metadata.headerRoute.trim().toUpperCase());
      leftTotalTokens = leftTotalTokens - reconstructedSection.metadata.tokens;

      result.push(reconstructedSection);
    }

    assert(
      result
        .map((s) => reconstructedSectionMetadataSchema.safeParse(s.metadata))
        .every((r) => r.success),
      'Invalid reconstructed section metadata'
    );

    return result;
  })();

  const sortedSections = sortReconstructedSectionsByHeaderRoute(
    reconstructedSections
  );

  return sortedSections
    .map(
      (doc) =>
        `${sectionHeaderPrefix}${doc.metadata.headerRoute}\n\n${doc.pageContent}`
    )
    .join('\n\n');
}

async function reconstructSection(
  prompt: string,
  chunk: SectionChunkDoc,
  collectionName: string,
  maxSectionTokens: number
): Promise<ReconstructedSectionDoc> {
  const {headerRoute, headerRouteLevels, order} = chunk.metadata;

  // Step 1: Query all chunks for the given section using the headerRoute filter
  const allChunksInSection = await queryCollection(
    collectionName,
    prompt,
    100,
    {
      filter: {headerRouteLevels},
    }
  );

  // Step 2: Sort the chunks based on their order in the document
  const sortedChunks = allChunksInSection.sort(
    (a, b) => a.metadata.order - b.metadata.order
  );

  // Step 3: Initialize reconstruction with the current chunk
  const initialChunkIndex = order - 1;
  const initialChunk = sortedChunks[initialChunkIndex];
  let reconstructedChunks = [initialChunk];
  let currentTokenCount = initialChunk.metadata.tokens;

  // Step 4: Reconstruct by adding chunks above and below
  let priorIndex = initialChunkIndex - 1;
  let afterIndex = initialChunkIndex + 1;

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

import {getEnvVars} from '@/app/common/env';
import {ReconstructedSectionDoc} from '@/app/common/types/ReconstructedSectionDoc';
import {SectionChunkDoc} from '@/app/common/types/SectionChunkDoc';
import {CohereRerank} from '@langchain/cohere';
import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI} from '@langchain/openai';
import {Document} from 'langchain/document';
import {marked} from 'marked';
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

  console.log('Retrieving context...');

  const sectionPrefix = 'SECTION HEADER ROUTE: ';
  const retrievedContext = await retrieveContext({
    prompt,
    collectionName,
    sectionHeaderPrefix: sectionPrefix,
  });

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
    temperature: 0,
    apiKey: getEnvVars().OPENAI_API_KEY,
  });

  const systemMessage = new SystemMessage(
    "You're a helpful AI assistant expert in explaining documents. Answer based only on the supplied context. Provide accurate, clear answers. Cite references in the context. Do not include external information, assumptions, opinions, or interpretations (unless the user requests it). If you can't find the answer, say 'I couldn't find the answer in the provided document.'"
  );

  console.log('Sending message to LLM...');
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

  console.log('Transforming answer to HTML...');

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

export async function retrieveContext({
  prompt,
  collectionName,
  sectionHeaderPrefix = '',
  reranker = null,
}: {
  prompt: string;
  collectionName: string;
  sectionHeaderPrefix?: string;
  reranker?: 'cohere' | null;
}): Promise<string> {
  console.log('Getting similar chunks...');
  const similarChunks = await getSimilarChunks(20);

  console.log('Reconstructing sections...');
  const reconstructedSections = await reconstructSections({
    prompt,
    similarChunks,
    collectionName,
    leftTotalTokens: 1000,
    maxSectionTokens: 200,
  });

  const sortedSections = sortReconstructedSectionsByHeaderRoute(
    reconstructedSections
  );

  return sortedSections
    .map(
      (doc) =>
        `${sectionHeaderPrefix}${doc.metadata.headerRoute}\n\n${doc.pageContent}`
    )
    .join('\n\n');

  // HELPER FUNCTIONS

  async function getSimilarChunks(
    maxChunks: number,
    dbCallTimeoutInMs = getEnvVars().CHROMA_DB_TIMEOUT
  ): Promise<SectionChunkDoc[]> {
    z.number().int().min(1).parse(maxChunks);

    const chunks = (await queryCollection({
      collectionName,
      prompt,
      topK: 100,
      throwOnEmptyReturn: true,
      options: {
        clientParams: {
          fetchOptions: {signal: AbortSignal.timeout(dbCallTimeoutInMs)},
        },
      },
    })) as SectionChunkDoc[];

    if (!reranker) {
      return chunks.slice(0, maxChunks);
    } else if (reranker === 'cohere') {
      // TODO: Probably I'm doing something wrong, but using only the
      // reranker seems to not yield any substantial improvements overs
      // similarity search with Chroma. Seems this user uses it more for
      // the metrics, and they may be useful
      // (https://www.reddit.com/r/LangChain/comments/1f3h9vk/comment/lkgfs4g/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button)
      // but this is a prototype and in production it should be implemented
      // differently if the value lies in the data. I should dive deeper
      // into this someday, but for now, I'm not implementing a reranker.
      // I've ran my tests using the file in
      // src/__tests__/api/llm/reranker.ts.
      throw new Error(
        "DEPRECATED: Cohere reranker 3.0 seems not useful enough, results aren't substantially better than simple similarity search."
      );

      const cohereRerank = new CohereRerank({
        apiKey: getEnvVars().COHERE_API_KEY,
        model: 'rerank-english-v3.0',
      });

      // TODO: Cohere can rate limit and for whatever reason it just
      // "hangs" instead of returning an error, so add a timeout here.
      const rerankedDocumentsResults = await cohereRerank.rerank(
        chunks.map(
          (c) =>
            `SECTION TITLE: ${c.metadata.headerRoute}\nSECTION CONTENT: ${c.pageContent}`
        ),
        prompt,
        {
          topN: maxChunks,
        }
      );

      const result = rerankedDocumentsResults.map((res) => chunks[res.index]);

      return result;
    } else {
      throw new Error('Unsupported reranker passed as parameter: ' + reranker);
    }
  }
}

async function reconstructSections({
  prompt,
  similarChunks,
  collectionName,
  leftTotalTokens,
  maxSectionTokens,
  dbCallTimeoutInMs = getEnvVars().CHROMA_DB_TIMEOUT,
}: {
  prompt: string;
  similarChunks: SectionChunkDoc[];
  collectionName: string;
  leftTotalTokens: number;
  maxSectionTokens: number;
  dbCallTimeoutInMs?: number;
}): Promise<ReconstructedSectionDoc[]> {
  // Calling the db queries in parallel to speed up operations
  const sectionChunks = await (async function () {
    const promises = similarChunks.map(async (chunk) => {
      // console.time(
      //   `queryCollection(${collectionName}:${chunk.metadata.headerRouteLevels}:${chunk.metadata.order})`
      // );
      const chunksInSection = await queryCollection({
        collectionName,
        prompt,
        // Query all chunks for the given section using the headerRoute filter.
        // Well, 100 is Chroma limit so maybe we aren't retrieving all of them
        // but 100 should be way more than what we need.
        topK: 100,
        throwOnEmptyReturn: true,
        options: {
          filter: {headerRouteLevels: chunk.metadata.headerRouteLevels},
          clientParams: {
            fetchOptions: {signal: AbortSignal.timeout(dbCallTimeoutInMs)},
          },
        },
      });
      // console.timeEnd(
      //   `queryCollection(${collectionName}:${chunk.metadata.headerRouteLevels}:${chunk.metadata.order})`
      // );

      return [chunk, chunksInSection] as [SectionChunkDoc, SectionChunkDoc[]];
    });

    const promiseResults = await Promise.allSettled(promises);
    const values = promiseResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    if (z.array(z.any()).nonempty().safeParse(values).success === false) {
      const firstFailedPromise = promiseResults.find(
        (r) => r.status === 'rejected'
      );

      if (firstFailedPromise?.reason != null) {
        throw new Error('ChromaDB returned no valid chunks due to an error.', {
          cause: firstFailedPromise.reason,
        });
      } else {
        throw new Error(
          'ChromaDB returned no valid chunks due to an unknown error.'
        );
      }
    }

    return values;
  })();

  // This is to avoid reconstructing the same section twice. Although it
  // needs refining (check reconstructSection() TODO comment)
  const seenSectionsIds = new Set();
  let _leftTotalTokens = leftTotalTokens;
  const result: ReconstructedSectionDoc[] = [];

  for (const [chunk, chunksInSection] of sectionChunks) {
    if (_leftTotalTokens <= 0) {
      break;
    }

    if (seenSectionsIds.has(chunk.metadata.sectionId)) {
      continue;
    }

    console.log('Reconstructing section: ', chunk.metadata.headerRoute);
    const reconstructedSection = await reconstructSection({
      prompt,
      chunk,
      chunksInSection,
      maxSectionTokens,
    });

    if (reconstructedSection == null) {
      debugger;
    }

    seenSectionsIds.add(chunk.metadata.sectionId);
    _leftTotalTokens = _leftTotalTokens - reconstructedSection.metadata.tokens;

    result.push(reconstructedSection);
  }

  return result;
}

async function reconstructSection({
  prompt,
  chunk,
  chunksInSection,
  maxSectionTokens,
}: {
  prompt: string;
  chunk: SectionChunkDoc;
  chunksInSection: SectionChunkDoc[];
  maxSectionTokens: number;
}): Promise<ReconstructedSectionDoc> {
  const {headerRoute, headerRouteLevels, order} = chunk.metadata;

  // Sort the chunks based on their order in the document
  const sortedChunks = chunksInSection.sort(
    (a, b) => a.metadata.order - b.metadata.order
  );

  // Initialize reconstruction with the current chunk
  const initialChunkIndex = order - 1;
  const initialChunk = sortedChunks[initialChunkIndex];
  let reconstructedChunks = [initialChunk];
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
      const aboveChunk = sortedChunks[priorIndex];
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
      const belowChunk = sortedChunks[afterIndex];
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

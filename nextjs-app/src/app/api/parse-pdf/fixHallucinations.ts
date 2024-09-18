import {MultipleRegexTextSplitter} from '@/app/common/types/MultipleRegexTextSplitter';
import {SectionChunkDoc} from '@/app/common/types/SectionChunkDoc';
import {SectionNode} from '@/app/common/types/SectionNode';
import {
  TextChunkDoc,
  textChunkDocSchema,
} from '@/app/common/types/TextChunkDoc';
import {
  isBlankString,
  matchCaseBySurroundingWords,
} from '@/app/common/utils/stringUtils';
import {OpenAIEmbeddings} from '@langchain/openai';
import {diffWords} from 'diff';
import {Document} from 'langchain/document';
import {MemoryVectorStore} from 'langchain/vectorstores/memory';
import {LevenshteinDistance} from 'natural';
import {z} from 'zod';
import {writeToTimestampedFile} from '../utils/fileUtils';
import {chunkSectionNodes, chunkString} from './chunking';
import {pdfParseWithPdfReader} from './functions';

export async function fixHallucinationsOnSections({
  sections,
  file,
  columnsNumber,
}: {
  sections: SectionNode[];
  file: File;
  columnsNumber: number;
}): Promise<SectionNode[]> {
  // TODO:
  // - Parse with pdfreader.
  //
  // - Chunk pdfreader output and sections by sentences
  //
  // - Match section text chunk to pdfreader chunk (or maybe chunks
  //   if they aren't the same).

  //    -- Skip table chunks
  //    -- Tools:
  //      `totalOrder` prop segmentation, Levenhstein Distance, Cosine
  //      similarity, Approximate String Matching (natural package)
  //
  // - Reconcile LLM chunk with pdfreader chunk(s) to fix
  //   hallucinations with some difference tolerance.
  //    -- Either ChatGPT4o mini or some way with 'natural' of detecting garbage and strip it
  //
  // - Using 'headerRoutesLevels' on the chunks, group them
  //   and merge them and substitute the Section content.
  //
  // return the fixed sections

  // Chunking sections with a sentence splitter
  const sectionSentenceSplitter = new MultipleRegexTextSplitter({
    keepSeparators: true,
    separators: [/[\r\n]+/, /[\.?!]{1}[)\]}`’”"'»›]*\s+/],
    noMatchSequences: [
      /e\.g\./i,
      /i\.e\./i,
      /f\.e\./i,
      /^\s*\w{1,2}[.:]\s+\w/m,
    ],
  });

  const sectionChunks = await chunkSectionNodes(
    sections,
    sectionSentenceSplitter
  );

  // Chunking layout parsed text (traditionally parsed)
  const layoutExtractedText = await pdfParseWithPdfReader({
    file,
    columnsNumber,
  });

  if (isBlankString(layoutExtractedText)) {
    throw new Error('Layout parser produced an empty file');
  }

  const layoutStringSentenceSplitter = new MultipleRegexTextSplitter({
    keepSeparators: true,
    separators: [
      /^\s*(?=(?:\w{1,2}[.:]|-)[ ]+\w)/m,
      /[\.?!]{1}[)\]}`’”"'»›]*\s+/,
    ],
    noMatchSequences: [/e\.g\./i, /i\.e\./i, /f\.e\./i],
  });

  const layoutChunks = await chunkString({
    text: layoutExtractedText,
    splitter: layoutStringSentenceSplitter,
  });

  // Match section chunk with most probable layoutChunks candidates
  // Updating the reference from when to search from each time, since there
  // may be shifts in the number of lines between the LLM text and the
  // traditionally parsed text.
  const matchedChunks = await (async function () {
    const batchSize = 50;
    const matchSectionChunk = cachedMatchSectionChunk({
      layoutChunks,
      proximityThreshold: 200,
      levenshteinThreshold: 0.3,
    });

    // Divide sectionChunks into batches of batchSize
    const batches = [];
    for (let i = 0; i < sectionChunks.length; i += batchSize) {
      batches.push(sectionChunks.slice(i, i + batchSize));
    }

    // Process each batch in parallel
    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        const batchResult = [];
        // Set lastReferenceTotalOrder to the first section chunk of the batch
        let lastReferenceTotalOrder = batch[0].metadata.totalOrder - 1;

        for (const sectionChunk of batch) {
          console.log('Matching section chunk...', {
            id: sectionChunk.id,
            totalOrder: sectionChunk.metadata.totalOrder,
          });

          // We don't match tables for now, as the layout parser cannot parse
          // them effectively.
          if (sectionChunk.metadata.table) {
            batchResult.push({
              sectionChunk,
              candidates: [],
            });

            continue;
          }

          // TODO: The best candidate is temporarily determined just by taking
          // the first prior candidate. However this may not be the case when
          // in the chunk reconciliation function decides which candidate was
          // the chosen one to reconciliate the LLM chunk. Therefore, the
          // referenceTotalOrder value should come from the reconciliation function.
          lastReferenceTotalOrder =
            batchResult[batchResult.length - 1]?.candidates[0]?.metadata
              .totalOrder ?? lastReferenceTotalOrder + 1;

          const candidates = await matchSectionChunk({
            sectionChunk,
            referenceTotalOrder: lastReferenceTotalOrder,
          });

          batchResult.push({
            sectionChunk,
            candidates,
          });
        }
        return batchResult;
      })
    );

    // Flatten the batch results into a single result array
    return batchResults.flat();
  })();

  // TODO: Remove this on production
  writeToTimestampedFile({
    content: JSON.stringify(
      {
        matchedChunks: matchedChunks.map((match) => {
          return {
            id: match.sectionChunk.id,
            sectionTitle: match.sectionChunk.metadata.headerRoute,
            sectionChunk: match.sectionChunk,
            candidate: match.candidates[0]?.pageContent ?? 'N/A',
          };
        }),
        layoutChunks,
      },
      null,
      2
    ),
    destinationFolderPath: 'tmp/matchedChunks',
    fileExtension: 'json',
    fileName: file.name,
    createFolderIfNotExists: true,
  });

  return;

  // TODO: The reconciliation function fixes LLM's hallucinations, but
  // there's another issue as well: the missing sentences.
  // Sometimes the LLM skips chunks of texts, and those should be added
  // back as well. For now we're only fixing what the LLM outputted,
  // though, creating an incomplete text but hopefully useful enough for
  // now.
  const reconciledChunks = matchedChunks.map((match) => {
    return reconcileSectionChunk({
      sectionChunk,
      candidates,
    });
  });

  // Reconcile texts of the section chunks and merge back into sections
  const fixedSections = mergeChunksIntoSections({
    originalSections: sections,
    newChunks: reconciledChunks,
  });

  // Return the new fixed SectionNodes
  return fixedSections;
}

/**
 * Finds the best matching layout chunks for a given section chunk.
 *
 * This function matches a `sectionChunk` to the most probable counterparts
 * within an array of `layoutChunks`. It is useful for mapping sections of
 * text between the same document but parsed differently.
 *
 * The matching process involves the following steps:
 *
 * 1. **Proximity Filtering**: Filters `layoutChunks` to include only those
 *    within a specified range (`proximityThreshold`) of the
 *    `referenceTotalOrder` in the document's sequence. This optimizes
 *    performance by narrowing down the candidates by document proximity to
 *    the section chunk.
 *
 * 2. **Levenshtein Distance Filtering**: Calculates the inverted
 *    normalized Levenshtein Distance between the `sectionChunk` and each
 *    nearby chunk. Chunks with a similarity score below the
 *    `levenshteinThreshold` are discarded as too dissimilar.
 *    - **Note**: If exact matches are found (score of 1), only those are
 *      returned, ordered by `totalOrder`.
 *
 * 3. **Cosine Similarity Scoring**: For the remaining chunks, computes the
 *    Cosine Similarity score (ranging from 0 to 1) to measure textual
 *    similarity, where 1 indicates an exact match.
 *
 * 4. **Sorting and Selection**: Sorts the chunks by similarity score in
 *    descending order. In case of tied scores, sorts by proximity
 *    (`totalOrder`) to the `sectionChunk`. Returns up to `maxCandidates`
 *    best matches.
 *
 * Finally returns an array the candidates, from most probable to least.
 *
 * @param {SectionChunkDoc} sectionChunk The section chunk to find matches
 *   for within the layout chunks.
 * @param {TextChunkDoc[]} layoutChunks An array of all layout chunks from
 *   the document.
 * @param {number} [maxCandidates=10] The maximum number of candidate
 *   chunks to return.
 * @param {number} [levenshteinThreshold=0.6] The minimum inverted
 *   normalized Levenshtein Distance score required. Chunks with a lower
 *   score are discarded. For example, 0.6 means keeping chunks that share
 *   at least 60% of characters with the `sectionChunk`.
 * @param {number} [referenceTotalOrder=sectionChunk.metadata.totalOrder]
 *   The reference `totalOrder` position to filter chunks based on
 *   proximity. Defaults to the `sectionChunk`'s `totalOrder`, but after
 *   the first match the parameter value should be the `totalOrder` value
 *   of the chunk that was determined to be the best candidate in the
 *   previous pass (with whatever criteria that doesn't concern to this
 *   function).
 * @param {number} [proximityThreshold=100] The range of `totalOrder`
 *   positions (both above and below `referenceTotalOrder`) to consider
 *   when filtering chunks. I.e. a value of 30 means considering 30 chunks
 *   upwards and downwards from `referenceTotalOrder`.
 * @returns {Promise<TextChunkDoc[]>} A Promise that resolves to a new
 *   array of matching layout chunks, sorted by similarity score and
 *   proximity.
 */
export function cachedMatchSectionChunk({
  layoutChunks,
  maxCandidates = 10,
  levenshteinThreshold = 0.6,
  proximityThreshold = 100,
}: {
  layoutChunks: TextChunkDoc[];
  maxCandidates?: number;
  levenshteinThreshold?: number;
  proximityThreshold?: number;
}): ({
  sectionChunk,
  referenceTotalOrder,
}: {
  sectionChunk: SectionChunkDoc;
  referenceTotalOrder?: number;
}) => Promise<TextChunkDoc[]> {
  z.array(textChunkDocSchema)
    .nonempty({message: 'Layout chunks must not be empty'})
    .parse(layoutChunks);
  z.number().min(1).parse(maxCandidates);

  type NormalizedTextChunkDoc = Document<
    TextChunkDoc['metadata'] & {
      originalPageContent: string;
    }
  >;

  const normalizedLayoutChunks: NormalizedTextChunkDoc[] = layoutChunks.map(
    (c) => ({
      ...c,
      pageContent: c.pageContent
        .split(/[\s\n]+/)
        .map((s) => s.trim())
        .join(' '),
      metadata: {
        ...c.metadata,
        originalPageContent: c.pageContent,
      },
    })
  );

  return async function ({
    sectionChunk,
    referenceTotalOrder = sectionChunk.metadata.totalOrder,
  }) {
    if (isBlankString(sectionChunk.pageContent)) {
      console.warn(
        'matchSectionChunk: Empty section chunk detecting, no candidates returned.'
      );
      return [];
    }

    // Filter by proximity to the document ordering. We know that what we
    // want mustn't be very far away. This way we save a ton of computations.
    const normalizedNearbyChunks: NormalizedTextChunkDoc[] =
      normalizedLayoutChunks.filter(
        (c) =>
          c.metadata.totalOrder >= referenceTotalOrder - proximityThreshold &&
          c.metadata.totalOrder <= referenceTotalOrder + proximityThreshold
      );

    if (normalizedNearbyChunks.length === 0) {
      console.warn(
        'matchSectionChunk: No nearby chunks detected, no candidates returned.'
      );

      return [];
    }

    const normalizedSectionChunk: SectionChunkDoc = {
      ...sectionChunk,
      pageContent: sectionChunk.pageContent
        .split(/[\s\n]+/)
        .map((s) => s.trim())
        .join(' '),
    };

    const levenshteinResults = await getNormalizedInvertedLevenshteinDistance(
      normalizedSectionChunk,
      normalizedNearbyChunks
    );

    // Pre-filter out chunks where Inverted Normalized Levenshtein Distance is 1, as we found the exact matches
    const exactMatches = levenshteinResults.filter((r) => r.score === 1);

    if (exactMatches.length > 0) {
      return orderChunksByScoreAndTotalOrder(exactMatches);
    }

    // If no exact matches found, filter those that deviate too much. As we
    // determine these are not the chunks we're looking for because they have
    // too many character differences. This may happen when two chunks talk
    // about the same thing but using different words. We assume the LLM will
    // hallucinate but not this much, that's why we filter.
    const filteredChunks = levenshteinResults.filter(
      (r) => r.score >= levenshteinThreshold
    );

    // If we have one candidate we shouldn't waste time trying to compute cosine similarity score
    if (filteredChunks.length === 1) {
      return orderChunksByScoreAndTotalOrder(filteredChunks);
    }

    const similarityResults = await getSimilarityScores(
      normalizedSectionChunk,
      filteredChunks.map((r) => r.chunk)
    );

    // Sort candidates by score in descending order (higher score is better)
    return orderChunksByScoreAndTotalOrder(similarityResults);

    // HELPER FUNCTIONS

    function orderChunksByScoreAndTotalOrder(
      matches: {chunk: NormalizedTextChunkDoc; score: number}[]
    ) {
      const groups = Map.groupBy(matches, (m) => m.score);

      const orderedGroups = Array.from(groups.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([score, chunks]) => {
          const sectionTotalOrder = sectionChunk.metadata.totalOrder;

          return chunks.sort((a, b) => {
            const aDistance = Math.abs(
              a.chunk.metadata.totalOrder - sectionTotalOrder
            );

            const bDistance = Math.abs(
              b.chunk.metadata.totalOrder - sectionTotalOrder
            );

            return aDistance - bDistance;
          });
        });

      return restoreChunks(orderedGroups.flat().slice(0, maxCandidates));
    }

    function restoreChunks(
      matches: {chunk: NormalizedTextChunkDoc}[]
    ): TextChunkDoc[] {
      return matches.map((match) => {
        const result = {
          ...structuredClone(match.chunk),
          pageContent: match.chunk.metadata.originalPageContent,
        };

        // @ts-expect-error It complaints the prop is not optional... But we aren't reusing the type anymore so it's fine.
        delete result.metadata.originalPageContent;

        return result;
      });
    }
  };
}

async function getSimilarityScores<T extends Document, K extends Document>(
  queryDoc: T,
  candidates: K[],
  decimalPlaces = 4
): Promise<{chunk: K; score: number}[]> {
  const vectorStore = new MemoryVectorStore(
    new OpenAIEmbeddings({
      apiKey:
        process.env.NODE_ENV === 'test'
          ? process.env.VITE_OPENAI_API_KEY
          : process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
      dimensions: 1536,
    })
  );

  await vectorStore.addDocuments(candidates);

  const similarityResults = await vectorStore.similaritySearchWithScore(
    queryDoc.pageContent,
    vectorStore.memoryVectors.length
  );

  return similarityResults.map(([chunk, score]) => ({
    chunk: chunk as K,
    score: Number(score.toFixed(decimalPlaces)),
  }));
}

/**
 * Computes the normalized inverted Levenshtein distance between each
 * candidate and the query document. The normalized distance is the
 * Levenshtein distance divided by the maximum length of the two strings.
 * The inverted distance is 1 - normalized distance, so that the closest
 * match has a score of 1. We need to invert it since we are using this
 * metric to compare it to other ones and all metrics must be equally
 * oriented, the lower the worse (more different the string).
 *
 * @param queryDoc The document to query.
 * @param candidates The list of candidates to compare against.
 * @returns A list of objects with keys `chunk` and `score`, where
 *   `chunk` is the candidate and `score` is the normalized inverted
 *   Levenshtein distance.
 */
async function getNormalizedInvertedLevenshteinDistance<
  T extends Document,
  K extends Document,
>(
  queryDoc: T,
  candidates: K[],
  decimalPlaces = 4
): Promise<{chunk: K; score: number}[]> {
  return Promise.all(
    candidates.map(async (candidate) => {
      const lDistance = LevenshteinDistance(
        queryDoc.pageContent,
        candidate.pageContent,
        {
          insertion_cost: 1,
          deletion_cost: 1,
          substitution_cost: 1,
        }
      );

      const maxLength = Math.max(
        queryDoc.pageContent.length,
        candidate.pageContent.length
      );

      const normalizedDistance = lDistance / maxLength;

      return {
        chunk: candidate,
        score: Number((1 - normalizedDistance).toFixed(decimalPlaces)),
      };
    })
  );
}

/**
 * Reconciles two texts by comparing and merging their differences.
 *
 * This function takes two texts as input, normalizes the first text, generates a diff JSON using jsdiff,
 * and then iterates over the diff to merge the differences between the two texts.
 * It handles cases where the second text has extra words, missing words, or equal words.
 * It tries to preserve the structure and case of the second text with the words of the first text.
 *
 * @param {string} firstText - The original text to be reconciled.
 * @param {string} secondText - The LLM text to be reconciled with the original text.
 * @return {string} The reconciled text.
 */
export function reconcileTexts(firstText: string, secondText: string): string {
  // Normalize the first text for easier diffing
  const normalizedFirstText = firstText
    .split(/[\s\n]+/)
    .map((s) => s.trim())
    .join(' ');

  // Generate the diff JSON using jsdiff
  const diff = diffWords(normalizedFirstText, secondText, {
    ignoreCase: true,
  });

  const chunks: string[] = [];
  let firstTextIndex = 0;

  diff.forEach((part) => {
    if (part.added) {
      // LLM has an extra piece of text, we need to remove it. Don't add
      // this text to the result array, as we need to remove them
    } else if (part.removed) {
      // Traditional text has a piece of text that LLM is missing.
      // Insert the missing words but handle the case based on the context
      const missingWords = part.value
        .split(/\s+/)
        .filter((w) => !isBlankString(w));

      missingWords.forEach((word) => {
        let newWord: string = '';

        if (chunks.length > 0) {
          const lastChunkSplit = chunks[chunks.length - 1]
            .split(/[\s\n]+/)
            .filter((w) => !isBlankString(w));
          const lastWord = lastChunkSplit[lastChunkSplit.length - 1];
          const nextWord = secondText
            .slice(firstTextIndex)
            .split(/\s+/)
            .filter((w) => !isBlankString(w))[0];

          newWord = matchCaseBySurroundingWords(word, lastWord, nextWord);
        } else {
          newWord = word;
        }

        chunks.push(newWord);
      });
    } else {
      // Words are equal
      chunks.push(part.value); // Directly use the part value from the LLM text
    }

    firstTextIndex += part.value.length;
  });

  // The final step is to join the words together with a space and remove
  // any double spaces. We only add a space between words, not other
  // characters.
  const finalStr = chunks.reduce((prev, curr) => {
    const shouldAddSpace = (() => {
      // Combine the strings with a special delimiter to aid in regex
      const combined = `${prev.trim()}#--#${curr.trim()}`;

      const noSpacePatterns = [
        /[(\[{`‘“"'«‹]#--#/, // no space when a parenthesis or quote opens (eg. '["a')
        /\d#--#\d/, // no space between digits (eg. 06)
        /\w#--#\W/i, // no space between a word char and a non word char (eg. 'a.')
        /#--#[)\]}`’”"'»›]/, // curr starts with a closing parenthesis or quote (eg. '[a"'),
        /#--#…/, // No space before an ellipsis (e.g., 'word…'),
      ];

      // Check if any pattern matches the combined string
      for (const pattern of noSpacePatterns) {
        if (pattern.test(combined)) {
          return false; // No space should be added
        }
      }

      // Otherwise, return true (space needed)
      return true;
    })();

    const newString = prev + (shouldAddSpace ? ' ' : '') + curr;

    return newString.replaceAll(/\s{2,}/g, ' ').trim();
  }, '');

  return finalStr;
}

import {SectionChunkDoc} from '@/app/common/types/SectionChunkDoc';
import {SectionNode} from '@/app/common/types/SectionNode';
import {
  TextChunkDoc,
  textChunkDocSchema,
} from '@/app/common/types/TextChunkDoc';
import {isBlankString} from '@/app/common/utils/stringUtils';
import {OpenAIEmbeddings} from '@langchain/openai';
import {Document} from 'langchain/document';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {MemoryVectorStore} from 'langchain/vectorstores/memory';
import {LevenshteinDistance} from 'natural';
import {z} from 'zod';
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
  //      totalOrder prop segmentation, Levenhstein Distance, Cosine
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
  const sentenceSplitter = new RecursiveCharacterTextSplitter({
    // This chunk size may seem small, but it's so we ensure we split
    // headers (in the text parsed document) that appear alongside
    // sentences. Because they are very small and we need to ensure
    // we split by all the indicated separators without leaving any.
    chunkSize: 1,
    chunkOverlap: 0,
    separators: ['\n\n', '. ', '? ', '! ', '.\n', '?\n', '!\n', ':\n'],
    keepSeparator: false,
  });

  const sectionChunks = await chunkSectionNodes(sections, sentenceSplitter);

  // Chunking layout parsed text (traditionally parsed)
  const layoutExtractedText = await pdfParseWithPdfReader({
    file,
    columnsNumber,
  });

  if (isBlankString(layoutExtractedText)) {
    throw new Error('Layout parser produced an empty file');
  }

  const layoutChunks = await chunkString({
    text: layoutExtractedText,
    splitter: sentenceSplitter,
  });

  // Match section chunk with most probable layoutChunks candidates
  const matchedChunks = sectionChunks.map((sectionChunk) => {
    return {
      sectionChunk,
      candidates: matchSectionChunk({
        sectionChunk,
        layoutChunks,
      }),
    };
  });

  const fixedChunks = matchedChunks.map((matchedChunk) => {
    return reconcileChunk({
      sectionChunk,
      candidates,
    });
  });

  // Reconcile texts of the section chunks and merge back into sections
  const fixedSections = mergeChunksIntoSections({
    originalSections: sections,
    newChunks: fixedChunks,
  });

  // Return the new fixed SectionNodes
  return fixedSections;
}

/**
 * Given a section chunk and an array of layout parsed chunks, find the
 * most probable matches of the section chunk in the layout chunks. It does
 * this by filtering the layout chunks by choosing the closest ones in
 * document order to the section chunk, and then computing the Cosine
 * similarity and Levenshtein distance between the section chunk and the
 * filtered layout chunks. The results are then sorted by the weighted
 * score of both metrics in a scale of 0 to 1 where 1 means total match and
 * 0 means is the theoretically most different string in the world (so
 * totally not a match).
 *
 * NOTE: If there are exact matches by the Levenshtein Distance metric,
 * it'll only return those, ordered by totalOrder.
 *
 * @param {SectionChunkDoc} sectionChunk - The section chunk to find a
 *   match for in the layout chunks.
 * @param {TextChunkDoc[]} layoutChunks - The array of layout chunks to
 *   search for a match in.
 * @param {number} [maxCandidates=10] - The maximum number of candidates to
 *   return in the sorted list.
 *
 * @returns {Promise<{chunk: TextChunkDoc; score: number}[]>} - A Promise
 *   that resolves to an ordered by score array of objects with keys
 *   `chunk` and `score`. The `chunk` property is the layout chunk that was
 *   matched, and the `score` property is the weighted score of the match
 *   where 1 means a total match and 0 means is not a match at all. The
 *   results are ordered first by score and then by totalOrder since in
 *   case of a tie we sort by document proximity to the section chunk.
 */
export async function matchSectionChunk({
  sectionChunk,
  layoutChunks,
  maxCandidates = 10,
}: {
  sectionChunk: SectionChunkDoc;
  layoutChunks: TextChunkDoc[];
  maxCandidates?: number;
}): Promise<{chunk: TextChunkDoc; score: number}[]> {
  z.array(textChunkDocSchema)
    .nonempty({message: 'Layout chunks must not be empty'})
    .parse(layoutChunks);
  z.number().min(1).parse(maxCandidates);

  // Filter by proximity to the document ordering. We know that what we
  // want mustn't be very far away. This way we save a ton of computations.
  const nearbyChunks: TextChunkDoc[] = layoutChunks.filter(
    (c) =>
      c.metadata.totalOrder >= sectionChunk.metadata.totalOrder - 30 &&
      c.metadata.totalOrder <= sectionChunk.metadata.totalOrder + 30
  );

  const normalizedNearbyChunks = nearbyChunks.map((c) => ({
    ...c,
    pageContent: c.pageContent
      .split(/[\s\n]+/)
      .map((s) => s.trim())
      .join(' '),
  }));

  const normalizedSectionChunk = {
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

  const similarityResults = await getSimilarityScores(
    normalizedSectionChunk,
    normalizedNearbyChunks
  );

  const weightedResults = similarityResults.map((s) => {
    const matchedLevenshteinChunk = levenshteinResults.find(
      (l) => l.chunk.id === s.chunk.id
    );

    if (
      !matchedLevenshteinChunk ||
      matchedLevenshteinChunk.chunk.id == null ||
      isBlankString(matchedLevenshteinChunk.chunk.id)
    ) {
      throw new Error(
        'No matched similarity chunk found. This should not happen.'
      );
    }

    const invertedLDistance = matchedLevenshteinChunk.score;
    const similarityScore = s.score;

    // TODO: Evaluate the weights, since now we're evaluating 50/50 between
    // character dissimilarity and semantics.
    return {
      ...s,
      score: invertedLDistance * similarityScore,
    };
  });

  // Sort candidates by score in descending order (higher score is better)
  return orderChunksByScoreAndTotalOrder(weightedResults);

  function orderChunksByScoreAndTotalOrder(
    matches: {chunk: TextChunkDoc; score: number}[]
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

    return orderedGroups.flat().slice(0, maxCandidates);
  }
}

async function getSimilarityScores<T extends Document, K extends Document>(
  queryDoc: T,
  candidates: K[]
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
    score,
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
>(queryDoc: T, candidates: K[]): Promise<{chunk: K; score: number}[]> {
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

      return {chunk: candidate, score: 1 - normalizedDistance};
    })
  );
}

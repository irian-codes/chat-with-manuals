import {SectionChunkDoc} from '@/app/common/types/SectionChunkDoc';
import {SectionNode} from '@/app/common/types/SectionNode';
import {TextChunkDoc} from '@/app/common/types/TextChunkDoc';
import {isBlankString} from '@/app/common/utils/stringUtils';
import {OpenAIEmbeddings} from '@langchain/openai';
import {Document} from 'langchain/document';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {MemoryVectorStore} from 'langchain/vectorstores/memory';
import {LevenshteinDistance} from 'natural';
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

async function matchSectionChunk({
  sectionChunk,
  layoutChunks,
  maxCandidates = 10,
}: {
  sectionChunk: SectionChunkDoc;
  layoutChunks: TextChunkDoc[];
  maxCandidates?: number;
}): Promise<{chunk: TextChunkDoc; score: number}[]> {
  // Filter by proximity to the document ordering. We know that what we
  // want mustn't be very far away. This way we save a ton of computations.
  const nearbyChunks: TextChunkDoc[] = layoutChunks
    .filter(
      (c) =>
        c.metadata.totalOrder >= sectionChunk.metadata.totalOrder - 30 &&
        c.metadata.totalOrder <= sectionChunk.metadata.totalOrder + 30
    )
    .map(
      (c) =>
        new Document({
          ...c,
          pageContent: c.pageContent
            .split(/[\s\n]+/)
            .map((s) => s.trim())
            .join(' '),
        })
    );

  const normalizedSectionChunk = new Document({
    ...sectionChunk,
    pageContent: sectionChunk.pageContent
      .split(/[\s\n]+/)
      .map((s) => s.trim())
      .join(' '),
  });

  const similarityResults = await getSimilarityScores(
    normalizedSectionChunk,
    nearbyChunks
  );

  const levenshteinResults = await getNormalizedLevenshteinDistance(
    normalizedSectionChunk,
    nearbyChunks
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

    // We need to invert so both metrics are equally oriented, the lower
    // the worse (more different the string).
    const invertedDistance = 1 - matchedLevenshteinChunk.score;
    const similarityScore = s.score;

    // TODO: Evaluate the weights, since now we're evaluating 50/50 between
    // character dissimilarity and semantics.
    return {
      ...s,
      score: invertedDistance * similarityScore,
    };
  });

  // Sort candidates by score in descending order (higher score is better)
  return weightedResults
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates);
}

async function getSimilarityScores<T extends Document, K extends Document>(
  queryDoc: T,
  candidates: K[]
): Promise<{chunk: K; score: number}[]> {
  const vectorStore = new MemoryVectorStore(
    new OpenAIEmbeddings({
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

async function getNormalizedLevenshteinDistance<
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

      return {chunk: candidate, score: normalizedDistance};
    })
  );
}

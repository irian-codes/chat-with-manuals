import {env} from '@/env';
import {chunkSectionNodes, chunkString} from '@/server/document/chunking';
import {MultipleRegexTextSplitter} from '@/server/document/MultipleRegexTextSplitter';
import {pdfParseWithPdfReader} from '@/server/document/parsing';
import {
  allowedAbsoluteDirPaths,
  getFile,
  writeToTimestampedFile,
} from '@/server/utils/fileStorage';
import {type ReconciledChunkDoc} from '@/types/ReconciledChunkDoc';
import {type SectionChunkDoc} from '@/types/SectionChunkDoc';
import {type SectionNode} from '@/types/SectionNode';
import {type TextChunkDoc, textChunkDocSchema} from '@/types/TextChunkDoc';
import {isStringEmpty} from '@/utils/strings';
import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI, OpenAIEmbeddings} from '@langchain/openai';
import {type Document} from 'langchain/document';
import {MemoryVectorStore} from 'langchain/vectorstores/memory';
import {LevenshteinDistance} from 'natural';
import {z} from 'zod';

export async function fixHallucinationsOnSections({
  sections,
  filePath,
  columnsNumber,
}: {
  sections: SectionNode[];
  filePath: string;
  columnsNumber: number;
}): Promise<SectionNode[]> {
  const file = await getFile({
    filePath,
    mimeType: 'application/pdf',
  });

  console.log('Chunk section nodes for reconciliation...');
  console.time('chunkSectionNodes');
  const sectionChunks = await chunkSectionNodes({
    sectionsJson: sections,
    splitter: new MultipleRegexTextSplitter({
      keepSeparators: true,
      separators: [/[\r\n]+/, /[\.?!]{1}[)\]}`’”"'»›]*\s+/],
      noMatchSequences: [/e\.g\./i, /i\.e\./i, /f\.e\./i],
    }),
  });
  console.timeEnd('chunkSectionNodes');

  console.log('Parsing with layout parser...');
  console.time('pdfParseWithPdfReader');
  const layoutExtractedText = await pdfParseWithPdfReader({
    file,
    columnsNumber,
  });
  console.timeEnd('pdfParseWithPdfReader');

  if (isStringEmpty(layoutExtractedText)) {
    throw new Error('Layout parser produced an empty file');
  }

  if (env.NODE_ENV === 'development') {
    await writeToTimestampedFile({
      content: layoutExtractedText,
      destinationFolderPath:
        allowedAbsoluteDirPaths.publicParsingResultsPDFParser,
      fileExtension: 'txt',
      fileName: file.name,
    });
  }

  console.log('Chunk layout text for reconciliation...');
  console.time('chunkString');
  const layoutChunks = await chunkString({
    text: layoutExtractedText,
    splitter: new MultipleRegexTextSplitter({
      keepSeparators: true,
      separators: [
        // Lists
        /^\s*(?=(?:\w{1,2}[.:)]|-)[ ]+\w)/m,
        // Sentence terminators
        /[\.?!]{1}[)\]}`’”"'»›]*\s+/,
        // An enumeration starts
        /\w{3,}:[ ]{0,1}[\n\r]/,
        // Obvious titles
        /[\n\r][A-Z0-9 ]+[\n\r]/,
      ],
      noMatchSequences: [/e\.g\./i, /i\.e\./i, /f\.e\./i],
    }),
  });
  console.timeEnd('chunkString');

  // Match section chunk with most probable layoutChunks candidates
  // Updating the reference from when to search from each time, since there
  // may be shifts in the number of lines between the LLM text and the
  // traditionally parsed text.
  console.log('Start chunk matching...');
  console.time('getMatchedChunks');
  const matchedChunks = await getMatchedChunks();
  console.timeEnd('getMatchedChunks');

  if (env.NODE_ENV === 'development') {
    await writeToTimestampedFile({
      content: JSON.stringify(
        {
          matchedChunks: matchedChunks.map((match) => {
            return {
              id: match.sectionChunk.id,
              sectionTitle: match.sectionChunk.metadata.headerRoute,
              sectionChunk: match.sectionChunk,
              candidate: match.candidates[0] ?? 'N/A',
            };
          }),
          layoutChunks,
        },
        null,
        2
      ),
      destinationFolderPath:
        allowedAbsoluteDirPaths.publicReconciliationMatchedChunks,
      fileExtension: 'json',
      fileName: file.name,
    });
  }

  // TODO: The reconciliation function fixes LLM's hallucinations, but
  // there's another issue as well: the missing sentences.
  // Sometimes the LLM skips chunks of texts, and those should be added
  // back as well. For now we're only fixing what the LLM outputted,
  // though, creating an incomplete text but hopefully useful enough for
  // now.
  console.log('Start chunk reconciliation...');
  console.time('tryReconcileSectionChunk');
  const reconciledChunksResults = (
    await Promise.allSettled(
      matchedChunks.map((match) => {
        return tryReconcileSectionChunk({
          sectionChunk: match.sectionChunk,
          candidates: match.candidates,
        });
      })
    )
  )
    .filter((p) => p.status === 'fulfilled')
    .map((r) => r.value);
  console.timeEnd('tryReconcileSectionChunk');

  if (env.NODE_ENV === 'development') {
    await writeToTimestampedFile({
      content: JSON.stringify(
        {
          reconciledChunks: reconciledChunksResults.map((res) => {
            return {
              reconciliationStrategy: `Reconciliation result: ${res.couldReconcile}:${res.reconciliationStrategy}`,
              data: {
                id: res.data.sectionChunk.id,
                sectionChunkOriginal: res.data.sectionChunk.pageContent,
                reconciledContent: res.couldReconcile
                  ? res.data.reconciledChunk.pageContent
                  : 'N/A',
                sectionChunk: res.data.sectionChunk,
                chosenCandidate: res.data.chosenCandidate,
              },
            };
          }),
        },
        null,
        2
      ),
      destinationFolderPath:
        allowedAbsoluteDirPaths.publicReconciliationReconciledChunks,
      fileExtension: 'json',
      fileName: file.name,
    });
  }

  // Reconcile texts of the section chunks and merge back into sections
  const fixedSections = reconcileSections({
    originalSections: sections,
    reconciledChunks: reconciledChunksResults.map(
      (r) => r.data.reconciledChunk
    ),
  });

  if (env.NODE_ENV === 'development') {
    await writeToTimestampedFile({
      content: JSON.stringify(
        {
          fixedSections: Object.fromEntries(
            Map.groupBy(
              [
                ...flattenSectionsTree(fixedSections, 'fixed'),
                ...flattenSectionsTree(sections, 'original-llm'),
              ],
              (s) => s.headerRouteLevels
            )
          ),
        },
        null,
        2
      ),
      destinationFolderPath:
        allowedAbsoluteDirPaths.publicReconciliationReconciledSections,
      fileExtension: 'json',
      fileName: file.name,
    });
  }

  // Return the new fixed SectionNodes
  return fixedSections;

  // HELPER FUNCTIONS

  async function getMatchedChunks() {
    // We need batches because otherwise we cannot track
    // `lastReferenceTotalOrder` and that's important to not accumulate
    // errors.
    const batchSize = 50;
    const matchSectionChunk = cachedMatchSectionChunk({
      layoutChunks,
      // We will consider any chunks in the most proximal 50% of the document at most.
      proximityWindow: Math.floor(
        Math.max(sectionChunks.length, layoutChunks.length) * 0.5
      ),
      levenshteinThreshold: 0.3,
      similarityThreshold: 0.75,
    });

    // Divide sectionChunks into batches of batchSize
    const batches: SectionChunkDoc[][] = [];
    for (let i = 0; i < sectionChunks.length; i += batchSize) {
      batches.push(sectionChunks.slice(i, i + batchSize));
    }

    // Process each batch in parallel
    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        const batchResult: {
          sectionChunk: SectionChunkDoc;
          candidates: {candidate: TextChunkDoc; score: number}[];
        }[] = [];
        // Set `lastReferenceTotalOrder` to the first section chunk of the batch
        let lastReferenceTotalOrder = batch[0].metadata.totalOrder - 1;

        for (const sectionChunk of batch) {
          // console.log('Matching section chunk...', {
          //   id: sectionChunk.id,
          //   totalOrder: sectionChunk.metadata.totalOrder,
          // });

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
            batchResult[batchResult.length - 1]?.candidates[0]?.candidate
              .metadata.totalOrder ?? lastReferenceTotalOrder + 1;

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
  }

  function flattenSectionsTree(
    sections: SectionNode[],
    source: 'original-llm' | 'original-layout-parsed' | 'fixed'
  ) {
    const flattened: (Omit<SectionNode, 'tables'> & {
      tables: Record<number, string>;
      source: typeof source;
    })[] = [];

    sections.forEach((section) => {
      flattened.push({
        source,
        ...section,
        subsections: [],
        // So we can serialize it
        tables: Object.fromEntries(section.tables),
      });

      flattened.push(...flattenSectionsTree(section.subsections, source));
    });

    return flattened;
  }
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
 *    within a specified range (`proximityWindow`) of the
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
 * @param {number} [similarityThreshold=0.75] The minimum Similarity score
 *   required. Chunks with a lower score are discarded. For example, 0.7
 *   means keeping chunks that are rated at least with a 0.7 or higher in
 *   the Similarity score against `sectionChunk`.
 * @param {number} [referenceTotalOrder=sectionChunk.metadata.totalOrder]
 *   The reference `totalOrder` position to filter chunks based on
 *   proximity. Defaults to the `sectionChunk`'s `totalOrder`, but after
 *   the first match the parameter value should be the `totalOrder` value
 *   of the chunk that was determined to be the best candidate in the
 *   previous pass (with whatever criteria that doesn't concern to this
 *   function).
 * @param {number} [proximityWindow=100] The range of `totalOrder`
 *   positions (both above and below `referenceTotalOrder`, so a search
 *   window) to consider when filtering chunks. I.e. a value of 100 means
 *   considering 50 chunks upwards and 50 more chunks downwards from
 *   `referenceTotalOrder`.
 * @returns {Promise<TextChunkDoc[]>} A Promise that resolves to a new
 *   array of matching layout chunks, sorted by similarity score and
 *   proximity.
 */
export function cachedMatchSectionChunk({
  layoutChunks,
  maxCandidates = 10,
  levenshteinThreshold = 0.6,
  similarityThreshold = 0.75,
  proximityWindow = 200,
}: {
  layoutChunks: TextChunkDoc[];
  maxCandidates?: number;
  levenshteinThreshold?: number;
  similarityThreshold?: number;
  proximityWindow?: number;
}): ({
  sectionChunk,
  referenceTotalOrder,
}: {
  sectionChunk: SectionChunkDoc;
  referenceTotalOrder?: number;
}) => Promise<{candidate: TextChunkDoc; score: number}[]> {
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
      pageContent: c.pageContent.trim().replaceAll(/\s+/g, ' '),
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
    if (isStringEmpty(sectionChunk.pageContent)) {
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
          c.metadata.totalOrder >=
            referenceTotalOrder - Math.floor(proximityWindow / 2) &&
          c.metadata.totalOrder <=
            referenceTotalOrder + Math.floor(proximityWindow / 2)
      );

    if (normalizedNearbyChunks.length === 0) {
      console.warn(
        'matchSectionChunk: No nearby chunks detected, no candidates returned.'
      );

      return [];
    }

    const normalizedSectionChunk: SectionChunkDoc = {
      ...sectionChunk,
      pageContent: sectionChunk.pageContent.trim().replaceAll(/\s+/g, ' '),
    };

    const levenshteinResults = getNormalizedInvertedLevenshteinDistance(
      normalizedSectionChunk,
      normalizedNearbyChunks
    );

    // Pre-filter out chunks where Inverted Normalized Levenshtein Distance
    // is 1, as we found the exact matches and we want to return only
    // those.
    const exactMatches = levenshteinResults.filter((r) => r.score === 1);

    if (exactMatches.length > 0) {
      return orderChunksByScoreAndTotalOrder(exactMatches);
    }

    // If no exact matches found, filter those that deviate too much. As we
    // determine these are not the chunks we're looking for because they
    // have too many character differences. A false negative may happen
    // when two chunks talk about the same thing but using different words.
    // But we assume the LLM will hallucinate but not very much, that's why
    // we filter.
    let filteredChunks = levenshteinResults.filter(
      (r) => r.score >= levenshteinThreshold
    );

    // If we have no candidates left return early.
    if (filteredChunks.length === 0) {
      return [];
    }

    const similarityResults = await getSimilarityScores(
      normalizedSectionChunk,
      filteredChunks.map((r) => r.chunk)
    );

    filteredChunks = similarityResults.filter(
      (r) => r.score >= similarityThreshold
    );

    // Sort candidates by score in descending order (higher score is better)
    return orderChunksByScoreAndTotalOrder(filteredChunks);

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
      matches: {chunk: NormalizedTextChunkDoc; score: number}[]
    ): {candidate: TextChunkDoc; score: number}[] {
      return matches.map((match) => {
        const result = {
          candidate: {
            ...structuredClone(match.chunk),
            pageContent: match.chunk.metadata.originalPageContent,
          },
          score: match.score,
        };

        // @ts-expect-error It complaints the prop is not optional... But
        // we aren't reusing the type anymore so it's fine.
        delete result.candidate.metadata.originalPageContent;

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
      apiKey: env.OPENAI_API_KEY,
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
 * @returns A list of objects with keys `chunk` and `score`, where `chunk`
 *   is the candidate and `score` is the normalized inverted Levenshtein
 *   distance.
 */
function getNormalizedInvertedLevenshteinDistance<
  T extends Document,
  K extends Document,
>(
  queryDoc: T,
  candidates: K[],
  decimalPlaces = 4
): {chunk: K; score: number}[] {
  const results: {chunk: K; score: number}[] = [];

  for (const candidate of candidates) {
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

    results.push({
      chunk: candidate,
      score: Number((1 - normalizedDistance).toFixed(decimalPlaces)),
    });
  }

  return results;
}

async function tryReconcileSectionChunk({
  sectionChunk,
  candidates,
}: {
  sectionChunk: SectionChunkDoc;
  candidates: {candidate: TextChunkDoc; score: number}[];
}): Promise<{
  couldReconcile: boolean;
  reconciliationStrategy:
    | 'llm'
    | 'same-text'
    | 'is-table'
    | 'empty-section'
    | 'empty-candidates'
    | 'error';
  data: {
    sectionChunk: SectionChunkDoc;
    chosenCandidate: {candidate: TextChunkDoc; score: number} | null;
    reconciledChunk: ReconciledChunkDoc | SectionChunkDoc;
  };
}> {
  if (sectionChunk.metadata.table) {
    return {
      couldReconcile: false,
      reconciliationStrategy: 'is-table',
      data: {
        sectionChunk,
        chosenCandidate: null,
        reconciledChunk: structuredClone(sectionChunk),
      },
    };
  }

  if (isStringEmpty(sectionChunk.pageContent)) {
    return {
      couldReconcile: false,
      reconciliationStrategy: 'empty-section',
      data: {
        sectionChunk,
        chosenCandidate: null,
        reconciledChunk: structuredClone(sectionChunk),
      },
    };
  }

  // TODO: Very simple candidate choosing criteria, maybe this could be
  // improved if we gain something.
  const candidate = candidates[0];

  if (candidates.length === 0 || candidate == null) {
    return {
      couldReconcile: false,
      reconciliationStrategy: 'empty-candidates',
      data: {
        sectionChunk,
        chosenCandidate: null,
        reconciledChunk: structuredClone(sectionChunk),
      },
    };
  }

  // TODO: This is not really the best way to skip LLM calls. I should
  // fully normalize the strings because that also gets rid of extra
  // newlines, quotes and other character that don't add meaning to texts
  // (they aren't words) which is what we want to reconcile. However, this
  // has an issue, and its that normalization with RegExp is very CPU
  // expensive and slows down the process significantly. Furthermore,
  // normalization is needed for chunk matching as well, so we would be
  // duplicating expensive work and that's a no no.
  //
  // POSSIBLE SOLUTIONS I SEE:
  // 1. Create a StringNormalizer class (or use a library) that caches and
  //    acts as a tool to fast normalize text when needed.
  // 2. Use JSDiff instead of normalizing and then make all the checks
  //    needed to ensure that to proceed with LLM normalization the
  //    differences happen in the content, not the format.
  // 3. Don't optimize for now as its not that expensive nor slow to call
  //    the LLM more than needed (I'd need to run tests to know this for
  //    sure though).
  if (
    candidate.score === 1 ||
    sectionChunk.pageContent.trim().toLowerCase().replaceAll(/\s+/g, ' ') ===
      candidate.candidate.pageContent
        .trim()
        .toLowerCase()
        .replaceAll(/\s+/g, ' ')
  ) {
    const sectionChunkClone = structuredClone(sectionChunk);

    return {
      couldReconcile: true,
      reconciliationStrategy: 'same-text',
      data: {
        sectionChunk,
        chosenCandidate: candidate,
        reconciledChunk: {
          ...sectionChunkClone,
          metadata: {
            ...sectionChunkClone.metadata,
            reconciled: true,
          },
        },
      },
    };
  }

  // LLM Reconciliation strategy

  // TODO: This strategy is not reliable. We shouldn't be using an LLM to
  // fix hallucinations, we should be using a tool that is able to behave
  // with 100% consistency, like code. Because there are cases where the
  // LLM will introduce new hallucinations besides fixing the existing
  // ones. However, this doesn't mean this approach is entirely useless, if
  // we fix more hallucinations than we create we are still improving the
  // document, on average. It's true that there's the potential of fixing
  // irrelevant text and introducing hallucinations with a way worse impact,
  // but that's the risk we take for now.
  const chat = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
    apiKey: env.OPENAI_API_KEY,
  });

  const systemMessage = new SystemMessage(
    "You're an AI agent tasked with fixing hallucinations of text fragments from candidate fragments."
  );

  const promptTemplate = `Given the following section fragments from a document:

Fragment A: {sectionChunk}
      
Fragment B: {candidate}
      
**Task:**
      
- Correct any errors, typos, or hallucinations in **Fragment A** by referencing **Fragment B**.
- **Do not** add any new sentences, phrases, or information from **Fragment B** that are not already present in **Fragment A**.
- **Do not** include any labels, headings, or additional text in your answer.
- Preserve the structure, layout, and content of **Fragment A** as closely as possible.
- Make only the minimal necessary changes to correct errors in **Fragment A**.
- Provide **only** the corrected version of **Fragment A** without adding extra information or newlines.
      
For additional context, the fragments belong to the following nested section titles: {sectionTitle}
      
**Your answer should be only the corrected version of Fragment A, with minimal corrections made.**`;

  const filledPrompt = await ChatPromptTemplate.fromTemplate(
    promptTemplate
  ).invoke({
    sectionChunk: sectionChunk.pageContent,
    candidate: candidate.candidate.pageContent,
    sectionTitle: sectionChunk.metadata.headerRoute,
  });

  const response = await chat.invoke([
    systemMessage,
    ...filledPrompt.toChatMessages(),
  ]);

  if (typeof response.content !== 'string' || isStringEmpty(response.content)) {
    return {
      couldReconcile: false,
      reconciliationStrategy: 'error',
      data: {
        sectionChunk,
        chosenCandidate: candidate,
        reconciledChunk: structuredClone(sectionChunk),
      },
    };
  }

  const llmAnswer = response.content.toString().trim();
  const sectionChunkClone = structuredClone(sectionChunk);
  const reconciledChunk = {
    ...sectionChunkClone,
    pageContent: llmAnswer,
    metadata: {
      ...sectionChunkClone.metadata,
      reconciled: true,
    },
  } as const;

  return {
    couldReconcile: true,
    reconciliationStrategy: 'llm',
    data: {
      sectionChunk,
      chosenCandidate: candidate,
      reconciledChunk,
    },
  };
}

export function reconcileSections({
  originalSections,
  reconciledChunks,
}: {
  originalSections: SectionNode[];
  reconciledChunks: SectionChunkDoc[];
}): SectionNode[] {
  // Group reconciled chunks by headerRouteLevels (act as a section ID)
  const chunksByHeaderRouteLevels = Map.groupBy(
    reconciledChunks,
    (c) => c.metadata.headerRouteLevels
  );

  // Process originalSections
  const updatedSections: SectionNode[] = originalSections.map((section) =>
    processSection(section)
  );

  return updatedSections;

  // HELPER FUNCTIONS

  // Function to process sections recursively
  function processSection(section: SectionNode): SectionNode {
    // Create a structured clone of the section
    const clone: SectionNode = {
      ...section,
      tables: new Map(section.tables),
      content: '',
      subsections: [],
    };

    // Process subsections recursively
    for (const subsection of section.subsections) {
      const processedSubsection = processSection(subsection);
      clone.subsections.push(processedSubsection);
    }

    // If the section's headerRouteLevels is in chunksByHeaderRouteLevels
    const chunks = chunksByHeaderRouteLevels
      .get(section.headerRouteLevels)
      ?.sort((a, b) => a.metadata.order - b.metadata.order);

    if (chunks != null && chunks.length > 0) {
      let currentTableCount = 0;
      const contentParts: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;

        if (chunk.metadata.table === true) {
          contentParts.push(`<<<TABLE:${currentTableCount++}>>>`);

          // Skip table chunks since we don't reconcile them for now.

          // TODO: This for now seems not to matter, but at least we have
          // to note the bug. If there are two tables in the original
          // section like this `<<<TABLE:x>>>\n<<<TABLE:y>>>` this loop
          // will reconciliate both tables as `<<<TABLE:x>>>` since the
          // correct table number increases by one if there are non table
          // elements between them. It doesn't seem to matter much because
          // joining tables like this should not affect the embeddings
          // since we're only registering if a chunk is table or not, not
          // the table number it belongs to.
          while (i < chunks.length && chunks[i + 1]?.metadata.table === true) {
            i++;
          }
        } else {
          contentParts.push(chunk.pageContent);
        }
      }

      clone.content = contentParts.join('\n');
    }

    return clone;
  }
}

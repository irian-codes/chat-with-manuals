import {env} from '@/env';
import {
  getSimilarChunks,
  reconstructSections,
  sortReconstructedSectionsByHeaderRoute,
  TOKEN_LIMITS,
} from '@/server/conversation/prompt';
import {logger, task} from '@trigger.dev/sdk/v3';
import './init';

// Main task for retrieving context from a document
export const retrieveContextTask = task({
  id: 'retrieve-context',
  maxDuration: 10 * 60,
  run: async (payload: {
    prompt: string;
    collectionName: string;
    sectionPrefix: string;
  }) => {
    logger.info('Getting similar chunks...');
    const similarChunks = await getSimilarChunks({
      prompt: payload.prompt,
      collectionName: payload.collectionName,
      maxChunks: 20,
      dbCallTimeoutInMs: env.CHROMA_DB_TIMEOUT,
    });

    logger.info('Reconstructing sections...');
    const reconstructedSections = await reconstructSections({
      similarChunks,
      collectionName: payload.collectionName,
      leftTotalTokens: TOKEN_LIMITS.maxTokensAllSections,
      maxSectionTokens: TOKEN_LIMITS.maxTokensPerSection,
    });

    logger.info('Sorting sections...');
    const sortedSections = sortReconstructedSectionsByHeaderRoute(
      reconstructedSections
    );

    logger.info('Returning context...');
    return sortedSections
      .map(
        (doc) =>
          `${payload.sectionPrefix}${doc.metadata.headerRoute}\n${doc.pageContent}`
      )
      .join('\n\n');
  },
});

import {clearDatabase, embedPDF, getDocs} from '@/server/db/chroma';
import {TRPCError} from '@trpc/server';
import {IncludeEnum} from 'chromadb';
import {Document} from 'langchain/document';
import {z} from 'zod';
import {createTRPCRouter, debugProcedure} from '../trpc';

export const debugRouter = createTRPCRouter({
  debugStoreInChroma: debugProcedure.mutation(async ({ctx}) => {
    const markdown = 'Hello World TEST TEXT';
    const fileHash = '123';

    const vectorStore = await embedPDF({
      fileHash,
      locale: 'en',
      docs: [
        new Document({
          pageContent: markdown,
          metadata: {
            title: 'Test Title 1',
            description: 'Test Description 1',
            locale: 'en',
          },
        }),
      ],
    });

    try {
      return await getDocs({
        collectionName: vectorStore.collectionName,
        dbQuery: {include: [IncludeEnum.Documents, IncludeEnum.Metadatas]},
        throwOnEmptyReturn: true,
      });
    } catch (error) {
      console.error(error);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching documents',
        cause: error,
      });
    }
  }),

  debugGetDocsFromChroma: debugProcedure
    .input(z.object({collectionName: z.string().trim().nonempty().uuid()}))
    .query(async ({input}) => {
      try {
        return await getDocs({
          collectionName: input.collectionName,
          dbQuery: {include: [IncludeEnum.Documents, IncludeEnum.Metadatas]},
          throwOnEmptyReturn: false,
        });
      } catch (error) {
        console.error(error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error fetching documents from ChromaDB',
          cause: error,
        });
      }
    }),

  debugClearChroma: debugProcedure.mutation(async ({ctx}) => {
    try {
      await clearDatabase();
    } catch (error) {
      console.error(error);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error clearing ChromaDB',
        cause: error,
      });
    }
  }),
});

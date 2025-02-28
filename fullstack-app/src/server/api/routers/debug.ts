import {clearDatabase, embedPDF, getDocs} from '@/server/db/chroma';
import {type envVarTestTask} from '@/server/trigger/test';
import {runs, tasks, type TaskOutput} from '@trigger.dev/sdk/v3';
import {TRPCError} from '@trpc/server';
import {IncludeEnum} from 'chromadb';
import {Document} from 'langchain/document';
import {z} from 'zod';
import {
  createTRPCRouter,
  debugAuthedProcedure,
  debugPublicProcedure,
} from '../trpc';

export const debugRouter = createTRPCRouter({
  debugStoreInChroma: debugAuthedProcedure.mutation(async ({ctx}) => {
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

  debugGetDocsFromChroma: debugAuthedProcedure
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

  debugClearChroma: debugAuthedProcedure.mutation(async ({ctx}) => {
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

  debugRunTriggerDevTask: debugPublicProcedure
    .input(z.object({data: z.string()}).optional())
    .mutation(async ({input}) => {
      const handle = await tasks.trigger<typeof envVarTestTask>(
        'env-var-test',
        null
      );

      let output: TaskOutput<typeof envVarTestTask> | undefined;
      for await (const run of runs.subscribeToRun<typeof envVarTestTask>(
        handle.id
      )) {
        if (run.output != null) {
          output = run.output;
          break;
        }
      }

      return output;
    }),
});

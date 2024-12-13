import {authedProcedure, createTRPCRouter} from '@/server/api/trpc';
import type {Document} from '@/types/Document';
import {UploadDocumentPayloadSchema} from '@/types/UploadDocumentPayload';
import {z} from 'zod';

export const documentsRouter = createTRPCRouter({
  getDocuments: authedProcedure.query(({ctx}) => {
    // TODO: Get only the documents for the specific user.

    const documents: Document[] = [
      {
        id: '2',
        title: 'Business report',
        date: '2024-10-12T21:21:00.000Z',
        locale: 'en',
      },
      {
        id: '3',
        title: 'Bitcoin whitepaper',
        date: '2023-03-07T10:14:00.000Z',
        locale: 'en',
      },
      {
        id: '4',
        title: 'Savage Worlds RPG',
        date: '2022-11-23T00:20:54.000Z',
        locale: 'en',
      },
      {
        id: '5',
        title: 'Urban mobility report',
        date: '2022-10-05T02:08:00.000Z',
        locale: 'en',
      },
      {
        id: '6',
        title: 'Fridge manual model X459 fasd sdad fasd  asdf asdf sa d',
        date: '2021-03-10T00:24:00Z',
        locale: 'en',
      },
    ];

    return documents;
  }),

  getDocument: authedProcedure
    .input(z.object({id: z.string()}))
    .query(({ctx, input}) => {
      // TODO: Get the document for the specific user.

      return {
        id: '2',
        title: 'Business report',
        date: '2024-10-12T21:21:00.000Z',
        locale: 'en',
      };
    }),

  uploadDocument: authedProcedure
    .input(
      z
        .instanceof(FormData)
        .transform((formData) => Object.fromEntries(formData.entries()))
        .pipe(UploadDocumentPayloadSchema)
    )
    .mutation(async ({ctx, input}) => {
      // Now input is properly typed with all our fields
      console.log('Received payload: ', input);

      return {
        success: input.file instanceof File,
      };
    }),

  updateDocument: authedProcedure
    .input(
      z.object({
        // TODO: This should be whatever we end up using for IDs in the DB
        id: z.string().min(1),
        title: z.string().trim().min(2).max(255),
        description: z.string().trim().max(2000),
      })
    )
    .mutation(({ctx, input}) => {
      console.log('Received payload: ', input);
    }),

  cancelDocumentParsing: authedProcedure
    .input(
      z.object({
        // TODO: This should be whatever we end up using for IDs in the DB
        id: z.string().min(1),
      })
    )
    .mutation(({ctx, input}) => {
      console.log('Document parsing cancelled for ID: ', input.id);
    }),

  deleteDocument: authedProcedure
    .input(
      z.object({
        // TODO: This should be whatever we end up using for IDs in the DB
        id: z.string().min(1),
      })
    )
    .mutation(({ctx, input}) => {
      console.log('Document deleted for ID: ', input.id);
    }),
});

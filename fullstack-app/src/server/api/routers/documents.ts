import {authedProcedure, createTRPCRouter} from '@/server/api/trpc';
import {saveUploadedFile} from '@/server/utils/fileStorage';
import type {Document} from '@/types/Document';
import {UploadDocumentPayloadSchema} from '@/types/UploadDocumentPayload';
import {STATUS} from '@prisma/client';
import crypto from 'crypto';
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
      // Get user from database using auth provider ID
      const user = await ctx.db.user.findUnique({
        where: {
          authProviderId: ctx.authProviderUserId,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Save file and get hash
      const {fileUrl, fileHash} = await saveUploadedFile(input.file);

      // Create pending document
      const pendingDocument = await ctx.db.pendingDocument.create({
        data: {
          userId: user.id,
          title: input.title,
          description: input.description ?? '',
          locale: input.locale,
          fileUrl,
          fileHash,
          llmParsingJobId: crypto.randomUUID(), // Placeholder for now
          codeParsingJobId: crypto.randomUUID(), // Placeholder for now
          status: STATUS.PENDING,
        },
      });

      // Start async processing
      void (async () => {
        try {
          // TODO: Start a DB transaction here to ensure either all is done or nothing.

          // Simulate document processing
          await new Promise((resolve) => setTimeout(resolve, 120000)); // 2 minutes

          // Create final document
          await ctx.db.document.create({
            data: {
              title: pendingDocument.title,
              description: pendingDocument.description,
              locale: pendingDocument.locale,
              fileUrl: pendingDocument.fileUrl,
              fileHash: pendingDocument.fileHash,
              user: {
                connect: {
                  id: user.id,
                },
              },
            },
          });

          // Delete pending document
          await ctx.db.pendingDocument.delete({
            where: {
              id: pendingDocument.id,
            },
          });
        } catch (error) {
          // Update pending document status to ERROR
          await ctx.db.pendingDocument.update({
            where: {
              id: pendingDocument.id,
            },
            data: {
              status: STATUS.ERROR,
            },
          });
          console.error('Error processing document:', error);
        }
      })();

      return pendingDocument;
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

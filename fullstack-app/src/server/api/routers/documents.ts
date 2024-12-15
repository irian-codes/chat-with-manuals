import {createTRPCRouter, withDbUserProcedure} from '@/server/api/trpc';
import type {Document} from '@/types/Document';
import {UploadDocumentPayloadSchema} from '@/types/UploadDocumentPayload';
import {STATUS} from '@prisma/client';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';

export const documentsRouter = createTRPCRouter({
  getDocuments: withDbUserProcedure.query(({ctx}) => {
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

  getDocument: withDbUserProcedure
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

  parseDocument: withDbUserProcedure
    .input(
      UploadDocumentPayloadSchema.extend({
        fileUrl: z
          .string()
          .trim()
          .min(1)
          .refine((val) => fs.existsSync(path.join(process.cwd(), val)), {
            message: 'File does not exist',
          }),
        fileHash: z.string().trim().length(64, {
          message: 'Invalid file hash - must be a 64 character hex string',
        }),
      })
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.dbUser.id;

      // Create pending document
      const pendingDocument = await ctx.db.pendingDocument.create({
        data: {
          // TODO: Add real imageUrl, for now using default value
          title: input.title,
          description: input.description ?? '',
          locale: input.locale,
          fileUrl: input.fileUrl,
          fileHash: input.fileHash,
          llmParsingJobId: crypto.randomUUID(), // Placeholder for now
          codeParsingJobId: crypto.randomUUID(), // Placeholder for now
          status: STATUS.PENDING,
          user: {
            connect: {
              id: userId,
            },
          },
        },
      });

      // TODO: This doesn't really work, we need to find another way to
      // fire this async processing.

      // Start async processing of the document
      void (async () => {
        try {
          // Update pending document status to RUNNING
          await ctx.db.pendingDocument.update({
            where: {
              id: pendingDocument.id,
            },
            data: {
              status: STATUS.RUNNING,
            },
          });

          // Simulate document processing
          await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000)); // 5 minutes

          // Creating the new 'document' db entry and deleting pending
          // document because when a document is done parsing we change its
          // classification from 'pending document' to 'document'.
          await ctx.db.$transaction([
            ctx.db.document.create({
              data: {
                // TODO: Add real imageUrl, for now using default value
                title: pendingDocument.title,
                description: pendingDocument.description,
                locale: pendingDocument.locale,
                fileUrl: pendingDocument.fileUrl,
                fileHash: pendingDocument.fileHash,
                users: {
                  connect: {
                    id: userId,
                  },
                },
              },
            }),

            ctx.db.pendingDocument.delete({
              where: {
                id: pendingDocument.id,
              },
            }),
          ]);
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

  updateDocument: withDbUserProcedure
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

  cancelDocumentParsing: withDbUserProcedure
    .input(
      z.object({
        // TODO: This should be whatever we end up using for IDs in the DB
        id: z.string().min(1),
      })
    )
    .mutation(({ctx, input}) => {
      console.log('Document parsing cancelled for ID: ', input.id);
    }),

  deleteDocument: withDbUserProcedure
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

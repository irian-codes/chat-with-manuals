import {createTRPCRouter, withDbUserProcedure} from '@/server/api/trpc';
import {UploadDocumentPayloadSchema} from '@/types/UploadDocumentPayload';
import {STATUS} from '@prisma/client';
import {TRPCError} from '@trpc/server';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';

export const documentsRouter = createTRPCRouter({
  getDocuments: withDbUserProcedure.query(async ({ctx}) => {
    const userId = ctx.dbUser.id;

    const documents = await ctx.db.document.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return documents;
  }),

  getDocument: withDbUserProcedure
    .input(z.object({id: z.string()}))
    .query(async ({ctx, input}) => {
      const userId = ctx.dbUser.id;

      const document = await ctx.db.document.findUnique({
        where: {
          id: input.id,
          users: {
            some: {
              id: userId,
            },
          },
        },
      });

      if (document == null) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      return document;
    }),

  getDocumentsIncludingPending: withDbUserProcedure
    .input(
      z
        .object({
          pendingDocumentsStatuses: z.array(z.nativeEnum(STATUS)),
        })
        .strict()
        .optional()
    )
    .query(async ({ctx, input}) => {
      const userId = ctx.dbUser.id;

      const [documents, pendingDocuments] = await Promise.all([
        ctx.db.document.findMany({
          where: {
            users: {
              some: {
                id: userId,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        ctx.db.pendingDocument.findMany({
          where: {
            userId: userId,
            status:
              input?.pendingDocumentsStatuses == null
                ? undefined
                : {
                    in: input.pendingDocumentsStatuses,
                  },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
      ]);

      return {
        documents,
        pendingDocuments,
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

import {env} from '@/env';
import {createTRPCRouter, withDbUserProcedure} from '@/server/api/trpc';
import {pdfParseWithLlamaparse} from '@/server/document/parsing';
import {
  allowedAbsoluteDirPaths,
  copyFile,
  copyFileToTempDir,
  deleteFile,
  fileExists,
  writeToTimestampedFile,
} from '@/server/utils/fileStorage';
import {UploadDocumentPayloadSchema} from '@/types/UploadDocumentPayload';
import {Prisma, type PrismaClient, STATUS} from '@prisma/client';
import {TRPCError} from '@trpc/server';
import crypto from 'crypto';
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
    .input(z.object({id: z.string().min(1).uuid()}))
    .query(async ({ctx, input}) => {
      const userId = ctx.dbUser.id;

      const document = await getDocument(ctx.db, input.id, userId);

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
          .refine((val) => fileExists(val), {
            message: 'File does not exist or path is invalid',
          }),
        fileHash: z.string().trim().length(64, {
          message: 'Invalid file hash. Must be a SHA256 string',
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

      // TODO: This whould be a fire and forget operation. But until we
      // implement Trigger.dev we are going to await it here to simulate
      // the parsing behaviour. This will actually work with TRPC
      // Subscription links to send an event to the frontend when the
      // document is parsed.
      //
      // @see https://trpc.io/docs/server/subscriptions

      // Start async processing of the document
      await (async () => {
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

          const markdown = await pdfParseWithLlamaparse({
            filePath: pendingDocument.fileUrl,
            documentLanguage: pendingDocument.locale,
          });

          if (env.NODE_ENV === 'development') {
            await writeToTimestampedFile({
              content: markdown,
              destinationFolderPath:
                allowedAbsoluteDirPaths.publicParsingResults,
              suffix: 'llamaParse',
              fileName: pendingDocument.title,
              fileExtension: 'md',
            });
          }

          // TODO: Embed into Chroma DB the parsed text

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
        id: z.string().min(1).uuid(),
        title: z.string().trim().min(2).max(255).optional(),
        description: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.dbUser.id;

      const _modifiedFields = Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) => key !== 'id' && value != null
        )
      );

      const document = await ctx.db.document
        .update({
          where: {
            id: input.id,
            users: {
              some: {
                id: userId,
              },
            },
          },
          data: _modifiedFields,
        })
        .catch((error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Document not found or access denied',
              });
            } else {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to update document',
              });
            }
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update document',
          });
        });

      return document;
    }),

  cancelDocumentParsing: withDbUserProcedure
    .input(
      z.object({
        id: z.string().min(1).uuid(),
      })
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.dbUser.id;

      const pendingDocument = await getPendingDocument(
        ctx.db,
        input.id,
        userId
      );

      if (pendingDocument == null) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pending document not found or access denied',
        });
      }

      let tempPath: string;
      try {
        // Store it in case we need to rollback
        tempPath = await copyFileToTempDir(pendingDocument.fileUrl);
      } catch (error) {
        console.error(error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to backup document file: ${pendingDocument.fileUrl}`,
          cause: error,
        });
      }

      try {
        // Delete original file
        await deleteFile(pendingDocument.fileUrl);
      } catch (error) {
        console.error(error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete document file: ${pendingDocument.fileUrl}`,
          cause: error,
        });
      }

      await ctx.db.pendingDocument
        .delete({
          where: {
            id: input.id,
            userId,
          },
        })
        .catch(async (error) => {
          // Rollback the deletion of the original file
          if (tempPath != null) {
            await copyFile(tempPath, pendingDocument.fileUrl);
          }

          // Throw errors
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Pending document not found or access denied',
              });
            } else {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete pending document',
              });
            }
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete pending document',
          });
        });

      if (tempPath != null) {
        // Delete temp file since we successfully deleted the original file
        try {
          await deleteFile(tempPath);
        } catch (error) {
          console.warn(
            `Failed to delete temp file: ${tempPath}. This is not critical and can be ignored.`
          );
        }
      }

      return pendingDocument;
    }),

  deleteDocument: withDbUserProcedure
    .input(
      z.object({
        id: z.string().min(1).uuid(),
      })
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.dbUser.id;

      const document = await getDocument(ctx.db, input.id, userId);

      if (document == null) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found or access denied',
        });
      }

      let tempPath: string;
      try {
        // Store it in case we need to rollback
        tempPath = await copyFileToTempDir(document.fileUrl);
      } catch (error) {
        console.error(error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to backup document file: ${document.fileUrl}`,
          cause: error,
        });
      }

      try {
        // Delete original file
        await deleteFile(document.fileUrl);
      } catch (error) {
        console.error(error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete document file: ${document.fileUrl}`,
          cause: error,
        });
      }

      await ctx.db.document
        .delete({
          where: {
            id: input.id,
            users: {
              some: {
                id: userId,
              },
            },
          },
        })
        .catch(async (error) => {
          // Rollback the deletion of the original file
          if (tempPath != null) {
            await copyFile(tempPath, document.fileUrl);
          }

          // Throw errors
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Document not found or access denied',
              });
            } else {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete document',
              });
            }
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete document',
          });
        });

      if (tempPath != null) {
        // Delete temp file since we successfully deleted the original file
        try {
          await deleteFile(tempPath);
        } catch (error) {
          console.warn(
            `Failed to delete temp file: ${tempPath}. This is not critical and can be ignored.`
          );
        }
      }

      return document;
    }),
});

// REUSABLE FUNCTIONS

async function getDocument(
  db: PrismaClient,
  documentId: string,
  userId: string
) {
  const _userId = z.string().trim().min(1).uuid().safeParse(userId).success
    ? userId.trim()
    : undefined;

  if (_userId == null) {
    throw new Error('User ID is required or is invalid');
  }

  const document = await db.document.findUnique({
    where: {
      id: documentId,
      users: {
        some: {
          id: _userId,
        },
      },
    },
  });

  return document;
}

async function getPendingDocument(
  db: PrismaClient,
  documentId: string,
  userId: string
) {
  const _userId = z.string().trim().min(1).uuid().safeParse(userId).success
    ? userId.trim()
    : undefined;

  if (_userId == null) {
    throw new Error('User ID is required or is invalid');
  }

  const document = await db.pendingDocument.findUnique({
    where: {
      id: documentId,
      userId: _userId,
    },
  });

  return document;
}

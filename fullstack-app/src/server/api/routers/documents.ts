import {env} from '@/env';
import {createTRPCRouter, withDbUserProcedure} from '@/server/api/trpc';
import {embedPDF} from '@/server/db/chroma';
import {pdfParseWithLlamaparse} from '@/server/document/parsing';
import {AppEventEmitter} from '@/server/utils/eventEmitter';
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
import {Document} from 'langchain/document';
import {z} from 'zod';

const ee = new AppEventEmitter();

export const documentsRouter = createTRPCRouter({
  getDocuments: withDbUserProcedure.query(async ({ctx}) => {
    const userId = ctx.prismaUser.id;

    const documents = await ctx.prisma.document.findMany({
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
      const userId = ctx.prismaUser.id;

      const document = await getDocument(ctx.prisma, input.id, userId);

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
      const userId = ctx.prismaUser.id;

      const [documents, pendingDocuments] = await Promise.all([
        ctx.prisma.document.findMany({
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
        ctx.prisma.pendingDocument.findMany({
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

  onDocumentParsingUpdate: withDbUserProcedure
    .input(
      z
        .object({
          includedStatuses: z.array(z.nativeEnum(STATUS)),
        })
        .strict()
        .optional()
    )
    .subscription(async function* ({ctx, input, signal}) {
      // This code is a simplified version of the official TRPC example
      // because pending documents list is small enough.
      // @see https://github.com/trpc/examples-next-sse-chat/blob/main/src/server/routers/post.ts

      // We start by subscribing to the event emitter so that we don't miss any new events while fetching
      const iterable = ee.toIterable('pendingDocument', {
        // We pass the signal so we can cancel the subscription if the request is aborted.
        signal,
      });

      const userId = ctx.prismaUser.id;

      yield {
        docs: await getPendingDocuments(
          ctx.prisma,
          userId,
          input?.includedStatuses
        ),
        action: null,
      };

      // Listen for any new pending document list updates from the emitter
      for await (const [action] of iterable) {
        yield {
          docs: await getPendingDocuments(
            ctx.prisma,
            userId,
            input?.includedStatuses
          ),
          action,
        };
      }
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
      const userId = ctx.prismaUser.id;

      // Create pending document
      const pendingDocument = await ctx.prisma.pendingDocument.create({
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

      ee.emit('pendingDocument', 'added');

      // Start async processing without awaiting.
      //
      // TODO: This is a temporary hack but we should be using either
      // something like Trigger.dev, a proper queue system or another
      // solution to ensure Node doesn't kill the promise.
      //
      // @see
      // https://stackoverflow.com/questions/46914025/node-exits-without-error-and-doesnt-await-promise-event-callback
      // @see https://github.com/nodejs/node/issues/22088
      void (async () => {
        try {
          // Update pending document status to RUNNING

          const _pendingDocument = await ctx.prisma.pendingDocument.update({
            where: {id: pendingDocument.id},
            data: {status: STATUS.RUNNING},
            select: {
              id: true,
              status: true,
            },
          });

          const markdown = await pdfParseWithLlamaparse({
            filePath: pendingDocument.fileUrl,
            documentLanguage: pendingDocument.locale,
          });

          const vectorStore = await embedPDF(pendingDocument.fileHash, [
            new Document({
              pageContent: markdown,
              metadata: {
                title: pendingDocument.title,
                description: pendingDocument.description,
                locale: pendingDocument.locale,
              },
            }),
          ]);

          if (env.NODE_ENV === 'development') {
            await writeToTimestampedFile({
              content: `Chroma collection name: ${vectorStore.collectionName}\n\nContent:\n${markdown}`,
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
          await ctx.prisma.$transaction([
            ctx.prisma.document.create({
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

            ctx.prisma.pendingDocument.delete({
              where: {
                id: pendingDocument.id,
              },
            }),
          ]);

          ee.emit('pendingDocument', 'finished');
        } catch (error) {
          // Update pending document status to ERROR
          const _pendingDocument = await ctx.prisma.pendingDocument.update({
            where: {id: pendingDocument.id},
            data: {status: STATUS.ERROR},
            select: {
              id: true,
              status: true,
            },
          });

          ee.emit('pendingDocument', 'error');

          // TODO: We should take care of these error results because
          // otherwise they'll pile up. And TRPC cannot return any errors
          // at this point.
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
      const userId = ctx.prismaUser.id;

      const _modifiedFields = Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) => key !== 'id' && value != null
        )
      );

      const document = await ctx.prisma.document
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
      const userId = ctx.prismaUser.id;

      const pendingDocument = await getPendingDocument(
        ctx.prisma,
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

      await ctx.prisma.pendingDocument
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

      ee.emit('pendingDocument', 'cancelled');

      return pendingDocument;
    }),

  deleteDocument: withDbUserProcedure
    .input(
      z.object({
        id: z.string().min(1).uuid(),
      })
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const document = await getDocument(ctx.prisma, input.id, userId);

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

      await ctx.prisma.document
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
  prisma: PrismaClient,
  documentId: string,
  userId: string
) {
  const _userId = z.string().trim().min(1).uuid().safeParse(userId).success
    ? userId.trim()
    : undefined;

  if (_userId == null) {
    throw new Error('User ID is required or is invalid');
  }

  const document = await prisma.document.findUnique({
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
  prisma: PrismaClient,
  documentId: string,
  userId: string
) {
  const _userId = z.string().trim().min(1).uuid().safeParse(userId).success
    ? userId.trim()
    : undefined;

  if (_userId == null) {
    throw new Error('User ID is required or is invalid');
  }

  const document = await prisma.pendingDocument.findUnique({
    where: {
      id: documentId,
      userId: _userId,
    },
  });

  return document;
}

async function getPendingDocuments(
  prisma: PrismaClient,
  userId: string,
  includedStatuses?: STATUS[]
) {
  const pendingDocs = await prisma.pendingDocument.findMany({
    where: {
      userId,
      status:
        includedStatuses == null
          ? undefined
          : {
              in: includedStatuses,
            },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return pendingDocs;
}

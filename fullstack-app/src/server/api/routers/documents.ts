import {
  authedProcedure,
  createTRPCRouter,
  withDbUserProcedure,
} from '@/server/api/trpc';
import {deleteCollection} from '@/server/db/chroma';
import {
  fileParsingErrorCleanup,
  type fileParsingTask,
} from '@/server/trigger/documents';
import {
  AppEventEmitter,
  pendingDocumentEventsSchema,
} from '@/server/utils/eventEmitter';
import {
  deleteFile,
  fileExists,
  validateAndResolvePath,
} from '@/server/utils/fileStorage';
import {UpdateDocumentPayloadSchema} from '@/types/UpdateDocumentPayload';
import {UploadNewDocumentPayloadSchema} from '@/types/UploadNewDocumentPayload';
import {isStringEmpty, normalizeStringForSearch} from '@/utils/strings';
import {
  Prisma,
  STATUS,
  type PendingDocument,
  type PrismaClient,
} from '@prisma/client';
import {runs, tasks} from '@trigger.dev/sdk/v3';
import {TRPCError} from '@trpc/server';
import {z} from 'zod';

export const ee = new AppEventEmitter();

export const documentsRouter = createTRPCRouter({
  getDocuments: withDbUserProcedure
    .input(
      z
        .object({
          titleSearch: z
            .string()
            .trim()
            .max(30)
            .default('')
            .transform(normalizeStringForSearch),
        })
        .strict()
        .optional()
    )
    .query(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const documents = await ctx.prisma.userDocument.findMany({
        where: {
          userId,
          ...(input == null ||
          isStringEmpty(input.titleSearch) ||
          input.titleSearch.length < 2
            ? undefined
            : {
                searchTitle: {
                  mode: 'insensitive',
                  contains: input.titleSearch,
                },
              }),
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

      const document = await getDocument({
        prisma: ctx.prisma,
        documentId: input.id,
        userId,
      });

      if (document == null) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      return document;
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
        // TODO: I'm pretty sure that here we should check if the emitted
        // event pertains to the user that is currently connected.
        // Otherwise I think we're signalling all users that are connected
        // to the server whenever any pending document event is emitted.
        // Which is wrong, because it's a huge waste of requests. To do
        // this though, we would need to receive the userId from the event.

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
      UploadNewDocumentPayloadSchema.omit({
        file: true,
        image: true,
      })
        .extend({
          fileUrl: z
            .string()
            .trim()
            .min(1)
            .refine(
              async (val) => {
                try {
                  return await fileExists(val);
                } catch (error) {
                  return false;
                }
              },
              {
                message: 'File does not exist or path is invalid',
              }
            ),
          fileHash: z.string().trim().length(64, {
            message: 'Invalid file hash. Must be a SHA256 string',
          }),
          imageUrl: z
            .string()
            .trim()
            .min(1)
            .refine(
              async (val) => {
                try {
                  return await fileExists(val);
                } catch (error) {
                  return false;
                }
              },
              {
                message: 'Image does not exist or path is invalid',
              }
            )
            .optional(),
        })
        .strict()
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      // Create pending document
      let pendingDocument: Pick<PendingDocument, 'id' | 'fileHash'> | null =
        null;
      try {
        pendingDocument = await ctx.prisma.pendingDocument.create({
          data: {
            title: input.title,
            searchTitle: normalizeStringForSearch(input.title),
            description: input.description ?? '',
            documentType: input.documentType,
            locale: input.locale,
            fileUrl: input.fileUrl,
            fileHash: input.fileHash,
            imageUrl: input.imageUrl,
            status: STATUS.PENDING,
            user: {
              connect: {
                id: userId,
              },
            },
          },
          select: {
            id: true,
            fileHash: true,
          },
        });

        // Trigger actual parsing task
        const taskHandle = await tasks.trigger<typeof fileParsingTask>(
          'file-parsing',
          {
            pendingDocumentId: pendingDocument.id,
            userId,
          },
          {
            idempotencyKey: pendingDocument.fileHash,
            idempotencyKeyTTL: '1m',
          }
        );

        ee.emit('pendingDocument', 'added');

        return {taskHandleId: taskHandle.id, pendingDocument};
      } catch (error) {
        // Try delete pending document. If it's null it means Prisma crashed.
        if (pendingDocument != null) {
          try {
            await ctx.prisma.pendingDocument.delete({
              where: {id: pendingDocument.id},
            });
          } catch (error) {
            console.error(
              'Failed to delete pending document. This db entry should be deleted manually.',
              error
            );
          }
        }

        // Delete original file and image
        try {
          await deleteFile(input.fileUrl);

          if (!isStringEmpty(input.imageUrl)) {
            await deleteFile(input.imageUrl!);
          }
        } catch (error) {
          const imageUrlErrorMsgPart = isStringEmpty(input.imageUrl)
            ? ''
            : ', image: ' + input.imageUrl;

          console.error(
            `Failed to delete document file: ${input.fileUrl}${imageUrlErrorMsgPart}. These files should be deleted manually.`,
            error
          );
        }

        ee.emit('pendingDocument', 'error');

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create pending document on database',
          cause: error,
        });
      }
    }),

  triggerDevWebhookReceiver: authedProcedure
    .input(
      z.object({
        pendingDocumentEventPayload: pendingDocumentEventsSchema,
      })
    )
    .mutation(async ({ctx, input}) => {
      // TODO: We should validate the source of the request with a secret key
      ee.emit('pendingDocument', input.pendingDocumentEventPayload);
    }),

  updateDocument: withDbUserProcedure
    .input(
      UpdateDocumentPayloadSchema.omit({image: true})
        .extend({
          imageUrl: z
            .string()
            .trim()
            .refine((val) => {
              try {
                return typeof validateAndResolvePath(val) === 'string';
              } catch (error) {
                return false;
              }
            })
            .optional(),
        })
        .strict()
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const _modifiedFields = Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) => key !== 'id' && value != null
        )
      ) as Omit<typeof input, 'id'>;

      const oldImageUrl = await (async () => {
        // Saving a database request if the imageUrl is not modified
        if (_modifiedFields.imageUrl == null) {
          return undefined;
        }

        try {
          const doc = await getDocument({
            prisma: ctx.prisma,
            documentId: input.id,
            userId,
            select: {
              imageUrl: true,
            },
          });

          return isStringEmpty(doc?.imageUrl) ? undefined : doc!.imageUrl;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update document',
            cause: error,
          });
        }
      })();

      const updatedDocument = await ctx.prisma.userDocument
        .update({
          where: {
            id: input.id,
            userId,
          },
          data: {
            ..._modifiedFields,
            searchTitle: !isStringEmpty(_modifiedFields.title)
              ? normalizeStringForSearch(_modifiedFields.title!)
              : undefined,
          },
        })
        .catch((error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Document not found or access denied',
              });
            }
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update document',
          });
        });

      if (oldImageUrl != null && _modifiedFields.imageUrl != null) {
        try {
          await deleteFile(oldImageUrl);
        } catch (error) {
          console.error(
            `Failed to delete image file: ${oldImageUrl}. This file should be deleted manually.`,
            error
          );
        }
      }

      return updatedDocument;
    }),

  cancelDocumentParsing: withDbUserProcedure
    .input(
      z.object({
        id: z.string().trim().min(1).uuid(),
      })
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const pendingDocument = await ctx.prisma.pendingDocument
        .findUniqueOrThrow({
          where: {
            id: input.id,
            userId,
          },
        })
        .catch((error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Pending document not found or access denied',
              });
            }
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete pending document',
          });
        });

      // Cancel the Trigger.dev run if we have a task ID
      if (!isStringEmpty(pendingDocument.parsingTaskId)) {
        try {
          await runs.cancel(pendingDocument.parsingTaskId!);
          await fileParsingErrorCleanup({
            pendingDocument,
            errorLoggerFunction: console.error,
          });
        } catch (error) {
          console.error(
            `Failed to cancel file parsing Trigger.dev run ${pendingDocument.parsingTaskId} for pending document ID ${pendingDocument.id}.`,
            error
          );
        }
      }

      ee.emit('pendingDocument', 'cancelled');

      return pendingDocument;
    }),

  deleteDocument: withDbUserProcedure
    .input(
      z.object({
        id: z.string().trim().min(1).uuid(),
      })
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      // First check if document exists and get user count
      const document = await ctx.prisma.userDocument
        .findUniqueOrThrow({
          where: {
            id: input.id,
            userId,
          },
          select: {
            file: {
              select: {
                _count: {
                  select: {
                    userDocuments: true,
                  },
                },
                id: true,
                vectorStoreId: true,
                url: true,
              },
            },
          },
        })
        .catch((error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'File or UserDocument not found or access denied',
              });
            }
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get UserDocument',
            cause: error,
          });
        });

      const isLastUser = document.file._count.userDocuments === 1;
      const deletedDocument = await ctx.prisma.userDocument
        .delete({
          where: {
            id: input.id,
          },
        })
        .catch((error) => {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete UserDocument',
            cause: error,
          });
        });

      // If this is the last user, proceed with full deletion
      // This should also delete all UserDocuments associated with the file
      if (isLastUser) {
        await ctx.prisma.documentFile
          .delete({
            where: {
              id: document.file.id,
            },
          })
          .catch((error) => {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to delete document file',
              cause: error,
            });
          });

        // Delete from vector store
        try {
          await deleteCollection(document.file.vectorStoreId);
        } catch (error) {
          console.error(
            `Failed to delete collection for document file ID ${deletedDocument.id}. This collection should be deleted manually.`,
            error
          );
        }

        // Delete original file
        try {
          await deleteFile(document.file.url);
        } catch (error) {
          console.error(
            `Failed to delete document file: ${document.file.url}. This file should be deleted manually.`,
            error
          );
        }
      }

      // Delete the user uploaded image
      if (!isStringEmpty(deletedDocument.imageUrl)) {
        try {
          await deleteFile(deletedDocument.imageUrl);
        } catch (error) {
          console.error(
            `Failed to delete image file: ${deletedDocument.imageUrl}. This file should be deleted manually.`,
            error
          );
        }
      }

      // Deleting all conversations that are left without a document
      // @see https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#filter-on-absence-of--to-many-records
      // TODO: Check if this is ever called because on the schema we have set a cascade on delete for conversations
      await ctx.prisma.conversation
        .deleteMany({
          where: {
            documents: {
              none: {},
            },
          },
        })
        .catch((error) => {
          console.error(
            'Error deleting leftover conversations with zero documents. These conversations should be deleted manually.',
            error
          );
        });

      return deletedDocument;
    }),
});

// REUSABLE FUNCTIONS

async function getDocument(params: {
  prisma: PrismaClient;
  documentId: string;
  userId: string;
  select?: Prisma.UserDocumentFindUniqueArgs['select'];
  include?: Prisma.UserDocumentFindUniqueArgs['include'];
}) {
  const _userId = z
    .string()
    .trim()
    .min(1)
    .uuid()
    .parse(params.userId, {
      errorMap: (issue) => ({
        message: `User ID is required or is invalid. ${issue.message}`,
      }),
    });

  const _options = {
    where: {
      id: params.documentId,
      userId: _userId,
    },
    ...(params.select ? {select: params.select} : {}),
    ...(params.include ? {include: params.include} : {}),
  } satisfies Prisma.UserDocumentFindUniqueArgs;

  const document = await params.prisma.userDocument.findUnique(_options);

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

import {env} from '@/env';
import {createTRPCRouter, withDbUserProcedure} from '@/server/api/trpc';
import {deleteCollection, embedPDF, getDocs} from '@/server/db/chroma';
import {chunkString} from '@/server/document/chunking';
import {
  lintAndFixMarkdown,
  pdfParseWithLlamaparse,
  plaintifyMarkdown,
} from '@/server/document/parsing';
import {AppEventEmitter} from '@/server/utils/eventEmitter';
import {
  allowedAbsoluteDirPaths,
  deleteFile,
  fileExists,
  getMostRecentFile,
  validateAndResolvePath,
  writeToTimestampedFile,
} from '@/server/utils/fileStorage';
import {UpdateDocumentPayloadSchema} from '@/types/UpdateDocumentPayload';
import {UploadNewDocumentPayloadSchema} from '@/types/UploadNewDocumentPayload';
import {isStringEmpty} from '@/utils/strings';
import {type Chroma} from '@langchain/community/vectorstores/chroma';
import {Prisma, STATUS, type PrismaClient} from '@prisma/client';
import {TRPCError} from '@trpc/server';
import {IncludeEnum} from 'chromadb';
import crypto from 'crypto';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {z} from 'zod';

const ee = new AppEventEmitter();

export const documentsRouter = createTRPCRouter({
  getDocuments: withDbUserProcedure
    .input(
      z
        .object({
          titleSearch: z.string().max(30).default(''),
        })
        .strict()
        .optional()
    )
    .query(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const documents = await ctx.prisma.document.findMany({
        where: {
          AND: {
            users: {
              some: {
                id: userId,
              },
            },
            ...(input == null ||
            isStringEmpty(input.titleSearch) ||
            input.titleSearch.length < 2
              ? undefined
              : {
                  title: {
                    mode: 'insensitive',
                    contains: input.titleSearch.trim(),
                  },
                }),
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
      const pendingDocument = await ctx.prisma.pendingDocument
        .create({
          data: {
            // TODO: Add real imageUrl, for now using default value
            title: input.title,
            description: input.description ?? '',
            locale: input.locale,
            fileUrl: input.fileUrl,
            fileHash: input.fileHash,
            imageUrl: input.imageUrl,
            llmParsingJobId: crypto.randomUUID(), // Placeholder for now
            codeParsingJobId: crypto.randomUUID(), // Placeholder for now
            status: STATUS.PENDING,
            user: {
              connect: {
                id: userId,
              },
            },
          },
        })
        .catch(async (error) => {
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

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create pending document on database',
            cause: error,
          });
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
      let vectorStore: Chroma | null = null;
      void (async () => {
        try {
          // Update pending document status to RUNNING

          await ctx.prisma.pendingDocument.update({
            where: {id: pendingDocument.id},
            data: {status: STATUS.RUNNING},
            select: {
              id: true,
              status: true,
            },
          });

          const markdown = await (async () => {
            if (env.NODE_ENV === 'development' && env.MOCK_FILE_PARSING) {
              await new Promise((resolve) => setTimeout(resolve, 5_000));

              const file = await getMostRecentFile({
                dirPath: 'public/temp/parsing-results',
                extensions: ['.md'],
              });

              return file.text();
            } else {
              return await pdfParseWithLlamaparse({
                filePath: pendingDocument.fileUrl,
                documentLanguage: pendingDocument.locale,
              });
            }
          })();

          const lintedMarkdown = lintAndFixMarkdown(markdown);

          if (typeof lintedMarkdown !== 'string') {
            throw new Error('Failed to lint and fix markdown');
          }

          // TODO: This operations could be CPU intensive and we should move them to something like Trigger.dev
          const plaintifiedMarkdown = await plaintifyMarkdown(lintedMarkdown);

          const chunks = await chunkString({
            text: plaintifiedMarkdown,
            splitter: new RecursiveCharacterTextSplitter({
              chunkSize: 150,
              chunkOverlap: 0,
              keepSeparator: false,
            }),
          });

          vectorStore = await embedPDF({
            fileHash: pendingDocument.fileHash,
            locale: pendingDocument.locale,
            docs: chunks,
          });

          if (env.NODE_ENV === 'development') {
            await writeToTimestampedFile({
              content: `Chroma collection name: ${vectorStore.collectionName}\n\nContent:\n${markdown}`,
              destinationFolderPath:
                allowedAbsoluteDirPaths.publicParsingResults,
              suffix: 'llamaParse',
              fileName: pendingDocument.title,
              fileExtension: 'md',
            });

            const embeddedChunks = await getDocs({
              collectionName: vectorStore.collectionName,
              dbQuery: {
                include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
                limit: 20,
              },
              throwOnEmptyReturn: true,
            });

            console.log('Retrieved chunks from Chroma:', embeddedChunks);
          }

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
                imageUrl: pendingDocument.imageUrl,
                vectorStoreId: vectorStore.collectionName,
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
          // TODO: We should take care of these error somehow in the
          // frontend. Because TRPC cannot return any errors at this point
          // since the procedure already returned as this is a Promise
          // that's being processed but not awaited.
          console.error('Error processing document:', error);

          // CLEANUP
          // Deleting pending document entry
          try {
            await ctx.prisma.pendingDocument.delete({
              where: {id: pendingDocument.id},
            });
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2025'
            ) {
              // If the document entry is not found, we don't need to delete it nor log an error.
            } else {
              console.error(
                `Failed to delete pending document ID ${pendingDocument.id}. This pending document entry should be deleted manually.`,
                error
              );
            }
          }
          // Delete from vector store
          if (vectorStore != null) {
            try {
              await deleteCollection(vectorStore.collectionName);
            } catch (error) {
              console.error(
                `Failed to delete collection ${vectorStore.collectionName} for document ID ${pendingDocument.id}. This collection should be deleted manually.`,
                error
              );
            }
          }

          // Delete original file and image
          try {
            await deleteFile(pendingDocument.fileUrl);

            if (!isStringEmpty(pendingDocument.imageUrl)) {
              await deleteFile(pendingDocument.imageUrl);
            }
          } catch (error) {
            const imageUrlErrorMsgPart = isStringEmpty(pendingDocument.imageUrl)
              ? ''
              : ', image: ' + pendingDocument.imageUrl;

            console.error(
              `Failed to delete document file: ${pendingDocument.fileUrl}${imageUrlErrorMsgPart}. These files should be deleted manually.`,
              error
            );
          }

          ee.emit('pendingDocument', 'error');
        }
      })();

      return pendingDocument;
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

      const updatedDocument = await ctx.prisma.document
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
        .delete({
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

      // Delete original file and image
      try {
        await deleteFile(pendingDocument.fileUrl);

        if (!isStringEmpty(pendingDocument.imageUrl)) {
          await deleteFile(pendingDocument.imageUrl);
        }
      } catch (error) {
        const imageUrlErrorMsgPart = isStringEmpty(pendingDocument.imageUrl)
          ? ''
          : ', image: ' + pendingDocument.imageUrl;

        console.error(
          `Failed to delete document file: ${pendingDocument.fileUrl}${imageUrlErrorMsgPart}. These files should be deleted manually.`,
          error
        );
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

      const document = await ctx.prisma.document
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
            message: 'Failed to delete document',
          });
        });

      // Delete from vector store
      try {
        await deleteCollection(document.vectorStoreId);
      } catch (error) {
        console.error(
          `Failed to delete collection for document ID ${document.id}. This collection should be deleted manually.`,
          error
        );
      }

      // Delete original file and image
      try {
        await deleteFile(document.fileUrl);

        if (!isStringEmpty(document.imageUrl)) {
          await deleteFile(document.imageUrl);
        }
      } catch (error) {
        const imageUrlErrorMsgPart = isStringEmpty(document.imageUrl)
          ? ''
          : ', image: ' + document.imageUrl;

        console.error(
          `Failed to delete document file: ${document.fileUrl}${imageUrlErrorMsgPart}. These files should be deleted manually.`,
          error
        );
      }

      // Deleting all conversations that are left without a document
      // @see https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#filter-on-absence-of--to-many-records
      try {
        await ctx.prisma.conversation.deleteMany({
          where: {
            documents: {
              none: {},
            },
          },
        });
      } catch (error) {
        console.error(
          'Error deleting leftover conversations with zero documents. These conversations should be deleted manually.',
          error
        );
      }

      return document;
    }),
});

// REUSABLE FUNCTIONS

async function getDocument(params: {
  prisma: PrismaClient;
  documentId: string;
  userId: string;
  select?: Prisma.DocumentFindUniqueArgs['select'];
  include?: Prisma.DocumentFindUniqueArgs['include'];
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
      users: {
        some: {
          id: _userId,
        },
      },
    },
    ...(params.select ? {select: params.select} : {}),
    ...(params.include ? {include: params.include} : {}),
  };

  const document = await params.prisma.document.findUnique(_options);

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

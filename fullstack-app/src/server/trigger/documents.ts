import {env} from '@/env';
import {createCaller} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {deleteCollection, embedPDF, getDocs} from '@/server/db/chroma';
import {prisma} from '@/server/db/prisma';
import {chunkString} from '@/server/document/chunking';
import {
  lintAndFixMarkdown,
  pdfParseWithLlamaparse,
  plaintifyMarkdown,
} from '@/server/document/parsing';
import {
  allowedAbsoluteDirPaths,
  deleteFile,
  getMostRecentFile,
  writeToTimestampedFile,
} from '@/server/utils/fileStorage';
import {isStringEmpty} from '@/utils/strings';
import {type Chroma} from '@langchain/community/vectorstores/chroma';
import {Prisma, STATUS} from '@prisma/client';
import {logger, task} from '@trigger.dev/sdk/v3';
import {IncludeEnum} from 'chromadb';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import './init';

export const fileParsingTask = task({
  id: 'file-parsing',
  maxDuration: 30 * 60, // 30 minutes
  retry: {
    maxAttempts: 0,
  },
  run: async (payload: {userId: string; pendingDocumentId: string}, {ctx}) => {
    logger.info('File parsing', {payload, ctx});

    // Update pending document status to RUNNING
    const pendingDocument = await (async () => {
      try {
        return await prisma.pendingDocument.update({
          where: {id: payload.pendingDocumentId},
          data: {status: STATUS.RUNNING, parsingTaskId: ctx.run.id},
        });
      } catch (error) {
        return new Error(
          `Failed to update pending document ID ${payload.pendingDocumentId} to RUNNING.`,
          {cause: error}
        );
      }
    })();

    if (pendingDocument == null || pendingDocument instanceof Error) {
      throw pendingDocument ?? new Error('Failed to update pending document');
    }

    let vectorStore: Chroma | null = null;
    try {
      const markdown = await (async () => {
        if (env.NODE_ENV === 'development' && env.MOCK_FILE_PARSING) {
          logger.debug('Mocking file parsing');

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
          destinationFolderPath: allowedAbsoluteDirPaths.publicParsingResults,
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

        logger.info('Retrieved chunks from Chroma:', {
          first10Chunks: embeddedChunks.slice(0, 10),
        });
      }

      // Creating the new 'document' db entry and deleting pending
      // document because when a document is done parsing we change its
      // classification from 'pending document' to 'document'.
      const [document, _] = await prisma.$transaction([
        prisma.document.create({
          data: {
            title: pendingDocument.title,
            description: pendingDocument.description,
            locale: pendingDocument.locale,
            fileUrl: pendingDocument.fileUrl,
            fileHash: pendingDocument.fileHash,
            imageUrl: pendingDocument.imageUrl,
            parsingTaskId: ctx.run.id,
            vectorStoreId: vectorStore.collectionName,
            users: {
              connect: {
                id: payload.userId,
              },
            },
          },
          select: {
            id: true,
          },
        }),

        prisma.pendingDocument.delete({
          where: {
            id: pendingDocument.id,
          },
        }),
      ]);

      return {
        documentId: document.id,
        pendingDocumentId: pendingDocument.id,
      };

      // TODO: Call an endpoint to emit the completion event from TRPC
    } catch (error) {
      logger.error('Error parsing document:', {error});

      // CLEANUP
      // Deleting pending document entry
      try {
        await prisma.pendingDocument.delete({
          where: {id: pendingDocument.id},
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          // If the document entry is not found, we don't need to delete it nor log an error.
        } else {
          logger.error(
            `Failed to delete pending document ID ${pendingDocument.id}. This pending document entry should be deleted manually.`,
            {error}
          );
        }
      }

      // Delete from vector store
      if (vectorStore != null) {
        try {
          await deleteCollection(vectorStore.collectionName);
        } catch (error) {
          logger.error(
            `Failed to delete collection ${vectorStore.collectionName} for document ID ${pendingDocument.id}. This collection should be deleted manually.`,
            {error}
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

        logger.error(
          `Failed to delete document file: ${pendingDocument.fileUrl}${imageUrlErrorMsgPart}. These files should be deleted manually.`,
          {error}
        );
      }

      throw error;
    }
  },
  async onSuccess(payload, output, params) {
    // Emitting the 'pendingDocument.finished' event
    const prismaUser = await prisma.user
      .findUniqueOrThrow({
        where: {
          id: payload.userId,
        },
      })
      .catch((error) => {
        logger.error(
          `Failed when retrieving prisma user. This shouldn't have happened.`,
          {payload, error}
        );
      });

    if (prismaUser == null) {
      return;
    }

    const trpc = createCaller(
      createInnerTRPCContext({
        prismaUser,
        authProviderUserId: prismaUser.authProviderId,
      })
    );

    await trpc.documents
      .triggerDevWebhookReceiver({
        pendingDocumentEventPayload: 'finished',
      })
      .catch((error) => {
        logger.error(
          `Failed when calling TRPC endpoint to emit the 'pendingDocument.finished' event.`,
          {payload, output, error}
        );
      });

    logger.info('Successfully emitted the "pendingDocument.finished" event.', {
      payload,
      output,
    });
  },
  async onFailure(payload, error, params) {
    // Emitting the 'pendingDocument.error' event
    const prismaUser = await prisma.user
      .findUniqueOrThrow({
        where: {
          id: payload.userId,
        },
      })
      .catch((error) => {
        logger.error(
          `Failed when retrieving prisma user. This shouldn't have happened.`,
          {payload, error}
        );
      });

    if (prismaUser == null) {
      return;
    }

    const trpc = createCaller(
      createInnerTRPCContext({
        prismaUser,
        authProviderUserId: prismaUser.authProviderId,
      })
    );

    await trpc.documents
      .triggerDevWebhookReceiver({
        pendingDocumentEventPayload: 'error',
      })
      .catch((error) => {
        logger.error(
          `Failed when calling TRPC endpoint to emit the 'pendingDocument.error' event.`,
          {payload, error}
        );
      });
  },
});

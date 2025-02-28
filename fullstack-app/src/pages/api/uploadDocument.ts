import {env} from '@/env';
import {createCaller} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {prisma} from '@/server/db/prisma';
import rateLimit from '@/server/middleware/rateLimit';
import {
  allowedAbsoluteDirPaths,
  deleteFile,
  FileAlreadyExistsError,
  getFile,
  saveUploadedDocFile,
  saveUploadedImageFile,
} from '@/server/utils/fileStorage';
import {type APIRouteErrorResponse} from '@/types/APIRouteErrorResponse';
import {
  type UploadNewDocumentPayload,
  UploadNewDocumentPayloadSchema,
} from '@/types/UploadNewDocumentPayload';
import {truncateFilename} from '@/utils/files';
import {isStringEmpty, nonEmptyStringSchema} from '@/utils/strings';
import {narrowType} from '@/utils/zod';
import {getAuth} from '@clerk/nextjs/server';
import NodeClam from 'clamscan';
import formidable, {type File as FileInfo} from 'formidable';
import type {NextApiRequest, NextApiResponse} from 'next';

export const config = {
  api: {
    // Disable body parsing, we use formidable
    bodyParser: false,
  },
};

const rateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per minute
});

const clamScan = await (async () => {
  try {
    return await new NodeClam().init({
      debugMode: env.NODE_ENV === 'development',
      clamdscan: {
        host: '127.0.0.1',
        port: 3310,
        timeout: 5 * 60 * 1000,
        multiscan: true,
      },
    });
  } catch (error) {
    console.error('ClamScan init error:', error);

    return null;
  }
})();

class VirusScanError extends Error {
  fileUrl: string;

  constructor(message: string, fileUrl: string) {
    super(message);
    this.name = 'VirusScanError';
    this.fileUrl = fileUrl;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.destroyed) {
    return await returnConnectionAbortedResponse({res});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      message: 'Method not allowed',
      data: {code: 'METHOD_NOT_SUPPORTED'},
    } satisfies APIRouteErrorResponse);
  }

  // Check authentication
  const {userId: userAuthId} = getAuth(req);

  if (!userAuthId) {
    return res.status(401).json({
      message: 'Unauthorized',
      data: {code: 'UNAUTHORIZED'},
    } satisfies APIRouteErrorResponse);
  }

  const isRateLimited = await rateLimiter.check({
    res,
    limit: env.API_REQUESTS_PER_MINUTE_PER_USER_RATE_LIMIT,
    token: userAuthId,
  });

  if (isRateLimited) {
    return res.status(429).json({
      message: 'Rate limit exceeded',
      data: {code: 'TOO_MANY_REQUESTS'},
    } satisfies APIRouteErrorResponse);
  }

  const prismaUser = await prisma.user.findFirst({
    where: {
      authProviderId: userAuthId,
    },
  });

  if (!prismaUser) {
    return res.status(401).json({
      message: 'Unauthorized',
      data: {code: 'UNAUTHORIZED'},
    } satisfies APIRouteErrorResponse);
  }

  // Parse the form data
  const parsedFormData = {} as Omit<
    UploadNewDocumentPayload,
    'file' | 'image'
  > & {
    file: FileInfo;
    image?: FileInfo;
  };

  const form = formidable({
    allowEmptyFiles: false,
    maxFiles: 2, // Allow both PDF and image
    uploadDir: allowedAbsoluteDirPaths.appTempDir,
    hashAlgorithm: 'sha256',
    keepExtensions: true,
    // TODO: Get this from the database instead of hardcoding it.
    maxTotalFileSize: 1000 * 1024 * 1024, // 1000MB
    filename: (name, ext, path, form) => {
      if (isStringEmpty(name)) {
        name = 'untitled';
      }

      return truncateFilename(name) + ext;
    },
    filter: (part) => {
      // Keep only images and pdfs
      const valid =
        !isStringEmpty(part.mimetype) &&
        (part.mimetype!.includes('image') || part.mimetype!.includes('pdf'));

      return valid;
    },
  });

  form
    .on('field', (fieldName, value) => {
      // @ts-expect-error - we are filling this so it's fine
      parsedFormData[fieldName] = value;
    })
    .on('file', (fieldName, file) => {
      // @ts-expect-error - we are filling this so it's fine
      parsedFormData[fieldName] = file;
    });

  try {
    await form.parse(req);
  } catch (error) {
    console.error('FormData upload error:', error);
    await cleanup({
      fileUrls: [parsedFormData.file?.filepath, parsedFormData.image?.filepath],
    });

    return res.status(500).json({
      message: 'Upload failed',
      data: {code: 'INTERNAL_SERVER_ERROR'},
    } satisfies APIRouteErrorResponse);
  }

  if (
    parsedFormData.file == null ||
    parsedFormData.file.mimetype !== 'application/pdf'
  ) {
    return res.status(400).json({
      message: 'A PDF file is required',
      data: {code: 'BAD_REQUEST'},
    } satisfies APIRouteErrorResponse);
  }

  if (req.destroyed) {
    return await returnConnectionAbortedResponse({
      res,
      cleanup: async () => {
        await cleanup({
          fileUrls: [
            parsedFormData.file?.filepath,
            parsedFormData.image?.filepath,
          ],
        });
      },
    });
  }

  const uploadedFileHash = parsedFormData.file.hash;

  if (!narrowType(nonEmptyStringSchema, uploadedFileHash)) {
    console.error('File hash could not be generated');
    await cleanup({
      fileUrls: [parsedFormData.file?.filepath, parsedFormData.image?.filepath],
    });

    return res.status(500).json({
      message: 'File hash could not be generated',
      data: {code: 'INTERNAL_SERVER_ERROR'},
    } satisfies APIRouteErrorResponse);
  }

  // FILE VIRUS SCANNING
  if (clamScan == null) {
    console.error('Virus engine not initialized. Cannot scan file.');
    await cleanup({
      fileUrls: [parsedFormData.file?.filepath, parsedFormData.image?.filepath],
    });

    return res.status(500).json({
      message: 'Virus engine not initialized. Cannot scan file.',
      data: {code: 'INTERNAL_SERVER_ERROR'},
    } satisfies APIRouteErrorResponse);
  }

  try {
    const filePathsToScan = [
      parsedFormData.file?.filepath,
      parsedFormData.image?.filepath,
    ].filter((path): path is string => {
      return !isStringEmpty(path);
    });

    const clamScanResult = await clamScan.scanFiles(filePathsToScan);
    if (clamScanResult.badFiles.length > 0) {
      throw new VirusScanError(
        'Files are infected with malware.',
        clamScanResult.badFiles.join(', ')
      );
    }
  } catch (error) {
    console.error('Virus scan error: ', error);
    await cleanup({
      fileUrls: [parsedFormData.file?.filepath, parsedFormData.image?.filepath],
    });

    if (error instanceof VirusScanError) {
      return res.status(400).json({
        message: 'Files are infected with malware.',
        data: {code: 'BAD_REQUEST'},
      } satisfies APIRouteErrorResponse);
    }

    return res.status(500).json({
      message: 'File virus scanning failed. Cannot proceed securely.',
      data: {code: 'INTERNAL_SERVER_ERROR'},
    } satisfies APIRouteErrorResponse);
  }

  if (req.destroyed) {
    console.log('Connection aborted (socket destroyed)');
    await cleanup({
      fileUrls: [parsedFormData.file?.filepath, parsedFormData.image?.filepath],
    });

    return res.status(204).json({
      message: 'Connection aborted (socket destroyed)',
      data: {code: 'CLIENT_CLOSED_REQUEST'},
    } satisfies APIRouteErrorResponse);
  }

  // VERIFYING FORM DATA
  const docTempFile = await getFile({
    filePath: parsedFormData.file.filepath,
    mimeType: parsedFormData.file.mimetype ?? 'application/pdf',
  });

  const imageTempFile =
    parsedFormData.image != null
      ? await getFile({
          filePath: parsedFormData.image.filepath,
          mimeType: parsedFormData.image.mimetype ?? 'image/*',
        })
      : undefined;

  const zodResult = UploadNewDocumentPayloadSchema.safeParse({
    ...parsedFormData,
    file: docTempFile,
    image: imageTempFile,
  });

  if (!zodResult.success) {
    console.error(zodResult.error);

    await cleanup({
      fileUrls: [parsedFormData.file.filepath, parsedFormData.image?.filepath],
    });

    return res.status(400).json({
      message: 'Invalid request body',
      data: {code: 'BAD_REQUEST'},
    } satisfies APIRouteErrorResponse);
  }

  if (req.destroyed) {
    return await returnConnectionAbortedResponse({
      res,
      cleanup: async () => {
        await cleanup({
          fileUrls: [
            parsedFormData.file?.filepath,
            parsedFormData.image?.filepath,
          ],
        });
      },
    });
  }

  let imageUrl: string | undefined;

  if (zodResult.data.image != null) {
    try {
      const imageResult = await saveUploadedImageFile({
        imageFile: zodResult.data.image,
      });

      imageUrl = imageResult.fileUrl;

      if (!imageUrl) {
        throw new Error('Image file upload failed');
      }
    } catch (error) {
      console.error('Image file upload error (non-critical):', error);

      await cleanup({
        fileUrls: [parsedFormData.image?.filepath, imageUrl],
      });

      // Don't return, if we couldn't save the image, it's not a big deal.
    }
  }

  // CHECK IF DOCUMENT IS ALREADY UPLOADED
  const existingFile = await prisma.documentFile.findFirst({
    where: {hash: uploadedFileHash},
    include: {
      userDocuments: {
        select: {userId: true},
      },
    },
  });

  if (existingFile != null) {
    await cleanup({
      fileUrls: [parsedFormData.file?.filepath],
    });

    // If user is already linked to this document, return conflict
    if (
      existingFile.userDocuments.some((doc) => doc.userId === prismaUser.id)
    ) {
      return res.status(409).json({
        message: 'User already has this document uploaded',
        data: {code: 'CONFLICT'},
      } satisfies APIRouteErrorResponse);
    }

    // If file exists but user is not linked, create new UserDocument and return success
    const userDocument = await prisma.userDocument.create({
      data: {
        title: zodResult.data.title,
        searchTitle: zodResult.data.title.toLowerCase(),
        description: zodResult.data.description,
        imageUrl,
        user: {
          connect: {
            id: prismaUser.id,
          },
        },
        file: {
          connect: {
            id: existingFile.id,
          },
        },
      },
    });

    return res.status(200).json({
      message: 'Document linked successfully',
      data: {
        documentId: userDocument.id,
      },
    });
  }

  // UPLOADING NEW DOCUMENT FILE
  // If we reached here, it means the file didn't previously exist.
  let fileUrl: string | undefined;
  let fileHash: string | undefined;

  try {
    const fileResult = await saveUploadedDocFile({
      file: zodResult.data.file,
      fileHash: uploadedFileHash,
    });

    fileUrl = fileResult.fileUrl;
    fileHash = fileResult.fileHash;

    if (!fileUrl || !fileHash) {
      throw new Error('Document file upload failed');
    }
  } catch (error) {
    const pathsToCleanup = [
      parsedFormData.file.filepath,
      parsedFormData.image?.filepath,
      fileUrl,
      imageUrl,
    ];

    if (error instanceof FileAlreadyExistsError) {
      console.error(error);

      await cleanup({
        fileUrls: pathsToCleanup,
      });

      return res.status(409).json({
        message: 'File already exists',
        data: {code: 'CONFLICT'},
      } satisfies APIRouteErrorResponse);
    }

    console.error('Document file upload error:', error);

    await cleanup({
      fileUrls: pathsToCleanup,
    });

    return res.status(500).json({
      message: 'Upload failed',
      data: {code: 'INTERNAL_SERVER_ERROR'},
    } satisfies APIRouteErrorResponse);
  }

  if (req.destroyed) {
    return await returnConnectionAbortedResponse({
      res,
      cleanup: async () => {
        await cleanup({
          fileUrls: [
            parsedFormData.file?.filepath,
            parsedFormData.image?.filepath,
            fileUrl,
            imageUrl,
          ],
        });
      },
    });
  }

  // Calling TRPC procedure to parse the document
  const trpc = createCaller(
    createInnerTRPCContext({
      req,
      res,
      authProviderUserId: userAuthId,
      prismaUser,
    })
  );

  // TODO: If the TRPC procedure fails, we need to delete the uploaded file.
  const trpcResponse = await trpc.documents.parseDocument({
    title: zodResult.data.title,
    locale: zodResult.data.locale,
    description: zodResult.data.description,
    documentType: zodResult.data.documentType,
    fileUrl,
    fileHash,
    imageUrl,
  });

  return res.status(200).json(trpcResponse);
}

async function cleanup({fileUrls}: {fileUrls: (string | null | undefined)[]}) {
  await Promise.allSettled(
    fileUrls
      .filter((url): url is string => !isStringEmpty(url))
      .map(async (fileUrl) => {
        try {
          await deleteFile(fileUrl);
        } catch (error) {
          console.error(
            `Failed to delete file '${fileUrl}' during /api/uploadDocument cleanup process: `,
            error
          );
        }
      })
  );
}

async function returnConnectionAbortedResponse(params: {
  res: NextApiResponse;
  cleanup?: () => Promise<void>;
}) {
  try {
    await params.cleanup?.();
  } catch (error) {
    console.error(
      'Cleanup failed during returnConnectionAbortedResponse:',
      error
    );
  }

  console.error('Connection timed out (req.destroyed === true)');

  return params.res.status(408).json({
    message: 'Request timeout',
    data: {code: 'TIMEOUT'},
  } satisfies APIRouteErrorResponse);
}

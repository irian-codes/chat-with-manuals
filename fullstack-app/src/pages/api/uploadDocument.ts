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
  saveUploadedFile,
} from '@/server/utils/fileStorage';
import {
  type UploadDocumentPayload,
  UploadDocumentPayloadSchema,
} from '@/types/UploadDocumentPayload';
import {truncateFilename} from '@/utils/files';
import {isStringEmpty} from '@/utils/strings';
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  // Check authentication
  const {userId: userAuthId} = getAuth(req);

  if (!userAuthId) {
    return res.status(401).json({error: 'Unauthorized'});
  }

  const isRateLimited = await rateLimiter.check({
    res,
    limit: env.API_REQUESTS_PER_MINUTE_PER_USER_RATE_LIMIT,
    token: userAuthId,
  });

  if (isRateLimited) {
    return res.status(429).json({error: 'Rate limit exceeded'});
  }

  const prismaUser = await prisma.user.findFirst({
    where: {
      authProviderId: userAuthId,
    },
  });

  if (!prismaUser) {
    return res.status(401).json({error: 'Unauthorized'});
  }

  // Parse the form data
  const parsedFormData = {} as Omit<UploadDocumentPayload, 'file'> & {
    file: FileInfo;
  };

  const form = formidable({
    allowEmptyFiles: false,
    maxFiles: 1,
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
    await cleanup({fileUrls: [parsedFormData.file.filepath]});

    return res.status(500).json({error: 'Upload failed'});
  }

  // FILE VIRUS SCANNING
  if (clamScan == null) {
    console.error('Virus engine not initialized. Cannot scan file.');
    await cleanup({fileUrls: [parsedFormData.file.filepath]});

    return res
      .status(500)
      .json({error: 'Virus engine not initialized. Cannot scan file.'});
  }

  try {
    const {isInfected} = await clamScan.isInfected(
      parsedFormData.file.filepath
    );

    if (isInfected) {
      return res.status(400).json({
        error: 'File is infected with malware.',
      });
    }
  } catch (error) {
    console.error('Virus scan error: ', error);
    await cleanup({fileUrls: [parsedFormData.file.filepath]});

    return res
      .status(500)
      .json({error: 'File virus scanning failed. Cannot proceed securely.'});
  }

  const file = await getFile(parsedFormData.file.filepath);

  const zodResult = UploadDocumentPayloadSchema.safeParse({
    ...parsedFormData,
    file,
  });

  if (!zodResult.success) {
    console.error(zodResult.error);
    await cleanup({fileUrls: [parsedFormData.file.filepath]});

    return res.status(400).json({error: 'Invalid request body'});
  }

  let fileUrl: string;
  let fileHash: string;
  try {
    const result = await saveUploadedFile(zodResult.data.file);

    fileUrl = result.fileUrl;
    fileHash = result.fileHash;

    if (!fileUrl || !fileHash) {
      await cleanup({fileUrls: [parsedFormData.file.filepath, fileUrl]});

      throw new Error('File upload failed');
    }
  } catch (error) {
    if (error instanceof FileAlreadyExistsError) {
      console.error(error);
      await cleanup({fileUrls: [parsedFormData.file.filepath]});

      return res.status(400).json({error: 'File already exists'});
    }

    console.error('Document file upload error:', error);
    // @ts-expect-error - it's fine since the function is robust against empty undefined values
    await cleanup({fileUrls: [parsedFormData.file.filepath, fileUrl]});

    return res.status(500).json({error: 'Upload failed'});
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
    ...zodResult.data,
    fileUrl,
    fileHash,
  });

  return res.status(200).json(trpcResponse);
}

async function cleanup({fileUrls}: {fileUrls: string[]}) {
  await Promise.allSettled(
    fileUrls
      .filter((url) => !isStringEmpty(url))
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

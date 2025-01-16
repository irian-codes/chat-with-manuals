import {env} from '@/env';
import {createCaller} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {prisma} from '@/server/db/prisma';
import rateLimit from '@/server/middleware/rateLimit';
import {
  allowedAbsoluteDirPaths,
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // TODO #18: Ensure this endpoint is secure.
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

    return res.status(500).json({error: 'Upload failed'});
  }

  const file = await getFile(parsedFormData.file.filepath);

  const zodResult = UploadDocumentPayloadSchema.safeParse({
    ...parsedFormData,
    file,
  });

  if (!zodResult.success) {
    console.error(zodResult.error);

    return res.status(400).json({error: 'Invalid request body'});
  }

  let fileUrl: string;
  let fileHash: string;
  try {
    const result = await saveUploadedFile(zodResult.data.file);

    fileUrl = result.fileUrl;
    fileHash = result.fileHash;

    if (!fileUrl || !fileHash) {
      throw new Error('File upload failed');
    }
  } catch (error) {
    if (error instanceof FileAlreadyExistsError) {
      console.error(error);

      return res.status(400).json({error: 'File already exists'});
    }

    console.error('Document file upload error:', error);

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

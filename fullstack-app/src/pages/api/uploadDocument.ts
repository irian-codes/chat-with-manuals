import {createCaller} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {db} from '@/server/db';
import {getFile, saveUploadedFile} from '@/server/utils/fileStorage';
import {
  type UploadDocumentPayload,
  UploadDocumentPayloadSchema,
} from '@/types/UploadDocumentPayload';
import {getAuth} from '@clerk/nextjs/server';
import formidable, {type File as FileInfo} from 'formidable';
import type {NextApiRequest, NextApiResponse} from 'next';
import os from 'node:os';

export const config = {
  api: {
    // Disable body parsing, we use formidable
    bodyParser: false,
  },
};

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

  const dbUser = await db.user.findFirst({
    where: {
      authProviderId: userAuthId,
    },
  });

  if (!dbUser) {
    return res.status(401).json({error: 'Unauthorized'});
  }

  // Parse the form data
  const parsedFormData = {} as Omit<UploadDocumentPayload, 'file'> & {
    file: FileInfo;
  };

  const form = formidable({
    allowEmptyFiles: false,
    maxFiles: 1,
    uploadDir: os.tmpdir(),
    hashAlgorithm: 'sha256',
    keepExtensions: true,
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
    console.error('Document file upload error:', error);

    return res.status(500).json({error: 'Upload failed'});
  }

  // Calling TRPC procedure to parse the document
  const trpc = createCaller(
    createInnerTRPCContext({
      req,
      res,
      authProviderUserId: userAuthId,
      dbUser,
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

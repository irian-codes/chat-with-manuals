import {env} from '@/env';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// TODO #17: Move this to a SECURE storage solution.
const isDevEnv = env.NODE_ENV === 'development';
const UPLOADS_DIR = path.join(
  'public',
  isDevEnv ? 'temp' : '',
  'uploads/files'
);

export class FileAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileAlreadyExistsError';
  }
}

export async function saveUploadedFile(
  file: File,
  fileHash?: string
): Promise<{
  fileUrl: string;
  fileHash: string;
}> {
  // Ensure uploads directory exists
  await fs.mkdir(UPLOADS_DIR, {recursive: true});

  // Read file content and calculate hash
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const _fileHash =
    fileHash ??
    crypto.createHash('sha256').update(fileBuffer).digest().toString('hex');

  // Generate unique filename using the hash
  const fileName = `${_fileHash}.pdf`;
  const filePath = path.join(process.cwd(), UPLOADS_DIR, fileName);

  // Check if file already exists
  if (await fileExists(filePath)) {
    throw new FileAlreadyExistsError('File already exists');
  }

  // Save file
  await fs.writeFile(filePath, fileBuffer);

  return {
    fileUrl: filePath.replace(process.cwd(), ''),
    fileHash: _fileHash,
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFile(filePath: string): Promise<File> {
  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);

  return new File([fileBuffer], fileName, {type: 'application/pdf'});
}

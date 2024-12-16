import {env} from '@/env';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {z} from 'zod';

// TODO #17: Move this to a SECURE storage solution.
const isDevEnv = env.NODE_ENV === 'development';
const ABSOLUTE_UPLOADS_DIR = resolveAbsolutePath(
  path.join('public', isDevEnv ? 'temp' : '', 'uploads/files')
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
  z.instanceof(File).parse(file);
  z.string().min(1).max(64).optional().parse(fileHash);

  await fs.mkdir(ABSOLUTE_UPLOADS_DIR, {recursive: true});

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const _fileHash =
    fileHash ??
    crypto.createHash('sha256').update(fileBuffer).digest().toString('hex');

  const fileName = `${_fileHash}.pdf`;
  const filePath = path.join(ABSOLUTE_UPLOADS_DIR, fileName);

  if (await fileExists(filePath)) {
    throw new FileAlreadyExistsError('File already exists');
  }

  await fs.writeFile(filePath, fileBuffer);

  return {
    fileUrl: filePath.replace(process.cwd(), ''),
    fileHash: _fileHash,
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  const absolutePath = z
    .string()
    .trim()
    .min(1)
    .refine(isPathSafe)
    .transform(resolveAbsolutePath)
    .parse(filePath);

  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFile(filePath: string): Promise<File> {
  const absolutePath = z
    .string()
    .trim()
    .min(1)
    .refine(isPathSafe)
    .transform(resolveAbsolutePath)
    .parse(filePath);

  const fileBuffer = await fs.readFile(absolutePath);
  const fileName = path.basename(absolutePath);

  return new File([fileBuffer], fileName, {type: 'application/pdf'});
}

export async function deleteFile(filePath: string): Promise<void> {
  const absolutePath = z
    .string()
    .trim()
    .min(1)
    .refine(isPathSafe)
    .transform(resolveAbsolutePath)
    .parse(filePath);

  if (
    !absolutePath.startsWith(os.tmpdir()) &&
    !isPathInUploadsDir(absolutePath)
  ) {
    throw new Error(
      `Invalid file path: File must be in uploads directory. Path: ${absolutePath}`
    );
  }

  await fs.unlink(absolutePath);
}

export async function copyFile(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  const absoluteSourcePath = z
    .string()
    .trim()
    .min(1)
    .refine(isPathSafe)
    .transform(resolveAbsolutePath)
    .parse(sourcePath);

  const absoluteDestinationPath = z
    .string()
    .trim()
    .min(1)
    .refine(isPathSafe)
    .transform(resolveAbsolutePath)
    .parse(destinationPath);

  await fs.mkdir(path.dirname(absoluteDestinationPath), {recursive: true});

  const exists = await fileExists(absoluteSourcePath);
  if (!exists) {
    throw new Error(`Source file does not exist. Path:  ${absoluteSourcePath}`);
  }

  await fs.copyFile(absoluteSourcePath, absoluteDestinationPath);
}

export async function copyFileToTempDir(filePath: string): Promise<string> {
  const absoluteSourcePath = z
    .string()
    .trim()
    .min(1)
    .refine(isPathSafe)
    .transform(resolveAbsolutePath)
    .parse(filePath);

  const tempDir = path.join(os.tmpdir(), 'chat-with-manuals/trash');
  const tempPath = path.join(tempDir, path.basename(absoluteSourcePath));

  await copyFile(absoluteSourcePath, tempPath);

  return tempPath;
}

function resolveAbsolutePath(filePath: string): string {
  const _filePath = z
    .string()
    .trim()
    .min(1)
    .transform((_path) => path.normalize(_path))
    .refine(isPathSafe)
    .parse(filePath);

  if (_filePath.startsWith(os.tmpdir())) {
    return _filePath;
  }

  return _filePath.startsWith(process.cwd())
    ? _filePath
    : path.join(process.cwd(), _filePath);
}

function isPathInUploadsDir(filePath: string): boolean {
  const absoluteSourcePath = z
    .string()
    .trim()
    .min(1)
    .refine(isPathSafe)
    .transform(resolveAbsolutePath)
    .parse(filePath);

  return absoluteSourcePath.startsWith(ABSOLUTE_UPLOADS_DIR);
}

function isPathSafe(filePath: string): boolean {
  const _filePath = z.string().trim().min(1).parse(filePath);

  // Check for null bytes
  if (_filePath.includes('\0')) {
    return false;
  }

  // Only allow alphanumeric characters, dots, dashes and forward slashes
  if (!/^[a-zA-Z0-9\-\.\/]+$/.test(_filePath)) {
    return false;
  }

  // Prevent directory traversal
  const normalizedPath = path.normalize(_filePath);
  if (normalizedPath.includes('..')) {
    return false;
  }

  // Check for hidden files (starting with dot)
  if (_filePath.split('/').some((part) => part.startsWith('.'))) {
    return false;
  }

  // Check maximum path length (prevent potential DoS)
  const MAX_PATH_LENGTH = 255; // Adjust based on your requirements
  if (_filePath.length > MAX_PATH_LENGTH) {
    return false;
  }

  return true;
}

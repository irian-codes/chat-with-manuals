import {env} from '@/env';
import {isStringEmpty} from '@/utils/strings';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {z} from 'zod';

// TODO #17: Move this to a SECURE storage solution.
const isDevEnv = env.NODE_ENV === 'development';

export const allowedAbsoluteDirPaths = {
  publicUploadedFiles: ensureAbsolutePath(
    path.join('public', isDevEnv ? 'temp' : '', 'uploads/files')
  ),
  publicParsingResults: ensureAbsolutePath(
    path.join('public', isDevEnv ? 'temp' : '', 'parsing-results')
  ),
  appTempDir: ensureAbsolutePath(path.join(os.tmpdir(), 'chat-with-manuals')),
} as const;

// Ensure that directories exist, if not create them
void Promise.all(
  Object.values(allowedAbsoluteDirPaths).map(async (dir) => {
    await fs.mkdir(dir, {recursive: true});
  })
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
  const _file = z.instanceof(File).parse(file);

  await fs.mkdir(allowedAbsoluteDirPaths.publicUploadedFiles, {
    recursive: true,
  });

  const fileBuffer = Buffer.from(await _file.arrayBuffer());
  const _fileHash =
    z.string().trim().min(1).max(64).optional().parse(fileHash) ??
    crypto.createHash('sha256').update(fileBuffer).digest().toString('hex');

  const fileName = `${_fileHash}.pdf`;
  const filePath = path.join(
    allowedAbsoluteDirPaths.publicUploadedFiles,
    fileName
  );

  if (await fileExists(filePath)) {
    throw new FileAlreadyExistsError('File already exists');
  }

  await fs.writeFile(filePath, fileBuffer);

  return {
    fileUrl: filePath.replace(process.cwd(), ''),
    fileHash: _fileHash,
  };
}

export async function writeToTimestampedFile(params: {
  content: string;
  destinationFolderPath: string;
  fileName: string;
  fileExtension: string;
  prefix?: string;
  suffix?: string;
}): Promise<string> {
  const paramsSchema = await z
    .object({
      content: z.string().trim().min(1),
      destinationFolderPath: z
        .string()
        .transform((val) => validateAndResolvePath(val))
        .refine(async (val) => {
          try {
            const stats = await fs.stat(val);
            return stats.isDirectory();
          } catch {
            return false;
          }
        }),
      fileName: z
        .string()
        .trim()
        .refine((val) => !isStringEmpty(val), {
          message: 'File name cannot be empty',
        }),
      fileExtension: z
        .string()
        .trim()
        .refine((val) => !isStringEmpty(val)),
      prefix: z.string().trim().optional().default(''),
      suffix: z.string().trim().optional().default(''),
    })
    .parseAsync(params);

  const _prefix = !isStringEmpty(paramsSchema.prefix)
    ? paramsSchema.prefix + '_'
    : '';
  const _suffix = !isStringEmpty(paramsSchema.suffix)
    ? '_' + paramsSchema.suffix
    : '';
  const _fileName = paramsSchema.fileName;
  const _fileExtension = paramsSchema.fileExtension;
  const _content = paramsSchema.content;
  const _destinationFolderPath = paramsSchema.destinationFolderPath;
  const date: string =
    '_' +
    new Date().toISOString().slice(0, 10).replace(/-/g, '') +
    '-' +
    new Date().toTimeString().slice(0, 5).replace(/:/g, '');

  const absolutePath = path.join(
    _destinationFolderPath,
    `${_prefix}${_fileName}${_suffix}${date}.${_fileExtension}`
  );

  await fs.mkdir(path.dirname(absolutePath), {recursive: true});
  await fs.writeFile(absolutePath, _content);

  return absolutePath;
}

export async function fileExists(filePath: string): Promise<boolean> {
  const absolutePath = validateAndResolvePath(filePath);

  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFile(filePath: string): Promise<File> {
  const absolutePath = validateAndResolvePath(filePath);
  const fileBuffer = await fs.readFile(absolutePath);
  const fileName = path.basename(absolutePath);

  return new File([fileBuffer], fileName, {type: 'application/pdf'});
}

export async function deleteFile(filePath: string): Promise<void> {
  const absolutePath = validateAndResolvePath(filePath);

  await fs.unlink(absolutePath);
}

export async function copyFile(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  const absoluteSourcePath = validateAndResolvePath(sourcePath);
  const absoluteDestinationPath = validateAndResolvePath(destinationPath);

  await fs.mkdir(path.dirname(absoluteDestinationPath), {recursive: true});

  const exists = await fileExists(absoluteSourcePath);
  if (!exists) {
    throw new Error(`Source file does not exist. Path:  ${absoluteSourcePath}`);
  }

  await fs.copyFile(absoluteSourcePath, absoluteDestinationPath);
}

export async function copyFileToTempDir(filePath: string): Promise<string> {
  const absoluteSourcePath = validateAndResolvePath(filePath);

  const tempPath = path.join(
    allowedAbsoluteDirPaths.appTempDir,
    path.basename(absoluteSourcePath)
  );

  await copyFile(absoluteSourcePath, tempPath);

  return tempPath;
}

function ensureAbsolutePath(filePath: string): string {
  const _filePath = z
    .string()
    .trim()
    .min(1)
    .transform((_path) => path.normalize(_path))
    .refine(isPathSafe, {
      message: `Path is not safe. Got: ${filePath}`,
    })
    .parse(filePath);

  const absolutePath = _filePath.startsWith(os.tmpdir())
    ? _filePath
    : _filePath.startsWith(process.cwd())
      ? _filePath
      : path.join(process.cwd(), _filePath);

  return absolutePath;
}

function isPathInValidDir(filePath: string): boolean {
  const absolutePath = ensureAbsolutePath(filePath);

  return Object.values(allowedAbsoluteDirPaths).some((dir) =>
    absolutePath.startsWith(dir)
  );
}

export function validateAndResolvePath(filePath: string): string {
  const absolutePath = ensureAbsolutePath(filePath);

  if (!isPathInValidDir(absolutePath)) {
    throw new Error(
      `Path must be within allowed directories. Got: ${absolutePath}`
    );
  }

  return absolutePath;
}

function isPathSafe(filePath: string): boolean {
  try {
    z.string().trim().min(1).parse(filePath);
  } catch (error) {
    return false;
  }

  const _filePath = filePath.trim();

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

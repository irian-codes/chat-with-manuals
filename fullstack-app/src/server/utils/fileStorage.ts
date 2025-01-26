import {env} from '@/env';
import {isStringEmpty} from '@/utils/strings';
import mime from 'mime';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';

// TODO #17: Move this to a SECURE storage solution.
const isDevEnv = env.NODE_ENV === 'development';

export const allowedAbsoluteDirPaths = {
  publicUploadedFiles: ensureAbsolutePath(
    path.join('public', isDevEnv ? 'temp' : '', 'uploads/files')
  ),
  publicUploadedImages: ensureAbsolutePath(
    path.join('public', isDevEnv ? 'temp' : '', 'uploads/images')
  ),
  publicParsingResults: ensureAbsolutePath(
    path.join('public', isDevEnv ? 'temp' : '', 'parsing-results')
  ),
  publicLlmAnswers: ensureAbsolutePath(
    path.join('public', isDevEnv ? 'temp' : '', 'llm-answers')
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

export async function saveUploadedDocFile({
  file,
  fileHash,
}: {
  file: File;
  fileHash?: string;
}): Promise<{
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

export async function saveUploadedImageFile({
  imageFile,
}: {
  imageFile: File;
}): Promise<{
  fileUrl: string;
}> {
  const _file = z.instanceof(File).parse(imageFile);
  const _extension = z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (val) => val.startsWith('image/') && mime.getExtension(val) != null,
      {
        message: 'Invalid file type',
      }
    )
    .transform((val) => mime.getExtension(val))
    .parse(_file.type);

  await fs.mkdir(allowedAbsoluteDirPaths.publicUploadedImages, {
    recursive: true,
  });

  const fileBuffer = Buffer.from(await _file.arrayBuffer());

  const fileName = `${uuidv4()}.${_extension}`;
  const filePath = path.join(
    allowedAbsoluteDirPaths.publicUploadedImages,
    fileName
  );

  await fs.writeFile(filePath, fileBuffer);

  return {
    fileUrl: filePath.replace(process.cwd(), ''),
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
    new Date().toTimeString().slice(0, 5).replace(/:/g, '') +
    '-' +
    new Date().toTimeString().slice(5, 8).replace(/:/g, '');

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

export async function getFile({
  filePath,
  mimeType,
}: {
  filePath: string;
  mimeType: string;
}): Promise<File> {
  const absolutePath = validateAndResolvePath(filePath);
  const fileBuffer = await fs.readFile(absolutePath);
  const fileName = path.basename(absolutePath);

  return new File([fileBuffer], fileName, {type: mimeType});
}

export async function getMostRecentFile({
  dirPath,
  extensions = [],
}: {
  dirPath: string;
  extensions?: string[];
}): Promise<File> {
  const absolutePath = validateAndResolvePath(dirPath);
  const _extensions = z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .refine((ext) => ext.startsWith('.'), {
          message: 'Extension must start with a dot',
        })
    )
    .parse(extensions);

  const files = await fs.readdir(absolutePath);
  if (files.length === 0) {
    throw new Error(`No files found in directory: ${dirPath}`);
  }

  const fileStats = await Promise.all(
    files.map(async (file) => ({
      name: file,
      path: path.join(absolutePath, file),
      stats: await fs.stat(path.join(absolutePath, file)),
    }))
  );

  const mostRecentFile = fileStats
    .filter((file) => file.stats.isFile())
    .filter((file) => {
      if (_extensions.length === 0) {
        return true;
      }

      return _extensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    })
    .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime())[0];

  if (!mostRecentFile) {
    throw new Error(`No valid files found in directory: ${dirPath}`);
  }

  return getFile({
    filePath: mostRecentFile.path,
    mimeType: mime.getType(mostRecentFile.name) ?? 'application/octet-stream',
  });
}

export async function deleteFile(filePath: string): Promise<void> {
  const absolutePath = validateAndResolvePath(filePath);

  await fs.unlink(absolutePath);
}

export async function copyFile({
  sourcePath,
  destinationPath,
}: {
  sourcePath: string;
  destinationPath: string;
}): Promise<void> {
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

  await copyFile({sourcePath: absoluteSourcePath, destinationPath: tempPath});

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
    console.error(
      'Filepath validation error: Invalid file path format',
      filePath,
      error
    );
    return false;
  }

  const _filePath = filePath.trim();

  // Check for null bytes
  if (_filePath.includes('\0')) {
    console.error(
      'Filepath validation error: File path contains null bytes',
      _filePath
    );
    return false;
  }

  // Only allow alphanumeric characters, dots, dashes and forward slashes
  if (!/^[ a-z0-9\-_()\[\]\.\/]+$/i.test(_filePath)) {
    console.error(
      'Filepath validation error: File path contains invalid characters',
      _filePath
    );
    return false;
  }

  // Prevent directory traversal
  const normalizedPath = path.normalize(_filePath);
  if (normalizedPath.includes('..')) {
    console.error(
      'Filepath validation error: Directory traversal attempt detected',
      _filePath
    );
    return false;
  }

  // Check for hidden files (starting with dot)
  if (_filePath.split('/').some((part) => part.startsWith('.'))) {
    console.error(
      'Filepath validation error: File path contains hidden files',
      _filePath
    );
    return false;
  }

  // Check maximum path length (prevent potential DoS)
  const MAX_PATH_LENGTH = 255; // Adjust based on your requirements
  if (_filePath.length > MAX_PATH_LENGTH) {
    console.error(
      'Filepath validation error: File path exceeds maximum length',
      _filePath
    );
    return false;
  }

  return true;
}

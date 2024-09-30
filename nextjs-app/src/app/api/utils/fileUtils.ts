import {isBlankString} from '@/app/common/utils/stringUtils';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export async function downloadFile(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const blob = await response.blob();
  const fileName = url.split('/').pop() ?? 'tempFile.pdf';
  const file = new File([blob], fileName, {type: 'application/pdf'});

  return file;
}
export function validatePathExists(
  pathToCheck: unknown
): pathToCheck is string {
  if (typeof pathToCheck !== 'string') {
    throw new TypeError('Path must be a string');
  }

  return fs.existsSync(path.join(pathToCheck));
}

export function writeToTimestampedFile({
  content,
  destinationFolderPath,
  fileName,
  fileExtension,
  prefix = '',
  createFolderIfNotExists = false,
}: {
  content: string;
  destinationFolderPath: string;
  fileName: string;
  fileExtension: string;
  prefix?: string;
  createFolderIfNotExists?: boolean;
}): string {
  const _prefix = isBlankString(prefix) ? '' : prefix + '_';
  const date: string =
    new Date().toISOString().slice(0, 10).replace(/-/g, '') +
    new Date().toTimeString().slice(0, 5).replace(/:/g, '');

  const fullPath = path.join(
    process.cwd(),
    destinationFolderPath,
    `${_prefix}${fileName}_${date}.${fileExtension}`
  );

  const folderPath = path.dirname(fullPath);

  if (!validatePathExists(folderPath)) {
    if (createFolderIfNotExists) {
      fs.mkdirSync(folderPath, {recursive: true});
    } else {
      throw new Error(`Folder '${folderPath}' does not exist.`);
    }
  }

  try {
    fs.writeFileSync(fullPath, content);

    return fullPath;
  } catch (error) {
    console.error('Error saving file to filesystem:', error);

    throw new Error('Failed to save file to filesystem. Path: ' + fullPath);
  }
}

export async function saveFileObjectToFileSystem(
  file: File,
  destinationFolderPath: string = 'tmp'
): Promise<string> {
  const destDir = path.join(process.cwd(), destinationFolderPath);

  // Create directory if it doesn't exist
  if (!validatePathExists(destDir)) {
    fs.mkdirSync(destDir, {recursive: true});
  }

  const fullPath = path.join(destDir, file.name);

  try {
    // Save the file to the filesystem
    const buffer = await file.arrayBuffer();
    fs.writeFileSync(fullPath, Buffer.from(buffer));

    return fullPath;
  } catch (error) {
    console.error('Error saving file to filesystem:', error);

    throw new Error('Failed to save file to filesystem. Path: ' + fullPath);
  }
}

export function readFile(filePath: string): {
  content: Buffer;
  fileExtension: string;
} {
  return {
    content: fs.readFileSync(filePath),
    fileExtension: path.extname(filePath).slice(1),
  };
}

export async function getFileHash(file: File): Promise<string> {
  const hash = crypto.createHash('sha256');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    hash.update(buffer);

    return hash.digest('hex');
  } catch (error) {
    throw new Error(`Error hashing file: ${error?.message ?? 'Unknown error'}`);
  }
}

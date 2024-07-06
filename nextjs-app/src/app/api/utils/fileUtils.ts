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

  try {
    if (!fs.existsSync(path.join(pathToCheck))) {
      throw new Error(`Path ${pathToCheck} does not exist`);
    }
  } catch (error) {
    throw new Error(`Error checking path: ${error?.message ?? 'unknown'}`, {
      cause: error,
    });
  }

  return true;
}

export function writeToFile(
  content: string,
  destinationFolderPath: string,
  fileName: string,
  fileExtension: string
) {
  const fullPath = path.join(
    process.cwd(),
    destinationFolderPath,
    `parsedPdf_${fileName}_${new Date().toISOString().split('T')[0]}.${fileExtension}`
  );

  const folderPath = path.dirname(fullPath);

  if (!validatePathExists(folderPath)) {
    throw new Error(
      `Folder '${folderPath}' does not exist or is an invalid path`
    );
  }

  fs.writeFileSync(fullPath, content);
}

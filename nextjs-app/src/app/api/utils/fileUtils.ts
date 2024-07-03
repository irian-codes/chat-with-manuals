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
export function validateFilePath(
  filePath: unknown
): asserts filePath is string {
  if (typeof filePath !== 'string') {
    throw new TypeError('filePath must be a string');
  }

  if (!fs.existsSync(filePath.trim())) {
    throw new Error(`File ${filePath} does not exist`);
  }
}

export function writeToPublicFile(
  content: string,
  fileName: string,
  fileExtension: string
) {
  fs.writeFileSync(
    path.join(
      process.cwd(),
      'public',
      `parsedPdf_${fileName}_${new Date().toISOString().split('T')[0]}.${fileExtension}`
    ),
    content
  );
}

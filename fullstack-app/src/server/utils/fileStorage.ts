import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// TODO #17: Move this to a SECURE storage solution.
const UPLOADS_DIR = path.join(process.cwd(), 'public/uploads/files');

export async function saveUploadedFile(file: File): Promise<{
  fileUrl: string;
  fileHash: Buffer;
}> {
  // Ensure uploads directory exists
  await fs.mkdir(UPLOADS_DIR, {recursive: true});

  // Read file content and calculate hash
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest();

  // Generate unique filename using hash
  const fileName = `${fileHash.toString('hex')}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  // Save file
  await fs.writeFile(filePath, fileBuffer);

  return {
    fileUrl: `public/uploads/files/${fileName}`,
    fileHash,
  };
}

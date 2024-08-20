import {pdfParsingOutputScheme} from '@/app/common/types/PdfParsingOutput';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {
  deleteFileByHash,
  getFileByHash,
  initStorage,
  setFileByHash,
} from '../db/uploaded-files-db/files';
import {deleteCollection, embedPDF} from '../db/vector-db/VectorDB';
import {getFileHash} from '../utils/fileUtils';
import {
  chunkSectionsJson,
  lintAndFixMarkdown,
  markdownToSectionsJson,
  parsePdf,
} from './functions';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('pdf');
  const columnsNumber = Number(formData.get('columnsNumber'));
  const output = formData.get('output')?.toString();
  const force = formData.get('force')?.toString() === 'true';

  try {
    if (!(file instanceof File)) {
      throw new Error('The provided file is invalid or missing.');
    }

    if (file.type !== 'application/pdf') {
      throw new Error('The provided file is not a PDF.');
    }

    pdfParsingOutputScheme.parse(output);
    z.number().int().gt(0).parse(columnsNumber);

    const fileHash = await getFileHash(file);
    await initStorage();

    if (force) {
      const fileUUID = await getFileByHash(fileHash);

      if (fileUUID !== null) {
        try {
          await deleteCollection(fileUUID.collectionName);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'Document not found in vector store'
          ) {
            console.warn(
              "Trying to delete a non existent document in vector db, so it's fine"
            );
          } else {
            throw error;
          }
        }

        await deleteFileByHash(fileHash);
      }
    } else {
      if ((await getFileByHash(fileHash)) !== null) {
        throw new Error('File already embedded in the database.');
      }
    }

    const parseResult = await parsePdf({file, output, force, columnsNumber});

    switch (parseResult.contentType) {
      case 'json':
        // ⚠️ Outdated methods
        console.warn('Outdated method called');

        return NextResponse.json({
          result: JSON.parse(parseResult.text),
          cachedTimestamp: parseResult.cachedTime,
        });

      case 'string':
        // ⚠️ Outdated methods
        console.warn('Outdated method called');

        return NextResponse.json({
          result: parseResult.text,
          cachedTimestamp: parseResult.cachedTime,
        });

      case 'markdown':
        const lintedMarkdown = lintAndFixMarkdown(parseResult.text);
        const mdToJson = await markdownToSectionsJson(lintedMarkdown);
        const chunks = await chunkSectionsJson(mdToJson);
        const store = await embedPDF(fileHash, chunks);
        await setFileByHash(fileHash, {collectionName: store.collectionName});

        return NextResponse.json({
          result: {
            id: store.collectionName,
            metadata: store.collectionMetadata,
          },
          cachedTimestamp: parseResult.cachedTime,
        });

      default:
        throw new Error('Unsupported content type');
    }
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {error: (error as Error)?.message ?? 'Unknown error'},
      {status: 500}
    );
  }
}

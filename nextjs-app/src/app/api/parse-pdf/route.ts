import {
  PdfParsingOutput,
  pdfParsingOutputEnum,
} from '@/app/common/types/PdfParsingOutput';
import {NextRequest, NextResponse} from 'next/server';
import {
  getFileByHash,
  initStorage,
  setFileByHash,
} from '../db/uploaded-files-db/files';
import {embedPDF} from '../db/vector-db/VectorDB';
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
  const output = formData.get('output')?.toString();
  const force = formData.get('force')?.toString() === 'true';

  try {
    if (!(file instanceof File)) {
      throw new Error('The provided file is invalid or missing.');
    }

    if (file.type !== 'application/pdf') {
      throw new Error('The provided file is not a PDF.');
    }

    pdfParsingOutputEnum.parse(output);

    const fileHash = await getFileHash(file);
    await initStorage();

    if (!force) {
      if ((await getFileByHash(fileHash)) !== null) {
        throw new Error('File already embedded in the database.');
      }
    }

    const parseResult = await parsePdf(file, output as PdfParsingOutput, force);

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

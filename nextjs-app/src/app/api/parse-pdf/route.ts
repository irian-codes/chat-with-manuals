import {
  PdfParsingOutput,
  pdfParsingOutputEnum,
} from '@/app/common/types/PdfParsingOutput';
import {NextRequest, NextResponse} from 'next/server';
import {
  embedPDF,
  isFileAlreadyEmbedded,
} from '../send-prompt/vector-db/VectorDB';
import {getFileHash} from '../utils/fileUtils';
import {chunkSectionsJson, markdownToSectionsJson, parsePdf} from './functions';

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

    if (!force) {
      if (await isFileAlreadyEmbedded(fileHash)) {
        throw new Error('File already embedded in the database.');
      }
    }

    const parseResult = await parsePdf(file, output as PdfParsingOutput, force);

    switch (parseResult.contentType) {
      case 'json':
        return NextResponse.json({
          result: JSON.parse(parseResult.text),
          cachedTimestamp: parseResult.cachedTime,
        });

      case 'string':
        return NextResponse.json({
          result: parseResult.text,
          cachedTimestamp: parseResult.cachedTime,
        });

      case 'markdown':
        const mdToJson = await markdownToSectionsJson(parseResult.text);
        const chunks = await chunkSectionsJson(mdToJson);
        await embedPDF(fileHash, chunks);

        return NextResponse.json({
          result: chunks,
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

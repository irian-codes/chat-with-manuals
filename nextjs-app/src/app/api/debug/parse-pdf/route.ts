import {
  PdfParsingOutput,
  pdfParsingOutputEnum,
} from '@/app/common/types/PdfParsingOutput';
import {NextRequest, NextResponse} from 'next/server';
import {markdownSectionsJson, parsePdf} from './functions';

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
        const mdToJson = await markdownSectionsJson(parseResult.text);

        return NextResponse.json({
          result: mdToJson,
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

import {
  PdfParsingOutput,
  pdfParsingOutputEnum,
} from '@/app/common/types/PdfParsingOutput';
import {NextRequest, NextResponse} from 'next/server';
import {markdownToJson, parsePdf} from './functions';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('pdf');
  const output = formData.get('output')?.toString();

  try {
    if (!(file instanceof File)) {
      throw new Error('The provided file is invalid or missing.');
    }

    if (file.type !== 'application/pdf') {
      throw new Error('The provided file is not a PDF.');
    }

    pdfParsingOutputEnum.parse(output);

    const parseResult = await parsePdf(file, output as PdfParsingOutput);

    switch (parseResult.contentType) {
      case 'json':
      case 'string':
        return NextResponse.json({result: parseResult.text});

      case 'markdown':
        const mdToJson = markdownToJson(parseResult.text);
        return NextResponse.json({result: mdToJson});

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

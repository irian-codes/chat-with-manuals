import {NextRequest, NextResponse} from 'next/server';
import {parsePdf} from './functions';

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

    if (typeof output !== 'string' || output.trim().length === 0) {
      throw new Error("The 'output' field is required and must be a string.");
    }

    const result = await parsePdf(file, output);

    return NextResponse.json({result});
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {error: (error as Error)?.message ?? 'Unknown error'},
      {status: 500}
    );
  }
}

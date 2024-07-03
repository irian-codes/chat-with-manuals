import {assert} from 'console';
import {NextRequest, NextResponse} from 'next/server';
import {parsePdf} from './functions';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('pdf');
  assert(file instanceof File, 'file is required');

  const output = formData.get('output')?.toString();
  assert(typeof output === 'string', 'output is required and must be a string');

  try {
    const result = await parsePdf(URL.createObjectURL(file), output);
    return NextResponse.json({result});
  } catch (error) {
    return NextResponse.json({error}, {status: 500});
  }
}

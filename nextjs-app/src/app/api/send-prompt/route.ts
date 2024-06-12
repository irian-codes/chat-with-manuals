import {NextRequest, NextResponse} from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const prompt = formData.get('prompt') ?? '';

  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    return NextResponse.json({
      prompt,
    });
  } else {
    return NextResponse.json({error: 'Invalid prompt', prompt}, {status: 400});
  }
}

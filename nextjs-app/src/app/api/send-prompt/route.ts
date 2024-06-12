import {NextRequest, NextResponse} from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const prompt = formData.get('prompt') ?? '';
  return NextResponse.json({
    prompt,
    isValid: typeof prompt === 'string' && prompt.trim().length > 0,
  });
}

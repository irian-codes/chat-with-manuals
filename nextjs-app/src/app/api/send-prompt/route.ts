import {sendPrompt} from '@/app/api/send-prompt/llm/Agent';
import {NextRequest, NextResponse} from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const prompt = formData.get('prompt') ?? '';

  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    const llmAnswer = await sendPrompt(prompt);

    return NextResponse.json({
      prompt,
      answer: llmAnswer,
    });
  } else {
    return NextResponse.json({error: 'Invalid prompt', prompt}, {status: 400});
  }
}

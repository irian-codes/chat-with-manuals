import {sendPrompt} from '@/app/api/send-prompt/llm/Agent';
import {NextRequest, NextResponse} from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const prompt = formData.get('prompt') ?? '';

  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    const llmAnswer = await (async () => {
      try {
        return {
          result: await sendPrompt(prompt),
          error: null,
        };
      } catch (error) {
        return {
          result: null,
          error,
        };
      }
    })();

    if (llmAnswer.error) {
      return NextResponse.json({error: llmAnswer.error}, {status: 500});
    } else {
      return NextResponse.json({
        prompt,
        answer: llmAnswer.result,
      });
    }
  } else {
    return NextResponse.json({error: 'Invalid prompt', prompt}, {status: 400});
  }
}

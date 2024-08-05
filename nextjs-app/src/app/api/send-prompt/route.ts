import {sendPrompt} from '@/app/api/send-prompt/llm/Agent';
import {NextRequest, NextResponse} from 'next/server';
import {z, ZodError} from 'zod';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const prompt = formData.get('prompt') ?? '';
  const fileId = formData.get('file-id')?.toString().trim().toLowerCase();

  try {
    z.string().uuid().parse(fileId);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {error: 'Invalid fileId: ' + error.issues[0].message},
        {status: 400}
      );
    } else {
      return NextResponse.json(
        {error: 'Invalid fileId: ' + String(error)},
        {status: 400}
      );
    }
  }

  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    const llmAnswer = await (async () => {
      try {
        return {
          result: await sendPrompt(prompt, fileId ?? 'N/A'),
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
      return NextResponse.json(
        {error: llmAnswer.error.message ?? 'Unknown error'},
        {status: 500}
      );
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

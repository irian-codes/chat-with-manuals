import {sendPrompt} from '@/app/api/send-prompt/llm/Agent';
import {NextRequest, NextResponse} from 'next/server';
import {z, ZodError} from 'zod';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const validationResult = validateInput(formData);

  if (!('data' in validationResult)) {
    return validationResult;
  }

  const {prompt, documentDescription, fileId} = validationResult.data;

  const llmAnswer = await (async () => {
    try {
      return {
        result: await sendPrompt(prompt, documentDescription, fileId ?? 'N/A'),
        error: null,
      };
    } catch (error) {
      console.error(error);

      return {
        result: null,
        error,
      };
    }
  })();

  if (llmAnswer.error) {
    console.error(llmAnswer.error);

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
}

function validateInput(formData: FormData) {
  const prompt = formData.get('prompt');
  const documentDescription = formData.get('document-description');
  const fileId = formData.get('file-id');

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

  try {
    z.string().trim().min(1).parse(prompt);
  } catch (error: unknown) {
    return NextResponse.json(
      {error: 'Invalid prompt: ' + String(error)},
      {status: 400}
    );
  }

  return {
    data: {
      prompt: prompt!.toString().trim(),
      documentDescription: documentDescription?.toString().trim() ?? '',
      fileId: fileId!.toString().trim().toLowerCase(),
    },
  };
}

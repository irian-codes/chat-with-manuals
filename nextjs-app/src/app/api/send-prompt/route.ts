import {sendPrompt} from '@/app/api/send-prompt/llm/Agent';
import {NextRequest, NextResponse} from 'next/server';
import {downloadFile, getFileHash} from '../utils/fileUtils';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const prompt = formData.get('prompt') ?? '';

  // TEMPORARY HASHING. On the real implementation this should be loaded
  // from a db instead since we won't hash a file at each prompt as its
  // damn slow.

  const fileHash = await getFileHash(
    await downloadFile('http://localhost:3000/test-pdf.pdf')
  );

  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    const llmAnswer = await (async () => {
      try {
        return {
          result: await sendPrompt(prompt, fileHash),
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

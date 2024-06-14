import {HumanMessage, SystemMessage} from '@langchain/core/messages';
import {ChatOpenAI} from '@langchain/openai';
import {embedPDF} from '../vector-db/VectorDB';

const llm = new ChatOpenAI({
  model: 'gpt-3.5-turbo',
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function sendPrompt(prompt: string) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Invalid prompt: prompt must be a non-empty string');
  }

  await embedPDF('http://localhost:3000/test-pdf.pdf');

  // TODO: Consume these embeddings and pass them with a Prompt template to the LLM
  return;

  const response = await llm.invoke([
    new SystemMessage({content: 'You are a helpful assistant.'}),
    new HumanMessage({content: prompt}),
  ]);

  return response.content;
}

import {HumanMessage, SystemMessage} from '@langchain/core/messages';
import {ChatOpenAI} from '@langchain/openai';
import {
  doesCollectionExists,
  embedPDF,
  queryCollection,
} from '../vector-db/VectorDB';

const llm = new ChatOpenAI({
  model: 'gpt-3.5-turbo',
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function sendPrompt(prompt: string) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Invalid prompt: prompt must be a non-empty string');
  }

  if (!(await doesCollectionExists('a-test-collection'))) {
    await embedPDF('http://localhost:3000/test-pdf.pdf', 'a-test-collection');
  }

  const res = await queryCollection('a-test-collection', prompt);

  console.log('heeey 1.5', res);

  // TODO: Consume these embeddings and pass them with a Prompt template to the LLM
  return res.map((doc) => doc.pageContent).join('\n');

  const response = await llm.invoke([
    new SystemMessage({content: 'You are a helpful assistant.'}),
    new HumanMessage({content: prompt}),
  ]);

  return response.content;
}

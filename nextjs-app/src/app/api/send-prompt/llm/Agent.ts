import {HumanMessage, SystemMessage} from '@langchain/core/messages';
import {ChatOpenAI} from '@langchain/openai';

const llm = new ChatOpenAI({
  model: 'gpt-3.5-turbo',
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function sendPrompt(prompt: string) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Invalid prompt: prompt must be a non-empty string');
  }

  const response = await llm.invoke([
    new SystemMessage({content: 'You are a helpful assistant.'}),
    new HumanMessage({content: prompt}),
  ]);

  return response.content;
}

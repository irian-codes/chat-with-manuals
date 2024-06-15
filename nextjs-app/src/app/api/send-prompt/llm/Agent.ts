import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI} from '@langchain/openai';
import {embedPDF, queryCollection} from '../vector-db/VectorDB';

const llm = new ChatOpenAI({
  model: 'gpt-3.5-turbo',
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function sendPrompt(prompt: string) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Invalid prompt: prompt must be a non-empty string');
  }

  const collectionName = 'a-test-collection';

  try {
    await embedPDF('http://localhost:3000/test-pdf.pdf', collectionName);
  } catch (error) {
    console.error(error);
  }

  const res = await queryCollection(collectionName, prompt);

  const template = `Answer the user's question to the best of your ability.
  Use the following fictitious story as context to answer.
  
  STORY: {context}
  
  USER QUESTION: {question}`;

  const chatTemplate = ChatPromptTemplate.fromTemplate(template);

  const finalPrompt = await chatTemplate.invoke({
    context: res.map((doc) => doc.pageContent).join('\n'),
    question: prompt,
  });

  const response = await llm.invoke(finalPrompt.toChatMessages());

  return response.content;
}

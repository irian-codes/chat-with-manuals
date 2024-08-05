import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI} from '@langchain/openai';
import {queryCollection} from '../vector-db/VectorDB';

const llm = new ChatOpenAI({
  model: 'gpt-3.5-turbo',
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function sendPrompt(prompt: string, collectionName: string) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Invalid prompt: prompt must be a non-empty string');
  }

  const retrievedContext = await queryCollection(collectionName, prompt);

  console.log('heeey 2.4', {retrievedContext});

  const chatText = `Use the following pieces of text from a fictitious story as context to answer the user's question to the best of your ability.
  STORY FRAGMENTS: {context}
  USER QUESTION: {question}`;

  const chatTemplate = await ChatPromptTemplate.fromTemplate(chatText).invoke({
    context: retrievedContext.map((doc) => doc.pageContent).join('\n\n'),
    question: prompt,
  });

  const response = await llm.invoke([
    new SystemMessage(
      "You're a helpful AI assistant expert in Bitcoin cryptocurrency. Your answers should be elaborate. If you don't know the answer just say 'I don't know'."
    ),
    ...chatTemplate.toChatMessages(),
  ]);

  return response.content;
}

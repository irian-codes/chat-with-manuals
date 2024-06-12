import {LLMAnswer} from './components/LLMAnswer.client';
import {UserPrompt} from './components/UserPrompt.client';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-24">
      <h1 className="font-sans text-4xl">RAG TEST</h1>
      <div className="m-6 flex flex-col items-center justify-around">
        <div className="m-6">Input your prompt:</div>
        <UserPrompt />
        <div className="m-6">LLM ANSWER:</div>
        <LLMAnswer />
      </div>
    </main>
  );
}

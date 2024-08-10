'use client';

import {FormEvent, useContext} from 'react';
import {ChatContext} from './ChatContext.client';

export function UserPrompt() {
  const {prompt, setPrompt, setAnswer} = useContext(ChatContext);

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();

    setAnswer('Thinking... 🤔');

    const formData = new FormData(e.target as HTMLFormElement);

    const response = await fetch('/api/send-prompt', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      setPrompt(data.prompt);
      setAnswer(data.answer);

      console.log(
        'User prompt correctly sent: ',
        data.prompt,
        'Answer: ',
        data.answer
      );
    } else {
      setAnswer('Error getting answer 😟');

      const error = await response.json();

      const errorMsg = 'Failed to send prompt, Response object:\n';
      console.error(errorMsg, error);
      alert(errorMsg + JSON.stringify(error, null, 2));
    }
  }

  return (
    <form onSubmit={handleFormSubmit} method="POST" className="flex flex-col">
      <div className="flex flex-col">
        <label htmlFor="prompt" className="text-white">
          Prompt
        </label>
        <textarea
          name="prompt"
          id="prompt"
          rows={10}
          cols={60}
          required
          className="mt-2 rounded-md border border-gray-300 p-2 text-black focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mt-4">
        <label htmlFor="document-description" className="text-white">
          Document Description
        </label>
        <textarea
          name="document-description"
          id="document-description"
          rows={4}
          cols={60}
          className="mt-2 rounded-md border border-gray-300 p-2 text-black focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mt-4 flex flex-col">
        <label htmlFor="file-id" className="text-white">
          File ID:
        </label>
        <input
          type="text"
          name="file-id"
          id="file-id"
          required
          placeholder="File UUID, i.e. 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
          className="mt-2 rounded-md border border-gray-300 p-2 text-black focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        className="mt-4 rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
      >
        Send
      </button>
    </form>
  );
}

'use client';

import {FormEvent, useContext} from 'react';
import {ChatContext} from './ChatContext.client';

export function UserPrompt() {
  const {prompt, setPrompt} = useContext(ChatContext);

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);

    // TODO: Transform this into the call that sends the prompt to the LLM and returns the answer
    const response = await fetch('/api/send-prompt', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      setPrompt(data.prompt);

      console.log('User prompt correctly sent: ', data.prompt);
    } else {
      const error = await response.json();
      console.error('Failed to send prompt, Response object: ', error);
    }
  }

  return (
    <form onSubmit={handleFormSubmit}>
      <textarea
        name="prompt"
        id="prompt"
        className="text-black"
        rows={10}
        cols={60}
        required
      />
      <button type="submit">Send</button>
    </form>
  );
}

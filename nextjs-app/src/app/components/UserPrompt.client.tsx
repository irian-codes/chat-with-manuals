'use client';

import {FormEvent} from 'react';

export function UserPrompt() {
  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);

    await fetch('/api/send-prompt', {
      method: 'POST',
      body: formData,
    });
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

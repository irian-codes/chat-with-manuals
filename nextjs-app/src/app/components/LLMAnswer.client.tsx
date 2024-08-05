'use client';

import {useContext} from 'react';
import {ChatContext} from './ChatContext.client';

export function LLMAnswer() {
  const {answer} = useContext(ChatContext);

  return (
    <p
      id="answer"
      className="w-full break-words rounded-md border border-gray-300 bg-white p-6 text-black"
    >
      {answer ?? ''}
    </p>
  );
}

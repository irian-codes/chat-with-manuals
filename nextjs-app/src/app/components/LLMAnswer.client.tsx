'use client';

import {useContext} from 'react';
import {ChatContext} from './ChatContext.client';

export function LLMAnswer() {
  const {answer} = useContext(ChatContext);

  return (
    <div className="w-full rounded-md border border-gray-300 bg-white p-6 text-black">
      {(answer ?? '').split('\n').map((chunk, index) => (
        <p key={index} className="answer-chunk mb-2 w-full break-words">
          {chunk}
        </p>
      ))}
    </div>
  );
}

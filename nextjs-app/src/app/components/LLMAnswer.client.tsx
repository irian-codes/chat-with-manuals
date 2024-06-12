'use client';

import {useContext} from 'react';
import {ChatContext} from './ChatContext.client';

export function LLMAnswer() {
  const {answer} = useContext(ChatContext);

  return (
    <p id="answer" className="w-full break-words bg-white p-6 text-black">
      {answer ?? ''}
    </p>
  );
}

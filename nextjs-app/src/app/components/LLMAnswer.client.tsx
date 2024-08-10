'use client';

import React, {useContext} from 'react';
import sanitizeHtml from 'sanitize-html';
import {ChatContext} from './ChatContext.client';

export function LLMAnswer() {
  const {answer} = useContext(ChatContext);
  const purifiedAnswer = React.useMemo(() => {
    return sanitizeHtml(answer);
  }, [answer]);

  return (
    <div
      className="w-full rounded-md border border-gray-300 bg-white p-6 text-black"
      dangerouslySetInnerHTML={{
        __html: purifiedAnswer,
      }}
    ></div>
  );
}

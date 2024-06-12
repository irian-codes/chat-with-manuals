'use client';

import React, {useState} from 'react';

export type ChatContextType = {
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  answer: string;
  setAnswer: React.Dispatch<React.SetStateAction<string>>;
};

export const ChatContext = React.createContext<ChatContextType>({
  prompt: '',
  setPrompt: () => {},
  answer: '',
  setAnswer: () => {},
});

interface ChatContextProps {
  children: React.ReactNode;
}

function ChatContextWrapper(props: ChatContextProps) {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');

  return (
    <ChatContext.Provider
      value={{
        prompt,
        setPrompt,
        answer,
        setAnswer,
      }}
    >
      {props.children}
    </ChatContext.Provider>
  );
}

export default ChatContextWrapper;

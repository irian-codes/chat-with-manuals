'use client';

import React, {useState} from 'react';

export type CountContextType = {
  count: number;
  setCount: React.Dispatch<React.SetStateAction<number>>;
};

export const CountContext = React.createContext<CountContextType>({
  count: 0,
  setCount: () => {},
});

interface CountContextProps {
  children: React.ReactNode;
}

function CountContextWrapper(props: CountContextProps) {
  const [count, setCount] = useState(0);

  return (
    <CountContext.Provider
      value={{
        count,
        setCount,
      }}
    >
      {props.children}
    </CountContext.Provider>
  );
}

export default CountContextWrapper;

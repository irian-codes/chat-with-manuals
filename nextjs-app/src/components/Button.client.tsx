'use client';

import {useContext} from 'react';
import {CountContext} from './CountContext.client';

function Button() {
  const {count, setCount} = useContext(CountContext);

  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}

export default Button;

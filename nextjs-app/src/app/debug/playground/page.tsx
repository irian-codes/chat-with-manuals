'use client';

import {parseMarkdownToPlainText} from './serverFunctions';

type Props = {};

export default function Page({}: Props) {
  function handleButtonClick() {
    parseMarkdownToPlainText().then((res) => {
      console.log('Parsing result: ', res);
    });
  }

  return (
    <div>
      <button
        className="m-6 rounded-sm border-2 border-white p-3 hover:border-blue-500 hover:bg-blue-100 hover:text-black"
        onClick={handleButtonClick}
      >
        DEBUG FUNCTION CALL
      </button>
    </div>
  );
}

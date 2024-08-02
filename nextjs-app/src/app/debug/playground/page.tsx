'use client';

import {
  getMarkdownLexer,
  parseMarkdownToJson,
  parseMarkdownToPlainText,
} from './serverFunctions';

type Props = {};

export default function Page({}: Props) {
  function handleButtonClick1() {
    getMarkdownLexer().then((res) => {
      console.log('Markdown lexer (JSON): ', res);
    });
  }

  function handleButtonClick2() {
    parseMarkdownToPlainText().then((res) => {
      console.log('Parsing result: ', res);
    });
  }

  function handleButtonClick3() {
    parseMarkdownToJson().then((res) => {
      console.log('Parsing result (JSON): ', res);
    });
  }

  return (
    <div>
      <button
        className="m-6 rounded-sm border-2 border-white p-3 hover:border-blue-500 hover:bg-blue-100 hover:text-black"
        onClick={handleButtonClick1}
      >
        DEBUG FUNCTION CALL 1
      </button>
      <button
        className="m-6 rounded-sm border-2 border-white p-3 hover:border-blue-500 hover:bg-blue-100 hover:text-black"
        onClick={handleButtonClick2}
      >
        DEBUG FUNCTION CALL 2
      </button>
      <button
        className="m-6 rounded-sm border-2 border-white p-3 hover:border-blue-500 hover:bg-blue-100 hover:text-black"
        onClick={handleButtonClick3}
      >
        DEBUG FUNCTION CALL 3
      </button>
    </div>
  );
}

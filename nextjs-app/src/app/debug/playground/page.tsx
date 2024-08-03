'use client';

import {
  chunkSections,
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

  function handleButtonClick4() {
    chunkSections().then((res) => {
      console.log('Parsing result (Chunks): ', res);
    });
  }

  return (
    <div>
      <h1 className="m-6 bg-red-500 p-3 text-center text-3xl text-white">
        ⚠️ DEBUG ⚠️
      </h1>
      <div>
        <button
          className="m-6 rounded-sm border-2 border-white p-3 hover:border-blue-500 hover:bg-blue-100 hover:text-black"
          onClick={handleButtonClick1}
        >
          Get Markdown Lexer
        </button>
        <button
          className="m-6 rounded-sm border-2 border-white p-3 hover:border-blue-500 hover:bg-blue-100 hover:text-black"
          onClick={handleButtonClick2}
        >
          Parse Markdown to Plain Text
        </button>
        <button
          className="m-6 rounded-sm border-2 border-white p-3 hover:border-blue-500 hover:bg-blue-100 hover:text-black"
          onClick={handleButtonClick3}
        >
          Parse Markdown to JSON
        </button>
        <button
          className="m-6 rounded-sm border-2 border-white p-3 hover:border-blue-500 hover:bg-blue-100 hover:text-black"
          onClick={handleButtonClick4}
        >
          Chunk Markdown Sections
        </button>
      </div>
    </div>
  );
}

'use client';

import {isBlankString} from '@/app/common/utils/stringUtils';

type Props = {};

export default function Page({}: Props) {
  const handleButtonClick = () => {
    const testCases = new Map([
      [0, ''],
      [1, ' '],
      [2, '\u0000'],
      [3, '\t'],
      [4, '\u0001'],
      [5, '\u00A0'],
      [6, '\u2000'],
      [7, '\u2001'],
      [8, '\u2002'],
      [9, '\u2003'],
      [10, '\u2004'],
      [11, '\u2005'],
      [12, '\u2006'],
      [13, '\u2007'],
      [14, '\u2008'],
      [15, '\u2009'],
      [16, '\u200A'],
      [17, '\u200B'],
      [18, '\u200C'],
      [19, '\u200D'],
      [20, '\u200E'],
      [21, '\u200F'],
      [22, '\u202F'],
      [23, '\u205F'],
      [24, '\u3000'],
      [25, '\u007F'],
      [25, '\u0096'],
      [26, '\r'],
      [27, '\r\n'],
      [28, '\n'],
      [29, '😀'],
      [30, 'Hello 🌍'],
      [31, 'こんにちは'],
      [32, '안녕하세요'],
      [33, '你好'],
      [34, 'مرحبا'],
      [35, 'नमस्ते'],
      [36, '\u0000Hello'],
      [37, 'Hello\u0001'],
      [38, 'Hello\u007F'],
      [39, 'Test\u0080String'],
    ]);

    testCases.forEach((str, key, map) => {
      const result = isBlankString(str);
      console.log(`Test case ${key} : '${str}'`, result);
    });
  };

  return (
    <div>
      <button onClick={handleButtonClick}>DEBUG FUNCTION CALL</button>
    </div>
  );
}

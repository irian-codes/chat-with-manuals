'use server';

import {decodeHTML} from 'entities';
import {marked} from 'marked';
import markedPlaintify from 'marked-plaintify';
import fs from 'node:fs';
import path from 'node:path';

export async function parseMarkdownToPlainText() {
  const fileContents = readTestFile();

  try {
    const parsedMd = await marked
      .use({gfm: true}, markedPlaintify())
      .parse(fileContents);

    return decodeHTML(parsedMd);
  } catch (error) {
    console.error(error);

    return `Error parsing markdown: ${error.message}`;
  }
}

function readTestFile() {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'tmp', 'markdown-test-files/test1.md'),
    'utf8'
  );

  return content;
}

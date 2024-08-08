'use server';

import {clearStorage, initStorage} from '@/app/api/db/files';
import {
  chunkSectionsJson,
  markdownToSectionsJson,
} from '@/app/api/parse-pdf/functions';
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

export async function getMarkdownLexer() {
  return marked.lexer(readTestFile());
}

export async function parseMarkdownToJson() {
  return await markdownToSectionsJson(readTestFile());
}

export async function chunkSections() {
  const sectionNodes = await parseMarkdownToJson();

  return await chunkSectionsJson(sectionNodes);
}

export async function clearNodePersistStorage() {
  await initStorage();
  await clearStorage();
}

function readTestFile() {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'tmp', 'markdown-test-files/test2.md'),
    'utf8'
  );

  return content;
}

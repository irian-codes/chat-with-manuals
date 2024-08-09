'use server';

import {clearStorage, initStorage} from '@/app/api/db/uploaded-files-db/files';
import {
  chunkSectionsJson,
  markdownToSectionsJson,
} from '@/app/api/parse-pdf/functions';
import {decodeHTML} from 'entities';
import markdownlint from 'markdownlint';
import markdownlintRuleHelpers from 'markdownlint-rule-helpers';
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

export async function lintMarkdown() {
  const markdown = readTestFile();

  const results = await markdownlint.promises.markdownlint({
    strings: {content: markdown},
    resultVersion: 3,
  });

  const newMarkdown = markdownlintRuleHelpers.applyFixes(
    markdown,
    results.content
  );

  writeNewFile(newMarkdown);

  return newMarkdown;
}

export async function clearNodePersistStorage() {
  await initStorage();
  await clearStorage();
}

const fileName =
  'parsedPdf_board-game_Root_Base_Law_of_Root_June_30_2023.pdf_parser-llamaparse_202408090012.md';

function readTestFile() {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'tmp', fileName),
    'utf8'
  );

  return content;
}

function writeNewFile(content: string) {
  fs.writeFileSync(
    path.join(process.cwd(), 'tmp', 'new_' + fileName),
    content,
    {encoding: 'utf8'}
  );
}

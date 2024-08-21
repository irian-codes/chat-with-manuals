'use server';

import {clearStorage, initStorage} from '@/app/api/db/uploaded-files-db/files';
import {clearDatabase} from '@/app/api/db/vector-db/VectorDB';
import {
  chunkSectionsJson,
  markdownToSectionsJson,
  reconcileTexts,
} from '@/app/api/parse-pdf/functions';
import {diffWords} from 'diff';
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

export async function diffTexts() {
  let one = `The Vagabond
cannot activate a dominance card for its normal
victory condition (3.3.1). Instead, in games with
four or more players, the Vagabond can activate a
dominance card to form a coalition with another
player, placing his score marker on that player’s
faction board. (The Vagabond no longer scores points.)
That player must have fewer victory points than
each other player except the Vagabond forming
the coalition, and that player cannot be in a coalition. If there is a tie for fewest victory points, he
chooses one tied player. If the coalitioned player
wins the game, the Vagabond also wins.`;
  const other =
    'Vagabund cannot activate a dominance card for its victory condition (3.3.1). Instead, in games with four or more players, the Vagabond can activate a dominance card to form a coalition with another player, placing his score marker on that player’s faction board. That player must have fewer victory points than each other player active in the coalition, and that player cannot be in a coalition. If there is a tie for fewest victory points, he chooses one tied player. If the coalited player wins the game, the Vagabond player also win';

  const normalizedFirstText = one
    .split(/[\s\n]+/)
    .map((s) => s.trim())
    .join(' ');

  const result = reconcileTexts(one, other);

  return {
    result,
    firstDiff: {
      diff: diffWords(normalizedFirstText, other, {
        ignoreCase: true,
      }),
      differences: diffWords(normalizedFirstText, other, {
        ignoreCase: true,
      }).filter((d) => d.added || d.removed),
    },
    secondDiff: {
      diff: diffWords(normalizedFirstText, result, {
        ignoreCase: true,
      }),
      differences: diffWords(normalizedFirstText, result, {
        ignoreCase: true,
      }).filter((d) => d.added || d.removed),
    },
  };
}

export async function clearNodePersistStorage() {
  await initStorage();
  await clearStorage();
}

export async function clearVectorDB() {
  await clearDatabase();
}

const fileRoute = 'markdown-test-files/test1.md';

function readTestFile() {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'tmp', fileRoute),
    'utf8'
  );

  return content;
}

function writeNewFile(content: string) {
  fs.writeFileSync(
    path.join(process.cwd(), 'tmp', 'new_' + fileRoute),
    content,
    {encoding: 'utf8'}
  );
}

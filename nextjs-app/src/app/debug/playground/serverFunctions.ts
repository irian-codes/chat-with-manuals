'use server';

import {runRerankerTests} from '@/__tests__/api/llm/reranker';
import {clearStorage, initStorage} from '@/app/api/db/uploaded-files-db/files';
import {clearDatabase} from '@/app/api/db/vector-db/VectorDB';
import {
  chunkSectionNodes,
  markdownToSectionsJson,
} from '@/app/api/parse-pdf/chunking';
import {reconcileTexts} from '@/app/api/parse-pdf/fixHallucinations';
import {SectionChunkDoc} from '@/app/common/types/SectionChunkDoc';
import {TextChunkDoc} from '@/app/common/types/TextChunkDoc';
import {diffWords} from 'diff';
import {decodeHTML} from 'entities';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {marked} from 'marked';
import markedPlaintify from 'marked-plaintify';
import {LevenshteinDistance} from 'natural';
import fs from 'node:fs';
import path from 'node:path';

export async function parseMarkdownToPlainText() {
  const fileContents = readFile('tmp/markdown-test-files/test1.md');

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
  return marked.lexer(readFile('tmp/markdown-test-files/test1.md'));
}

export async function parseMarkdownToJson() {
  return await markdownToSectionsJson(
    readFile('tmp/markdown-test-files/test1.md')
  );
}

export async function chunkSections() {
  const sectionNodes = await parseMarkdownToJson();
  const chunkedSections = await chunkSectionNodes(
    sectionNodes,
    new RecursiveCharacterTextSplitter({
      chunkSize: 150,
      chunkOverlap: 0,
      keepSeparator: false,
    })
  );

  // Without doing this Next.js complaints that we cannot return class
  // instances to a client component.
  return chunkedSections.map((d) => structuredClone(d));
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

export async function function1() {
  const parsedPdfJson = readFile(
    'tmp/matchedChunks/crypto-whitepaper-bitcoin.pdf_202409231907.json'
  );

  const parsedPdf: {
    matchedChunks: {
      id: string;
      sectionTitle: string;
      sectionChunk: SectionChunkDoc;
      candidate: string;
    }[];
    layoutChunks: TextChunkDoc[];
  } = JSON.parse(parsedPdfJson);

  return parsedPdf.matchedChunks.filter((m) => {
    if (m.candidate === 'N/A') {
      return false;
    }

    const lDistance = LevenshteinDistance(
      m.sectionChunk.pageContent,
      m.candidate,
      {
        insertion_cost: 1,
        deletion_cost: 1,
        substitution_cost: 1,
      }
    );

    return lDistance > 8;
  });
}

export async function function2() {
  console.log('Function 2 called');
  return await runRerankerTests();
}

export async function clearNodePersistStorage() {
  await initStorage();
  await clearStorage();
}

export async function clearVectorDB() {
  await clearDatabase();
}

function readFile(route: string) {
  const content = fs.readFileSync(path.join(process.cwd(), route), 'utf8');

  return content;
}

function writeNewFile(content: string, folder: string, fileName: string) {
  fs.writeFileSync(
    path.join(process.cwd(), folder, 'new_' + fileName),
    content,
    {
      encoding: 'utf8',
    }
  );
}

'use server';

import {runRerankerTests} from '@/__tests__/api/llm/reranker';
import {clearStorage, initStorage} from '@/app/api/db/uploaded-files-db/files';
import {clearDatabase} from '@/app/api/db/vector-db/VectorDB';
import {
  chunkSectionNodes,
  markdownToSectionsJson,
} from '@/app/api/parse-pdf/chunking';
import {reconcileTexts} from '@/app/api/parse-pdf/fixHallucinations';
import {getEnvVars} from '@/app/common/env';
import {
  SectionChunkDoc,
  sectionChunkMetadataSchema,
} from '@/app/common/types/SectionChunkDoc';
import {narrowType} from '@/app/common/types/zod';
import {OpenAIEmbeddings} from '@langchain/openai';
import {ChromaClient, IncludeEnum} from 'chromadb';
import {diffWords} from 'diff';
import {decodeHTML} from 'entities';
import {Document} from 'langchain/document';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {marked} from 'marked';
import markedPlaintify from 'marked-plaintify';
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';

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
  console.log('Function 1 called');

  const documents = {
    rootManual: '1733c6da-6de4-4aa1-8e8a-e4bd92ed23ff',
    aliensManual: '84e763aa-943a-46f5-8b06-0b53d3e491e8',
    bitcoinWhitepaper: 'c76946a7-671b-42b6-8d5a-3e57cd88690b',
    airPurifierManual: '86b5aea9-9848-4f90-829e-aad28539cece',
  } as const;

  const embedder = new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    dimensions: 1536,
  });

  const prompt = 'How do I get wood as the Cat?';
  const timeout = getEnvVars().CHROMA_DB_TIMEOUT;

  const chromaClient = new ChromaClient({
    path: getEnvVars().CHROMA_DB_HOST,
    fetchOptions: {signal: AbortSignal.timeout(timeout)},
  });

  const collection = await chromaClient.getCollection({
    name: documents.rootManual,
    embeddingFunction: {
      generate: (texts: string[]) => {
        return embedder.embedDocuments(texts);
      },
    },
  });

  const similarChunks = await collection.query({
    queryTexts: prompt,
    nResults: 50,
    include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
  });

  console.time('chunkedSections');
  const chunkedSections = (
    await Promise.all(
      similarChunks.metadatas[0].map(async (metadata, i) => {
        if (narrowType(sectionChunkMetadataSchema, metadata)) {
          console.time(
            `sectionChunk:${metadata.headerRouteLevels}:${metadata.order})`
          );
          const res = await collection.query({
            queryTexts: prompt,
            nResults: 100,
            where: {
              headerRouteLevels: metadata.headerRouteLevels,
            },
            include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
          });

          // console.dir({logId: 'heeey 5.4', res}, {depth: null, colors: true});

          const docs = res.documents[0].map(
            (r, i) =>
              new Document({
                pageContent: r!,
                metadata: res.metadatas[0][i]!,
              }) as SectionChunkDoc
          );
          console.timeEnd(
            `sectionChunk:${metadata.headerRouteLevels}:${metadata.order})`
          );

          return [docs[i], docs] as [SectionChunkDoc, SectionChunkDoc[]];
        } else {
          return null;
        }
      })
    )
  ).filter((d) => d != null);
  console.timeEnd('chunkedSections');

  console.dir(
    {
      logId: 'heeey 5.7',
      chunkedSections: z
        .array(z.instanceof(Document))
        .nonempty()
        .parse(chunkedSections[1]),
    },
    {depth: null, colors: true}
  );
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

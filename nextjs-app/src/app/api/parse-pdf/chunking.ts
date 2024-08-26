import {ChunkDoc} from '@/app/common/types/ChunkDoc';
import {decodeHTML} from 'entities';
import {isWithinTokenLimit} from 'gpt-tokenizer/model/gpt-4o';
import {Document} from 'langchain/document';
import {
  RecursiveCharacterTextSplitter,
  TextSplitter,
} from 'langchain/text_splitter';
import {Marked} from 'marked';
import markedPlaintify from 'marked-plaintify';
import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';

const metaContentDelimiter = '<<<%s>>>';
const tableDelimiter = metaContentDelimiter.replace('%s', 'TABLE:%d');

export type SectionNode = {
  type: 'section';
  level: number;
  title: string;
  content: string;
  tables: Map<number, string>;
  subsections: SectionNode[];
};

/**
 * Parses a markdown string into a JSON structure representing the sections
 * and their content.
 *
 * @param {string} markdown - The markdown string to be parsed. It replaces
 * tables with a placeholder for table content in the format of
 * {@link tableDelimiter} for more information on how tables are it for the
 * table later on. The placeholder includes '%d' which will be replaced
 * with the table index.
 * @return {Promise<SectionNode[]>} A Promise that resolves to an array of
 * SectionNode objects representing the sections and their content.
 */
export async function markdownToSectionsJson(
  markdown: string
): Promise<SectionNode[]> {
  const plainMarked = new Marked().use({gfm: true}, markedPlaintify());
  const tokens = plainMarked.lexer(markdown);
  // This should be an array because the object itself acts as a fake root
  // node, in case there are more than one level 1 headings in the document
  const jsonStructure: SectionNode[] = [];
  const stack: SectionNode[] = [];
  let currentContent = {
    text: '',
    tables: new Map<number, string>(),
    lastTableIndex: -1,
  };

  function pushContent() {
    if (currentContent.text.length > 0) {
      if (stack.length > 0) {
        stack[stack.length - 1].content = currentContent.text.trim();
      }

      currentContent.text = '';
    }

    if (currentContent.tables.size > 0) {
      if (stack.length > 0) {
        stack[stack.length - 1].tables = currentContent.tables;
      }

      currentContent.tables = new Map();
      currentContent.lastTableIndex = -1;
    }
  }

  for (const token of tokens) {
    if (token.type === 'heading') {
      // When we encounter a new heading, we should finalize the previous section content
      pushContent();

      const node: SectionNode = {
        type: 'section',
        level: token.depth,
        title: token.text,
        content: '',
        tables: new Map(),
        subsections: [],
      };

      // Find the right place to insert the node based on its level
      while (stack.length > 0 && stack[stack.length - 1].level >= token.depth) {
        stack.pop();
      }

      if (stack.length === 0) {
        jsonStructure.push(node);
      } else {
        stack[stack.length - 1].subsections.push(node);
      }

      stack.push(node);
    } else if (token.type === 'table') {
      currentContent.tables.set(
        ++currentContent.lastTableIndex,
        (await plainMarked.parse(token.raw)).trim()
      );

      // Add a table placeholder to restore this table later
      currentContent.text +=
        tableDelimiter.replace('%d', String(currentContent.lastTableIndex)) +
        '\n\n';
    } else {
      // Append the current token to the content string
      currentContent.text += decodeHTML(await plainMarked.parse(token.raw));
    }
  }

  // Finalize the last section content
  pushContent();

  return jsonStructure;
}

export async function chunkSectionNodes(
  sectionsJson: SectionNode[],
  splitter?: TextSplitter
) {
  if (splitter == null) {
    splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 150,
      chunkOverlap: 0,
      separators: [
        metaContentDelimiter.substring(0, 3),
        metaContentDelimiter.substring(metaContentDelimiter.length - 3),
        '\n\n',
        '\n',
        '.',
        '?',
        '!',
        ' ',
        '',
      ],
    });
  }

  const chunks: ChunkDoc[] = [];

  for (let i = 0; i < sectionsJson.length; i++) {
    const section = sectionsJson[i];
    chunks.push(
      ...(await chunkSectionNode({
        section,
        headerRoute: section.title,
        headerRouteLevels: `${i + 1}`,
        splitter,
      }))
    );
  }

  return chunks;
}

async function chunkSectionNode({
  section,
  headerRoute,
  headerRouteLevels,
  splitter,
}: {
  section: SectionNode;
  headerRoute: string;
  headerRouteLevels: string;
  splitter: TextSplitter;
}): Promise<ChunkDoc[]> {
  const chunks: ChunkDoc[] = [];
  // This keeps the delimiters because of the capturing group syntax, which
  // is what we want
  const delimiterSplit = section.content.split(
    new RegExp(`(${metaContentDelimiter.replace('%s', '.+')})`, 'gi')
  );

  // Ensuring each split is either a block of text or a metacontent delimiter
  const splits = await (async () => {
    const result: string[] = [];
    for (const split of delimiterSplit) {
      if (split.startsWith(metaContentDelimiter.substring(0, 3))) {
        result.push(split);
      } else {
        result.push(...(await splitter.splitText(split)));
      }
    }

    return result;
  })();

  let currentOrder = 1;
  for (let i = 0; i < splits.length; i++) {
    const part = splits[i];

    const newChunks = await chunkSingleSplit({
      part,
      section,
      startOrder: currentOrder,
      headerRoute,
      headerRouteLevels,
      splitter,
    });

    chunks.push(...newChunks);
    currentOrder += newChunks.length;
  }

  for (let i = 0; i < section.subsections.length; i++) {
    const subsection = section.subsections[i];

    chunks.push(
      ...(await chunkSectionNode({
        section: subsection,
        headerRoute: `${headerRoute}>${subsection.title}`,
        headerRouteLevels: `${headerRouteLevels}>${i + 1}`,
        splitter,
      }))
    );
  }

  return chunks;
}

/**
 * Splits a single section chunk into chunks. It can detect if the input
 * part is a table and split it into further chunks. It will return an
 * array of chunks. Being 1 the length of it if the input is not a table
 *
 * @param {string} part - The content of the section to be split. Either a
 * block of text or a `tableDelimiter` string.
 * @param {SectionNode} section - The section the chunk belongs to.
 * @param {number} startOrder - The starting order num of this chunk.
 * Defaults to 1.
 * @param {string} headerRoute - The route of the current section.
 * @param {string} headerRouteLevels - The route of the current section
 * with levels.
 * @param {TextSplitter} splitter - The splitter instance to use.
 *
 * @return {Promise<ChunkDoc[]>} A Promise that resolves to an array of
 * ChunkDoc objects.
 */
async function chunkSingleSplit({
  part,
  section,
  startOrder = 1,
  headerRoute,
  headerRouteLevels,
  splitter,
}: {
  part: string;
  startOrder?: number;
  section: SectionNode;
  headerRoute: string;
  headerRouteLevels: string;
  splitter: TextSplitter;
}): Promise<ChunkDoc[]> {
  let currentOrder = startOrder;

  // Detecting if chunk is a table
  const tableRegex = new RegExp(tableDelimiter.replace('%d', '(\\d+)'), 'i');
  const tableMatch = part.match(tableRegex);
  const tableIndex = tableMatch && tableMatch[1] ? Number(tableMatch[1]) : -1;
  const isTable = z
    .literal(-1)
    .or(
      z
        .number()
        .min(0)
        .max(Math.max(0, section.tables.size - 1))
    )
    .transform((tableIndex) => tableIndex >= 0)
    .parse(tableIndex);

  const text = (isTable ? (section.tables.get(tableIndex) ?? '') : part).trim();

  const tokens = (function () {
    const tokenNum: number | boolean = isWithinTokenLimit(
      text,
      Number.MAX_VALUE
    );

    if (tokenNum === false) {
      throw new Error(
        "This shouldn't happen. Attempting to get the token size of a chunk."
      );
    } else if (isTable && tokenNum < 1) {
      throw new Error(
        `Table index ${tableIndex} does not exist. Attempting to get the token size of a chunk.`
      );
    } else {
      return tokenNum;
    }
  })();

  if (tokens <= splitter.chunkSize) {
    return [
      new Document({
        id: uuidv4(),
        pageContent: text,
        metadata: {
          headerRoute,
          headerRouteLevels,
          order: currentOrder++,
          tokens,
          charCount: text.length,
          table: isTable,
        },
      }),
    ];
  }

  // Big table detected that needs to be chunked as well
  const chunks: ChunkDoc[] = [];
  const splits = await splitter.splitText(text);

  for (let j = 0; j < splits.length; j++) {
    const text = splits[j];
    const tokens: number | boolean = isWithinTokenLimit(text, Number.MAX_VALUE);

    if (tokens === false) {
      throw new Error(
        "This shouldn't happen. Attempting to get the token size of a chunk."
      );
    }

    chunks.push(
      new Document({
        id: uuidv4(),
        pageContent: text,
        metadata: {
          headerRoute,
          headerRouteLevels,
          order: currentOrder++,
          tokens,
          charCount: text.length,
          table: isTable,
        },
      })
    );
  }

  return chunks;
}

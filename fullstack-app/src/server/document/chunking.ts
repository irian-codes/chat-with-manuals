import {
  type SectionChunkDoc,
  type SectionChunkMetadata,
} from '@/types/SectionChunkDoc';
import {type SectionNode} from '@/types/SectionNode';
import type {TextChunkDoc, TextChunkMetadata} from '@/types/TextChunkDoc';
import type {TextSplitter} from '@/types/TextSplitter';
import {isStringEmpty} from '@/utils/strings';
import {decodeHTML} from 'entities';
import {isWithinTokenLimit} from 'gpt-tokenizer/model/gpt-4o';
import {Document} from 'langchain/document';
import {Marked} from 'marked';
import markedPlaintify from 'marked-plaintify';
import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';

const metaContentDelimiter = '<<<%s>>>';
const tableDelimiter = metaContentDelimiter.replace('%s', 'TABLE:%d');

async function chunkString({
  text,
  splitter,
}: {
  text: string;
  splitter: TextSplitter;
}): Promise<TextChunkDoc[]> {
  const splits = await splitter.splitText(text);
  const chunks: TextChunkDoc[] = [];

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i]?.trim();

    if (split == null || isStringEmpty(split ?? '')) {
      continue;
    }

    // Hacky way to get the token size of a chunk.
    const tokens: number | boolean = isWithinTokenLimit(
      split,
      Number.MAX_VALUE
    );

    if (typeof tokens !== 'number') {
      throw new Error(
        "This shouldn't happen. Attempt to get the token size of a chunk failed."
      );
    }

    chunks.push(
      new Document<TextChunkMetadata>({
        id: uuidv4(),
        pageContent: split,
        metadata: {
          totalOrder: i + 1,
          tokens,
          charCount: split.length,
        },
      })
    );
  }

  return chunks;
}

/**
 * Converts a markdown string into a JSON structure that represents the
 * sections and their content in plain text, with all markdown formatting
 * removed.
 *
 * @param {string} markdown - The markdown string to be parsed. It replaces
 * tables with a placeholder for table content in the format of
 * {@link tableDelimiter}. The placeholder includes '%d' which will be
 * replaced with the table index. This to save the tables in a separate
 * property of the resulting JSON object {@link SectionNode.tables}.
 *
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
  const currentContent = {
    text: '',
    tables: new Map<number, string>(),
    lastTableIndex: -1,
    lastHeaderRoute: new Array<string>(),
    lastHeaderRouteLevels: new Array<string>(),
  };

  for (const token of tokens) {
    if (token.type === 'heading') {
      // When we encounter a new heading, we should finalize the current section content
      pushContent();

      const node: SectionNode = {
        id: uuidv4(),
        type: 'section',
        title: token.text,
        level: token.depth,
        headerRoute: '',
        headerRouteLevels: '',
        content: '',
        tables: new Map(),
        subsections: [],
      };

      // Find the right place to insert the node based on its level
      while (
        stack.length > 0 &&
        stack[stack.length - 1]!.level >= token.depth
      ) {
        stack.pop();
      }

      if (stack.length === 0) {
        jsonStructure.push(node);
      } else {
        stack[stack.length - 1]!.subsections.push(node);
      }

      stack.push(node);
    } else if (token.type === 'table') {
      currentContent.tables.set(
        ++currentContent.lastTableIndex,
        decodeHTML(await plainMarked.parse(token.raw)).trim()
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

  // HELPER FUNCTIONS

  /**
   * Updates the lastHeaderRoute and lastHeaderRouteLevels arrays of the
   * currentContent object to have the correct length of depth and header
   * route (e.g. Heading 3>Heading 3.2>Heading 3.2.1). If the last entry is
   * null, it will fill it with ones until depth (f.e. [1, 1>1, 1>1>1] and
   * [N/A, N/A>N/A, N/A>N/A>Heading 1.1.1]). If the last entry is not null,
   * it will check if the last entry has the same depth as the given depth
   * and if so, it will increment the last level by one (f.e. from [1, 1>1]
   * to [1, 1>2]). If not, it will fill the missing levels with ones (f.e.
   * [3, missing, missing] to [3, 3>1, 3>1>1]).
   *
   * @param {SectionNode} section - The section we're dealing with.
   * @return The updated last header route and level
   * (e.g. `{route: 'Heading 3>Heading 3.2>Heading 3.2.1', level: '3>2>1'}`).
   */
  function updateLastHeaderRoutes(section: SectionNode): {
    route: string;
    level: string;
  } {
    const depth = section.level;
    const title = section.title;

    // Delete from lastHeaderRoutes until correct level
    while (currentContent.lastHeaderRouteLevels.length > depth) {
      currentContent.lastHeaderRouteLevels.pop();
      currentContent.lastHeaderRoute.pop();
    }

    const headerRouteLevelsLen = currentContent.lastHeaderRouteLevels.length;
    const lastHeaderLevelsEntry =
      currentContent.lastHeaderRouteLevels[headerRouteLevelsLen - 1];
    const lastHeaderRouteEntry =
      currentContent.lastHeaderRoute[headerRouteLevelsLen - 1]!;

    // Fill it with ones until depth, just in case the first header is
    // lower than depth one for whatever reason (malformed Markdown, empty
    // section, etc.).
    if (lastHeaderLevelsEntry == null) {
      const levels = Array.from({length: depth}, () => '1');
      currentContent.lastHeaderRouteLevels = [];
      currentContent.lastHeaderRoute = [];

      levels.reduce((acc, level) => {
        const newEntry = [acc, level].filter(Boolean).join('>');
        currentContent.lastHeaderRouteLevels.push(newEntry);

        return newEntry;
      }, '');

      levels.reduce((acc, level, i) => {
        const isLastElement = i === levels.length - 1;
        const newEntry = [acc, isLastElement ? title : 'N/A']
          .filter(Boolean)
          .join('>');

        currentContent.lastHeaderRoute.push(newEntry);

        return newEntry;
      }, '');

      return {
        route:
          currentContent.lastHeaderRoute[
            currentContent.lastHeaderRoute.length - 1
          ]!,
        level:
          currentContent.lastHeaderRouteLevels[
            currentContent.lastHeaderRouteLevels.length - 1
          ]!,
      };
    }

    // Check depth of the last entry (e.g. x>y>z). If it's the same as
    // depth (contains depth - 1 > symbols) then grab last number,
    // otherwise just start at 1 and fill the missing levels
    const lastEntryLevels = lastHeaderLevelsEntry.split('>');
    const lastEntryHeaders = lastHeaderRouteEntry.split('>');

    if (lastEntryLevels.length === depth) {
      const lastEntryLevel = lastEntryLevels[lastEntryLevels.length - 1];

      currentContent.lastHeaderRouteLevels[headerRouteLevelsLen - 1] =
        lastEntryLevels
          .toSpliced(
            lastEntryLevels.length - 1,
            1,
            String(Number(lastEntryLevel) + 1)
          )
          .join('>');

      currentContent.lastHeaderRoute[headerRouteLevelsLen - 1] =
        lastEntryHeaders
          .toSpliced(lastEntryHeaders.length - 1, 1, title)
          .join('>');

      return {
        route: currentContent.lastHeaderRoute[headerRouteLevelsLen - 1]!,
        level: currentContent.lastHeaderRouteLevels[headerRouteLevelsLen - 1]!,
      };
    } else {
      const missingLevels = Array.from(
        {length: depth - currentContent.lastHeaderRouteLevels.length},
        () => '1'
      );

      missingLevels.reduce((acc, level) => {
        const newEntry = [acc, level].filter(Boolean).join('>');
        currentContent.lastHeaderRouteLevels.push(newEntry);

        return newEntry;
      }, lastHeaderLevelsEntry);

      missingLevels.reduce((acc, level, i) => {
        const isLastElement = i === missingLevels.length - 1;
        const newEntry = [acc, isLastElement ? title : 'N/A']
          .filter(Boolean)
          .join('>');

        currentContent.lastHeaderRoute.push(newEntry);

        return newEntry;
      }, lastHeaderRouteEntry);

      return {
        route:
          currentContent.lastHeaderRoute[
            currentContent.lastHeaderRoute.length - 1
          ]!,
        level:
          currentContent.lastHeaderRouteLevels[
            currentContent.lastHeaderRouteLevels.length - 1
          ]!,
      };
    }
  }

  function pushContent() {
    const lastSection = stack[stack.length - 1];

    if (lastSection == null) {
      return;
    }

    if (currentContent.text.length > 0) {
      if (stack.length > 0) {
        lastSection.content = currentContent.text.trim();
      }

      currentContent.text = '';
    }

    if (currentContent.tables.size > 0) {
      if (stack.length > 0) {
        lastSection.tables = currentContent.tables;
      }

      currentContent.tables = new Map();
      currentContent.lastTableIndex = -1;
    }

    if (stack.length > 0) {
      const {route, level} = updateLastHeaderRoutes(lastSection);
      lastSection.headerRoute = route;
      lastSection.headerRouteLevels = level;
    }
  }
}

export async function chunkSectionNodes({
  sectionsJson,
  splitter,
}: {
  sectionsJson: SectionNode[];
  splitter: TextSplitter;
}): Promise<SectionChunkDoc[]> {
  const chunks: SectionChunkDoc[] = [];
  let totalOrder = 1;

  for (const section of sectionsJson) {
    const newChunks = await chunkSectionNode({
      section,
      startTotalOrder: totalOrder,
      splitter,
    });

    chunks.push(...newChunks);
    totalOrder += newChunks.length;
  }

  return chunks;
}

async function chunkSectionNode({
  section,
  startTotalOrder,
  splitter,
}: {
  section: SectionNode;
  startTotalOrder: number;
  splitter: TextSplitter;
}): Promise<SectionChunkDoc[]> {
  const chunks: SectionChunkDoc[] = [];
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
  let totalOrder = startTotalOrder;
  for (const split of splits) {
    const newChunks = await chunkSingleSplit({
      split,
      section,
      startOrder: currentOrder,
      startTotalOrder: totalOrder,
      splitter,
    });

    chunks.push(...newChunks.filter((c) => !isStringEmpty(c.pageContent)));
    currentOrder += newChunks.length;
    totalOrder += newChunks.length;
  }

  for (const subsection of section.subsections) {
    const newChunks = await chunkSectionNode({
      section: subsection,
      startTotalOrder: totalOrder,
      splitter,
    });

    chunks.push(...newChunks);
    totalOrder += newChunks.length;
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
 * @param {number} startTotalOrder - The starting totalOrder num of the
 * whole document.
 * @param {TextSplitter} splitter - The splitter instance to use.
 *
 * @return {Promise<SectionChunkDoc[]>} A Promise that resolves to an array
 * of ChunkDoc objects.
 */
async function chunkSingleSplit({
  split,
  section,
  startOrder = 1,
  startTotalOrder,
  splitter,
}: {
  split: string;
  startOrder?: number;
  section: SectionNode;
  startTotalOrder: number;
  splitter: TextSplitter;
}): Promise<SectionChunkDoc[]> {
  let currentOrder = startOrder;
  let totalOrder = startTotalOrder;

  // Detecting if chunk is a table
  const tableRegex = new RegExp(tableDelimiter.replace('%d', '(\\d+)'), 'i');
  const tableMatch = split.match(tableRegex);
  const tableIndex = tableMatch?.[1] != null ? Number(tableMatch[1]) : -1;
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

  const text = (
    isTable ? (section.tables.get(tableIndex) ?? '') : split
  ).trim();

  // TODO: Refactor this as the variable is not used but the validation it is
  const tokens = (function () {
    const tokenNum: number | boolean = isWithinTokenLimit(
      text,
      Number.MAX_VALUE
    );

    if (tokenNum === false) {
      throw new Error(
        "This shouldn't happen. Attempting to get the token size of a chunk."
      );
    } else {
      return tokenNum;
    }
  })();

  // Split just in case it's a big table that needs to be chunked as well
  const chunks: SectionChunkDoc[] = [];
  const splits = await splitter.splitText(text);

  for (const text of splits) {
    const tokens: number | boolean = isWithinTokenLimit(text, Number.MAX_VALUE);

    if (tokens === false) {
      throw new Error(
        "This shouldn't happen. Attempting to get the token size of a chunk."
      );
    }

    chunks.push(
      new Document<SectionChunkMetadata>({
        id: uuidv4(),
        pageContent: text,
        metadata: {
          headerRoute: section.headerRoute,
          headerRouteLevels: section.headerRouteLevels,
          order: currentOrder++,
          totalOrder: totalOrder++,
          tokens,
          charCount: text.length,
          table: isTable,
          sectionId: section.id,
        },
      })
    );
  }

  return chunks;
}

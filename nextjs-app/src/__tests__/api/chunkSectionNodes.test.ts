import {chunkSectionNodes, SectionNode} from '@/app/api/parse-pdf/chunking';
import {ChunkDoc} from '@/app/common/types/ChunkDoc';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import util from 'node:util';
import {describe, expect, it} from 'vitest';

describe('chunkSectionNodes', () => {
  const sampleTexts = {
    byCharCount: {
      50: {
        text: '9.2.4 Defenseless. n battle, the Vagabond is aaaaa',
      },
      150: {
        text: "9.2.4 Defenseless. In battle, the Vagabond is defenseless (4.3.2.III) if he has no undamaged S. 9.2.5 Items. The Vagabond's capabilities depend on the",
      },
      300: {
        text: "9.2.4 Defenseless. In battle, the Vagabond is defenseless (4.3.2.III) if he has no undamaged S. 9.2.5 Items. The Vagabond's capabilities depend on the items he acquires. Instead of a Crafted Items box, he has a Satchel and various item tracks. Items on the Vagabond's faction board can be face up or.",
      },
      450: {
        text: "9.2.4 Defenseless. In battle, the Vagabond is defenseless (4.3.2.III) if he has no undamaged S. 9.2.5 Items. The Vagabond's capabilities depend on the items he acquires. Instead of a Crafted Items box, he has a Satchel and various item tracks. Items on the Vagabond's faction board can be face up or face down. The Vagabond exhausts faceup undamaged items, flipping them face down, to take many actions. I Item Tracks. When gained or flipped face up.",
      },
      700: {
        text: "9.2.4 Defenseless. In battle, the Vagabond is defenseless (4.3.2.III) if he has no undamaged S. 9.2.5 Items. The Vagabond's capabilities depend on the items he acquires. Instead of a Crafted Items box, he has a Satchel and various item tracks. Items on the Vagabond's faction board can be face up or face down. The Vagabond exhausts faceup undamaged items, flipping them face down, to take many actions. I Item Tracks. When gained or flipped face up in the Satchel, T, X, and B are placed face up on their matching tracks. When flipped face down, T, X, or B on tracks are placed face down in the Satchel. Each track can only hold three matching items. II The Satchel. When gained, M, S, C , F, and H.",
      },
      1000: {
        text: "9.2.4 Defenseless. In battle, the Vagabond is defenseless (4.3.2.III) if he has no undamaged S. 9.2.5 Items. The Vagabond's capabilities depend on the items he acquires. Instead of a Crafted Items box, he has a Satchel and various item tracks. Items on the Vagabond's faction board can be face up or face down. The Vagabond exhausts faceup undamaged items, flipping them face down, to take many actions. I Item Tracks. When gained or flipped face up in the Satchel, T, X, and B are placed face up on their matching tracks. When flipped face down, T, X, or B on tracks are placed face down in the Satchel. Each track can only hold three matching items. II The Satchel. When gained, M, S, C , F, and H are placed face up in the Vagabond's Satchel. 9.2.6 Maximum Rolled Hits. In battle, the Vagabond's maximum rolled hits (4.3.2.I) equals his undamaged S, face up or face down, in his Satchel. 9.2.7 Taking Hits. Whenever the Vagabond takes a hit (4.3.3), he must damage one undamaged item, moving it to",
      },
    },
  } as const;

  const globalSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 150,
    chunkOverlap: 0,
    separators: ['<<<', '>>>', '\n\n', '\n', '.', '?', '!', ' ', ''],
  });

  it('should correctly chunk a simple section', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content: 'This is a simple section with some text.',
        tables: new Map(),
        subsections: [],
      },
    ];

    const chunks: ChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageContent).toBe(
      'This is a simple section with some text.'
    );
    expect(chunks[0].metadata.headerRoute).toBe('Heading 1');
    expect(chunks[0].metadata.headerRouteLevels).toBe('1');
    expect(chunks[0].metadata.order).toBe(1);
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.tokens).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[0].metadata.table).toBe(false);
  });

  it('should correctly handle sections with tables', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content:
          'This is a section with a table.<<<TABLE:0>>>More text after the table.',
        tables: new Map([
          [
            0,
            'Header 1: Row 1\nHeader 2: Data 1\n\nHeader 1: Row 2\nHeader 2: Data 2',
          ],
        ]),
        subsections: [],
      },
    ];

    const chunks: ChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    expect(chunks).toHaveLength(3);

    expect(chunks[0].pageContent).toBe('This is a section with a table.');
    expect(chunks[0].metadata.headerRouteLevels).toBe('1');
    expect(chunks[0].metadata.order).toBe(1);
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.tokens).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[0].metadata.table).toBe(false);

    expect(chunks[1].pageContent).toBe(
      'Header 1: Row 1\nHeader 2: Data 1\n\nHeader 1: Row 2\nHeader 2: Data 2'
    );
    expect(chunks[1].metadata.order).toBe(2);
    expect(chunks[1].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[1].metadata.tokens).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[1].metadata.table).toBe(true);

    expect(chunks[2].pageContent).toBe('More text after the table.');
    expect(chunks[2].metadata.order).toBe(3);
    expect(chunks[2].metadata.tokens).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[2].metadata.table).toBe(false);
  });

  it('should correctly chunk nested sections', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content: 'Text under heading 1.',
        tables: new Map(),
        subsections: [
          {
            type: 'section',
            level: 2,
            title: 'Heading 1.1',
            content: 'Text under heading 1.1.',
            tables: new Map(),
            subsections: [],
          },
        ],
      },
    ];

    const chunks: ChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    expect(chunks).toHaveLength(2);

    expect(chunks[0].pageContent).toBe('Text under heading 1.');
    expect(chunks[0].metadata.headerRoute).toBe('Heading 1');
    expect(chunks[0].metadata.headerRouteLevels).toBe('1');
    expect(chunks[0].metadata.order).toBe(1);

    expect(chunks[1].pageContent).toBe('Text under heading 1.1.');
    expect(chunks[1].metadata.headerRoute).toBe('Heading 1>Heading 1.1');
    expect(chunks[1].metadata.headerRouteLevels).toBe('1>1');
    expect(chunks[1].metadata.order).toBe(1);
  });

  it('should handle large content by splitting it into multiple chunks', async () => {
    const largeContent = 'A'.repeat(1000);
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content: largeContent,
        tables: new Map(),
        subsections: [],
      },
    ];

    const chunks: ChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, index) => {
      expect(chunk.pageContent.length).toBeLessThanOrEqual(150);
      expect(chunk.metadata.order).toBe(index + 1);
      expect(chunk.metadata.table).toBe(false);
    });
  });

  it('should correctly handle sections without content', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content: '',
        tables: new Map(),
        subsections: [],
      },
    ];

    const chunks: ChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    expect(chunks).toHaveLength(0);
  });

  it('should correctly handle sections with special characters and non-standard content', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Special Section',
        content: 'Text with special characters: 😊, 👍, and symbols: ©, ™.',
        tables: new Map(),
        subsections: [],
      },
    ];

    const chunks: ChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageContent).toBe(
      'Text with special characters: 😊, 👍, and symbols: ©, ™.'
    );
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.tokens).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[0].metadata.table).toBe(false);
  });

  it('should correctly handle a large table that needs splitting into subchunks', async () => {
    const largePlaintifiedTableContent =
      'Header 1: Row 1\nHeader 2: Data 1\n\n' +
      Array(100).fill('Header 1: Row 2\nHeader 2: Data 2').join('\n\n');

    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content:
          'This section contains a large table.\n\n<<<TABLE:0>>>\n\nEnd of section content.',
        tables: new Map([[0, largePlaintifiedTableContent]]),
        subsections: [],
      },
    ];

    const chunks: ChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    // Validate that the first chunk is the text before the table
    expect(chunks[0].pageContent).toBe('This section contains a large table.');
    expect(chunks[0].metadata.order).toBe(1);
    expect(chunks[0].metadata.table).toBe(false);
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.tokens).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );

    // Validate that subsequent chunks are parts of the table
    const tableChunks = chunks.filter((chunk) => chunk.metadata.table);
    expect(tableChunks.length).toBeGreaterThan(5); // Should be split into multiple chunks

    tableChunks.forEach((chunk, index) => {
      expect(chunk.pageContent).toContain('Header 1: Row'); // Part of the table should be in each chunk
      expect(chunk.pageContent).toContain('Header 2: Data'); // Ensure both headers and data are present in chunks
      expect(chunk.metadata.order).toBe(index + 2); // Should follow the order after the initial text chunk
      expect(chunk.metadata.tokens).toBeGreaterThan(0);
      expect(chunk.metadata.tokens).toBeLessThanOrEqual(
        globalSplitter.chunkSize
      );
      expect(chunk.metadata.table).toBe(true);
    });

    // Validate that the last chunk is the text after the table
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.pageContent).toBe('End of section content.');
    expect(lastChunk.metadata.order).toBe(chunks.length);
    expect(lastChunk.metadata.tokens).toBeGreaterThan(0);
    expect(lastChunk.metadata.tokens).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(lastChunk.metadata.table).toBe(false);
  });

  it('should correctly split section contents with specific tokens sizes to the appropriate chunk amount', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content: sampleTexts.byCharCount[50].text,
        tables: new Map(),
        subsections: [],
      },
      {
        type: 'section',
        level: 1,
        title: 'Heading 2',
        content: sampleTexts.byCharCount[150].text,
        tables: new Map(),
        subsections: [],
      },
      {
        type: 'section',
        level: 1,
        title: 'Heading 3',
        content: sampleTexts.byCharCount[300].text,
        tables: new Map(),
        subsections: [],
      },
    ];

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 150,
      chunkOverlap: 0,
      keepSeparator: false,
      separators: ['\n\n', '\n', '.', ' ', ''],
    });

    function getChunkAmount(textTokenSize: number) {
      return Math.ceil(textTokenSize / splitter.chunkSize);
    }

    const chunks: ChunkDoc[] = await chunkSectionNodes(sectionsJson, splitter);

    const groupedTokensByHeaderLevel = Map.groupBy(
      chunks,
      (c) => c.metadata.headerRouteLevels
    );

    console.log(
      'heeeey 4.6',
      util.inspect(groupedTokensByHeaderLevel, {
        showHidden: false,
        depth: null,
        colors: true,
      })
    );
    // 50 Token chunk (1 chunk)
    const chunk50 = groupedTokensByHeaderLevel.get('1') ?? [];
    expect(chunk50).toHaveLength(getChunkAmount(50));

    // 150 Token chunks (1 chunk)
    const chunk150 = groupedTokensByHeaderLevel.get('2') ?? [];
    expect(chunk150).toHaveLength(getChunkAmount(150));

    // 300 Token chunks
    const chunk300 = groupedTokensByHeaderLevel.get('3') ?? [];
    expect(chunk300).toHaveLength(getChunkAmount(300));
  });
});

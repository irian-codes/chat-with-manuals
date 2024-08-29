import {chunkSectionNodes} from '@/app/api/parse-pdf/chunking';
import {SectionChunkDoc} from '@/app/common/types/SectionChunkDoc';
import {SectionNode} from '@/app/common/types/SectionNode';
import {
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
} from 'langchain/text_splitter';
import {describe, expect, it} from 'vitest';

describe('chunkSectionNodes', () => {
  const globalSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 150,
    chunkOverlap: 0,
    separators: ['<<<', '>>>', '\n\n', '\n', '.', '?', '!', ' ', ''],
  });

  it('should correctly chunk a simple section', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        title: 'Heading 1',
        level: 1,
        headerRouteLevels: '1',
        content: 'This is a simple section with some text.',
        tables: new Map(),
        subsections: [],
      },
    ];

    const chunks: SectionChunkDoc[] = await chunkSectionNodes(
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
    expect(chunks[0].metadata.charCount).toBeGreaterThan(0);
    expect(chunks[0].metadata.charCount).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[0].metadata.table).toBe(false);
  });

  it('should correctly handle sections with tables', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        title: 'Heading 1',
        level: 1,
        headerRouteLevels: '1',
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

    const chunks: SectionChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    expect(chunks).toHaveLength(3);

    expect(chunks[0].pageContent).toBe('This is a section with a table.');
    expect(chunks[0].metadata.headerRouteLevels).toBe('1');
    expect(chunks[0].metadata.order).toBe(1);
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.charCount).toBeGreaterThan(0);
    expect(chunks[0].metadata.charCount).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[0].metadata.table).toBe(false);

    expect(chunks[1].pageContent).toBe(
      'Header 1: Row 1\nHeader 2: Data 1\n\nHeader 1: Row 2\nHeader 2: Data 2'
    );
    expect(chunks[1].metadata.order).toBe(2);
    expect(chunks[1].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[1].metadata.charCount).toBeGreaterThan(0);
    expect(chunks[1].metadata.charCount).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[1].metadata.table).toBe(true);

    expect(chunks[2].pageContent).toBe('More text after the table.');
    expect(chunks[2].metadata.order).toBe(3);
    expect(chunks[2].metadata.charCount).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[2].metadata.table).toBe(false);
  });

  it('should correctly chunk nested sections', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        title: 'Heading 1',
        level: 1,
        headerRouteLevels: '1',
        content: 'Text under heading 1.',
        tables: new Map(),
        subsections: [
          {
            type: 'section',
            title: 'Heading 1.1',
            level: 2,
            headerRouteLevels: '1>1',
            content: 'Text under heading 1.1.',
            tables: new Map(),
            subsections: [],
          },
        ],
      },
    ];

    const chunks: SectionChunkDoc[] = await chunkSectionNodes(
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
        title: 'Heading 1',
        level: 1,
        headerRouteLevels: '1',
        content: largeContent,
        tables: new Map(),
        subsections: [],
      },
    ];

    const chunks: SectionChunkDoc[] = await chunkSectionNodes(
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
        title: 'Heading 1',
        level: 1,
        headerRouteLevels: '1',
        content: '',
        tables: new Map(),
        subsections: [],
      },
    ];

    const chunks: SectionChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    expect(chunks).toHaveLength(0);
  });

  it('should correctly handle sections with special characters and non-standard content', async () => {
    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        title: 'Special Section',
        level: 1,
        headerRouteLevels: '1',
        content: 'Text with special characters: 😊, 👍, and symbols: ©, ™.',
        tables: new Map(),
        subsections: [],
      },
    ];

    const chunks: SectionChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageContent).toBe(
      'Text with special characters: 😊, 👍, and symbols: ©, ™.'
    );
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.charCount).toBeGreaterThan(0);
    expect(chunks[0].metadata.charCount).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(chunks[0].metadata.table).toBe(false);
  });

  it('should correctly handle a large table that needs splitting into subchunks', async () => {
    const largePlaintifiedTableContent =
      'Header 1: Row 1\nHeader 2: Data 1\n\n' +
      Array(100).fill('Header 1: Row 2\nHeader 2: Data 2').join('\n\n');

    const largePlaintifiedTableContent2 =
      'Header 1: Row 1\nHeader 2: Data 1\n\n' +
      Array(100).fill('Header 1: Row 2\nHeader 2: Data 2').join('\n\n');

    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        title: 'Heading 1',
        level: 1,
        headerRouteLevels: '1',
        content:
          'This section contains a large table.\n\n<<<TABLE:0>>>\n\n\n\n<<<TABLE:1>>>\n\nEnd of section content.',
        tables: new Map([
          [0, largePlaintifiedTableContent],
          [1, largePlaintifiedTableContent2],
        ]),
        subsections: [],
      },
    ];

    const chunks: SectionChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      globalSplitter
    );

    // Validate that the first chunk is the text before the table
    expect(chunks[0].pageContent).toBe('This section contains a large table.');
    expect(chunks[0].metadata.order).toBe(1);
    expect(chunks[0].metadata.table).toBe(false);
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.charCount).toBeGreaterThan(0);
    expect(chunks[0].metadata.charCount).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );

    // Validate that subsequent chunks are parts of the table
    const tableChunks = chunks.filter((chunk) => chunk.metadata.table);
    expect(tableChunks.length).toBeGreaterThan(5); // Should be split into multiple chunks

    tableChunks.forEach((chunk, index) => {
      expect(chunk.pageContent).toContain('Header 1: Row');
      expect(chunk.pageContent).toContain('Header 2: Data');
      expect(chunk.metadata.order).toBe(index + 2); // Should follow the order after the initial text chunk
      expect(chunk.metadata.tokens).toBeGreaterThan(0);
      expect(chunk.metadata.charCount).toBeGreaterThan(0);
      expect(chunk.metadata.charCount).toBeLessThanOrEqual(
        globalSplitter.chunkSize
      );
      expect(chunk.metadata.table).toBe(true);
    });

    // Validate that the last chunk is the text after the table
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.pageContent).toBe('End of section content.');
    expect(lastChunk.metadata.order).toBe(chunks.length);
    expect(lastChunk.metadata.tokens).toBeGreaterThan(0);
    expect(lastChunk.metadata.charCount).toBeGreaterThan(0);
    expect(lastChunk.metadata.charCount).toBeLessThanOrEqual(
      globalSplitter.chunkSize
    );
    expect(lastChunk.metadata.table).toBe(false);
  });

  it('should correctly split section contents by sentences in the text', async () => {
    const sampleTexts = {
      byCharCount: {
        50: {
          text: '9.2.4 Defenseless. In battle, the Vagabond is aaaa',
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

    const sectionsJson: SectionNode[] = [
      {
        type: 'section',
        title: 'Heading 1',
        level: 1,
        headerRouteLevels: '1',
        content: sampleTexts.byCharCount[50].text,
        tables: new Map(),
        subsections: [],
      },
      {
        type: 'section',
        title: 'Heading 2',
        level: 1,
        headerRouteLevels: '2',
        content: sampleTexts.byCharCount[150].text,
        tables: new Map(),
        subsections: [],
      },
      {
        type: 'section',
        title: 'Heading 3',
        level: 1,
        headerRouteLevels: '3',
        content: sampleTexts.byCharCount[300].text,
        tables: new Map(),
        subsections: [],
      },
      {
        type: 'section',
        title: 'Heading 4',
        level: 1,
        headerRouteLevels: '4',
        content: sampleTexts.byCharCount[450].text,
        tables: new Map(),
        subsections: [],
      },
      {
        type: 'section',
        title: 'Heading 5',
        level: 1,
        headerRouteLevels: '5',
        content: sampleTexts.byCharCount[700].text,
        tables: new Map(),
        subsections: [],
      },
      {
        type: 'section',
        title: 'Heading 6',
        level: 1,
        headerRouteLevels: '6',
        content: sampleTexts.byCharCount[1000].text,
        tables: new Map(),
        subsections: [],
      },
    ];

    const separator = '. ';
    const separatorRegex = /\.\s/g;
    const splitter = new CharacterTextSplitter({
      chunkSize: 20,
      chunkOverlap: 0,
      keepSeparator: false,
      separator,
    });

    function getTargetChunkAmount(
      charCount: keyof typeof sampleTexts.byCharCount
    ) {
      const text = sampleTexts.byCharCount[charCount].text;
      expect(typeof text === 'string' && text.length === charCount).toBe(true);

      return (Array.from(text.matchAll(separatorRegex)) ?? []).length + 1;
    }

    const chunks: SectionChunkDoc[] = await chunkSectionNodes(
      sectionsJson,
      splitter
    );

    const groupedTokensByHeaderLevel = Map.groupBy(
      chunks,
      (c) => c.metadata.headerRouteLevels
    );

    const chunks50 = groupedTokensByHeaderLevel.get('1') ?? [];
    expect(chunks50.length).toBe(getTargetChunkAmount(50));

    const chunks150 = groupedTokensByHeaderLevel.get('2') ?? [];
    expect(chunks150.length).toBe(getTargetChunkAmount(150));

    const chunks300 = groupedTokensByHeaderLevel.get('3') ?? [];
    expect(chunks300.length).toBe(getTargetChunkAmount(300));

    const chunks450 = groupedTokensByHeaderLevel.get('4') ?? [];
    expect(chunks450.length).toBe(getTargetChunkAmount(450));

    const chunks700 = groupedTokensByHeaderLevel.get('5') ?? [];
    expect(chunks700.length).toBe(getTargetChunkAmount(700));

    const chunks1000 = groupedTokensByHeaderLevel.get('6') ?? [];
    expect(chunks1000.length).toBe(getTargetChunkAmount(1000));
  });
});

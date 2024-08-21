import {chunkSectionNodes, SectionNode} from '@/app/api/parse-pdf/chunking'; // Adjust the import path
import {ChunkDoc} from '@/app/common/types/ChunkDoc';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {describe, expect, it} from 'vitest';

describe('chunkSectionNodes', () => {
  const splitter = new RecursiveCharacterTextSplitter({
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

    const chunks: ChunkDoc[] = await chunkSectionNodes(sectionsJson, splitter);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageContent).toBe(
      'This is a simple section with some text.'
    );
    expect(chunks[0].metadata.headerRoute).toBe('Heading 1');
    expect(chunks[0].metadata.headerRouteLevels).toBe('1');
    expect(chunks[0].metadata.order).toBe(1);
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.tokens).toBeLessThanOrEqual(splitter.chunkSize);
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

    const chunks: ChunkDoc[] = await chunkSectionNodes(sectionsJson, splitter);

    expect(chunks).toHaveLength(3);

    expect(chunks[0].pageContent).toBe('This is a section with a table.');
    expect(chunks[0].metadata.headerRouteLevels).toBe('1');
    expect(chunks[0].metadata.order).toBe(1);
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.tokens).toBeLessThanOrEqual(splitter.chunkSize);
    expect(chunks[0].metadata.table).toBe(false);

    expect(chunks[1].pageContent).toBe(
      'Header 1: Row 1\nHeader 2: Data 1\n\nHeader 1: Row 2\nHeader 2: Data 2'
    );
    expect(chunks[1].metadata.order).toBe(2);
    expect(chunks[1].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[1].metadata.tokens).toBeLessThanOrEqual(splitter.chunkSize);
    expect(chunks[1].metadata.table).toBe(true);

    expect(chunks[2].pageContent).toBe('More text after the table.');
    expect(chunks[2].metadata.order).toBe(3);
    expect(chunks[2].metadata.tokens).toBeLessThanOrEqual(splitter.chunkSize);
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

    const chunks: ChunkDoc[] = await chunkSectionNodes(sectionsJson, splitter);

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

    const chunks: ChunkDoc[] = await chunkSectionNodes(sectionsJson, splitter);

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

    const chunks: ChunkDoc[] = await chunkSectionNodes(sectionsJson, splitter);

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

    const chunks: ChunkDoc[] = await chunkSectionNodes(sectionsJson, splitter);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageContent).toBe(
      'Text with special characters: 😊, 👍, and symbols: ©, ™.'
    );
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.tokens).toBeLessThanOrEqual(splitter.chunkSize);
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

    const chunks: ChunkDoc[] = await chunkSectionNodes(sectionsJson, splitter);

    // Validate that the first chunk is the text before the table
    expect(chunks[0].pageContent).toBe('This section contains a large table.');
    expect(chunks[0].metadata.order).toBe(1);
    expect(chunks[0].metadata.table).toBe(false);
    expect(chunks[0].metadata.tokens).toBeGreaterThan(0);
    expect(chunks[0].metadata.tokens).toBeLessThanOrEqual(splitter.chunkSize);

    // Validate that subsequent chunks are parts of the table
    const tableChunks = chunks.filter((chunk) => chunk.metadata.table);
    expect(tableChunks.length).toBeGreaterThan(5); // Should be split into multiple chunks

    tableChunks.forEach((chunk, index) => {
      expect(chunk.pageContent).toContain('Header 1: Row'); // Part of the table should be in each chunk
      expect(chunk.pageContent).toContain('Header 2: Data'); // Ensure both headers and data are present in chunks
      expect(chunk.metadata.order).toBe(index + 2); // Should follow the order after the initial text chunk
      expect(chunk.metadata.tokens).toBeGreaterThan(0);
      expect(chunk.metadata.tokens).toBeLessThanOrEqual(splitter.chunkSize);
      expect(chunk.metadata.table).toBe(true);
    });

    // Validate that the last chunk is the text after the table
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.pageContent).toBe('End of section content.');
    expect(lastChunk.metadata.order).toBe(chunks.length);
    expect(lastChunk.metadata.tokens).toBeGreaterThan(0);
    expect(lastChunk.metadata.tokens).toBeLessThanOrEqual(splitter.chunkSize);
    expect(lastChunk.metadata.table).toBe(false);
  });
});

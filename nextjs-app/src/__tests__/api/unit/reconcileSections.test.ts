import {reconcileSections} from '@/app/api/parse-pdf/fixHallucinations';
import {SectionChunkDoc} from '@/app/common/types/SectionChunkDoc';
import {SectionNode} from '@/app/common/types/SectionNode';
import {Document} from 'langchain/document';
import {describe, expect, it} from 'vitest';

describe('reconcileSections', () => {
  it('should process a simple section without subsections or tables', () => {
    const originalSections: SectionNode[] = [
      {
        id: '1',
        type: 'section',
        title: 'Introduction',
        level: 1,
        headerRoute: 'Introduction',
        headerRouteLevels: '1',
        content: 'Original content of Introduction',
        tables: new Map(),
        subsections: [],
      },
    ];

    const reconciledChunks: SectionChunkDoc[] = [
      new Document({
        id: '1',
        pageContent: 'Updated content of Introduction',
        metadata: {
          headerRoute: 'Introduction',
          headerRouteLevels: '1',
          order: 1,
          totalOrder: 1,
          tokens: 5,
          charCount: 30,
          table: false,
          sectionId: '1',
        },
      }),
    ];

    const updatedSections = reconcileSections({
      originalSections,
      reconciledChunks,
    });

    expect(updatedSections[0].content).toBe('Updated content of Introduction');
    expect(updatedSections[0].tables).toBeInstanceOf(Map);
    expect(updatedSections[0].tables.size).toBe(0);
    expect(updatedSections[0].subsections).toBeInstanceOf(Array);
    expect(updatedSections[0].subsections.length).toBe(0);
  });

  it('should process sections with subsections recursively', () => {
    const originalSections: SectionNode[] = [
      {
        id: '1',
        type: 'section',
        title: 'Chapter 1',
        level: 1,
        headerRoute: 'Chapter 1',
        headerRouteLevels: '1',
        content: 'Original content of Chapter 1',
        tables: new Map(),
        subsections: [
          {
            id: '1.1',
            type: 'section',
            title: 'Section 1.1',
            level: 2,
            headerRoute: 'Chapter 1>Section 1.1',
            headerRouteLevels: '1>1',
            content: 'Original content of Section 1.1',
            tables: new Map(),
            subsections: [],
          },
        ],
      },
    ];

    const reconciledChunks: SectionChunkDoc[] = [
      new Document({
        id: '1',
        pageContent: 'Updated content of Chapter 1',
        metadata: {
          headerRoute: 'Chapter 1',
          headerRouteLevels: '1',
          order: 1,
          totalOrder: 1,
          tokens: 5,
          charCount: 30,
          table: false,
          sectionId: '1',
        },
      }),
      new Document({
        id: '2',
        pageContent: 'Updated content of Section 1.1',
        metadata: {
          headerRoute: 'Chapter 1>Section 1.1',
          headerRouteLevels: '1>1',
          order: 1,
          totalOrder: 1,
          tokens: 5,
          charCount: 30,
          table: false,
          sectionId: '1.1',
        },
      }),
    ];

    const updatedSections = reconcileSections({
      originalSections,
      reconciledChunks,
    });

    expect(updatedSections[0].content).toBe('Updated content of Chapter 1');
    expect(updatedSections[0].subsections[0].content).toBe(
      'Updated content of Section 1.1'
    );
    expect(updatedSections[0].tables).toBeInstanceOf(Map);
    expect(updatedSections[0].tables.size).toBe(0);
    expect(updatedSections[0].subsections).toBeInstanceOf(Array);
    expect(updatedSections[0].subsections.length).toBe(1);
    expect(updatedSections[0].subsections[0].tables).toBeInstanceOf(Map);
    expect(updatedSections[0].subsections[0].tables.size).toBe(0);
    expect(updatedSections[0].subsections[0].subsections).toBeInstanceOf(Array);
    expect(updatedSections[0].subsections[0].subsections.length).toBe(0);
  });

  it('should insert table delimiters and preserve tables', () => {
    const originalSections: SectionNode[] = [
      {
        id: '1',
        type: 'section',
        title: 'Data Analysis',
        level: 1,
        headerRoute: 'Data Analysis',
        headerRouteLevels: '1',
        content:
          'Original content before Table 1\n<<<TABLE:0>>>\nOriginal content after Table 1\n<<<TABLE:1>>>',
        tables: new Map([
          [0, 'Table 1 content'],
          [1, 'Table 2 content'],
        ]),
        subsections: [],
      },
    ];

    const reconciledChunks: SectionChunkDoc[] = [
      new Document({
        id: '1',
        pageContent: 'Updated content before Table 1',
        metadata: {
          headerRoute: 'Data Analysis',
          headerRouteLevels: '1',
          order: 1,
          totalOrder: 1,
          tokens: 5,
          charCount: 30,
          table: false,
          sectionId: '1',
        },
      }),
      new Document({
        id: '2',
        pageContent: 'Table 1 content',
        metadata: {
          headerRoute: 'Data Analysis',
          headerRouteLevels: '1',
          order: 2,
          totalOrder: 2,
          tokens: 5,
          charCount: 30,
          table: true,
          sectionId: '1',
        },
      }),
      new Document({
        pageContent: 'Updated content after Table 1',
        metadata: {
          headerRoute: 'Data Analysis',
          headerRouteLevels: '1',
          order: 3,
          totalOrder: 3,
          tokens: 5,
          charCount: 30,
          table: false,
          sectionId: '1',
        },
      }),
      new Document({
        id: '3',
        pageContent: 'Table 2 content',
        metadata: {
          headerRoute: 'Data Analysis',
          headerRouteLevels: '1',
          order: 4,
          totalOrder: 4,
          tokens: 0,
          charCount: 0,
          table: true,
          sectionId: '1',
        },
      }),
    ];

    const updatedSections = reconcileSections({
      originalSections,
      reconciledChunks,
    });

    const expectedContent = [
      'Updated content before Table 1',
      '<<<TABLE:0>>>',
      'Updated content after Table 1',
      '<<<TABLE:1>>>',
    ].join('\n');

    expect(updatedSections[0]).toEqual({
      id: '1',
      type: 'section',
      title: 'Data Analysis',
      level: 1,
      headerRoute: 'Data Analysis',
      headerRouteLevels: '1',
      content: expectedContent,
      tables: new Map([
        [0, 'Table 1 content'],
        [1, 'Table 2 content'],
      ]),
      subsections: [],
    });
  });

  it('should process complex sections with multiple tables and subsections', () => {
    const originalSections: SectionNode[] = [
      {
        id: '1',
        type: 'section',
        title: 'Report',
        level: 1,
        headerRoute: 'Report',
        headerRouteLevels: '1',
        content: 'Original content of Report',
        tables: new Map(),
        subsections: [
          {
            id: '1.1',
            type: 'section',
            title: 'Overview',
            level: 2,
            headerRoute: 'Report>Overview',
            headerRouteLevels: '1>1',
            content: 'Original content of Overview\n<<<TABLE:0>>>',
            tables: new Map([[0, 'Overview Table 1']]),
            subsections: [],
          },
          {
            id: '1.2',
            type: 'section',
            title: 'Details',
            level: 2,
            headerRoute: 'Report>Details',
            headerRouteLevels: '1>2',
            content:
              'Original content of Details\n<<<TABLE:0>>>\nContent between tables\n<<<TABLE:1>>>',
            tables: new Map([
              [0, 'Details Table 1'],
              [1, 'Details Table 2'],
            ]),
            subsections: [],
          },
        ],
      },
    ];

    const reconciledChunks: SectionChunkDoc[] = [
      // Report Section
      new Document({
        id: '1',
        pageContent: 'Updated content of Report',
        metadata: {
          headerRoute: 'Report',
          headerRouteLevels: '1',
          order: 1,
          totalOrder: 1,
          tokens: 5,
          charCount: 30,
          table: false,
          sectionId: '1',
        },
      }),
      // Overview Section
      new Document({
        id: '2',
        pageContent: 'Updated content of Overview',
        metadata: {
          headerRoute: 'Report>Overview',
          headerRouteLevels: '1>1',
          order: 1,
          totalOrder: 2,
          tokens: 5,
          charCount: 30,
          table: false,
          sectionId: '1.1',
        },
      }),
      new Document({
        id: '3',
        pageContent: 'Overview Table 1',
        metadata: {
          headerRoute: 'Report>Overview',
          headerRouteLevels: '1>1',
          order: 2,
          totalOrder: 3,
          tokens: 0,
          charCount: 0,
          table: true,
          sectionId: '1.1',
        },
      }),
      // Details Section
      new Document({
        pageContent: 'Updated content of Details',
        metadata: {
          headerRoute: 'Report>Details',
          headerRouteLevels: '1>2',
          order: 1,
          totalOrder: 4,
          tokens: 5,
          charCount: 30,
          table: false,
          sectionId: '1.2',
        },
      }),
      new Document({
        pageContent: 'Details Table 1',
        metadata: {
          headerRoute: 'Report>Details',
          headerRouteLevels: '1>2',
          order: 2,
          totalOrder: 5,
          tokens: 0,
          charCount: 0,
          table: true,
          sectionId: '1.2',
        },
      }),
      new Document({
        pageContent: 'Content between tables',
        metadata: {
          headerRoute: 'Report>Details',
          headerRouteLevels: '1>2',
          order: 3,
          totalOrder: 6,
          tokens: 5,
          charCount: 25,
          table: false,
          sectionId: '1.2',
        },
      }),
      new Document({
        pageContent: 'Details Table 2',
        metadata: {
          headerRoute: 'Report>Details',
          headerRouteLevels: '1>2',
          order: 4,
          totalOrder: 7,
          tokens: 5,
          charCount: 25,
          table: true,
          sectionId: '1.2',
        },
      }),
    ];

    const updatedSections = reconcileSections({
      originalSections,
      reconciledChunks,
    });

    // Verify Report Section
    expect(updatedSections[0].content).toBe('Updated content of Report');

    expect(updatedSections[0]).toEqual({
      id: '1',
      type: 'section',
      title: 'Report',
      level: 1,
      headerRoute: 'Report',
      headerRouteLevels: '1',
      content: 'Updated content of Report',
      tables: new Map(),
      subsections: [
        {
          id: '1.1',
          type: 'section',
          title: 'Overview',
          level: 2,
          headerRoute: 'Report>Overview',
          headerRouteLevels: '1>1',
          content: 'Updated content of Overview\n<<<TABLE:0>>>',
          tables: new Map([[0, 'Overview Table 1']]),
          subsections: [],
        },
        {
          id: '1.2',
          type: 'section',
          title: 'Details',
          level: 2,
          headerRoute: 'Report>Details',
          headerRouteLevels: '1>2',
          content:
            'Updated content of Details\n<<<TABLE:0>>>\nContent between tables\n<<<TABLE:1>>>',
          tables: new Map([
            [0, 'Details Table 1'],
            [1, 'Details Table 2'],
          ]),
          subsections: [],
        },
      ],
    });
  });
});

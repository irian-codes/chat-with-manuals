import {
  markdownToSectionsJson,
  SectionNode,
} from '@/app/api/parse-pdf/chunking';
import {describe, expect, it} from 'vitest';

describe('markdownToSectionsJson', () => {
  it('should parse a simple markdown string into a JSON structure', async () => {
    const markdown = `
# Heading 1
Some text under heading 1.

## Heading 1.1
Text under heading 1.1.

## Heading 1.2
Text under heading 1.2.

# Heading 2
Text under heading 2.`;

    const expectedJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content: 'Some text under heading 1.',
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
          {
            type: 'section',
            level: 2,
            title: 'Heading 1.2',
            content: 'Text under heading 1.2.',
            tables: new Map(),
            subsections: [],
          },
        ],
      },
      {
        type: 'section',
        level: 1,
        title: 'Heading 2',
        content: 'Text under heading 2.',
        tables: new Map(),
        subsections: [],
      },
    ];

    const result = await markdownToSectionsJson(markdown);

    expect(result).toEqual(expectedJson);
  });

  it('should handle markdown with tables correctly', async () => {
    const markdown = `
# Heading 1
Some text under heading 1.

| Header 1 | Header 2 |
|----------|----------|
| Row 1    | Data 1   |
| Row 2    | Data 2   |

Second table.

| Header 1 | Header 2 |
|----------|----------|
| Row 3    | Data 3   |
| Row 4    | Data 4   |

End tables.
`;

    const expectedJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content:
          'Some text under heading 1.\n\n<<<TABLE:0>>>\n\nSecond table.\n\n<<<TABLE:1>>>\n\nEnd tables.',
        tables: new Map([
          [
            0,
            'Header 1: Row 1\nHeader 2: Data 1\n\nHeader 1: Row 2\nHeader 2: Data 2',
          ],
          [
            1,
            'Header 1: Row 3\nHeader 2: Data 3\n\nHeader 1: Row 4\nHeader 2: Data 4',
          ],
        ]),
        subsections: [],
      },
    ];

    const result = await markdownToSectionsJson(markdown);

    expect(result).toEqual(expectedJson);
  });

  it('should handle nested sections correctly', async () => {
    const markdown = `
# Heading 1
Some text under heading 1.

## Heading 1.1
Text under heading 1.1.

### Heading 1.1.1
Text under heading 1.1.1.
`;

    const expectedJson: SectionNode[] = [
      {
        type: 'section',
        level: 1,
        title: 'Heading 1',
        content: 'Some text under heading 1.',
        tables: new Map(),
        subsections: [
          {
            type: 'section',
            level: 2,
            title: 'Heading 1.1',
            content: 'Text under heading 1.1.',
            tables: new Map(),
            subsections: [
              {
                type: 'section',
                level: 3,
                title: 'Heading 1.1.1',
                content: 'Text under heading 1.1.1.',
                tables: new Map(),
                subsections: [],
              },
            ],
          },
        ],
      },
    ];

    const result = await markdownToSectionsJson(markdown);

    expect(result).toEqual(expectedJson);
  });

  it('should handle markdown with no sections but text', async () => {
    const markdown = `Just some text without any headings or sections.`;

    const expectedJson: SectionNode[] = [];

    const result = await markdownToSectionsJson(markdown);

    expect(result).toEqual(expectedJson);
  });

  it('should handle empty markdown string', async () => {
    const markdown = '';

    const expectedJson: SectionNode[] = [];

    const result = await markdownToSectionsJson(markdown);

    expect(result).toEqual(expectedJson);
  });
});

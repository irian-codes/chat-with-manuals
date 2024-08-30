import {matchSectionChunk} from '@/app/api/parse-pdf/fixHallucinations';
import {SectionChunkDoc} from '@/app/common/types/SectionChunkDoc';
import {TextChunkDoc} from '@/app/common/types/TextChunkDoc';
import {Document} from 'langchain/document';
import {describe, expect, it} from 'vitest';

describe('matchSectionChunk', () => {
  it('should find the correct clear match. Easy difficulty.', async () => {
    const easyMatchSectionChunk: SectionChunkDoc = new Document({
      id: 'S1',
      pageContent: 'The quick brown fox jumps over the lazy dog.',
      metadata: {
        headerRoute: '1>1',
        headerRouteLevels: '1',
        order: 1,
        totalOrder: 50,
        tokens: 9,
        charCount: 44,
        table: false,
      },
    });

    const easyMatchLayoutChunks: TextChunkDoc[] = [
      new Document({
        id: 'L1',
        pageContent: 'A different sentence.',
        metadata: {totalOrder: 20, tokens: 3, charCount: 19},
      }),
      new Document({
        id: 'L2',
        pageContent: 'The quick brown fox jumps over the lazy dog.',
        metadata: {totalOrder: 55, tokens: 9, charCount: 44},
      }),
      new Document({
        id: 'L3',
        pageContent:
          'The red car was speeding so much it hit the side of the road!',
        metadata: {totalOrder: 80, tokens: 15, charCount: 61},
      }),
    ];

    const orderedCandidates = await matchSectionChunk({
      sectionChunk: easyMatchSectionChunk,
      layoutChunks: easyMatchLayoutChunks,
    });

    expect(orderedCandidates).toHaveLength(1);
    expect(orderedCandidates[0].chunk.pageContent).toBe(
      'The quick brown fox jumps over the lazy dog.'
    );
  });

  it('should find the correct clear match. Medium difficulty.', async () => {
    const mediumMatchSectionChunk: SectionChunkDoc = new Document({
      id: 'S1',
      pageContent: 'The quick brown fox.',
      metadata: {
        headerRoute: '1>1',
        headerRouteLevels: '1',
        order: 1,
        totalOrder: 50,
        tokens: 5,
        charCount: 20,
        table: false,
      },
    });

    const mediumMatchLayoutChunks: TextChunkDoc[] = [
      new Document({
        id: 'L1',
        pageContent: 'The quick green dog.',
        metadata: {totalOrder: 55, tokens: 5, charCount: 20},
      }),
      new Document({
        id: 'L2',
        pageContent: 'The quick brown fox.',
        metadata: {totalOrder: 56, tokens: 5, charCount: 20},
      }),
      new Document({
        id: 'L3',
        pageContent: 'A quick brown animal.',
        metadata: {totalOrder: 57, tokens: 5, charCount: 21},
      }),
    ];

    const orderedCandidates = await matchSectionChunk({
      sectionChunk: mediumMatchSectionChunk,
      layoutChunks: mediumMatchLayoutChunks,
    });

    expect(orderedCandidates).toHaveLength(1);
    expect(orderedCandidates[0].chunk.pageContent).toBe('The quick brown fox.');
  });

  it('should find the correct clear match. High difficulty.', async () => {
    const hardMatchSectionChunk: SectionChunkDoc = new Document({
      id: 'S1',
      pageContent: 'The quick brown fox',
      metadata: {
        headerRoute: '1>1',
        headerRouteLevels: '1',
        order: 1,
        totalOrder: 50,
        tokens: 4,
        charCount: 18,
        table: false,
      },
    });

    const hardMatchLayoutChunks: TextChunkDoc[] = [
      new Document({
        id: 'L1',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 51, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L2',
        pageContent: 'The quick brown fo',
        metadata: {totalOrder: 52, tokens: 4, charCount: 18},
      }),
      new Document({
        id: 'L3',
        pageContent: 'The quick brown dog',
        metadata: {totalOrder: 53, tokens: 4, charCount: 19},
      }),
    ];

    const orderedCandidates = await matchSectionChunk({
      sectionChunk: hardMatchSectionChunk,
      layoutChunks: hardMatchLayoutChunks,
    });

    expect(orderedCandidates).toHaveLength(1);
    expect(orderedCandidates[0].chunk.pageContent).toBe('The quick brown fox');
  });

  it('should return candidates ordered by totalOrder difference if there are candidates with the same score', async () => {
    const sectionChunk: SectionChunkDoc = new Document({
      id: 'S1',
      pageContent: 'The quick brown fox',
      metadata: {
        headerRoute: '1>1',
        headerRouteLevels: '1',
        order: 1,
        totalOrder: 10,
        tokens: 4,
        charCount: 18,
        table: false,
      },
    });

    const layoutChunks: TextChunkDoc[] = [
      new Document({
        id: 'L1',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 16, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L2',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 5, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L3',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 1, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L4',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 100, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L5',
        pageContent: 'The quick brown dog',
        metadata: {totalOrder: 12, tokens: 4, charCount: 19},
      }),
    ];

    const orderedCandidates = await matchSectionChunk({
      sectionChunk,
      layoutChunks,
    });

    expect(orderedCandidates).toHaveLength(3);
    expect(orderedCandidates[0].chunk.pageContent).toBe('The quick brown fox');
    expect(orderedCandidates[0].chunk.metadata.totalOrder).toBe(5);
    expect(orderedCandidates[1].chunk.pageContent).toBe('The quick brown fox');
    expect(orderedCandidates[1].chunk.metadata.totalOrder).toBe(16);
    expect(orderedCandidates[2].chunk.pageContent).toBe('The quick brown fox');
    expect(orderedCandidates[2].chunk.metadata.totalOrder).toBe(1);
  });

  it.only('should filter correctly the chunks that are too far away.', async () => {
    const sectionChunk: SectionChunkDoc = new Document({
      id: 'S1',
      pageContent: 'The quick brown fox',
      metadata: {
        headerRoute: '1>1',
        headerRouteLevels: '1',
        order: 1,
        totalOrder: 50,
        tokens: 4,
        charCount: 18,
        table: false,
      },
    });

    const layoutChunks: TextChunkDoc[] = [
      new Document({
        id: 'L1',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 1, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L2',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 20, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L3',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 39, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L4',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 50, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L5',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 60, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L6',
        pageContent: 'The quick brown fox',
        metadata: {totalOrder: 100, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L7',
        pageContent: 'The quick brown dog',
        metadata: {totalOrder: 41, tokens: 4, charCount: 19},
      }),
    ];

    const orderedCandidates = await matchSectionChunk({
      sectionChunk,
      layoutChunks,
    });

    expect(orderedCandidates).toHaveLength(4);
    expect(orderedCandidates.map((c) => c.chunk.pageContent)).toEqual(
      new Array(4).fill('The quick brown fox')
    );

    expect(orderedCandidates.map((c) => c.chunk.metadata.totalOrder)).toEqual([
      50, 60, 39, 20,
    ]);
  });

  it('should find the closest match when no clear match is found.', async () => {
    const sectionChunk: SectionChunkDoc = new Document({
      id: 'S1',
      pageContent: 'The quick brown fox',
      metadata: {
        headerRoute: '1>1',
        headerRouteLevels: '1',
        order: 1,
        totalOrder: 50,
        tokens: 4,
        charCount: 18,
        table: false,
      },
    });

    const inexactLayoutChunks: TextChunkDoc[] = [
      new Document({
        id: 'L1',
        pageContent: 'The quick brown dog',
        metadata: {totalOrder: 51, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L2',
        pageContent: 'The happy penguin',
        metadata: {totalOrder: 52, tokens: 4, charCount: 17},
      }),
      new Document({
        id: 'L3',
        pageContent: 'The very long and sturdy building',
        metadata: {totalOrder: 53, tokens: 6, charCount: 33},
      }),
    ];

    const orderedCandidates = await matchSectionChunk({
      sectionChunk,
      layoutChunks: inexactLayoutChunks,
    });

    expect(orderedCandidates).toHaveLength(3);
    expect(orderedCandidates[0].chunk.pageContent).toBe('The quick brown dog');
  });
});

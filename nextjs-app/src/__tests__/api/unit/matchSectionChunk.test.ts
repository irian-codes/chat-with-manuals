import {matchSectionChunk} from '@/app/api/parse-pdf/fixHallucinations';
import {SectionChunkDoc} from '@/app/common/types/SectionChunkDoc';
import {TextChunkDoc} from '@/app/common/types/TextChunkDoc';
import {Document} from 'langchain/document';
import {describe, expect, it} from 'vitest';

describe('matchSectionChunk', () => {
  it('should find the correct exact match.', async () => {
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

  it('should find the closest match. Easy difficulty.', async () => {
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
        pageContent: 'The quick brown fox jumps over the dog.',
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
      scoresRatio: 0.5,
    });

    expect(orderedCandidates).toHaveLength(3);
    expect(orderedCandidates[0].chunk.pageContent).toBe(
      'The quick brown fox jumps over the dog.'
    );
  });

  it('should find the closest match. Medium difficulty.', async () => {
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
        pageContent: 'The quick brown foxy.',
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
      scoresRatio: 0.5,
    });

    expect(orderedCandidates).toHaveLength(3);
    expect(orderedCandidates[0].chunk.pageContent).toBe(
      'The quick brown foxy.'
    );
  });

  it('should find the closest match. High difficulty.', async () => {
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
        pageContent: 'The quick brownish fox',
        metadata: {totalOrder: 51, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L2',
        pageContent: 'The quick brown fog',
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
      scoresRatio: 0.5,
    });

    expect(orderedCandidates).toHaveLength(3);
    expect(orderedCandidates[0].chunk.pageContent).toBe(
      'The quick brownish fox'
    );
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

  it('should filter correctly the chunks that are too far away and order them by totalOrder when there are exact candidates.', async () => {
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

  it('should order the chunks by totalOrder that share the same score.', async () => {
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
        pageContent: 'The quick brown fo',
        metadata: {totalOrder: 16, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L2',
        pageContent: 'The quick brown dog',
        metadata: {totalOrder: 1, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L3',
        pageContent: 'The quick brown dog',
        metadata: {totalOrder: 8, tokens: 4, charCount: 19},
      }),
      new Document({
        id: 'L4',
        pageContent: 'The car is going fast.',
        metadata: {totalOrder: 11, tokens: 4, charCount: 19},
      }),
    ];

    const orderedCandidates = await matchSectionChunk({
      sectionChunk,
      layoutChunks,
    });

    expect(orderedCandidates).toHaveLength(4);
    expect(orderedCandidates.map((c) => c.chunk.pageContent)).toEqual([
      'The quick brown fo',
      'The quick brown dog',
      'The quick brown dog',
      'The car is going fast.',
    ]);

    expect(orderedCandidates.map((c) => c.chunk.metadata.totalOrder)).toEqual([
      16, 8, 1, 11,
    ]);
  });
});

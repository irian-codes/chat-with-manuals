import {sortReconstructedSectionsByHeaderRoute} from '@/app/api/send-prompt/llm/Agent';
import {Document} from 'langchain/document';
import {describe, expect, it} from 'vitest';

describe('sortReconstructedSectionsByHeaderRoute', () => {
  it('should correctly sort reconstructed sections based on headerRoute', () => {
    // Sample reconstructed sections with various headerRoutesLevels
    const sections: Document[] = [
      new Document({
        pageContent: 'Introduction',
        metadata: {headerRouteLevels: '1'},
      }),
      new Document({
        pageContent: 'Background',
        metadata: {headerRouteLevels: '1>2'},
      }),
      new Document({
        pageContent: 'Methodology',
        metadata: {headerRouteLevels: '2'},
      }),
      new Document({
        pageContent: 'Overview',
        metadata: {headerRouteLevels: '1>1'},
      }),
      new Document({
        pageContent: 'Detailed Background',
        metadata: {headerRouteLevels: '1>2>1'},
      }),
      new Document({
        pageContent: 'Data Collection',
        metadata: {headerRouteLevels: '2>1'},
      }),
      new Document({
        pageContent: 'Results',
        metadata: {headerRouteLevels: '3'},
      }),
      new Document({
        pageContent: 'Sub Overview',
        metadata: {headerRouteLevels: '1>1'},
      }),
      new Document({
        pageContent: 'Sub Overview',
        metadata: {headerRouteLevels: '1>1>1'},
      }),
      new Document({
        pageContent: 'Sub Overview',
        metadata: {headerRouteLevels: '1>1>2'},
      }),
    ];

    // Shuffle the sections to ensure sorting is necessary
    const shuffledSections = sections.sort(() => Math.random() - 0.5);

    // Perform the sorting
    const sortedSections =
      sortReconstructedSectionsByHeaderRoute(shuffledSections);

    // Expected order based on headerRoute hierarchy
    const expectedOrder = [
      '1',
      '1>1',
      '1>1',
      '1>1>1',
      '1>1>2',
      '1>2',
      '1>2>1',
      '2',
      '2>1',
      '3',
    ];

    // Extract headerRoutes from sorted sections
    const sortedHeaderRoutes = sortedSections.map(
      (section) => section.metadata.headerRouteLevels
    );

    // Assert that the sorted headerRoutes match the expected order
    expect(sortedHeaderRoutes).toEqual(expectedOrder);
  });
});

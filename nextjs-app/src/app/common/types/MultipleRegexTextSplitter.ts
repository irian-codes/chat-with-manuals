import {TextSplitter} from './TextSplitter';

type MultipleRegexTextSplitterParams = {
  separators: RegExp[];
  noMatchSequences?: RegExp[];
  keepSeparators?: boolean;
};

export class MultipleRegexTextSplitter implements TextSplitter {
  separators: RegExp[];
  /**
   * Sequences to not split even if they match with the separators.
   * @default
   * Defaults to 'e.g.', 'i.e.', 'f.e.' and common list item headers (a.
   * blah blah, 2. blah blah)
   */
  noMatchSequences: RegExp[] = [
    /e\.g\./,
    /i\.e\./,
    /f\.e\./,
    /^\s*\w{1,2}[.:]\s+/,
  ];
  keepSeparators: boolean = false;

  constructor({
    separators,
    keepSeparators,
    noMatchSequences,
  }: MultipleRegexTextSplitterParams) {
    if (!separators || separators.length === 0) {
      throw new Error('At least one separator is required.');
    }

    if (separators.some((s) => !(s instanceof RegExp))) {
      throw new Error('All separators must be RegExp instances.');
    }

    this.separators = separators;
    this.noMatchSequences =
      noMatchSequences != null ? noMatchSequences : this.noMatchSequences;

    this.keepSeparators = keepSeparators ?? this.keepSeparators;
  }

  async splitText(text: string): Promise<string[]> {
    if (this.separators.length === 0) {
      return [text];
    }

    const noMatchIntervals = this.collectIntervals(text, this.noMatchSequences);
    const separatorIntervals = this.collectIntervals(text, this.separators);

    // Filter out separator intervals that are within noMatch intervals
    const validSeparatorIntervals = this.filterSeparatorIntervals(
      separatorIntervals,
      noMatchIntervals
    );

    // Split the text based on the valid separator intervals
    const result = this.splitByIntervals(text, validSeparatorIntervals);

    return result.filter(Boolean);
  }

  private collectIntervals(
    text: string,
    regexes: RegExp[]
  ): {start: number; end: number}[] {
    const intervals: {start: number; end: number}[] = [];

    for (const regex of regexes) {
      const globalRegex = new RegExp(
        regex.source,
        regex.flags.includes('g') ? regex.flags : regex.flags + 'g'
      );
      globalRegex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = globalRegex.exec(text)) !== null) {
        intervals.push({start: match.index, end: globalRegex.lastIndex});

        if (globalRegex.lastIndex === match.index) {
          // Avoid infinite loops with zero-length matches
          globalRegex.lastIndex++;
        }
      }
    }

    return intervals.sort((a, b) => a.start - b.start);
  }

  private filterSeparatorIntervals(
    separators: {start: number; end: number}[],
    noMatches: {start: number; end: number}[]
  ): {start: number; end: number}[] {
    const validSeparators: {start: number; end: number}[] = [];
    let noMatchIndex = 0;

    for (const sep of separators) {
      while (
        noMatchIndex < noMatches.length &&
        noMatches[noMatchIndex].end <= sep.start
      ) {
        noMatchIndex++;
      }

      if (
        noMatchIndex < noMatches.length &&
        noMatches[noMatchIndex].start <= sep.start &&
        sep.start < noMatches[noMatchIndex].end
      ) {
        // Separator is within a noMatch interval; skip it
        continue;
      }

      validSeparators.push(sep);
    }

    return validSeparators;
  }

  private splitByIntervals(
    text: string,
    separators: {start: number; end: number}[]
  ): string[] {
    const result: string[] = [];
    let currentPosition = 0;

    for (const sep of separators) {
      if (sep.start >= currentPosition) {
        let segment = text.substring(currentPosition, sep.start);

        if (this.keepSeparators) {
          // Include separator in the segment
          segment += text.substring(sep.start, sep.end);
        }

        if (segment) {
          result.push(segment);
        }

        currentPosition = sep.end;
      } else if (sep.end > currentPosition) {
        // Overlapping separator, adjust currentPosition
        currentPosition = sep.end;
      }
    }

    if (currentPosition < text.length) {
      const segment = text.substring(currentPosition);
      if (segment) {
        result.push(segment);
      }
    }

    return result;
  }
}

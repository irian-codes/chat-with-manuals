import {type TextSplitter} from '@/types/TextSplitter';
import {isStringEmpty} from '@/utils/strings';

/**
 * Splits a given text by multiple regex patterns while also
 * respecting abbreviations and other exceptions where it should
 * not split.
 * Each pattern can use its own independent flags and will be
 * evaluated separately.
 *
 * @remarks
 * Useful for splitting text by sentences, paragraphs or
 * any regex delimitable sequence.
 *
 * @example
 * Example: "Split on each paragraph and sentence but don't split on list delimiters."
 * const splitter = new MultipleRegexTextSplitter({
 *     separators: [/[\r\n]+/, /[\.?!]{1}\s+/],
 *     noMatchSequences: [/^\s*\w{1,2}[.:]\s+/m],
 *     keepSeparators: true,
 *   });
 *
 *   // Test without exceptions
 *   const text = `This is not a list.
 * This list begins now:
 *   a. Item1
 *   b. Item2
 *
 * End of the list.`;
 *   let result = await splitter.splitText(text);
 *
 *   expect(result).toEqual([
 *     'This is not a list.\n',
 *     'This list begins now:\n',
 *     '    a. Item1\n',
 *     '    b. Item2\n\n',
 *     'End of the list.',
 *   ]);
 *
 * @export
 */
export class MultipleRegexTextSplitter implements TextSplitter {
  separators: RegExp[];
  /**
   * Sequences to not split even if they match with the separators.
   * @default
   * `Defaults to 'e.g.', 'i.e.', 'f.e.' and common list item headers (a.
   * blah blah, 2. blah blah) or abbreviations like 'Mr.' and 'Dr.'`
   */
  noMatchSequences: RegExp[] = [
    /e\.g\./i,
    /i\.e\./i,
    /f\.e\./i,
    /^\s*\w{1,2}[.:]\s+\w/m,
  ];
  // TODO: This is not ideal, we should be able to choose, per each
  // separator which ones to keep and which ones to drop.
  // This doesn't seem a nightmare to implement.
  keepSeparators = false;

  constructor(params: {
    separators: RegExp[];
    noMatchSequences?: RegExp[];
    keepSeparators?: boolean;
  }) {
    if (!params.separators || params.separators.length === 0) {
      throw new Error('At least one separator RegExp is required.');
    }

    if (
      params.separators
        .concat(params.noMatchSequences ?? [])
        .some((s) => !(s instanceof RegExp))
    ) {
      throw new Error(
        "All 'separators' and 'noMatchSequences' must be RegExp instances."
      );
    }

    this.separators = params.separators;
    this.noMatchSequences = params.noMatchSequences ?? this.noMatchSequences;
    this.keepSeparators = params.keepSeparators ?? this.keepSeparators;
  }

  async splitText(text: string): Promise<string[]> {
    if (this.separators.length === 0 || isStringEmpty(text)) {
      return [text];
    }

    const separatorIntervals = this.collectIntervals(text, this.separators);
    const noMatchIntervals = this.collectIntervals(text, this.noMatchSequences);

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
    regExps: RegExp[]
  ): {start: number; end: number}[] {
    const intervals: {start: number; end: number}[] = [];

    for (const regex of regExps) {
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
    if (noMatches.length === 0) {
      return separators;
    }

    const validSeparators: {start: number; end: number}[] = [];
    let noMatchIndex = 0;

    for (const sep of separators) {
      // Catch up with the current separator until we find one that ends
      // after the start of the current separator
      while (
        noMatchIndex < noMatches.length &&
        noMatches[noMatchIndex]!.end <= sep.start
      ) {
        noMatchIndex++;
      }

      // Separator is within a noMatch interval; skip it
      if (
        noMatchIndex < noMatches.length &&
        noMatches[noMatchIndex]!.start <= sep.start &&
        sep.start < noMatches[noMatchIndex]!.end
      ) {
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
      // If overlapping separators are detected, skip them
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
      }
    }

    // Splitting last segment
    if (currentPosition < text.length) {
      const segment = text.substring(currentPosition);
      if (segment) {
        result.push(segment);
      }
    }

    return result;
  }
}

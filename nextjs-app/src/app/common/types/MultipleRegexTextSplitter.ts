import {isBlankString} from '../utils/stringUtils';
import {TextSplitter} from './TextSplitter';

type MultipleRegexTextSplitterParams = {
  separators: RegExp[];
  noMatchSequences?: RegExp[];
  flags?: string;
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
  flags: string = 'gm';
  keepSeparators: boolean = false;

  constructor({
    separators,
    keepSeparators,
    noMatchSequences,
    flags,
  }: MultipleRegexTextSplitterParams) {
    if (flags != null && !isBlankString(flags)) {
      try {
        new RegExp('/.*/', flags);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(
            `Wrong RegExp flags. Flags must be a combination of the following ECMAScript valid regex flags characters.
Consult here the valid ones: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags`
          );
        } else {
          throw error;
        }
      }
    }

    this.flags = (() => {
      if (flags == null || isBlankString(flags)) {
        return this.flags;
      } else {
        return flags.includes('g') ? flags : 'g' + flags;
      }
    })();

    if (!separators || separators.length === 0) {
      throw new Error('At least one separator is required.');
    }

    if (separators.some((s) => s instanceof RegExp === false)) {
      throw new Error('All separators must be RegExp instances.');
    }

    if (separators.concat(noMatchSequences ?? []).some((r) => r.flags !== '')) {
      throw new Error(
        "Please don't pass flags directly in RegExp instances in this constructor. Use the flags parameter."
      );
    }

    this.separators = separators.map((s) => new RegExp(s, this.flags));
    this.noMatchSequences =
      noMatchSequences != null
        ? noMatchSequences.map((s) => new RegExp(s, this.flags))
        : this.noMatchSequences;

    this.keepSeparators = keepSeparators ?? this.keepSeparators;
  }

  async splitText(text: string): Promise<string[]> {
    if (this.separators.length === 0) {
      return [text];
    }

    const {joinedRegex, noMatchGroup, separatorsGroup, flags} =
      this.buildJoinedSeparator();
    const splitIndexes: number[] = [];
    let lastMatch = joinedRegex.exec(text);

    while (lastMatch !== null) {
      if (lastMatch.groups?.noMatches == null) {
        if (!this.keepSeparators) {
          splitIndexes.push(lastMatch.index);
        }

        splitIndexes.push(lastMatch.index + lastMatch[0].length);
      }

      lastMatch = joinedRegex.exec(text);
    }

    let result: string[] = [];

    for (let i = 0; i < splitIndexes.length + 1; i++) {
      const index = splitIndexes[i];
      const lastIndex = splitIndexes[i - 1] || 0;
      const split = text.slice(lastIndex, index ?? text.length);

      // If this is a separator and we want to drop it we won't push it
      if (!this.keepSeparators && this.doesContainSeparator(split)) {
        continue;
      }

      result.push(split);
    }

    return result.filter(Boolean);
  }

  private buildJoinedSeparator() {
    const separatorsGroup = this.separators.map((s) => s.source).join('|');
    const noMatchGroup = this.noMatchSequences.map((s) => s.source).join('|');

    const regexpStr =
      this.noMatchSequences.length > 0
        ? `(?<noMatches>${noMatchGroup})|(?<separators>${separatorsGroup})`
        : `(?<separators>${separatorsGroup})`;

    return {
      joinedRegex: new RegExp(regexpStr, this.flags),
      noMatchGroup,
      separatorsGroup,
      flags: this.flags,
    };
  }

  private doesContainSeparator(text: string) {
    if (this.separators.length === 0) {
      return false;
    }

    for (const noMatches of this.noMatchSequences) {
      if (text.match(noMatches) != null && text.match(noMatches)!.length > 0) {
        return false;
      }
    }

    for (const separator of this.separators) {
      if (text.match(separator) != null && text.match(separator)!.length > 0) {
        return true;
      }
    }

    return false;
  }
}

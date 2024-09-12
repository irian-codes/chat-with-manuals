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
    /^\s*\w{1,2}[.:]\s/,
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

    if (separators.some((s) => s instanceof RegExp === false)) {
      throw new Error('All separators must be RegExp instances.');
    }

    this.separators = separators;
    this.noMatchSequences = noMatchSequences ?? this.noMatchSequences;

    if (!this.doesEachRegExpContainsSameSeparators()) {
      throw new Error(
        'Different flags in RegExp is unsupported. All separators and noMatchSequences must have the same flags.'
      );
    }

    this.keepSeparators = keepSeparators ?? this.keepSeparators;
  }

  private doesEachRegExpContainsSameSeparators() {
    const referenceFlags = this.separators[0].flags.split('');

    for (const regexp of this.separators.concat(this.noMatchSequences)) {
      const flags = regexp.flags.split('');

      if (flags.length !== referenceFlags.length) {
        return false;
      }

      if (flags.some((f) => !referenceFlags.includes(f))) {
        return false;
      }
    }

    return true;
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
      if (
        !this.keepSeparators &&
        this.doesContainSeparator(split, this.separators)
      ) {
        continue;
      }

      result.push(split);
    }

    return result.filter(Boolean);
  }

  private buildJoinedSeparator() {
    const separatorsGroup = this.separators.map((s) => s.source).join('|');
    const noMatchGroup = this.noMatchSequences.map((s) => s.source).join('|');
    const flags = this.separators[0].flags.includes('g')
      ? this.separators[0].flags
      : this.separators[0].flags + 'g';

    const regexpStr =
      this.noMatchSequences.length > 0
        ? `(?<noMatches>${noMatchGroup})|(?<separators>${separatorsGroup})`
        : `(?<separators>${separatorsGroup})`;

    return {
      joinedRegex: new RegExp(regexpStr, flags),
      noMatchGroup,
      separatorsGroup,
      flags,
    };
  }

  private doesContainSeparator(text: string, separators: RegExp[]) {
    if (separators.length === 0) {
      return false;
    }

    for (const noMatches of this.noMatchSequences) {
      if (text.match(noMatches) != null && text.match(noMatches)!.length > 0) {
        return false;
      }
    }

    for (const separator of separators) {
      if (text.match(separator) != null && text.match(separator)!.length > 0) {
        return true;
      }
    }

    return false;
  }
}

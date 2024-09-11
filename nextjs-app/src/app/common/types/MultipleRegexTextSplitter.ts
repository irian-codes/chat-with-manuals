import {TextSplitter} from './TextSplitter';

type MultipleRegexTextSplitterParams = {
  separators: RegExp[];
  keepSeparators?: boolean;
};

export class MultipleRegexTextSplitter implements TextSplitter {
  separators: RegExp[] = [/[\r\n]+/, /[\.?!]\s+/];
  keepSeparators: boolean = false;

  constructor({separators, keepSeparators}: MultipleRegexTextSplitterParams) {
    if (!separators || separators.length === 0) {
      throw new Error('At least one separator is required.');
    }

    this.separators = separators;

    if (!this.doesEachSeparatorContainsSameSeparators()) {
      throw new Error(
        'Different flags in separators is unsupported. All separators must have the same flags.'
      );
    }

    this.keepSeparators = keepSeparators ?? this.keepSeparators;
  }

  private doesEachSeparatorContainsSameSeparators() {
    const referenceSeparators = this.separators[0].flags.split('');

    for (const separator of this.separators) {
      const flags = separator.flags.split('');

      if (flags.length !== referenceSeparators.length) {
        return false;
      }

      if (flags.some((f) => !referenceSeparators.includes(f))) {
        return false;
      }
    }

    return true;
  }

  async splitText(text: string): Promise<string[]> {
    return this.keepSeparators
      ? this.splitKeepSeparators(text)
      : this.splitDroppingSeparators(text);
  }
  private splitDroppingSeparators(text: string) {
    const joinedSeparator = new RegExp(
      this.separators.map((separator) => separator.source).join('|'),
      this.separators[0].flags
    );

    // Split the text using the combined regex
    const segments = text.split(joinedSeparator).filter(Boolean);

    return segments;
  }
  private splitKeepSeparators(text: string) {
    const joinedSeparator = new RegExp(
      this.separators.map((separator) => `(${separator.source})`).join('|'),
      this.separators[0].flags
    );
    const segments = text.split(joinedSeparator).filter(Boolean);

    if (segments.length === 0) {
      return segments;
    }

    // If keeping separators, rejoin the separators to their preceding segments
    const startsWithSeparator = text.match(joinedSeparator)?.index === 0;
    let firstSeparator = null;
    const result: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Removing first separator so the even element indexes are the separators
      if (i === 0 && firstSeparator == null) {
        if (startsWithSeparator) {
          firstSeparator = segments.shift()!;
          i--;
          continue;
        }
      }

      if (i % 2 === 1 && result.length > 0) {
        // Append the separator to the preceding segment
        result[result.length - 1] += segment;
      } else {
        result.push(segment);
      }
    }

    if (startsWithSeparator) {
      result.unshift(firstSeparator!);
    }

    return result;
  }
  private doesContainSeparator(text: string, separators: RegExp[]) {
    if (separators.length === 0) {
      return false;
    }

    for (const separator of separators) {
      if (text.match(separator) != null && text.match(separator)!.length > 0) {
        return true;
      }
    }

    return false;
  }
}

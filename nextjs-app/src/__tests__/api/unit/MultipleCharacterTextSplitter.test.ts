import {MultipleRegexTextSplitter} from '@/app/common/types/MultipleRegexTextSplitter';
import {describe, expect, it} from 'vitest';

describe('MultipleCharacterTextSplitter', () => {
  it('should throw an error if no separators are provided', () => {
    expect(() => {
      new MultipleRegexTextSplitter({});
    }).toThrow();

    expect(() => {
      new MultipleRegexTextSplitter({separators: []});
    }).toThrow();
  });

  it('should throw an error if separators have inconsistent flags', () => {
    expect(() => {
      new MultipleRegexTextSplitter({
        separators: [/[\r\n]+/g, /[\.?!]\s+/i],
      });
    }).toThrow();

    expect(() => {
      new MultipleRegexTextSplitter({
        separators: [/[\r\n]+/, /[\.?!]\s+/i],
      });
    }).toThrow();
  });

  it('should split text correctly without keeping separators', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]{1}\s+/],
      keepSeparators: false,
    });

    const text = "Hello! How are you\ntoday?\nI'm fine. Thanks!";
    const result = await splitter.splitText(text);

    expect(result).toEqual([
      'Hello',
      'How are you',
      'today',
      "I'm fine",
      'Thanks!',
    ]);
  });

  it('should split text correctly while keeping separators', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]{1}\s+/],
      keepSeparators: true,
    });

    const text = "Hello! How are you\ntoday?\nI'm fine. Thanks!";
    const result = await splitter.splitText(text);

    expect(result).toEqual([
      'Hello! ',
      'How are you\n',
      'today?\n',
      "I'm fine. ",
      'Thanks!',
    ]);
  });

  it('should handle multiple occurrences of separators correctly', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]{1}\s+/],
      keepSeparators: true,
    });

    // Test keeping separators
    const text = "Hello... How are you?!\n\nI'm fine.";
    let result = await splitter.splitText(text);
    expect(result).toEqual(['Hello... ', 'How are you?!\n\n', "I'm fine."]);

    // Test without keeping separators
    splitter.keepSeparators = false;
    result = await splitter.splitText(text);
    expect(result).toEqual(['Hello..', 'How are you?', "I'm fine."]);
  });

  it('should handle separators at the beginning of the text correctly', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]{1}\s+/],
      keepSeparators: true,
    });

    // Test keeping separators
    const text = "\n\nHello... How are you?!\n\nI'm fine.";
    let result = await splitter.splitText(text);

    expect(result).toEqual([
      '\n\n',
      'Hello... ',
      'How are you?!\n\n',
      "I'm fine.",
    ]);

    // Test without keeping separators
    splitter.keepSeparators = false;
    result = await splitter.splitText(text);
    expect(result).toEqual(['Hello..', 'How are you?', "I'm fine."]);
  });

  it('should handle separators at the end of the text correctly', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]{1}\s+/],
      keepSeparators: true,
    });

    // Test keeping separators
    const text = "Hello... How are you?!\n\nI'm fine. ";
    let result = await splitter.splitText(text);
    expect(result).toEqual(['Hello... ', 'How are you?!\n\n', "I'm fine. "]);

    // Test without keeping separators
    splitter.keepSeparators = false;
    result = await splitter.splitText(text);
    expect(result).toEqual(['Hello..', 'How are you?', "I'm fine"]);
  });

  it('should handle multiple separators concatenated correctly', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]{1}\s+/],
      keepSeparators: true,
    });

    // Test keeping separators
    const text = "Hello... How are you\n\n?!\n\nI'm fine. Thanks!";
    let result = await splitter.splitText(text);

    expect(result).toEqual([
      'Hello... ',
      'How are you\n\n',
      '?!\n\n',
      "I'm fine. ",
      'Thanks!',
    ]);

    // Test without keeping separators
    splitter.keepSeparators = false;
    result = await splitter.splitText(text);

    expect(result).toEqual([
      'Hello..',
      'How are you',
      '?',
      "I'm fine",
      'Thanks!',
    ]);
  });

  it('should handle text without any separators correctly', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/null/],
      keepSeparators: true,
    });

    // Test keeping separators
    const text = 'This is a plain text without separators';
    let result = await splitter.splitText(text);
    expect(result).toEqual(['This is a plain text without separators']);

    // Test without keeping separators
    splitter.keepSeparators = false;
    result = await splitter.splitText(text);
    expect(result).toEqual(['This is a plain text without separators']);
  });

  it('should split text with only one separator', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/\s/],
      keepSeparators: true,
    });

    // Test keeping separators
    const text = 'Split this.';
    let result = await splitter.splitText(text);
    expect(result).toEqual(['Split ', 'this.']);

    // Test without keeping separators
    splitter.keepSeparators = false;
    result = await splitter.splitText(text);
    expect(result).toEqual(['Split', 'this.']);
  });

  it('should handle abbreviations well by not splitting them', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]{1}\s+/],
      noMatchSequences: [],
      keepSeparators: true,
    });

    // Test without exceptions
    const text =
      'Split this text. That contains some abbreviations like i.e. or etc. \nText i.e.';
    let result = await splitter.splitText(text);

    expect(result).toEqual([
      'Split this text. ',
      'That contains some abbreviations like i.e. ',
      'or etc. \n',
      'Text i.e.',
    ]);

    // Test with abbreviations skipped
    (splitter.noMatchSequences = [/etc\./, /i\.e\./, /f\.e\./]),
      (result = await splitter.splitText(text));
    expect(result).toEqual([
      'Split this text. ',
      'That contains some abbreviations like i.e. or etc. \n',
      'Text i.e.',
    ]);

    // Test without keeping separators
    splitter.keepSeparators = false;
    result = await splitter.splitText(text);
    expect(result).toEqual([
      'Split this text',
      'That contains some abbreviations like i.e. or etc. ',
      'Text i.e.',
    ]);
  });
});

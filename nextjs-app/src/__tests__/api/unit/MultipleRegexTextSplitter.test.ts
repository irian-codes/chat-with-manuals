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
    splitter.noMatchSequences = [/etc\./, /i\.e\./, /f\.e\./i];
    result = await splitter.splitText(text);

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

  it("should split lists correctly with the 'm' flag", async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/^\s*(?=(?:\w{1,2}[.:]|-)[ ]+\w)/m],
      noMatchSequences: [],
      keepSeparators: true,
    });

    // Test without exceptions
    const text = `This is not a list.
This list begins now:
    a. Item 1
  b. Item 2
c. Item 3

End of the list.`;
    let result = await splitter.splitText(text);

    expect(result).toEqual([
      'This is not a list.\nThis list begins now:\n    ',
      'a. Item 1\n  ',
      'b. Item 2\n',
      'c. Item 3\n\nEnd of the list.',
    ]);

    // Test without keeping separators
    splitter.keepSeparators = false;
    result = await splitter.splitText(text);

    expect(result).toEqual([
      'This is not a list.\nThis list begins now:\n',
      'a. Item 1\n',
      'b. Item 2\n',
      'c. Item 3\n\nEnd of the list.',
    ]);
  });

  it('should handle overlapping separators well', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/(\.\$)+/, /[\r\n]+/],
      noMatchSequences: [],
      keepSeparators: true,
    });

    // Test keeping separators
    const text =
      'Text with overlapping separators.\nCase 1: .$ T\nCase 2: .$.$ T\nCase 3: .$.$.$ T';
    let result = await splitter.splitText(text);

    expect(result).toEqual([
      'Text with overlapping separators.\n',
      'Case 1: .$',
      ' T\n',
      'Case 2: .$.$',
      ' T\n',
      'Case 3: .$.$.$',
      ' T',
    ]);

    // Test without keeping separators
    splitter.keepSeparators = false;
    result = await splitter.splitText(text);

    expect(result).toEqual([
      'Text with overlapping separators.',
      'Case 1: ',
      ' T',
      'Case 2: ',
      ' T',
      'Case 3: ',
      ' T',
    ]);
  });
});

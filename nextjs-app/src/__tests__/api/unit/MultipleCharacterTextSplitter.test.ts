import {MultipleRegexTextSplitter} from '@/app/common/types/MultipleRegexTextSplitter';
import {describe, expect, test} from 'vitest';

describe('MultipleCharacterTextSplitter', () => {
  test('should throw an error if no separators are provided', () => {
    expect(() => {
      new MultipleRegexTextSplitter({});
    }).toThrow('At least one separator is required.');

    expect(() => {
      new MultipleRegexTextSplitter({separators: []});
    }).toThrow('At least one separator is required.');
  });

  test('should throw an error if separators have inconsistent flags', () => {
    expect(() => {
      new MultipleRegexTextSplitter({
        separators: [/[\r\n]+/g, /[\.?!]\s+/i],
      });
    }).toThrow('All separators must have the same flags.');

    expect(() => {
      new MultipleRegexTextSplitter({
        separators: [/[\r\n]+/, /[\.?!]\s+/i],
      });
    }).toThrow('All separators must have the same flags.');
  });

  test('should split text correctly without keeping separators', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
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

  test('should split text correctly while keeping separators', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
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

  test('should handle multiple occurrences of separators correctly', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
      keepSeparators: true,
    });

    const text = "Hello... How are you?!\n\nI'm fine.";
    const result = await splitter.splitText(text);

    expect(result).toEqual(['Hello... ', 'How are you?!\n\n', "I'm fine."]);
  });

  test('should handle separators at the beginning of the text correctly', async () => {
    let splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
      keepSeparators: true,
    });

    const text = "\n\nHello... How are you?!\n\nI'm fine.";
    let result = await splitter.splitText(text);

    expect(result).toEqual([
      '\n\n',
      'Hello... ',
      'How are you?!\n\n',
      "I'm fine.",
    ]);

    splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
      keepSeparators: false,
    });

    result = await splitter.splitText(text);

    expect(result).toEqual(['Hello..', 'How are you?', "I'm fine."]);
  });

  test('should handle separators at the end of the text correctly', async () => {
    let splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
      keepSeparators: true,
    });

    const text = "Hello... How are you?!\n\nI'm fine. ";
    let result = await splitter.splitText(text);

    expect(result).toEqual(['Hello... ', 'How are you?!\n\n', "I'm fine. "]);

    splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
      keepSeparators: false,
    });

    result = await splitter.splitText(text);

    expect(result).toEqual(['Hello..', 'How are you?', "I'm fine"]);
  });

  test('should handle multiple separators concatenated correctly', async () => {
    let splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
      keepSeparators: true,
    });

    const text = "Hello... How are you\n\n?!\n\nI'm fine. Thanks!";
    let result = await splitter.splitText(text);

    expect(result).toEqual([
      'Hello... ',
      'How are you\n\n',
      '?!\n\n',
      "I'm fine. ",
      'Thanks!',
    ]);

    splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
      keepSeparators: false,
    });

    result = await splitter.splitText(text);

    expect(result).toEqual([
      'Hello..',
      'How are you',
      '?',
      "I'm fine",
      'Thanks!',
    ]);
  });

  test('should handle text without any separators correctly', async () => {
    let splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
    });

    const text = 'This is a plain text without separators';
    let result = await splitter.splitText(text);

    expect(result).toEqual(['This is a plain text without separators']);

    splitter = new MultipleRegexTextSplitter({
      separators: [/[\r\n]+/, /[\.?!]\s+/],
      keepSeparators: true,
    });

    result = await splitter.splitText(text);

    expect(result).toEqual(['This is a plain text without separators']);
  });

  test('should split text with only one separator', async () => {
    const splitter = new MultipleRegexTextSplitter({
      separators: [/[\.\s]+/],
    });

    const text = 'Split this text.';
    const result = await splitter.splitText(text);

    expect(result).toEqual(['Split', 'this', 'text']);
  });
});

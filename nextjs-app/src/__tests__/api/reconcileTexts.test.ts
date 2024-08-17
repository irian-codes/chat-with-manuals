import {reconcileTexts} from '@/app/api/parse-pdf/functions';
import {diffWordsWithSpace} from 'diff';
import {describe, expect, it, TestFunction} from 'vitest';

describe('reconcileTexts', () => {
  function printDiff(
    firstText: string,
    secondText: string,
    ctx: Parameters<TestFunction>[0]
  ) {
    // Normalize the first text for easier diffing
    const normalizedFirstText = firstText
      .split(/[\s\n]+/)
      .map((s) => s.trim())
      .join(' ');

    // Generate the diff JSON using jsdiff
    const trimmedDiff = diffWordsWithSpace(normalizedFirstText, secondText, {
      ignoreCase: true,
      ignoreWhitespace: true,
    }).map((d) => ({...d, value: d.value.trim()}));

    console.log('Diff:', {name: ctx.task.name, trimmedDiff});
  }

  it('should handle equal words without changes', (ctx) => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown fox jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
  });

  it('should replace different words while preserving the case', (ctx) => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown f0x jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
  });

  it('should remove extra words present in the second text', (ctx) => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown smart fox jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
  });

  it('should insert missing words with appropriate case based on context (lowercase)', (ctx) => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
  });

  it('should insert missing words with appropriate case based on context (uppercase)', (ctx) => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick BROWN JUMPS over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);

    printDiff(firstText, secondText, ctx);

    expect(result).toEqual('The quick BROWN FOX JUMPS over the lazy dog.');
  });

  it('should correctly handle differences at the beginning of the text', (ctx) => {
    const firstText = 'Quick brown fox jumps over the lazy dog.';
    const secondText = 'Fast brown fox jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('Quick brown fox jumps over the lazy dog.');
  });

  it('should correctly handle differences at the end of the text', (ctx) => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown fox jumps over the lazy cat';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
  });

  it('should correctly handle uppercase blocks with the same word', (ctx) => {
    const firstText = 'THE quick BROWN FOX JUMPS OVER THE LAZY DOG.';
    const secondText = 'THE QUICK BROWN F_O_X JUMPS OVER THE LAZY DOG.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.');
  });

  it('should correctly handle uppercase header blocks with different words', (ctx) => {
    const firstText = 'the quick brown FOX JUMPS OVER THE LAZY DOG.';
    const secondText = 'THE SLOW BROWN F0X JUMPS OVER THE LAZY DOG.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.');
  });

  it('should correctly handle newlines and extra spaces', (ctx) => {
    const firstText = 'THE QUICK BROWN FOX\njumps over     the lazy dog   .';
    const secondText = 'THE QUICK BROWN F0X jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('THE QUICK BROWN FOX jumps over the lazy dog.');
  });

  it('should correctly handle multi-line differences in text', (ctx) => {
    const firstText = `The Vagabond\ncannot activate a DOMINANCE card for its normal\nvictory condition.`;
    const secondText = `The Vagabund cannot activate a dominance card for its victory condition.`;
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual(
      `The Vagabond cannot activate a dominance card for its normal victory condition.`
    );
  });
});

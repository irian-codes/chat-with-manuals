import {reconcileTexts} from '@/app/api/parse-pdf/functions';
import {diffWordsWithSpace} from 'diff';
import {describe, expect, it} from 'vitest';

describe('reconcileTexts', () => {
  function checkOnlyWhitespaceDifferences(
    firstText: string,
    resultText: string
  ) {
    const normalizedFirstText = firstText
      .split(/[\s\n]+/)
      .map((s) => s.trim())
      .join(' ');

    const diff = diffWordsWithSpace(normalizedFirstText, resultText, {
      ignoreCase: true,
    }).filter((d) => d.added || d.removed);

    // Ensure all diff.value strings are only whitespace or newline characters
    diff.forEach((d) => {
      expect(/^[\s\n]*$/.test(d.value)).toBe(true);
    });
  }

  // Case 1: Equal words (no change)
  it('should handle equal words without changes', () => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown fox jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
    checkOnlyWhitespaceDifferences(firstText, result);
  });

  // Case 2: Different words with case preservation
  it('should replace different words while preserving the case', () => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown f0x jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
    checkOnlyWhitespaceDifferences(firstText, result);
  });

  // Case 3: Extra word in LLM text (remove it)
  it('should remove extra words present in LLM text', () => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown smart fox jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
    checkOnlyWhitespaceDifferences(firstText, result);
  });

  // Case 4: Missing word in LLM text (insert it)
  it('should insert missing words with appropriate case based on context', () => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
    checkOnlyWhitespaceDifferences(firstText, result);
  });

  // Beginning of the text block difference
  it('should correctly handle differences at the beginning of the text', () => {
    const firstText = 'Quick brown fox jumps over the lazy dog.';
    const secondText = 'Fast brown fox jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('Quick brown fox jumps over the lazy dog.');
    checkOnlyWhitespaceDifferences(firstText, result);
  });

  // Middle of the text block difference
  it('should correctly handle differences in the middle of the text', () => {
    const firstText = 'The quick brown fox jumps over the lazy dog.';
    const secondText = 'The quick brown cat jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
    checkOnlyWhitespaceDifferences(firstText, result);
  });

  // End of the text block difference
  it('should correctly handle differences at the end of the text', () => {
    const firstText = 'The quick brown fox jumps over the dog.';
    const secondText = 'The quick brown fox jumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('The quick brown fox jumps over the lazy dog.');
    checkOnlyWhitespaceDifferences(firstText, result);
  });

  // Uppercase header block
  it('should correctly handle uppercase header blocks', () => {
    const firstText = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.';
    const secondText = 'THE QUICK BROWN F0X JUMPS OVER THE LAZY DOG.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.');
    checkOnlyWhitespaceDifferences(firstText, result);
  });

  // Mixed case blocks with headers and body
  it('should correctly handle mixed case blocks with headers and body text', () => {
    const firstText = 'THE QUICK BROWN FOX\njumps over the lazy dog.';
    const secondText = 'THE QUICK BROWN F0X\njumps over the lazy dog.';
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual('THE QUICK BROWN FOX\njumps over the lazy dog.');
    checkOnlyWhitespaceDifferences(firstText, result);
  });

  // Handle multi-line differences
  it('should correctly handle multi-line differences in text', () => {
    const firstText = `The Vagabond\ncannot activate a dominance card for its normal\nvictory condition.`;
    const secondText = `The Vagabund\ncannot activate a dominance card for its\nvictory condition.`;
    const result = reconcileTexts(firstText, secondText);
    expect(result).toEqual(
      `The Vagabond\ncannot activate a dominance card for its normal\nvictory condition.`
    );
    checkOnlyWhitespaceDifferences(firstText, result);
  });
});

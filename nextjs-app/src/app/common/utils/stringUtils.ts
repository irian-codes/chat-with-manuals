import {z} from 'zod';

export function isBlankString(str: string) {
  const emptyStringSchema = z
    .string()
    .trim()
    .min(1)
    .refine((value) => {
      if (value.toWellFormed().length === 0) {
        return false;
      }

      // Striping most common invalid characters
      let output = '';
      for (let i = 0; i < value.length; i++) {
        if (
          !(
            value.charCodeAt(i) <= 0x20 ||
            (value.charCodeAt(i) >= 0x7f && value.charCodeAt(i) <= 0x9f)
          )
        ) {
          output += value.charAt(i);
        }
      }

      if (output.length === 0) {
        return false;
      }

      return true;
    });

  return !emptyStringSchema.safeParse(str).success;
}

export function isStringUppercase(str: string) {
  return str === str.toUpperCase();
}

export function isStringLowercase(str: string) {
  return str === str.toLowerCase();
}

export function isStringSentenceCase(str: string) {
  return /^[^a-zA-Z]*[A-Z][a-z]+.*$/.test(str);
}

export function matchCaseBySurroundingWords(
  word: string,
  prevWord?: string,
  nextWord?: string
): string {
  const _prevWord =
    prevWord == null || isBlankString(prevWord) ? undefined : prevWord.trim();
  const _nextWord =
    nextWord == null || isBlankString(nextWord) ? undefined : nextWord.trim();

  if (_prevWord && _nextWord) {
    // Handle case based on surrounding words with the same case
    if (isStringUppercase(_prevWord) && isStringUppercase(_nextWord)) {
      return word.toUpperCase();
    } else if (isStringLowercase(_prevWord) && isStringLowercase(_nextWord)) {
      return isStringSentenceCase(word) ? word : word.toLowerCase();
    }
    // If the case mismatches we just return the word
    else {
      return word;
    }
  } else if (_prevWord) {
    // Handle case based on the previous word only
    return isStringUppercase(_prevWord)
      ? word.toUpperCase()
      : isStringSentenceCase(word)
        ? word
        : word.toLowerCase();
  } else if (_nextWord) {
    // Handle case based on the next word only
    return isStringUppercase(_nextWord)
      ? word.toUpperCase()
      : isStringSentenceCase(word)
        ? word
        : word.toLowerCase();
  }

  return word; // Default: return as is
}

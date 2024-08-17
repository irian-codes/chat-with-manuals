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

export function matchCaseBySurroundingWords(
  word: string,
  prevWord?: string,
  nextWord?: string
): string {
  if (prevWord && nextWord) {
    // Handle case based on surrounding words with the same case
    if (isStringUppercase(prevWord) && isStringUppercase(nextWord)) {
      return word.toUpperCase();
    } else if (isStringLowercase(prevWord) && isStringLowercase(nextWord)) {
      return word.toLowerCase();
    }
    // If the case mismatches we just return the word
    else {
      return word;
    }
  } else if (prevWord) {
    // Handle case based on the previous word only
    return isStringUppercase(prevWord)
      ? word.toUpperCase()
      : word.toLowerCase();
  } else if (nextWord) {
    // Handle case based on the next word only
    return isStringUppercase(nextWord)
      ? word.toUpperCase()
      : word.toLowerCase();
  }

  return word; // Default: return as is
}

import {z} from 'zod';

export const nonEmptyStringSchema = z
  .string()
  .trim()
  .nonempty()
  .refine((value) => value.toWellFormed().length > 0);

export function isStringEmpty(str?: string | null) {
  return !nonEmptyStringSchema.safeParse(str).success;
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

/**
 * Normalizes a string for search by:
 * - Trimming whitespace
 * - Converting to lowercase
 * - Applying Unicode NFKD normalization (decomposing ligatures and diacritics into unicode marks)
 * - Removing all unicode marks (accents, tildes, etc.)
 *
 * This ensures that searches are case-insensitive and weird characters insensitive.
 *
 * @param {string} str - The input string to normalize.
 * @returns {string} The normalized string, suitable for search comparisons.
 *
 * @example
 * normalizeStringForSearch("Fiancé Café"); // "fiance cafe"
 * normalizeStringForSearch("Résumé naïve touché"); // "resume naive touche"
 */
export function normalizeStringForSearch(str: string): string {
  return str.trim().toLowerCase().normalize('NFKD').replaceAll(/\p{M}/gu, '');
}

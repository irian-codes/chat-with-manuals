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

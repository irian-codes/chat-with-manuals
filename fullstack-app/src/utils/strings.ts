import {z} from 'zod';

export function isStringEmpty(str: string) {
  const nonEmptyStringSchema = z
    .string()
    .trim()
    .min(1)
    .refine((value) => value.toWellFormed().length > 0);

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

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

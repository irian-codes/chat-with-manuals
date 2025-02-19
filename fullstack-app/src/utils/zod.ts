import {type z} from 'zod';

export function narrowType<T>(schema: z.ZodType<T>, val: unknown): val is T {
  return schema.safeParse(val).success;
}

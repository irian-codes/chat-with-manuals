import {z} from 'zod';

export function addDays(date: Date, days: number) {
  z.date().parse(date);
  z.number().int().positive().parse(days);

  const newDate = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

  return newDate;
}

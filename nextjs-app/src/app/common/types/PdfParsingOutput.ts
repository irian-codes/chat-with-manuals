import {z} from 'zod';

export const pdfParsingOutputEnum = z.enum([
  'json',
  'langchain',
  'unstructured',
  'llmwhisperer',
  'llamaparse',
]);

export type PdfParsingOutput = z.infer<typeof pdfParsingOutputEnum>;

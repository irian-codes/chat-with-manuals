import {z} from 'zod';

export const pdfParsingOutputScheme = z.enum([
  'json',
  'langchain',
  'unstructured',
  'llmwhisperer',
  'llamaparse',
]);

export type PdfParsingOutput = z.infer<typeof pdfParsingOutputScheme>;

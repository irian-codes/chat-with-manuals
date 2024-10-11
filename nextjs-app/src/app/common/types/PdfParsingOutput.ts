import {z} from 'zod';

export const pdfParsingOutputScheme = z.enum([
  'json',
  'langchain',
  'unstructured',
  'llmwhisperer',
  'llamaparse',
  'llamaparse-fastmode',
  'azure-document-intelligence',
  'pdfreader',
]);

export type PdfParsingOutput = z.infer<typeof pdfParsingOutputScheme>;

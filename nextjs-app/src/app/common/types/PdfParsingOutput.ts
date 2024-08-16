import {z} from 'zod';

export const pdfParsingOutputScheme = z.enum([
  'json',
  'langchain',
  'unstructured',
  'llmwhisperer',
  'llamaparse',
  'llamaparse-fastmode',
  'azure-document-intelligence',
  '@opendocsg-pdf2md',
]);

export type PdfParsingOutput = z.infer<typeof pdfParsingOutputScheme>;

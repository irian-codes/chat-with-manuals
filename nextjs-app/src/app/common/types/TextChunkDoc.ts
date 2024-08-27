import {Document} from 'langchain/document';
import {z} from 'zod';

export const textChunkMetadataSchema = z
  .object({
    totalOrder: z.number().gt(0),
    tokens: z.number().gt(0),
    charCount: z.number().gt(0),
  })
  .strict();

export type TextChunkMetadata = z.infer<typeof textChunkMetadataSchema>;
export type TextChunkDoc = Document<TextChunkMetadata>;

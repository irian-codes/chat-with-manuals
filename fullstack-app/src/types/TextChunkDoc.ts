import {Document} from 'langchain/document';
import {z} from 'zod';

export const textChunkMetadataSchema = z.object({
  totalOrder: z.number().gt(0),
  tokens: z.number().gt(0),
  charCount: z.number().gt(0),
});

export const textChunkDocSchema = z.instanceof(Document<TextChunkMetadata>);

export type TextChunkMetadata = z.infer<typeof textChunkMetadataSchema>;
export type TextChunkDoc = z.infer<typeof textChunkDocSchema>;

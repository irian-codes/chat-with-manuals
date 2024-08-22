import {Document} from 'langchain/document';
import {z} from 'zod';

export const chunkMetadataSchema = z.object({
  headerRoute: z.string().min(1),
  headerRouteLevels: z.string().min(1),
  order: z.number().gt(0),
  tokens: z.number().gt(0),
  charCount: z.number().gt(0),
  table: z.boolean(),
});

export type ChunkMetadata = z.infer<typeof chunkMetadataSchema>;
export type ChunkDoc = Document<ChunkMetadata>;

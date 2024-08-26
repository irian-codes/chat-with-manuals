import {Document} from 'langchain/document';
import {z} from 'zod';

export const sectionChunkMetadataSchema = z.object({
  headerRoute: z.string().min(1),
  headerRouteLevels: z.string().min(1),
  order: z.number().gt(0),
  tokens: z.number().gt(0),
  charCount: z.number().gt(0),
  table: z.boolean(),
});

export type SectionChunkMetadata = z.infer<typeof sectionChunkMetadataSchema>;
export type SectionChunkDoc = Document<SectionChunkMetadata>;

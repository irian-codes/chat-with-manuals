import {Document} from 'langchain/document';
import {z} from 'zod';

export const sectionChunkMetadataSchema = z.object({
  headerRoute: z.string().min(1),
  headerRouteLevels: z.string().min(1),
  // starts at 1
  order: z.number().gt(0),
  // starts at 1
  totalOrder: z.number().gt(0),
  tokens: z.number().gt(0),
  charCount: z.number().gt(0),
  table: z.boolean(),
  sectionId: z.string().min(1).uuid(),
});

export const sectionChunkDocSchema = z.instanceof(
  Document<SectionChunkMetadata>
);

export type SectionChunkMetadata = z.infer<typeof sectionChunkMetadataSchema>;
export type SectionChunkDoc = z.infer<typeof sectionChunkDocSchema>;

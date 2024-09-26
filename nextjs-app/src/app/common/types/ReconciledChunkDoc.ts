import {Document} from 'langchain/document';
import {z} from 'zod';
import {sectionChunkMetadataSchema} from './SectionChunkDoc';

export const reconciledChunkMetadataSchema = sectionChunkMetadataSchema
  .extend({
    reconciled: z.literal(true),
  })
  .strict();

export const reconciledChunkDocSchema = z.instanceof(
  Document<ReconciledChunkMetadata>
);

export type ReconciledChunkMetadata = z.infer<
  typeof reconciledChunkMetadataSchema
>;
export type ReconciledChunkDoc = z.infer<typeof reconciledChunkDocSchema>;

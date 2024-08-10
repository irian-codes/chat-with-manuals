import {Document} from 'langchain/document';
import {z} from 'zod';

export const reconstructedSectionMetadataSchema = z.object({
  headerRoute: z.string().min(1),
  headerRouteLevels: z.string().min(1),
  tokens: z.number().gt(0),
});

export type ReconstructedSectionMetadata = z.infer<
  typeof reconstructedSectionMetadataSchema
>;

export type ReconstructedSectionDoc = Document<ReconstructedSectionMetadata>;

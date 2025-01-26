import {z} from 'zod';
import {acceptedImageTypes as _acceptedImageTypes} from './UploadNewDocumentPayload';

export const acceptedImageTypes = _acceptedImageTypes;

export const UpdateDocumentPayloadSchema = z
  .object({
    id: z.string().trim().min(1).uuid(),
    title: z.string().trim().min(2).max(255).optional(),
    description: z.string().trim().max(2000).optional(),
    image: z
      .instanceof(File)
      .refine(
        (file) => acceptedImageTypes.includes(file.type),
        'File must be an image (JPEG, PNG, etc.)'
      )
      .refine(
        (file) => file.size > 0,
        'File must have a size greater than 0. Maybe the file is corrupted.'
      )
      .optional(),
  })
  .strict();

export type UpdateDocumentPayload = z.infer<typeof UpdateDocumentPayloadSchema>;

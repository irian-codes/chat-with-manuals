import ISO6391 from 'iso-639-1';
import {z} from 'zod';

export const UploadDocumentPayloadSchema = z
  .object({
    title: z.string().trim().min(2).max(255),
    description: z.string().trim().max(2000).optional(),
    locale: z
      .string()
      .trim()
      .min(2)
      .refine(
        (locale) => ISO6391.validate(locale),
        (locale) => ({
          message: `Invalid locale code. Got: ${locale}.`,
        })
      ),
    file: z
      .instanceof(File)
      .refine((file) => file.type === 'application/pdf', 'File must be a PDF')
      .refine(
        (file) => file.size > 0,
        'File must have a size greater than 0. Maybe the file is corrupted.'
      ),
  })
  .strict();

export type UploadDocumentPayload = z.infer<typeof UploadDocumentPayloadSchema>;

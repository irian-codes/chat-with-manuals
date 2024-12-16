import ISO6391 from 'iso-639-1';
import {z} from 'zod';

export const UploadDocumentPayloadSchema = z
  .object({
    // TODO: Add real imageUrl, for now using default value so we're not validating it
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
      )
      .refine(
        (file) => file.name.length >= 3 && file.name.length <= 255,
        (file) => ({
          message: `File name must be between 2 and 255 characters. Got: ${file.name}`,
        })
      )
      // TODO: Get this from the database instead of hardcoding it.
      // Maybe we'll need to move the validation on the backend itself though.
      .refine(
        (file) => file.size <= 1000 * 1024 * 1024,
        'File size must be less than 1000MB'
      ),
  })
  .strict();

export type UploadDocumentPayload = z.infer<typeof UploadDocumentPayloadSchema>;

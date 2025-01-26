import {isStringEmpty} from '@/utils/strings';
import ISO6391 from 'iso-639-1';
import mime from 'mime';
import {z} from 'zod';

export const acceptedImageTypes = [
  mime.getType('.jpg'),
  mime.getType('.png'),
  mime.getType('.webp'),
].filter((val): val is string => !isStringEmpty(val));

export const UploadNewDocumentPayloadSchema = z
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

export type UploadNewDocumentPayload = z.infer<
  typeof UploadNewDocumentPayloadSchema
>;

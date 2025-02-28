import {
  fileExists,
  getFile,
  validateAndResolvePath,
} from '@/server/utils/fileStorage';
import type {APIRouteErrorResponse} from '@/types/APIRouteErrorResponse';
import {acceptedImageTypes} from '@/types/UploadNewDocumentPayload';
import {isStringEmpty, nonEmptyStringSchema} from '@/utils/strings';
import mime from 'mime';
import type {NextApiRequest, NextApiResponse} from 'next';
import path from 'node:path';
import {env} from 'node:process';
import sharp from 'sharp';
import {z} from 'zod';

const DEFAULT_QUALITY = 75;

export const config = {
  api: {
    externalResolver: true,
  },
};

// TODO: This should go inside a Trigger.dev task because it can be CPU intensive
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      message: 'Method not allowed',
      data: {code: 'METHOD_NOT_SUPPORTED'},
    } satisfies APIRouteErrorResponse);
  }

  const queryParams = z
    .object({
      url: nonEmptyStringSchema.refine(
        (val) => !isStringEmpty(validateAndResolvePath(val)),
        (val) => ({
          message: `Invalid supplied file URL: ${val}`,
        })
      ),
      w: z.coerce.number().min(1).int().optional(),
      h: z.coerce.number().min(1).int().optional(),
      q: z.coerce.number().min(0).max(100).optional().default(DEFAULT_QUALITY),
    })
    .parse(req.query);

  if (!(await fileExists(queryParams.url))) {
    return res.status(404).json({
      message: 'Image not found',
      data: {code: 'NOT_FOUND'},
    } satisfies APIRouteErrorResponse);
  }

  try {
    const filePath = validateAndResolvePath(queryParams.url);
    const mimeType = mime.getType(path.extname(filePath));

    if (mimeType == null || !acceptedImageTypes.includes(mimeType)) {
      return res.status(400).json({
        message: 'Invalid file type requested, you can only request images',
        data: {code: 'BAD_REQUEST'},
      } satisfies APIRouteErrorResponse);
    }

    const file = await getFile({
      filePath,
      mimeType,
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const image = sharp(fileBuffer)
      .resize(queryParams.w, queryParams.h, {
        fit: 'inside',
      })
      .webp({quality: queryParams.q});

    const resizedBuffer = await image.toBuffer();

    if (env.NODE_ENV === 'development') {
      const metadata = await sharp(resizedBuffer).metadata();

      console.log('Image served with following characteristics: ', {
        ...metadata,
        quality: queryParams.q,
      });
    }

    return res
      .status(200)
      .setHeader('Content-Type', 'image/webp')
      .send(resizedBuffer);
  } catch (error) {
    console.error('Error sending image: ', error);

    return res.status(500).json({
      message: 'Error sending image',
      data: {code: 'INTERNAL_SERVER_ERROR'},
    } satisfies APIRouteErrorResponse);
  }
}

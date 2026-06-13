import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';

import { env, maxUploadBytes } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { storeImage } from '../storage/imageStorage';
import { AppError } from '../utils/http';

export const uploadsRouter = Router();

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

const allowedExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadBytes,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, 'Only JPG, PNG, WEBP, and GIF images are allowed'));
      return;
    }

    callback(null, true);
  }
});

function getUploadedFile(req: Express.Request) {
  const files = req.files as
    | {
        image?: Express.Multer.File[];
        file?: Express.Multer.File[];
      }
    | undefined;

  return files?.image?.[0] ?? files?.file?.[0] ?? null;
}

function hasValidImageSignature(buffer: Buffer, mimetype: string) {
  const header = buffer.subarray(0, 16);

  if (mimetype === 'image/jpeg') {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }

  if (mimetype === 'image/png') {
    return (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    );
  }

  if (mimetype === 'image/webp') {
    return (
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    );
  }

  if (mimetype === 'image/gif') {
    return (
      header[0] === 0x47 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x38 &&
      (header[4] === 0x37 || header[4] === 0x39) &&
      header[5] === 0x61
    );
  }

  return false;
}

uploadsRouter.post('/', requireAuth(), (req, res, next) => {
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ])(req, res, async (error) => {
    try {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          throw new AppError(
            400,
            `File is too large. Maximum size is ${env.MAX_UPLOAD_MB}MB`
          );
        }

        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          throw new AppError(400, 'Unexpected upload field. Use image or file.');
        }

        throw new AppError(400, error.message);
      }

      if (error) {
        throw error;
      }

      const uploadedFile = getUploadedFile(req);

      if (!uploadedFile) {
        throw new AppError(400, 'No file uploaded');
      }

      const extension = path.extname(uploadedFile.originalname).toLowerCase();

      if (!allowedExtensions.has(extension)) {
        throw new AppError(400, 'Unsupported image file extension');
      }

      if (!hasValidImageSignature(uploadedFile.buffer, uploadedFile.mimetype)) {
        throw new AppError(
          400,
          'Uploaded file content does not match a supported image format'
        );
      }

      const storedFile = await storeImage({
        buffer: uploadedFile.buffer,
        extension,
        mimetype: uploadedFile.mimetype,
        originalName: uploadedFile.originalname
      });

      res.status(201).json({
        url: storedFile.url,
        fileUrl: storedFile.url,
        imageUrl: storedFile.url,
        file: storedFile
      });
    } catch (caughtError) {
      next(caughtError);
    }
  });
});

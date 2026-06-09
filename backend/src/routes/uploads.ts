import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router } from 'express';
import multer from 'multer';

import { env, maxUploadBytes } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../utils/http';

export const uploadsRouter = Router();

const uploadPath = path.resolve(process.cwd(), env.UPLOAD_DIR);

fs.mkdirSync(uploadPath, {
  recursive: true
});

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const storage = multer.diskStorage({
  destination: uploadPath,
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      callback(new AppError(400, 'Unsupported image file extension'), '');
      return;
    }

    const safeFilename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`;
    callback(null, safeFilename);
  }
});

const upload = multer({
  storage,
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

uploadsRouter.post('/', requireAuth(), (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    try {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          throw new AppError(400, `File is too large. Maximum size is ${env.MAX_UPLOAD_MB}MB`);
        }

        throw new AppError(400, error.message);
      }

      if (error) {
        throw error;
      }

      if (!req.file) {
        throw new AppError(400, 'No file uploaded');
      }

      res.status(201).json({
        file: {
          originalName: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: `/uploads/${req.file.filename}`
        }
      });
    } catch (caughtError) {
      next(caughtError);
    }
  });
});
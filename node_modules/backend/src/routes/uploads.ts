import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../utils/http';

export const uploadsRouter = Router();

const uploadPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadPath,
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new AppError(400, 'Only image uploads are allowed'));
      return;
    }

    callback(null, true);
  }
});

uploadsRouter.post('/', requireAuth(), upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');

    res.status(201).json({
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      url: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    next(error);
  }
});
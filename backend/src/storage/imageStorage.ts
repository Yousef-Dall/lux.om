import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env';
import { storeImageInCloudinary } from './cloudinaryStorage';

export type StoreImageInput = {
  buffer: Buffer;
  extension: string;
  mimetype: string;
  originalName: string;
};

export const supportedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

export const supportedImageExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif'
]);

const storedImageContentTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif']
]);

const storedImageFilenamePattern = /^\d{13}-[a-f0-9]{24}\.(?:jpg|jpeg|png|webp|gif)$/;

function sanitizeOriginalName(originalName: string) {
  const basename = path.basename(originalName).replace(/[\u0000-\u001f\u007f]/g, '').trim();

  return basename.slice(0, 180) || 'upload';
}

export function isSupportedStoredImageExtension(extension: string) {
  return supportedImageExtensions.has(extension.toLowerCase());
}

export function getStoredImageContentType(filename: string) {
  const basename = path.basename(filename);

  if (basename !== filename || !storedImageFilenamePattern.test(basename)) {
    return null;
  }

  return storedImageContentTypes.get(path.extname(basename).toLowerCase()) ?? null;
}

export function isSafeLocalUploadFilename(filename: string) {
  return Boolean(getStoredImageContentType(filename));
}

export type StoredImage = {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
  originalName: string;
};

const localUploadDirectory = path.resolve(process.cwd(), env.UPLOAD_DIR);

export function usesLocalImageStorage() {
  return env.STORAGE_DRIVER === 'local';
}

export function getLocalUploadDirectory() {
  return localUploadDirectory;
}

async function storeImageLocally(input: StoreImageInput): Promise<StoredImage> {
  const extension = input.extension.toLowerCase();

  if (!isSupportedStoredImageExtension(extension)) {
    throw new Error('Unsupported local image extension');
  }

  if (!supportedImageMimeTypes.has(input.mimetype)) {
    throw new Error('Unsupported local image MIME type');
  }

  await fs.mkdir(localUploadDirectory, {
    recursive: true
  });

  const filename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`;
  const destination = path.join(localUploadDirectory, filename);

  await fs.writeFile(destination, input.buffer, {
    flag: 'wx',
    mode: 0o644
  });

  return {
    url: `/uploads/${filename}`,
    filename,
    size: input.buffer.byteLength,
    mimetype: input.mimetype,
    originalName: sanitizeOriginalName(input.originalName)
  };
}

export async function storeImage(input: StoreImageInput): Promise<StoredImage> {
  if (env.STORAGE_DRIVER === 'local') {
    return storeImageLocally(input);
  }

  if (env.STORAGE_DRIVER === 'cloudinary') {
    return storeImageInCloudinary(input);
  }

  throw new Error(`Unsupported storage driver: ${env.STORAGE_DRIVER}`);
}

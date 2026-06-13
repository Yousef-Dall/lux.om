import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env';

export type StoreImageInput = {
  buffer: Buffer;
  extension: string;
  mimetype: string;
  originalName: string;
};

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
  await fs.mkdir(localUploadDirectory, {
    recursive: true
  });

  const filename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${input.extension}`;
  const destination = path.join(localUploadDirectory, filename);

  await fs.writeFile(destination, input.buffer, {
    flag: 'wx'
  });

  return {
    url: `/uploads/${filename}`,
    filename,
    size: input.buffer.byteLength,
    mimetype: input.mimetype,
    originalName: input.originalName
  };
}

export async function storeImage(input: StoreImageInput): Promise<StoredImage> {
  if (env.STORAGE_DRIVER === 'local') {
    return storeImageLocally(input);
  }

  throw new Error(`Unsupported storage driver: ${env.STORAGE_DRIVER}`);
}

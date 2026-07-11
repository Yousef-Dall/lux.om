import crypto from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { env, maxPmsDocumentBytes } from '../config/env';
import { AppError } from '../utils/http';

const MIME_BY_EXTENSION = new Map([
  ['.pdf', 'application/pdf'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

const PRIVATE_KEY_PATTERN = /^[a-zA-Z0-9_-]+\/[0-9]{4}\/[0-9]{2}\/[0-9]{13}-[a-f0-9]{32}\.(?:pdf|jpg|jpeg|png|webp)$/;
const privateRoot = path.resolve(process.cwd(), env.PMS_PRIVATE_DOCUMENT_DIR);

export type PrivateDocumentMetadata = {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
};

export const supportedPrivateDocumentMimeTypes = new Set(MIME_BY_EXTENSION.values());

function sanitizeOriginalFilename(value: string) {
  const cleaned = path.basename(value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'document').slice(0, 220);
}

function hasValidSignature(buffer: Buffer, mimeType: string) {
  const h = buffer.subarray(0, 16);
  if (mimeType === 'application/pdf') return h.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  if (mimeType === 'image/png') return h.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mimeType === 'image/webp') return h.subarray(0, 4).toString('ascii') === 'RIFF' && h.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

export function validatePrivateDocumentFile(file: Express.Multer.File) {
  if (file.size <= 0 || file.size > maxPmsDocumentBytes || file.buffer.length !== file.size) {
    throw new AppError(400, `Private PMS documents must be non-empty and no larger than ${env.MAX_PMS_DOCUMENT_MB}MB.`);
  }
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMime = MIME_BY_EXTENSION.get(extension);
  if (!expectedMime || expectedMime !== file.mimetype) {
    throw new AppError(400, 'Private PMS documents must be PDF, JPG, PNG, or WEBP and the extension must match the content type.');
  }
  if (!hasValidSignature(file.buffer, file.mimetype)) {
    throw new AppError(400, 'The uploaded document signature does not match its declared file type.');
  }
  return { extension, originalFilename: sanitizeOriginalFilename(file.originalname) };
}

function resolveStorageKey(storageKey: string) {
  if (!PRIVATE_KEY_PATTERN.test(storageKey)) throw new AppError(404, 'Private document file is unavailable.');
  const resolved = path.resolve(privateRoot, storageKey);
  if (!resolved.startsWith(`${privateRoot}${path.sep}`)) throw new AppError(404, 'Private document file is unavailable.');
  return resolved;
}

export async function storePrivatePmsDocument(input: {
  companyId: string;
  file: Express.Multer.File;
}): Promise<PrivateDocumentMetadata> {
  const { extension, originalFilename } = validatePrivateDocumentFile(input.file);
  const now = new Date();
  const storageKey = `${input.companyId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${Date.now()}-${crypto.randomBytes(16).toString('hex')}${extension}`;
  const destination = resolveStorageKey(storageKey);
  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await fs.writeFile(destination, input.file.buffer, { flag: 'wx', mode: 0o600 });
  return {
    storageKey,
    originalFilename,
    mimeType: input.file.mimetype,
    sizeBytes: input.file.size,
    checksumSha256: crypto.createHash('sha256').update(input.file.buffer).digest('hex'),
  };
}

export async function readPrivatePmsDocument(storageKey: string) {
  return fs.readFile(resolveStorageKey(storageKey));
}

export async function removePrivatePmsDocument(storageKey: string | null | undefined) {
  if (!storageKey) return;
  try {
    await fs.unlink(resolveStorageKey(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function resolveLegacyPublicDocumentPath(fileUrl: string, publicUploadDirectory: string) {
  if (!fileUrl.startsWith('/uploads/')) throw new AppError(409, 'External legacy document URLs require manual migration to private storage.');
  const filename = path.basename(fileUrl);
  if (`/uploads/${filename}` !== fileUrl) throw new AppError(400, 'Invalid legacy document URL.');
  const sourcePath = path.resolve(publicUploadDirectory, filename);
  const publicRoot = path.resolve(publicUploadDirectory);
  if (!sourcePath.startsWith(`${publicRoot}${path.sep}`)) throw new AppError(400, 'Invalid legacy document URL.');
  return { filename, sourcePath };
}

export async function importLegacyLocalPmsDocument(input: {
  companyId: string;
  fileUrl: string;
  publicUploadDirectory: string;
}): Promise<PrivateDocumentMetadata> {
  const { filename, sourcePath } = resolveLegacyPublicDocumentPath(input.fileUrl, input.publicUploadDirectory);
  const buffer = await fs.readFile(sourcePath).catch(() => { throw new AppError(409, 'Legacy document file was not found in public upload storage.'); });
  const extension = path.extname(filename).toLowerCase();
  const mimeType = MIME_BY_EXTENSION.get(extension);
  if (!mimeType || !hasValidSignature(buffer, mimeType)) throw new AppError(409, 'Legacy document is not an approved private document format.');
  const file = { originalname: filename, mimetype: mimeType, buffer, size: buffer.length } as Express.Multer.File;
  const stored = await storePrivatePmsDocument({ companyId: input.companyId, file });
  try {
    await fs.unlink(sourcePath);
  } catch (error) {
    await removePrivatePmsDocument(stored.storageKey).catch(() => undefined);
    throw new AppError(500, 'The legacy public document could not be removed after private migration.');
  }
  return stored;
}

export async function restoreLegacyLocalPmsDocument(input: {
  storageKey: string;
  fileUrl: string;
  publicUploadDirectory: string;
}) {
  const { sourcePath } = resolveLegacyPublicDocumentPath(input.fileUrl, input.publicUploadDirectory);
  const privatePath = resolveStorageKey(input.storageKey);
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  await fs.copyFile(privatePath, sourcePath, fsConstants.COPYFILE_EXCL);
  await removePrivatePmsDocument(input.storageKey);
}

export function getPrivatePmsDocumentRoot() {
  return privateRoot;
}

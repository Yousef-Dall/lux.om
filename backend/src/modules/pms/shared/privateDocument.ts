import path from 'node:path';
import type { Response } from 'express';

import { readPrivatePmsDocument } from '../../../storage/privatePmsDocumentStorage';
import { AppError } from '../../../utils/http';

export async function sendPrivatePmsDocument(
  res: Response,
  document: {
    title: string;
    storageDriver: string;
    storageKey: string | null;
    originalFilename: string | null;
    mimeType: string | null;
    scanStatus: string;
  },
) {
  if (document.scanStatus === 'QUARANTINED') throw new AppError(423, 'This document is quarantined and cannot be downloaded.');
  if (document.storageDriver !== 'LOCAL_PRIVATE' || !document.storageKey) {
    throw new AppError(409, 'This document must be migrated to private storage before portal download.');
  }
  const contents = await readPrivatePmsDocument(document.storageKey);
  const filename = path.basename(document.originalFilename || `${document.title}.pdf`).replace(/["\r\n]/g, '_');
  res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', String(contents.length));
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(contents);
}

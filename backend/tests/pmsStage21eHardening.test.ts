import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { sanitizeAuditMetadata } from '../src/lib/domainAudit';
import {
  canExportPmsData,
  canExportPmsSensitiveData,
  type PmsPermissionSubject,
} from '../src/lib/pmsPermissions';
import {
  importLegacyLocalPmsDocument,
  readPrivatePmsDocument,
  removePrivatePmsDocument,
  restoreLegacyLocalPmsDocument,
  storePrivatePmsDocument,
  validatePrivateDocumentFile,
} from '../src/storage/privatePmsDocumentStorage';

function uploadedFile(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: input.filename,
    encoding: '7bit',
    mimetype: input.mimeType,
    size: input.buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer: input.buffer,
    stream: undefined as never,
  };
}

describe('PMS Stage 21E hardening foundations', () => {
  it('requires both import/export and the effective module view permission', () => {
    expect(canExportPmsData('PMS_AGENT', 'accounting')).toBe(false);

    const inventoryExporter: PmsPermissionSubject = {
      role: 'PMS_VIEWER',
      permissionKeys: ['IMPORT_EXPORT', 'INVENTORY_VIEW'],
    };
    expect(canExportPmsData(inventoryExporter, 'units')).toBe(true);
    expect(canExportPmsData(inventoryExporter, 'tenants')).toBe(false);
    expect(canExportPmsData(inventoryExporter, 'accounting')).toBe(false);
  });

  it('keeps sensitive exports behind a dedicated permission boundary', () => {
    const ordinaryTenantExporter: PmsPermissionSubject = {
      role: 'PMS_VIEWER',
      permissionKeys: ['IMPORT_EXPORT', 'TENANCY_VIEW'],
    };
    const sensitiveTenantExporter: PmsPermissionSubject = {
      role: 'PMS_OWNER',
      permissionKeys: ['IMPORT_EXPORT', 'TENANCY_VIEW', 'SENSITIVE_DATA_EXPORT'],
    };

    expect(canExportPmsSensitiveData(ordinaryTenantExporter)).toBe(false);
    expect(canExportPmsSensitiveData(sensitiveTenantExporter)).toBe(true);
  });

  it('removes secret and identity values from generic audit metadata', () => {
    expect(sanitizeAuditMetadata({
      safe: 'kept',
      passportNumber: 'P123456',
      nationalId: '123456789',
      nested: { authorization: 'Bearer token', changed: true },
    })).toEqual({ safe: 'kept', nested: { changed: true } });
  });

  it('validates file signature and stores private files with checksum metadata', async () => {
    const buffer = Buffer.from('%PDF-1.7\nPrivate PMS document\n%%EOF');
    const file = uploadedFile({ filename: 'lease.pdf', mimeType: 'application/pdf', buffer });

    expect(validatePrivateDocumentFile(file)).toMatchObject({
      extension: '.pdf',
      originalFilename: 'lease.pdf',
    });

    const stored = await storePrivatePmsDocument({ companyId: 'stage21e-test', file });
    try {
      expect(stored.storageKey).not.toContain('..');
      expect(stored.checksumSha256).toBe(crypto.createHash('sha256').update(buffer).digest('hex'));
      expect(await readPrivatePmsDocument(stored.storageKey)).toEqual(buffer);
    } finally {
      await removePrivatePmsDocument(stored.storageKey);
    }
  });

  it('restores a legacy public document when its database migration must roll back', async () => {
    const publicDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lux-pms-public-'));
    const filename = 'legacy-lease.pdf';
    const publicPath = path.join(publicDirectory, filename);
    const buffer = Buffer.from('%PDF-1.7\nLegacy PMS document\n%%EOF');
    await fs.writeFile(publicPath, buffer);

    const migrated = await importLegacyLocalPmsDocument({
      companyId: 'stage21e-rollback',
      fileUrl: `/uploads/${filename}`,
      publicUploadDirectory: publicDirectory,
    });
    expect(await fs.stat(publicPath).catch(() => null)).toBeNull();

    await restoreLegacyLocalPmsDocument({
      storageKey: migrated.storageKey,
      fileUrl: `/uploads/${filename}`,
      publicUploadDirectory: publicDirectory,
    });

    expect(await fs.readFile(publicPath)).toEqual(buffer);
    await expect(readPrivatePmsDocument(migrated.storageKey)).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.rm(publicDirectory, { recursive: true, force: true });
  });

  it('preserves the private copy when a legacy rollback destination already exists', async () => {
    const publicDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lux-pms-public-collision-'));
    const filename = 'legacy-collision.pdf';
    const publicPath = path.join(publicDirectory, filename);
    const original = Buffer.from('%PDF-1.7\nOriginal private copy\n%%EOF');
    const conflicting = Buffer.from('%PDF-1.7\nConflicting public copy\n%%EOF');
    await fs.writeFile(publicPath, original);

    const migrated = await importLegacyLocalPmsDocument({
      companyId: 'stage21e-collision',
      fileUrl: `/uploads/${filename}`,
      publicUploadDirectory: publicDirectory,
    });
    await fs.writeFile(publicPath, conflicting);

    await expect(restoreLegacyLocalPmsDocument({
      storageKey: migrated.storageKey,
      fileUrl: `/uploads/${filename}`,
      publicUploadDirectory: publicDirectory,
    })).rejects.toMatchObject({ code: 'EEXIST' });

    expect(await fs.readFile(publicPath)).toEqual(conflicting);
    expect(await readPrivatePmsDocument(migrated.storageKey)).toEqual(original);
    await removePrivatePmsDocument(migrated.storageKey);
    await fs.rm(publicDirectory, { recursive: true, force: true });
  });

  it('rejects inconsistent upload sizes before writing private storage', () => {
    const file = uploadedFile({
      filename: 'lease.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\n%%EOF'),
    });
    file.size += 1;
    expect(() => validatePrivateDocumentFile(file)).toThrow(/non-empty|larger/i);
  });

  it('rejects an extension or declared MIME type that does not match the signature', () => {
    const fakePdf = uploadedFile({
      filename: 'identity.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('not a pdf'),
    });
    expect(() => validatePrivateDocumentFile(fakePdf)).toThrow(/signature/i);

    const mismatched = uploadedFile({
      filename: 'identity.png',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\n%%EOF'),
    });
    expect(() => validatePrivateDocumentFile(mismatched)).toThrow(/extension/i);
  });
});

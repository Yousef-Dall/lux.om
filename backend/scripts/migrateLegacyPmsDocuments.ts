import 'dotenv/config';

import {
  DomainAuditDomain,
  DomainAuditOrigin,
  PmsDocumentScanStatus,
  PmsDocumentStorageDriver,
} from '@prisma/client';

import { prisma } from '../src/lib/prisma';
import { recordDomainAuditEvent } from '../src/lib/domainAudit';
import { getLocalUploadDirectory } from '../src/storage/imageStorage';
import {
  importLegacyLocalPmsDocument,
  restoreLegacyLocalPmsDocument,
} from '../src/storage/privatePmsDocumentStorage';

type Args = {
  execute: boolean;
  limit: number;
};

function parseArgs(argv: string[]): Args {
  const result: Args = { execute: false, limit: 500 };
  for (const arg of argv) {
    if (arg === '--execute') result.execute = true;
    else if (arg.startsWith('--limit=')) result.limit = Number(arg.slice('--limit='.length));
    else if (arg === '--help') {
      console.log('Usage: npm run ops:pms-documents:migrate -w backend -- [--execute] [--limit=500]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(result.limit) || result.limit < 1 || result.limit > 10_000) {
    throw new Error('--limit must be an integer between 1 and 10000.');
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const documents = await prisma.pmsDocument.findMany({
    where: { storageDriver: PmsDocumentStorageDriver.LEGACY_REFERENCE },
    select: { id: true, companyId: true, propertyId: true, fileUrl: true, title: true },
    orderBy: { createdAt: 'asc' },
    take: args.limit,
  });

  const localCandidates = documents.filter((document) => document.fileUrl.startsWith('/uploads/'));
  const manualCandidates = documents.filter((document) => !document.fileUrl.startsWith('/uploads/'));

  console.log(`[lux.om] Legacy PMS documents found: ${documents.length}`);
  console.log(`[lux.om] Local /uploads candidates: ${localCandidates.length}`);
  console.log(`[lux.om] External/manual migration candidates: ${manualCandidates.length}`);

  for (const document of manualCandidates) {
    console.log(`[manual] ${document.id} ${document.title}: ${document.fileUrl}`);
  }

  if (!args.execute) {
    console.log('[lux.om] Dry run only. Re-run with --execute after the database and upload directory are backed up.');
    return;
  }

  let migratedCount = 0;
  let failedCount = 0;
  for (const document of localCandidates) {
    let storageKey: string | null = null;
    try {
      const migrated = await importLegacyLocalPmsDocument({
        companyId: document.companyId,
        fileUrl: document.fileUrl,
        publicUploadDirectory: getLocalUploadDirectory(),
      });
      storageKey = migrated.storageKey;
      await prisma.$transaction(async (tx) => {
        await tx.pmsDocument.update({
          where: { id: document.id },
          data: {
            fileUrl: `private://${migrated.storageKey}`,
            storageDriver: PmsDocumentStorageDriver.LOCAL_PRIVATE,
            storageKey: migrated.storageKey,
            originalFilename: migrated.originalFilename,
            mimeType: migrated.mimeType,
            sizeBytes: migrated.sizeBytes,
            checksumSha256: migrated.checksumSha256,
            scanStatus: PmsDocumentScanStatus.NOT_CONFIGURED,
            fileUploadedAt: new Date(),
          },
        });
        await recordDomainAuditEvent(tx, {
          companyId: document.companyId,
          domain: DomainAuditDomain.PMS,
          origin: DomainAuditOrigin.SYSTEM,
          entityType: 'pmsDocument',
          entityId: document.id,
          action: 'legacy_private_storage_migration',
          changedFields: ['fileUrl', 'storageDriver', 'storageKey', 'checksumSha256'],
          metadata: { propertyId: document.propertyId, source: 'legacy_local_upload', fileVersion: 1 },
        });
      });
      storageKey = null;
      migratedCount += 1;
      console.log(`[migrated] ${document.id} ${document.title}`);
    } catch (error) {
      if (storageKey) {
        await restoreLegacyLocalPmsDocument({
          storageKey,
          fileUrl: document.fileUrl,
          publicUploadDirectory: getLocalUploadDirectory(),
        }).catch(() => undefined);
      }
      failedCount += 1;
      console.error(`[failed] ${document.id} ${document.title}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[lux.om] Migration complete. Migrated=${migratedCount} Failed=${failedCount} Manual=${manualCandidates.length}`);
  if (failedCount > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

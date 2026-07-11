import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  crmContactConsentStatuses,
  crmContractVersion
} from '../src/modules/crm/contracts';
import {
  normalizeTextLineEndings,
  readPrismaEnumValues
} from '../src/modules/crm/contracts/prismaSchema';

function extractGeneratedUnion(source: string, typeName: string) {
  const match = source.match(new RegExp(`export type ${typeName} = ([^;]+);`));

  if (!match) {
    throw new Error(`Generated CRM contract is missing ${typeName}.`);
  }

  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

describe('CRM generated contract consistency', () => {
  it('treats LF and CRLF generated contracts as equivalent without hiding content drift', () => {
    const lf = 'first line\nsecond line\n';
    const crlf = 'first line\r\nsecond line\r\n';

    expect(normalizeTextLineEndings(crlf)).toBe(lf);
    expect(normalizeTextLineEndings('first line\rsecond line')).toBe(
      'first line\nsecond line'
    );
    expect(normalizeTextLineEndings('different\r\ncontent\r\n')).not.toBe(lf);
  });

  it('keeps contact consent states aligned with the Prisma enum', async () => {
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const prismaConsentStatuses = await readPrismaEnumValues(
      schemaPath,
      'CrmContactConsentStatus'
    );

    expect(crmContactConsentStatuses).toEqual(prismaConsentStatuses);
    expect(crmContactConsentStatuses).not.toContain('CANCELLED');
  });

  it('keeps the committed frontend contract aligned with the backend contract source', async () => {
    const generatedPath = path.resolve(
      process.cwd(),
      '../frontend/src/generated/crmContract.ts'
    );
    const generated = await readFile(generatedPath, 'utf8');

    expect(generated).toContain(
      `export const CRM_CONTRACT_VERSION = '${crmContractVersion}' as const;`
    );
    expect(extractGeneratedUnion(generated, 'CrmContactConsentStatus')).toEqual(
      crmContactConsentStatuses
    );
  });
});

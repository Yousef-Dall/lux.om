import { createHash } from 'node:crypto';

import type { PmsReconciliationDirection, PmsReconciliationSource } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../utils/http';

type CsvRow = Record<string, string>;

export type TreasuryImportRowData = {
  source: PmsReconciliationSource;
  direction: PmsReconciliationDirection;
  externalReference: string;
  amount: number;
  currency: string;
  transactionDate: string;
  propertyId: string | null;
  payerReference: string | null;
  metadata: Record<string, unknown>;
};

export type TreasuryImportPreviewRow = {
  rowNumber: number;
  status: 'VALID' | 'DUPLICATE' | 'INVALID';
  errors: string[];
  data: TreasuryImportRowData | null;
  duplicateReason?: 'EXISTING_REFERENCE' | 'DUPLICATE_IN_FILE';
};

export type TreasuryImportPreview = {
  headers: string[];
  totalRows: number;
  validRows: TreasuryImportPreviewRow[];
  duplicateRows: TreasuryImportPreviewRow[];
  invalidRows: TreasuryImportPreviewRow[];
  contentHash: string;
};

function normalizeCsvHeader(value: string) {
  return value.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (inQuotes) throw new AppError(400, 'CSV contains an unterminated quoted field.');
  cells.push(current.trim());
  return cells;
}

function parseCsvText(csvText: string) {
  if (Buffer.byteLength(csvText, 'utf8') > 2 * 1024 * 1024) throw new AppError(413, 'Treasury CSV cannot exceed 2 MB.');
  const normalized = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) throw new AppError(400, 'CSV file is empty.');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length > 5001) throw new AppError(400, 'Treasury CSV cannot exceed 5,000 data rows.');
  const rawHeaders = parseCsvLine(lines[0]!);
  const headers = rawHeaders.map(normalizeCsvHeader);
  if (headers.length === 0 || headers.every((header) => !header)) throw new AppError(400, 'CSV header row is required.');
  const populatedHeaders = headers.filter(Boolean);
  if (new Set(populatedHeaders).size !== populatedHeaders.length) throw new AppError(400, 'CSV header names must be unique.');
  if (lines.length === 1) throw new AppError(400, 'CSV must contain at least one data row.');
  const rows = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((header, headerIndex) => {
      if (header) row[header] = cells[headerIndex]?.trim() ?? '';
    });
    return { rowNumber: index + 2, row };
  });
  return { normalized, headers: rawHeaders, rows };
}

function csvValue(row: CsvRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeCsvHeader(alias)];
    if (value !== undefined && value.trim() !== '') return value.trim();
  }
  return '';
}

function parseNonZeroAmount(value: string) {
  if (!value) return null;
  const normalized = value.replaceAll(',', '').trim();
  if (!/^[+-]?(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed !== 0 && Math.abs(parsed) <= 1_000_000_000 ? parsed : null;
}

function parsePositiveAmount(value: string) {
  const parsed = parseNonZeroAmount(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function parseTransactionDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveDirectionAndAmount(row: CsvRow):
  | { error: string }
  | { direction: PmsReconciliationDirection; amount: number } {
  const explicitDirection = csvValue(row, ['direction', 'flow', 'debitCredit', 'transactionType']).toUpperCase();
  const rawAmount = csvValue(row, ['amount', 'transactionAmount', 'value']);
  const rawCredit = csvValue(row, ['credit', 'creditAmount', 'moneyIn']);
  const rawDebit = csvValue(row, ['debit', 'debitAmount', 'moneyOut']);
  const amountValue = parseNonZeroAmount(rawAmount);
  const creditValue = parsePositiveAmount(rawCredit);
  const debitValue = parsePositiveAmount(rawDebit);

  if (explicitDirection && explicitDirection !== 'CREDIT' && explicitDirection !== 'DEBIT') return { error: 'Direction must be CREDIT or DEBIT.' } as const;
  if (rawCredit && creditValue == null) return { error: 'Credit amount must be greater than zero.' } as const;
  if (rawDebit && debitValue == null) return { error: 'Debit amount must be greater than zero.' } as const;
  if (rawAmount && amountValue == null) return { error: 'Amount must be non-zero, no more than 1,000,000,000, and use at most three decimal places.' } as const;
  if (amountValue != null && (creditValue != null || debitValue != null)) return { error: 'Provide either amount or credit/debit columns, not both.' } as const;
  if (creditValue != null && debitValue != null) return { error: 'Provide either a credit amount or a debit amount, not both.' } as const;
  if (creditValue != null) return { direction: 'CREDIT' as const, amount: creditValue };
  if (debitValue != null) return { direction: 'DEBIT' as const, amount: debitValue };
  if (amountValue == null) return { error: 'A non-zero amount is required.' } as const;
  if ((explicitDirection === 'CREDIT' && amountValue < 0) || (explicitDirection === 'DEBIT' && amountValue > 0)) {
    return { error: 'Amount sign conflicts with the explicit direction.' } as const;
  }
  return {
    direction: explicitDirection === 'DEBIT' || (!explicitDirection && amountValue < 0) ? 'DEBIT' as const : 'CREDIT' as const,
    amount: Math.abs(amountValue),
  };
}

export function treasuryImportContentHash(source: PmsReconciliationSource, accountReference: string | null | undefined, normalizedCsv: string) {
  return createHash('sha256').update(`${source}\0${accountReference?.trim() ?? ''}\0${normalizedCsv}`, 'utf8').digest('hex');
}

export async function buildTreasuryImportPreview(input: {
  companyId: string;
  source: PmsReconciliationSource;
  accountReference?: string | null;
  csvText: string;
}): Promise<TreasuryImportPreview> {
  if (input.source === 'MANUAL') throw new AppError(400, 'Manual reconciliation items must be entered individually.');
  const parsed = parseCsvText(input.csvText);
  const properties = await prisma.pmsProperty.findMany({
    where: { companyId: input.companyId },
    select: { id: true, name: true, code: true },
  });
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const propertyByCode = new Map(properties.filter((property) => property.code).map((property) => [property.code!.toLowerCase(), property]));
  const propertyByName = new Map(properties.map((property) => [property.name.toLowerCase(), property]));

  const candidates = parsed.rows.map(({ rowNumber, row }): TreasuryImportPreviewRow => {
    const errors: string[] = [];
    const externalReference = csvValue(row, ['externalReference', 'reference', 'bankReference', 'transactionId', 'transactionReference']);
    if (!externalReference) errors.push('External reference is required.');
    if (externalReference.length > 300) errors.push('External reference cannot exceed 300 characters.');

    const resolvedAmount = resolveDirectionAndAmount(row);
    if ('error' in resolvedAmount) errors.push(resolvedAmount.error);
    const currency = csvValue(row, ['currency', 'currencyCode']).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) errors.push('Currency must be a three-letter code.');
    const transactionDate = parseTransactionDate(csvValue(row, ['transactionDate', 'date', 'valueDate', 'bookingDate']));
    if (!transactionDate) errors.push('A valid transaction date is required.');

    const propertyIdValue = csvValue(row, ['propertyId']);
    const propertyCode = csvValue(row, ['propertyCode', 'propertyRef']);
    const propertyName = csvValue(row, ['propertyName', 'property']);
    const hasPropertyReference = Boolean(propertyIdValue || propertyCode || propertyName);
    const property = propertyById.get(propertyIdValue)
      || propertyByCode.get(propertyCode.toLowerCase())
      || propertyByName.get(propertyName.toLowerCase());
    if (hasPropertyReference && !property) errors.push('Property reference does not match this company.');

    const payerReference = csvValue(row, ['payerReference', 'counterparty', 'description', 'beneficiary', 'narrative']);
    if (payerReference.length > 300) errors.push('Payer or beneficiary reference cannot exceed 300 characters.');

    const data = errors.length === 0 && !('error' in resolvedAmount) && transactionDate ? {
      source: input.source,
      direction: resolvedAmount.direction,
      externalReference,
      amount: resolvedAmount.amount,
      currency,
      transactionDate: transactionDate.toISOString(),
      propertyId: property?.id ?? null,
      payerReference: payerReference || null,
      metadata: {
        importedRowNumber: rowNumber,
        importedPropertyReference: propertyIdValue || propertyCode || propertyName || null,
      },
    } satisfies TreasuryImportRowData : null;

    return { rowNumber, status: errors.length ? 'INVALID' : 'VALID', errors, data };
  });

  const references = candidates.flatMap((row) => row.data?.externalReference ? [row.data.externalReference] : []);
  const existing = references.length ? await prisma.pmsReconciliationItem.findMany({
    where: { companyId: input.companyId, source: input.source, externalReference: { in: references } },
    select: { externalReference: true },
  }) : [];
  const existingReferences = new Set(existing.map((item) => item.externalReference));
  const seen = new Set<string>();

  const rows = candidates.map((row): TreasuryImportPreviewRow => {
    if (!row.data) return row;
    if (existingReferences.has(row.data.externalReference)) {
      return { ...row, status: 'DUPLICATE', duplicateReason: 'EXISTING_REFERENCE' };
    }
    if (seen.has(row.data.externalReference)) {
      return { ...row, status: 'DUPLICATE', duplicateReason: 'DUPLICATE_IN_FILE' };
    }
    seen.add(row.data.externalReference);
    return row;
  });

  return {
    headers: parsed.headers,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.status === 'VALID'),
    duplicateRows: rows.filter((row) => row.status === 'DUPLICATE'),
    invalidRows: rows.filter((row) => row.status === 'INVALID'),
    contentHash: treasuryImportContentHash(input.source, input.accountReference, parsed.normalized),
  };
}

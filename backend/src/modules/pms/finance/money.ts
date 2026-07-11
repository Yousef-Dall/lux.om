import { Prisma } from '@prisma/client';
import { AppError } from '../../../utils/http';

export const ZERO = new Prisma.Decimal(0);

export function money(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneyNumber(value: Prisma.Decimal.Value) {
  return money(value).toNumber();
}

export function assertPositiveMoney(value: Prisma.Decimal.Value, message = 'Amount must be greater than zero.') {
  const amount = money(value);
  if (!amount.isPositive()) throw new AppError(400, message);
  return amount;
}

export function assertSameCurrency(...currencies: Array<string | null | undefined>) {
  const normalized = currencies.filter(Boolean).map((value) => value!.toUpperCase());
  if (new Set(normalized).size > 1) throw new AppError(400, 'Currencies must match.');
  return normalized[0] ?? 'OMR';
}

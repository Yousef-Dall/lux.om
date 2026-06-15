export const priceQualifierValues = [
  'FIXED',
  'FROM',
  'ON_REQUEST'
] as const;

export type PriceQualifierValue =
  (typeof priceQualifierValues)[number];

export const priceUnitValues = [
  'TOTAL',
  'NIGHT',
  'MONTH',
  'YEAR',
  'PERSON',
  'GROUP',
  'HOUR',
  'DAY',
  'ACTIVITY'
] as const;

export type PriceUnitValue =
  (typeof priceUnitValues)[number];

export type StructuredPrice = {
  priceAmount: string | null;
  priceCurrency: string | null;
  priceQualifier: PriceQualifierValue;
  priceUnit: PriceUnitValue | null;
};

export type StructuredPriceInput = {
  displayPrice?: string | null;
  priceAmount?: string | number | null;
  priceCurrency?: string | null;
  priceQualifier?: PriceQualifierValue | null;
  priceUnit?: PriceUnitValue | null;
  paymentFrequency?: string | null;
};

export type ResolvedPrice = StructuredPrice & {
  price: string;
};

const paymentFrequencyUnits: Record<string, PriceUnitValue> = {
  'Total sale price': 'TOTAL',
  'Per night': 'NIGHT',
  'Per month': 'MONTH',
  'Per year': 'YEAR'
};

const unitSuffixes: Partial<Record<PriceUnitValue, string>> = {
  NIGHT: '/night',
  MONTH: '/mo',
  YEAR: '/year',
  PERSON: '/person',
  GROUP: '/group',
  HOUR: '/hour',
  DAY: '/day',
  ACTIVITY: '/activity'
};

const supportedCurrencyPattern =
  /\b(?:OMR|USD|EUR|GBP|AED|SAR|QAR|BHD|KWD)\b/i;

function normalizeDigits(value: string) {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';

  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(arabicDigits.indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(persianDigits.indexOf(digit))
    )
    .replace(/[,\u066c]/g, '')
    .replace(/\u066b/g, '.');
}

function normalizeAmount(
  value: string | number | null | undefined
) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeDigits(String(value)).trim();

  return normalized || null;
}

function extractPriceAmount(price: string) {
  const match = normalizeDigits(price).match(
    /\d+(?:\.\d+)?/
  );

  return match?.[0] ?? null;
}

function detectCurrency(price: string) {
  const currencyCode =
    price.match(supportedCurrencyPattern)?.[0];

  if (currencyCode) {
    return currencyCode.toUpperCase();
  }

  if (/ر\s*\.?\s*ع/u.test(price)) {
    return 'OMR';
  }

  return null;
}

function detectQualifier(
  price: string,
  amount: string | null
): PriceQualifierValue {
  if (!amount) {
    return 'ON_REQUEST';
  }

  if (
    /^\s*from\b/i.test(price) ||
    /^\s*ابتداء/u.test(price)
  ) {
    return 'FROM';
  }

  return 'FIXED';
}

function detectUnit(
  price: string,
  paymentFrequency?: string | null
): PriceUnitValue | null {
  const mappedFrequency = paymentFrequency
    ? paymentFrequencyUnits[paymentFrequency]
    : undefined;

  if (mappedFrequency) {
    return mappedFrequency;
  }

  const normalized = price.toLocaleLowerCase();

  if (/\/\s*mo\b|per month|monthly/.test(normalized)) {
    return 'MONTH';
  }

  if (/\/\s*yr\b|per year|yearly|annual/.test(normalized)) {
    return 'YEAR';
  }

  if (/\/\s*night\b|per night/.test(normalized)) {
    return 'NIGHT';
  }

  if (/per person|\/\s*person\b|\/\s*pp\b/.test(normalized)) {
    return 'PERSON';
  }

  if (/per group|\/\s*group\b/.test(normalized)) {
    return 'GROUP';
  }

  if (/per hour|\/\s*hour\b|\/\s*hr\b/.test(normalized)) {
    return 'HOUR';
  }

  if (/per day|\/\s*day\b/.test(normalized)) {
    return 'DAY';
  }

  if (/per activity|\/\s*activity\b/.test(normalized)) {
    return 'ACTIVITY';
  }

  return null;
}

function normalizeCurrency(
  currency: string | null | undefined,
  amount: string | null
) {
  if (!amount) {
    return null;
  }

  const normalized = currency?.trim().toUpperCase();

  return normalized || 'OMR';
}

function formatAmount(amount: string) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return amount;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  }).format(numericAmount);
}

export function deriveStructuredPrice(
  displayPrice: string,
  paymentFrequency?: string | null
): StructuredPrice {
  const price = displayPrice.trim();
  const priceAmount = extractPriceAmount(price);

  return {
    priceAmount,
    priceCurrency: detectCurrency(price),
    priceQualifier: detectQualifier(price, priceAmount),
    priceUnit: detectUnit(price, paymentFrequency)
  };
}

export function formatStructuredPrice(
  structuredPrice: StructuredPrice
) {
  if (
    structuredPrice.priceQualifier === 'ON_REQUEST' ||
    !structuredPrice.priceAmount
  ) {
    return 'Price on request';
  }

  const prefix =
    structuredPrice.priceQualifier === 'FROM'
      ? 'From '
      : '';

  const currency =
    structuredPrice.priceCurrency ?? 'OMR';

  const amount = formatAmount(
    structuredPrice.priceAmount
  );

  const suffix = structuredPrice.priceUnit
    ? unitSuffixes[structuredPrice.priceUnit] ?? ''
    : '';

  return `${prefix}${currency} ${amount}${
    suffix ? ` ${suffix}` : ''
  }`;
}

export function resolvePriceInput(
  input: StructuredPriceInput
): ResolvedPrice {
  const displayPrice = input.displayPrice?.trim() ?? '';

  const hasExplicitStructuredInput =
    input.priceAmount !== undefined ||
    input.priceCurrency !== undefined ||
    input.priceQualifier !== undefined ||
    input.priceUnit !== undefined;

  if (!hasExplicitStructuredInput) {
    if (!displayPrice) {
      throw new Error('A display or structured price is required');
    }

    return {
      price: displayPrice,
      ...deriveStructuredPrice(
        displayPrice,
        input.paymentFrequency
      )
    };
  }

  const derived = displayPrice
    ? deriveStructuredPrice(
        displayPrice,
        input.paymentFrequency
      )
    : null;

  const priceAmount =
    normalizeAmount(input.priceAmount) ??
    derived?.priceAmount ??
    null;

  const priceQualifier =
    input.priceQualifier ??
    derived?.priceQualifier ??
    (priceAmount ? 'FIXED' : 'ON_REQUEST');

  if (
    priceQualifier !== 'ON_REQUEST' &&
    !priceAmount
  ) {
    throw new Error(
      'A numeric amount is required for fixed and starting prices'
    );
  }

  if (
    priceQualifier === 'ON_REQUEST' &&
    priceAmount
  ) {
    throw new Error(
      'On-request pricing cannot include a numeric amount'
    );
  }

  const structuredPrice: StructuredPrice =
    priceQualifier === 'ON_REQUEST'
      ? {
          priceAmount: null,
          priceCurrency: null,
          priceQualifier,
          priceUnit: null
        }
      : {
          priceAmount,
          priceCurrency: normalizeCurrency(
            input.priceCurrency ??
              derived?.priceCurrency,
            priceAmount
          ),
          priceQualifier,
          priceUnit:
            input.priceUnit ??
            derived?.priceUnit ??
            detectUnit('', input.paymentFrequency)
        };

  return {
    price: formatStructuredPrice(structuredPrice),
    ...structuredPrice
  };
}

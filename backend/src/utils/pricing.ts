export type PriceQualifierValue =
  | 'FIXED'
  | 'FROM'
  | 'ON_REQUEST';

export type PriceUnitValue =
  | 'TOTAL'
  | 'NIGHT'
  | 'MONTH'
  | 'YEAR'
  | 'PERSON'
  | 'GROUP'
  | 'HOUR'
  | 'DAY'
  | 'ACTIVITY';

export type StructuredPrice = {
  priceAmount: string | null;
  priceCurrency: string | null;
  priceQualifier: PriceQualifierValue;
  priceUnit: PriceUnitValue | null;
};

const paymentFrequencyUnits: Record<string, PriceUnitValue> = {
  'Total sale price': 'TOTAL',
  'Per night': 'NIGHT',
  'Per month': 'MONTH',
  'Per year': 'YEAR'
};

function extractPriceAmount(price: string) {
  const match = price
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/);

  return match?.[0] ?? null;
}

function detectCurrency(price: string) {
  const currencyCode = price.match(/\b[A-Za-z]{3}\b/)?.[0];

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

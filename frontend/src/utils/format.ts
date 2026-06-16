import type {
  DayName,
  ListingTransaction,
  PriceQualifier,
  PriceUnit
} from '../types';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function formatNumber(value: number, locale = 'en-OM') {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCompactNumber(value: number, locale = 'en-OM') {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}

type MarketplacePriceInput = {
  price?: string | null;
  priceAmount?: string | number | null;
  priceCurrency?: string | null;
  priceQualifier?: PriceQualifier | null;
  priceUnit?: PriceUnit | null;
  language: 'en' | 'ar';
};

const marketplacePriceUnitLabels: Record<
  'en' | 'ar',
  Partial<Record<PriceUnit, string>>
> = {
  en: {
    NIGHT: 'per night',
    MONTH: 'per month',
    YEAR: 'per year',
    PERSON: 'per person',
    GROUP: 'per group',
    HOUR: 'per hour',
    DAY: 'per day',
    ACTIVITY: 'per activity'
  },
  ar: {
    NIGHT: 'لكل ليلة',
    MONTH: 'لكل شهر',
    YEAR: 'لكل سنة',
    PERSON: 'لكل شخص',
    GROUP: 'لكل مجموعة',
    HOUR: 'لكل ساعة',
    DAY: 'لكل يوم',
    ACTIVITY: 'لكل نشاط'
  }
};

function formatMarketplaceMoney(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
  locale: string
) {
  if (
    amount === null ||
    amount === undefined ||
    (typeof amount === 'string' && !amount.trim())
  ) {
    return null;
  }

  const numericAmount =
    typeof amount === 'number'
      ? amount
      : Number(amount.trim());

  if (!Number.isFinite(numericAmount)) {
    return null;
  }

  const normalizedCurrency =
    currency?.trim().toUpperCase();

  if (
    !normalizedCurrency ||
    !/^[A-Z]{3}$/.test(normalizedCurrency)
  ) {
    return null;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
      currencyDisplay: 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    }).format(numericAmount);
  } catch {
    return [
      formatNumber(numericAmount, locale),
      normalizedCurrency
    ].join(' ');
  }
}

export function formatMarketplacePrice({
  price,
  priceAmount,
  priceCurrency,
  priceQualifier,
  priceUnit,
  language
}: MarketplacePriceInput) {
  const copy =
    language === 'ar'
      ? {
          from: 'ابتداءً من',
          onRequest: 'السعر عند الطلب',
          unavailable: 'السعر غير متوفر'
        }
      : {
          from: 'From',
          onRequest: 'Price on request',
          unavailable: 'Price unavailable'
        };

  if (priceQualifier === 'ON_REQUEST') {
    return copy.onRequest;
  }

  const locale =
    language === 'ar' ? 'ar-OM' : 'en-OM';

  const structuredAmount = formatMarketplaceMoney(
    priceAmount,
    priceCurrency,
    locale
  );

  if (!structuredAmount) {
    return price?.trim() || copy.unavailable;
  }

  const qualifier =
    priceQualifier === 'FROM'
      ? `${copy.from} `
      : '';

  const unitLabel = priceUnit
    ? marketplacePriceUnitLabels[language][priceUnit]
    : undefined;

  return [
    `${qualifier}${structuredAmount}`,
    unitLabel
  ]
    .filter(Boolean)
    .join(' ');
}

export function getListingLabel(transaction: ListingTransaction | string) {
  if (transaction === 'Short stay') return 'Short stay';
  return transaction;
}

export function formatTimeRange(startTime: string, endTime: string) {
  return `${startTime} – ${endTime}`;
}

export function formatDayList(days: DayName[], conjunction = '&') {
  if (days.length === 0) return '';

  if (days.length === 1) {
    return days[0];
  }

  if (days.length === 2) {
    return `${days[0]} ${conjunction} ${days[1]}`;
  }

  return `${days.slice(0, -1).join(', ')} ${conjunction} ${days[days.length - 1]}`;
}

export function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export function includesSearchValue(source: string, query: string) {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  return normalizeSearchValue(source).includes(normalizedQuery);
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'untitled';
}

export function isNonEmptyString(value: string) {
  return value.trim().length > 0;
}

export function convertTimeToMinutes(time: string) {
  if (!time) return 0;

  const [hours = 0, minutes = 0] = time.split(':').map(Number);

  return hours * 60 + minutes;
}

export function isValidTimeWindow(startTime: string, endTime: string) {
  if (!startTime || !endTime) return true;

  return convertTimeToMinutes(endTime) > convertTimeToMinutes(startTime);
}

export function updateSearchParam(
  currentParams: URLSearchParams,
  key: string,
  value: string,
  options?: {
    removeWhenEmpty?: boolean;
  }
) {
  const nextParams = new URLSearchParams(currentParams);
  const shouldRemove = options?.removeWhenEmpty ?? true;

  if (!value && shouldRemove) {
    nextParams.delete(key);
  } else {
    nextParams.set(key, value);
  }

  return nextParams;
}
type SearchValue = string | null | undefined;

export type SearchRelevance = readonly number[];

export type RankedSearchCandidate = {
  id: string;
  relevance: SearchRelevance;
  partnerTier: number;
  qualityScore: number;
  createdAt: Date;
};

function normalizeSearchText(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function getTextMatchLevel(
  value: SearchValue,
  normalizedSearch: string
) {
  if (!value || !normalizedSearch) {
    return 0;
  }

  const normalizedValue = normalizeSearchText(value);

  if (!normalizedValue) {
    return 0;
  }

  if (normalizedValue === normalizedSearch) {
    return 3;
  }

  if (normalizedValue.startsWith(normalizedSearch)) {
    return 2;
  }

  if (normalizedValue.includes(normalizedSearch)) {
    return 1;
  }

  return 0;
}

export function buildSearchRelevance(
  search: string,
  groups: ReadonlyArray<ReadonlyArray<SearchValue>>
): SearchRelevance {
  const normalizedSearch = normalizeSearchText(search);

  return groups.map((values) =>
    values.reduce(
      (highestLevel, value) =>
        Math.max(
          highestLevel,
          getTextMatchLevel(value, normalizedSearch)
        ),
      0
    )
  );
}

function compareRelevance(
  left: SearchRelevance,
  right: SearchRelevance
) {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftLevel = left[index] ?? 0;
    const rightLevel = right[index] ?? 0;

    if (leftLevel !== rightLevel) {
      return rightLevel - leftLevel;
    }
  }

  return 0;
}

export function paginateRankedIds(
  candidates: RankedSearchCandidate[],
  skip: number,
  take: number
) {
  return [...candidates]
    .sort((left, right) => {
      const relevanceDifference = compareRelevance(
        left.relevance,
        right.relevance
      );

      if (relevanceDifference !== 0) {
        return relevanceDifference;
      }

      const partnerDifference =
        right.partnerTier - left.partnerTier;

      if (partnerDifference !== 0) {
        return partnerDifference;
      }

      const qualityDifference =
        right.qualityScore - left.qualityScore;

      if (qualityDifference !== 0) {
        return qualityDifference;
      }

      const freshnessDifference =
        right.createdAt.getTime() - left.createdAt.getTime();

      if (freshnessDifference !== 0) {
        return freshnessDifference;
      }

      return left.id.localeCompare(right.id);
    })
    .slice(skip, skip + take)
    .map((candidate) => candidate.id);
}

export function restoreRankedOrder<T extends { id: string }>(
  records: T[],
  orderedIds: string[]
): T[] {
  const recordsById = new Map(
    records.map((record) => [record.id, record] as const)
  );

  return orderedIds.flatMap((id) => {
    const record = recordsById.get(id);

    return record ? [record] : [];
  });
}

export type ExplicitMarketplaceSort =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'area_desc';

export type ExplicitSortCandidate = {
  id: string;
  price?: string | null;
  area?: number | null;
  partnerTier: number;
  createdAt: Date;
};

export function parseSortablePrice(
  value: string | null | undefined
): number | null {
  if (!value) {
    return null;
  }

  const match = value
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const amount = Number(match[0]);

  return Number.isFinite(amount) ? amount : null;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: 'asc' | 'desc'
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  return direction === 'asc'
    ? left - right
    : right - left;
}

export function paginateExplicitlySortedIds(
  candidates: ExplicitSortCandidate[],
  sort: ExplicitMarketplaceSort,
  skip: number,
  take: number
) {
  return [...candidates]
    .sort((left, right) => {
      let primaryDifference = 0;

      if (sort === 'newest') {
        primaryDifference =
          right.createdAt.getTime() -
          left.createdAt.getTime();
      }

      if (sort === 'price_asc') {
        primaryDifference = compareNullableNumbers(
          parseSortablePrice(left.price),
          parseSortablePrice(right.price),
          'asc'
        );
      }

      if (sort === 'price_desc') {
        primaryDifference = compareNullableNumbers(
          parseSortablePrice(left.price),
          parseSortablePrice(right.price),
          'desc'
        );
      }

      if (sort === 'area_desc') {
        primaryDifference = compareNullableNumbers(
          left.area ?? null,
          right.area ?? null,
          'desc'
        );
      }

      if (primaryDifference !== 0) {
        return primaryDifference;
      }

      const partnerDifference =
        right.partnerTier - left.partnerTier;

      if (partnerDifference !== 0) {
        return partnerDifference;
      }

      const freshnessDifference =
        right.createdAt.getTime() -
        left.createdAt.getTime();

      if (freshnessDifference !== 0) {
        return freshnessDifference;
      }

      return left.id.localeCompare(right.id);
    })
    .slice(skip, skip + take)
    .map((candidate) => candidate.id);
}

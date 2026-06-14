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

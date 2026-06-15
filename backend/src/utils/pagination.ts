type PaginationQuery = {
  page?: number;
  pageSize?: number;
  take: number;
  skip: number;
};

export type ResolvedPagination = {
  page: number;
  pageSize: number;
  take: number;
  skip: number;
};

export function resolvePagination(
  query: PaginationQuery
): ResolvedPagination {
  const pageSize = query.pageSize ?? query.take;
  const skip =
    query.page !== undefined
      ? (query.page - 1) * pageSize
      : query.skip;

  return {
    page: Math.floor(skip / pageSize) + 1,
    pageSize,
    take: pageSize,
    skip
  };
}

export function createPaginationMetadata(
  total: number,
  count: number,
  pagination: ResolvedPagination
) {
  const totalPages =
    total === 0 ? 0 : Math.ceil(total / pagination.pageSize);

  return {
    take: pagination.take,
    skip: pagination.skip,
    count,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPreviousPage: pagination.page > 1
  };
}

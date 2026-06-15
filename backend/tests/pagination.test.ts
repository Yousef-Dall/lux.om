import { describe, expect, it } from 'vitest';

import {
  createPaginationMetadata,
  resolvePagination
} from '../src/utils/pagination';

describe('resolvePagination', () => {
  it('uses page and pageSize when provided', () => {
    expect(
      resolvePagination({
        page: 3,
        pageSize: 12,
        take: 50,
        skip: 0
      })
    ).toEqual({
      page: 3,
      pageSize: 12,
      take: 12,
      skip: 24
    });
  });

  it('preserves backward-compatible take and skip pagination', () => {
    expect(
      resolvePagination({
        take: 20,
        skip: 40
      })
    ).toEqual({
      page: 3,
      pageSize: 20,
      take: 20,
      skip: 40
    });
  });

  it('lets pageSize override the legacy take value', () => {
    expect(
      resolvePagination({
        pageSize: 8,
        take: 50,
        skip: 16
      })
    ).toEqual({
      page: 3,
      pageSize: 8,
      take: 8,
      skip: 16
    });
  });
});

describe('createPaginationMetadata', () => {
  it('creates metadata for a middle page', () => {
    const pagination = resolvePagination({
      page: 2,
      pageSize: 20,
      take: 50,
      skip: 0
    });

    expect(
      createPaginationMetadata(45, 20, pagination)
    ).toEqual({
      take: 20,
      skip: 20,
      count: 20,
      page: 2,
      pageSize: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true
    });
  });

  it('handles an empty result set', () => {
    const pagination = resolvePagination({
      page: 1,
      pageSize: 12,
      take: 50,
      skip: 0
    });

    expect(
      createPaginationMetadata(0, 0, pagination)
    ).toEqual({
      take: 12,
      skip: 0,
      count: 0,
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    });
  });

  it('marks an out-of-range page as having no next page', () => {
    const pagination = resolvePagination({
      page: 5,
      pageSize: 10,
      take: 50,
      skip: 0
    });

    expect(
      createPaginationMetadata(12, 0, pagination)
    ).toMatchObject({
      page: 5,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });
});

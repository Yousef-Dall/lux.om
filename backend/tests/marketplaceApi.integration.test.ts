import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();

async function clearTestDatabase() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  const databaseName = databaseUrl.pathname.replace(/^\/+/, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing destructive cleanup for database: ${databaseName}`
    );
  }

  await prisma.inquiry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();

  await prisma.activityHighlight.deleteMany();
  await prisma.activityImage.deleteMany();
  await prisma.activity.deleteMany();

  await prisma.listingImage.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.listing.deleteMany();

  await prisma.travelAgency.deleteMany();
  await prisma.developerCompany.deleteMany();
  await prisma.landmark.deleteMany();
  await prisma.user.deleteMany();
}

async function seedMarketplaceFixtures() {
  const owner = await prisma.user.create({
    data: {
      name: 'Integration Owner',
      email: 'integration-owner@lux.test',
      password: 'test-password',
      role: 'OWNER'
    }
  });

  const activityProvider = await prisma.user.create({
    data: {
      name: 'Integration Activity Provider',
      email: 'integration-activities@lux.test',
      password: 'test-password',
      role: 'ACTIVITY_PROVIDER'
    }
  });

  const featuredDeveloper =
    await prisma.developerCompany.create({
      data: {
        slug: 'featured-test-developer',
        nameEn: 'Featured Test Developer',
        verified: true,
        featured: true
      }
    });

  const featuredAgency =
    await prisma.travelAgency.create({
      data: {
        slug: 'muscat-coast-test-agency',
        nameEn: 'Muscat Coast Tours',
        verified: true,
        featured: true
      }
    });

  const standardAgency =
    await prisma.travelAgency.create({
      data: {
        slug: 'standard-test-agency',
        nameEn: 'Standard Adventures',
        verified: true,
        featured: false
      }
    });

  const listingBase = {
    description:
      'A sufficiently detailed integration-test property description.',
    transaction: 'Sale',
    location: 'Muscat, Oman',
    beds: 3,
    baths: 2,
    image: 'https://example.com/property.jpg',
    status: 'APPROVED' as const,
    ownerId: owner.id
  };

  await prisma.listing.create({
    data: {
      ...listingBase,
      slug: 'integration-budget-apartment',
      title: 'Budget Apartment',
      titleEn: 'Budget Apartment',
      type: 'Apartment',
      typeEn: 'Apartment',
      price: 'OMR 9,999',
      priceAmount: '100',
      sqm: 80,
      partnerTier: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    }
  });

  await prisma.listing.create({
    data: {
      ...listingBase,
      slug: 'integration-exact-villa',
      title: 'Villa',
      titleEn: 'Villa',
      type: 'Residence',
      typeEn: 'Residence',
      price: 'OMR 1',
      priceAmount: '900',
      sqm: 200,
      partnerTier: 0,
      createdAt: new Date('2026-02-01T00:00:00.000Z')
    }
  });

  await prisma.listing.create({
    data: {
      ...listingBase,
      slug: 'integration-villa-heights',
      title: 'Villa Heights',
      titleEn: 'Villa Heights',
      type: 'Residence',
      typeEn: 'Residence',
      price: 'OMR 3,000',
      priceAmount: '3000',
      sqm: 400,
      partnerTier: 3,
      developerId: featuredDeveloper.id,
      createdAt: new Date('2026-03-01T00:00:00.000Z')
    }
  });

  await prisma.listing.create({
    data: {
      ...listingBase,
      slug: 'integration-type-only-villa',
      title: 'Modern Residence',
      titleEn: 'Modern Residence',
      type: 'Villa',
      typeEn: 'Villa',
      price: 'Price on request',
      sqm: 500,
      partnerTier: 3,
      developerId: featuredDeveloper.id,
      createdAt: new Date('2026-04-01T00:00:00.000Z')
    }
  });

  await prisma.listing.create({
    data: {
      ...listingBase,
      slug: 'integration-pending-listing',
      title: 'Pending Villa',
      titleEn: 'Pending Villa',
      type: 'Villa',
      typeEn: 'Villa',
      price: 'OMR 50',
      sqm: 100,
      status: 'PENDING',
      partnerTier: 3
    }
  });

  const activityBase = {
    descriptionEn:
      'A sufficiently detailed integration-test activity description.',
    locationEn: 'Muscat, Oman',
    categoryEn: 'Experience',
    ownerId: activityProvider.id,
    status: 'APPROVED' as const
  };

  await prisma.activity.create({
    data: {
      ...activityBase,
      slug: 'integration-city-walk',
      titleEn: 'City Walk',
      providerEn: 'Independent Oman',
      price: 'OMR 999',
      priceAmount: '20',
      partnerTier: 1,
      familyFriendly: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    }
  });

  await prisma.activity.create({
    data: {
      ...activityBase,
      slug: 'integration-mountain-hike',
      titleEn: 'Mountain Hike',
      price: 'OMR 1',
      priceAmount: '50',
      partnerTier: 2,
      travelAgencyId: standardAgency.id,
      outdoor: true,
      createdAt: new Date('2026-02-01T00:00:00.000Z')
    }
  });

  await prisma.activity.create({
    data: {
      ...activityBase,
      slug: 'integration-muscat',
      titleEn: 'Muscat',
      price: 'OMR 150',
      priceAmount: '150',
      partnerTier: 3,
      travelAgencyId: featuredAgency.id,
      familyFriendly: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z')
    }
  });

  await prisma.activity.create({
    data: {
      ...activityBase,
      slug: 'integration-desert-escape',
      titleEn: 'Desert Escape',
      price: 'Price on request',
      partnerTier: 3,
      travelAgencyId: featuredAgency.id,
      createdAt: new Date('2026-04-01T00:00:00.000Z')
    }
  });

  await prisma.activity.create({
    data: {
      ...activityBase,
      slug: 'integration-pending-activity',
      titleEn: 'Pending Muscat Activity',
      price: 'OMR 10',
      status: 'PENDING',
      partnerTier: 3
    }
  });
}

beforeAll(async () => {
  await clearTestDatabase();
  await seedMarketplaceFixtures();
});

afterAll(async () => {
  await clearTestDatabase();
  await prisma.$disconnect();
});

describe('GET /api/listings', () => {
  it('returns approved listings with full pagination metadata', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        page: 1,
        pageSize: 2
      })
      .expect(200);

    expect(response.body.listings).toHaveLength(2);
    expect(response.body.pagination).toEqual({
      take: 2,
      skip: 0,
      count: 2,
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false
    });
  });

  it('returns a different second page', async () => {
    const firstPage = await request(app)
      .get('/api/listings')
      .query({
        page: 1,
        pageSize: 2
      })
      .expect(200);

    const secondPage = await request(app)
      .get('/api/listings')
      .query({
        page: 2,
        pageSize: 2
      })
      .expect(200);

    const firstIds = firstPage.body.listings.map(
      (listing: { id: string }) => listing.id
    );

    const secondIds = secondPage.body.listings.map(
      (listing: { id: string }) => listing.id
    );

    expect(secondIds).toHaveLength(2);
    expect(secondIds).not.toEqual(firstIds);
    expect(secondPage.body.pagination).toMatchObject({
      page: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });

  it('prioritizes title relevance over partner tier', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        search: 'villa',
        sort: 'recommended'
      })
      .expect(200);

    expect(
      response.body.listings.map(
        (listing: { slug: string }) => listing.slug
      )
    ).toEqual([
      'integration-exact-villa',
      'integration-villa-heights',
      'integration-type-only-villa'
    ]);
  });

  it('sorts by structured listing amounts and leaves missing amounts last', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        sort: 'price_asc'
      })
      .expect(200);

    expect(
      response.body.listings.map(
        (listing: { slug: string }) => listing.slug
      )
    ).toEqual([
      'integration-budget-apartment',
      'integration-exact-villa',
      'integration-villa-heights',
      'integration-type-only-villa'
    ]);
  });

  it('sorts area descending', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        sort: 'area_desc'
      })
      .expect(200);

    expect(
      response.body.listings.map(
        (listing: { sqm: number }) => listing.sqm
      )
    ).toEqual([500, 400, 200, 80]);
  });

  it('returns empty records with valid out-of-range metadata', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        page: 9,
        pageSize: 2
      })
      .expect(200);

    expect(response.body.listings).toEqual([]);
    expect(response.body.pagination).toMatchObject({
      page: 9,
      total: 4,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });
});

describe('GET /api/activities', () => {
  it('returns approved activities with pagination metadata', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        page: 1,
        pageSize: 2
      })
      .expect(200);

    expect(response.body.activities).toHaveLength(2);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false
    });
  });

  it('ranks title and agency matches ahead of location-only matches', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        search: 'muscat',
        sort: 'recommended'
      })
      .expect(200);

    const slugs = response.body.activities.map(
      (activity: { slug: string }) => activity.slug
    );

    expect(slugs).toHaveLength(4);
    expect(slugs.slice(0, 2)).toEqual([
      'integration-muscat',
      'integration-desert-escape'
    ]);

    expect(slugs.slice(2)).toEqual(
      expect.arrayContaining([
        'integration-mountain-hike',
        'integration-city-walk'
      ])
    );
  });

  it('sorts by structured activity amounts and leaves missing amounts last', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        sort: 'price_asc'
      })
      .expect(200);

    expect(
      response.body.activities.map(
        (activity: { slug: string }) => activity.slug
      )
    ).toEqual([
      'integration-city-walk',
      'integration-mountain-hike',
      'integration-muscat',
      'integration-desert-escape'
    ]);
  });

  it('inherits featured status from featured travel agencies', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        featured: 'true'
      })
      .expect(200);

    expect(
      response.body.activities.map(
        (activity: { slug: string }) => activity.slug
      )
    ).toEqual([
      'integration-desert-escape',
      'integration-muscat'
    ]);
  });

  it('parses optional boolean filters correctly', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        familyFriendly: 'true'
      })
      .expect(200);

    expect(
      response.body.activities.map(
        (activity: { slug: string }) => activity.slug
      )
    ).toEqual(['integration-muscat']);
  });

  it('rejects invalid query values', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        familyFriendly: 'invalid'
      })
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'Validation failed'
    });
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/middleware/auth';

const app = createApp();

let ownerToken = '';
let activityProviderToken = '';
let customerToken = '';

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

  const customer = await prisma.user.create({
    data: {
      name: 'Integration Customer',
      email: 'integration-customer@lux.test',
      password: 'test-password',
      role: 'USER',
      phone: '+96890000000'
    }
  });

  ownerToken = signToken(owner);
  activityProviderToken = signToken(activityProvider);
  customerToken = signToken(customer);

  const featuredDeveloper = await prisma.developerCompany.create({
    data: {
      slug: 'featured-test-developer',
      nameEn: 'Featured Test Developer',
      verified: true,
      featured: true
    }
  });

  const featuredAgency = await prisma.travelAgency.create({
    data: {
      slug: 'muscat-coast-test-agency',
      nameEn: 'Muscat Coast Tours',
      verified: true,
      featured: true
    }
  });

  const standardAgency = await prisma.travelAgency.create({
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
      buyerEligibility: ['OMAN_RESIDENTS'],
      title: 'Budget Apartment',
      titleEn: 'Budget Apartment',
      type: 'Apartment',
      typeEn: 'Apartment',
      price: 'OMR 9,999',
      priceAmount: '100',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED',
      priceUnit: 'MONTH',
      sqm: 80,
      partnerTier: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    }
  });

  await prisma.listing.create({
    data: {
      ...listingBase,
      slug: 'integration-exact-villa',
      buyerEligibility: ['OMANI_ONLY'],
      title: 'Villa',
      titleEn: 'Villa',
      type: 'Residence',
      typeEn: 'Residence',
      price: 'OMR 1',
      priceAmount: '900',
      priceCurrency: 'OMR',
      priceQualifier: 'FROM',
      priceUnit: 'MONTH',
      sqm: 200,
      partnerTier: 0,
      createdAt: new Date('2026-02-01T00:00:00.000Z')
    }
  });

  await prisma.listing.create({
    data: {
      ...listingBase,
      slug: 'integration-villa-heights',
      buyerEligibility: [
        'FOREIGNERS_ALLOWED',
        'FREEHOLD',
        'COMPANY_PURCHASE_ALLOWED'
      ],
      title: 'Villa Heights',
      titleEn: 'Villa Heights',
      type: 'Residence',
      typeEn: 'Residence',
      price: 'OMR 3,000',
      priceAmount: '3000',
      priceCurrency: 'USD',
      priceQualifier: 'FIXED',
      priceUnit: 'TOTAL',
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
      buyerEligibility: ['GCC_NATIONALS', 'USUFRUCT'],
      title: 'Modern Residence',
      titleEn: 'Modern Residence',
      type: 'Villa',
      typeEn: 'Villa',
      price: 'Price on request',
      priceQualifier: 'ON_REQUEST',
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
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED',
      priceUnit: 'PERSON',
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
      priceCurrency: 'OMR',
      priceQualifier: 'FROM',
      priceUnit: 'PERSON',
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
      priceCurrency: 'USD',
      priceQualifier: 'FIXED',
      priceUnit: 'GROUP',
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
      priceQualifier: 'ON_REQUEST',
      partnerTier: 3,
      travelRegion: 'OUTSIDE_OMAN',
      destinationCountry: 'United Arab Emirates',
      destinationCity: 'Dubai',
      departureCity: 'Muscat',
      tripDurationDays: 4,
      tripDurationNights: 3,
      flightIncluded: true,
      airline: 'Oman Air',
      hotelIncluded: true,
      hotelName: 'Downtown Dubai Hotel',
      hotelRating: 5,
      roomType: 'Double room',
      mealPlan: 'Breakfast',
      visaSupportIncluded: true,
      travelInsuranceIncluded: true,
      airportTransferIncluded: true,
      packageItinerary:
        'Day 1 arrival, Day 2 city tour, Day 3 free day, Day 4 return.',
      requiredDocuments: 'Passport copy and residence card.',
      cancellationPolicy:
        'Cancellation terms depend on airline and hotel rules.',
      availableTravelDates: 'Selected weekends and public holidays.',
      minimumGroupSize: 2,
      packageInclusions: 'Flights, hotel, breakfast, airport transfers.',
      packageExclusions: 'Personal expenses and optional tours.',
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

  it('filters listings by structured price range and metadata', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        minPrice: 800,
        maxPrice: 1000,
        priceCurrency: 'omr',
        priceQualifier: 'FROM',
        priceUnit: 'MONTH'
      })
      .expect(200);

    expect(
      response.body.listings.map(
        (listing: { slug: string }) => listing.slug
      )
    ).toEqual(['integration-exact-villa']);
  });

  it('excludes listings without numeric prices from price ranges', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        maxPrice: 5000
      })
      .expect(200);

    expect(
      response.body.listings.map(
        (listing: { slug: string }) => listing.slug
      )
    ).not.toContain('integration-type-only-villa');
  });

  it('rejects reversed listing price ranges', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        minPrice: 1000,
        maxPrice: 100
      })
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'Validation failed'
    });

    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'maxPrice'
        })
      ])
    );
  });

  it('filters listings by buyer eligibility', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        buyerEligibility: 'FOREIGNERS_ALLOWED'
      })
      .expect(200);

    expect(
      response.body.listings.map(
        (listing: { slug: string }) => listing.slug
      )
    ).toEqual(['integration-villa-heights']);
  });

  it('matches buyer eligibility in listing search', async () => {
    const response = await request(app)
      .get('/api/listings')
      .query({
        search: 'freehold'
      })
      .expect(200);

    expect(
      response.body.listings.map(
        (listing: { slug: string }) => listing.slug
      )
    ).toEqual(['integration-villa-heights']);
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

  it('filters activities by structured price range and metadata', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        minPrice: 40,
        maxPrice: 60,
        priceCurrency: 'omr',
        priceQualifier: 'FROM',
        priceUnit: 'PERSON'
      })
      .expect(200);

    expect(
      response.body.activities.map(
        (activity: { slug: string }) => activity.slug
      )
    ).toEqual(['integration-mountain-hike']);
  });

  it('excludes activities without numeric prices from price ranges', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        maxPrice: 500
      })
      .expect(200);

    expect(
      response.body.activities.map(
        (activity: { slug: string }) => activity.slug
      )
    ).not.toContain('integration-desert-escape');
  });

  it('rejects reversed activity price ranges', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        minPrice: 60,
        maxPrice: 40
      })
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'Validation failed'
    });

    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'maxPrice'
        })
      ])
    );
  });

  it('filters activities by travel region', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        travelRegion: 'OUTSIDE_OMAN'
      })
      .expect(200);

    expect(
      response.body.activities.map(
        (activity: { slug: string }) => activity.slug
      )
    ).toEqual(['integration-desert-escape']);
  });

  it('returns outside-Oman package fields from the API', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        travelRegion: 'OUTSIDE_OMAN'
      })
      .expect(200);

    expect(response.body.activities[0]).toMatchObject({
      slug: 'integration-desert-escape',
      travelRegion: 'OUTSIDE_OMAN',
      destinationCountry: 'United Arab Emirates',
      destinationCity: 'Dubai',
      departureCity: 'Muscat',
      tripDurationDays: 4,
      tripDurationNights: 3,
      flightIncluded: true,
      airline: 'Oman Air',
      hotelIncluded: true,
      hotelName: 'Downtown Dubai Hotel',
      hotelRating: 5,
      roomType: 'Double room',
      mealPlan: 'Breakfast',
      visaSupportIncluded: true,
      travelInsuranceIncluded: true,
      airportTransferIncluded: true,
      packageInclusions: 'Flights, hotel, breakfast, airport transfers.',
      packageExclusions: 'Personal expenses and optional tours.'
    });
  });

  it('matches outside-Oman package fields in activity search', async () => {
    const response = await request(app)
      .get('/api/activities')
      .query({
        search: 'dubai',
        sort: 'recommended'
      })
      .expect(200);

    expect(
      response.body.activities.map(
        (activity: { slug: string }) => activity.slug
      )
    ).toContain('integration-desert-escape');
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

describe('POST /api/bookings', () => {
  it('creates a direct activity booking request for an approved activity', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        activityId: activity.id,
        scheduledDate: '2026-07-15',
        preferredTime: '10:30',
        guests: 3,
        contactName: 'Integration Customer',
        contactEmail: 'customer@lux.test',
        contactPhone: '+96890000000',
        message: 'Please confirm hotel pickup.'
      })
      .expect(201);

    expect(response.body.booking).toMatchObject({
      activityId: activity.id,
      listingId: null,
      status: 'PENDING',
      guests: 3,
      preferredTime: '10:30',
      contactName: 'Integration Customer',
      contactEmail: 'customer@lux.test',
      contactPhone: '+96890000000',
      message: 'Please confirm hotel pickup.'
    });

    expect(response.body.booking.scheduledDate).toContain('2026-07-15');
    expect(response.body.booking.activity.slug).toBe('integration-city-walk');
    expect(response.body.booking.payment).toMatchObject({
      status: 'PENDING',
      provider: 'THAWANI'
    });
    expect(Number(response.body.booking.payment.amount)).toBe(60);
    expect(Number(response.body.booking.payment.commission)).toBe(6);
    expect(response.body.booking.payment.reference).toEqual(expect.any(String));
  });

  it('returns received booking requests on the provider dashboard', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    const bookingResponse = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        activityId: activity.id,
        scheduledDate: '2026-07-18',
        guests: 2
      })
      .expect(201);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .expect(200);

    expect(
      response.body.receivedBookings.map(
        (booking: { id: string }) => booking.id
      )
    ).toContain(bookingResponse.body.booking.id);

    expect(response.body.stats.receivedBookings).toBeGreaterThan(0);
    expect(response.body.stats.receivedPendingBookings).toBeGreaterThan(0);
  });

  it('prevents checkout before provider approval', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    const bookingResponse = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        activityId: activity.id,
        scheduledDate: '2026-07-19',
        guests: 1
      })
      .expect(201);

    const response = await request(app)
      .post(`/api/bookings/${bookingResponse.body.booking.id}/payments/session`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'Booking must be approved by the provider before payment can start'
    });
  });

  it('allows the provider to approve a pending booking request', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    const bookingResponse = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        activityId: activity.id,
        scheduledDate: '2026-07-20',
        guests: 1
      })
      .expect(201);

    const response = await request(app)
      .patch(`/api/bookings/${bookingResponse.body.booking.id}/owner-status`)
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .send({
        status: 'OWNER_APPROVED'
      })
      .expect(200);

    expect(response.body.booking).toMatchObject({
      id: bookingResponse.body.booking.id,
      status: 'OWNER_APPROVED'
    });
  });

  it('creates a real Thawani checkout session for a payable activity booking', async () => {
    const previousFetch = globalThis.fetch;
    const previousSecret = process.env.THAWANI_SECRET_KEY;
    const previousPublishable = process.env.THAWANI_PUBLISHABLE_KEY;

    process.env.THAWANI_SECRET_KEY = 'test_secret';
    process.env.THAWANI_PUBLISHABLE_KEY = 'test_publishable';

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          session_id: 'checkout_test_session',
          payment_status: 'unpaid'
        }
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const activity = await prisma.activity.findUniqueOrThrow({
        where: {
          slug: 'integration-city-walk'
        }
      });

      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          activityId: activity.id,
          scheduledDate: '2026-07-16',
          guests: 2
        })
        .expect(201);

      const bookingId = bookingResponse.body.booking.id;

      await request(app)
        .patch(`/api/bookings/${bookingId}/owner-status`)
        .set('Authorization', `Bearer ${activityProviderToken}`)
        .send({
          status: 'OWNER_APPROVED'
        })
        .expect(200);

      const response = await request(app)
        .post(`/api/bookings/${bookingId}/payments/session`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://uatcheckout.thawani.om/api/v1/checkout/session',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'thawani-api-key': 'test_secret'
          })
        })
      );

      const firstFetchCall = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit
      ];
      const payload = JSON.parse(String(firstFetchCall[1]?.body));

      expect(payload).toMatchObject({
        mode: 'payment',
        products: [
          {
            name: expect.any(String),
            quantity: 1,
            unit_amount: 40000
          }
        ]
      });

      expect(payload.success_url).toContain(bookingId);
      expect(payload.cancel_url).toContain(bookingId);
      expect(response.body.payment).toMatchObject({
        status: 'PENDING',
        provider: 'THAWANI',
        providerSessionId: 'checkout_test_session'
      });
      expect(Number(response.body.payment.amount)).toBe(40);
      expect(Number(response.body.payment.commission)).toBe(4);
      expect(response.body.payment.checkoutUrl).toBe(
        'https://uatcheckout.thawani.om/pay/checkout_test_session?key=test_publishable'
      );
    } finally {
      globalThis.fetch = previousFetch;
      process.env.THAWANI_SECRET_KEY = previousSecret;
      process.env.THAWANI_PUBLISHABLE_KEY = previousPublishable;
    }
  });

  it('syncs a paid Thawani checkout session before marking the booking payment paid', async () => {
    const previousFetch = globalThis.fetch;
    const previousSecret = process.env.THAWANI_SECRET_KEY;
    const previousPublishable = process.env.THAWANI_PUBLISHABLE_KEY;

    process.env.THAWANI_SECRET_KEY = 'test_secret';
    process.env.THAWANI_PUBLISHABLE_KEY = 'test_publishable';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            session_id: 'checkout_paid_session',
            payment_status: 'unpaid'
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            session_id: 'checkout_paid_session',
            payment_status: 'paid'
          }
        })
      });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const activity = await prisma.activity.findUniqueOrThrow({
        where: {
          slug: 'integration-city-walk'
        }
      });

      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          activityId: activity.id,
          scheduledDate: '2026-07-17',
          guests: 1
        })
        .expect(201);

      const bookingId = bookingResponse.body.booking.id;

      await request(app)
        .patch(`/api/bookings/${bookingId}/owner-status`)
        .set('Authorization', `Bearer ${activityProviderToken}`)
        .send({
          status: 'OWNER_APPROVED'
        })
        .expect(200);

      await request(app)
        .post(`/api/bookings/${bookingId}/payments/session`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const response = await request(app)
        .post(`/api/bookings/${bookingId}/payments/sync`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://uatcheckout.thawani.om/api/v1/checkout/session/checkout_paid_session',
        expect.objectContaining({
          headers: expect.objectContaining({
            'thawani-api-key': 'test_secret'
          })
        })
      );
      expect(response.body.payment).toMatchObject({
        status: 'PAID',
        provider: 'THAWANI',
        providerSessionId: 'checkout_paid_session'
      });
      expect(Number(response.body.payment.amount)).toBe(20);
      expect(Number(response.body.payment.commission)).toBe(2);
      expect(response.body.payment.paidAt).toEqual(expect.any(String));
      expect(response.body.booking.payment.status).toBe('PAID');

      const rejectionResponse = await request(app)
        .patch(`/api/bookings/${bookingId}/owner-status`)
        .set('Authorization', `Bearer ${activityProviderToken}`)
        .send({
          status: 'OWNER_REJECTED'
        })
        .expect(400);

      expect(rejectionResponse.body).toMatchObject({
        message: 'Paid bookings cannot be rejected by the provider'
      });
    } finally {
      globalThis.fetch = previousFetch;
      process.env.THAWANI_SECRET_KEY = previousSecret;
      process.env.THAWANI_PUBLISHABLE_KEY = previousPublishable;
    }
  });

  it('requires a scheduled date for activity booking requests', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        activityId: activity.id,
        guests: 2
      })
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'Scheduled date is required for activity bookings'
    });
  });

  it('prevents activity providers from booking their own activities', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .send({
        activityId: activity.id,
        scheduledDate: '2026-07-15',
        guests: 1
      })
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'You cannot create a booking request for your own activity'
    });
  });

  it('rejects booking payloads that target both a listing and an activity', async () => {
    const listing = await prisma.listing.findUniqueOrThrow({
      where: {
        slug: 'integration-budget-apartment'
      }
    });
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        listingId: listing.id,
        activityId: activity.id,
        scheduledDate: '2026-07-15'
      })
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'Validation failed'
    });
    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'activityId'
        })
      ])
    );
  });
});

describe('POST /api/listings pricing compatibility', () => {
  const listingPayload = {
    description:
      'A detailed property description for authenticated integration testing.',
    type: 'Apartment',
    transaction: 'Rent',
    location: 'Muscat, Oman',
    beds: 2,
    baths: 2,
    sqm: 120,
    image: 'https://example.com/new-listing.jpg',
    amenities: ['Parking']
  };

  it('continues accepting a legacy display-price payload', async () => {
    const response = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ...listingPayload,
        title: 'Legacy Price Listing',
        price: 'OMR 900 /mo'
      })
      .expect(201);

    const createdListing = await prisma.listing.findUniqueOrThrow({
      where: {
        id: response.body.listing.id
      }
    });

    expect(createdListing.price).toBe('OMR 900 /mo');
    expect(createdListing.priceAmount?.toString()).toBe('900');
    expect(createdListing.priceCurrency).toBe('OMR');
    expect(createdListing.priceQualifier).toBe('FIXED');
    expect(createdListing.priceUnit).toBe('MONTH');
  });

  it('creates a canonical display price from structured fields', async () => {
    const response = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ...listingPayload,
        title: 'Structured Price Listing',
        priceAmount: '2800',
        priceCurrency: 'omr',
        priceQualifier: 'FIXED',
        priceUnit: 'MONTH'
      })
      .expect(201);

    const createdListing = await prisma.listing.findUniqueOrThrow({
      where: {
        id: response.body.listing.id
      }
    });

    expect(createdListing.price).toBe('OMR 2,800 /mo');
    expect(createdListing.priceAmount?.toString()).toBe('2800');
    expect(createdListing.priceCurrency).toBe('OMR');
    expect(createdListing.priceQualifier).toBe('FIXED');
    expect(createdListing.priceUnit).toBe('MONTH');
  });

  it('stores sale buyer eligibility values', async () => {
    const response = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ...listingPayload,
        title: 'Buyer Eligibility Listing',
        transaction: 'Sale',
        buyerEligibility: ['FOREIGNERS_ALLOWED', 'FREEHOLD'],
        priceAmount: '75000',
        priceCurrency: 'omr',
        priceQualifier: 'FIXED',
        priceUnit: 'TOTAL'
      })
      .expect(201);

    const createdListing = await prisma.listing.findUniqueOrThrow({
      where: {
        id: response.body.listing.id
      }
    });

    expect(createdListing.buyerEligibility).toEqual([
      'FOREIGNERS_ALLOWED',
      'FREEHOLD'
    ]);
  });

  it('rejects on-request pricing that includes an amount', async () => {
    await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ...listingPayload,
        title: 'Invalid Structured Price Listing',
        priceAmount: '100',
        priceCurrency: 'OMR',
        priceQualifier: 'ON_REQUEST'
      })
      .expect(400);
  });
});

describe('POST /api/activities pricing compatibility', () => {
  const activityPayload = {
    descriptionEn:
      'A detailed activity description for authenticated integration testing.',
    locationEn: 'Muscat, Oman',
    categoryEn: 'Experience',
    durationMinutes: 120,
    availabilityDays: ['Thursday', 'Friday'],
    availabilityStartTime: '09:00',
    availabilityEndTime: '17:00',
    familyFriendly: true,
    includesTransfer: false,
    mealIncluded: false,
    outdoor: true,
    images: [
      {
        url: 'https://example.com/new-activity.jpg',
        sortOrder: 0
      }
    ],
    highlights: [
      {
        textEn: 'Professional local guide'
      }
    ]
  };

  it('continues accepting a legacy display-price payload', async () => {
    const response = await request(app)
      .post('/api/activities')
      .set(
        'Authorization',
        `Bearer ${activityProviderToken}`
      )
      .send({
        ...activityPayload,
        titleEn: 'Legacy Price Activity',
        price: 'From OMR 45'
      })
      .expect(201);

    const createdActivity = await prisma.activity.findUniqueOrThrow({
      where: {
        id: response.body.activity.id
      }
    });

    expect(createdActivity.price).toBe('From OMR 45');
    expect(createdActivity.priceAmount?.toString()).toBe('45');
    expect(createdActivity.priceCurrency).toBe('OMR');
    expect(createdActivity.priceQualifier).toBe('FROM');
    expect(createdActivity.priceUnit).toBeNull();
  });

  it('creates a canonical display price from structured fields', async () => {
    const response = await request(app)
      .post('/api/activities')
      .set(
        'Authorization',
        `Bearer ${activityProviderToken}`
      )
      .send({
        ...activityPayload,
        titleEn: 'Structured Price Activity',
        priceAmount: '35',
        priceCurrency: 'omr',
        priceQualifier: 'FROM',
        priceUnit: 'PERSON'
      })
      .expect(201);

    const createdActivity = await prisma.activity.findUniqueOrThrow({
      where: {
        id: response.body.activity.id
      }
    });

    expect(createdActivity.price).toBe('From OMR 35 /person');
    expect(createdActivity.priceAmount?.toString()).toBe('35');
    expect(createdActivity.priceCurrency).toBe('OMR');
    expect(createdActivity.priceQualifier).toBe('FROM');
    expect(createdActivity.priceUnit).toBe('PERSON');
    expect(createdActivity.travelRegion).toBe('INSIDE_OMAN');
  });

  it('creates an inside-Oman activity without travel package fields', async () => {
    const response = await request(app)
      .post('/api/activities')
      .set(
        'Authorization',
        `Bearer ${activityProviderToken}`
      )
      .send({
        ...activityPayload,
        titleEn: 'Inside Oman Stage Seven Activity',
        price: 'OMR 40',
        travelRegion: 'INSIDE_OMAN'
      })
      .expect(201);

    const createdActivity = await prisma.activity.findUniqueOrThrow({
      where: {
        id: response.body.activity.id
      }
    });

    expect(response.body.activity.travelRegion).toBe('INSIDE_OMAN');
    expect(response.body.activity.destinationCountry).toBeNull();
    expect(createdActivity.destinationCountry).toBeNull();
    expect(createdActivity.destinationCity).toBeNull();
    expect(createdActivity.tripDurationDays).toBeNull();
  });

  it('creates an outside-Oman travel package with package fields', async () => {
    const response = await request(app)
      .post('/api/activities')
      .set(
        'Authorization',
        `Bearer ${activityProviderToken}`
      )
      .send({
        ...activityPayload,
        titleEn: 'Dubai Family Package',
        priceAmount: '280',
        priceCurrency: 'OMR',
        priceQualifier: 'FROM',
        priceUnit: 'PERSON',
        travelRegion: 'OUTSIDE_OMAN',
        destinationCountry: 'United Arab Emirates',
        destinationCity: 'Dubai',
        departureCity: 'Muscat',
        tripDurationDays: 4,
        tripDurationNights: 3,
        flightIncluded: true,
        airline: 'Oman Air',
        hotelIncluded: true,
        hotelName: 'Downtown Dubai Hotel',
        hotelRating: 5,
        roomType: 'Double room',
        mealPlan: 'Breakfast',
        visaSupportIncluded: true,
        travelInsuranceIncluded: true,
        airportTransferIncluded: true,
        packageItinerary: 'Arrival, city tour, free day, return.',
        requiredDocuments: 'Passport copy and residence card.',
        cancellationPolicy: 'Subject to airline and hotel terms.',
        availableTravelDates: 'Selected weekends.',
        minimumGroupSize: 2,
        packageInclusions: 'Flights, hotel, breakfast, transfers.',
        packageExclusions: 'Personal expenses.'
      })
      .expect(201);

    const createdActivity = await prisma.activity.findUniqueOrThrow({
      where: {
        id: response.body.activity.id
      }
    });

    expect(response.body.activity).toMatchObject({
      travelRegion: 'OUTSIDE_OMAN',
      destinationCountry: 'United Arab Emirates',
      destinationCity: 'Dubai',
      departureCity: 'Muscat',
      tripDurationDays: 4,
      tripDurationNights: 3,
      flightIncluded: true,
      airline: 'Oman Air',
      hotelIncluded: true,
      hotelName: 'Downtown Dubai Hotel',
      visaSupportIncluded: true,
      travelInsuranceIncluded: true,
      airportTransferIncluded: true
    });

    expect(createdActivity.travelRegion).toBe('OUTSIDE_OMAN');
    expect(createdActivity.destinationCountry).toBe('United Arab Emirates');
    expect(createdActivity.destinationCity).toBe('Dubai');
    expect(createdActivity.tripDurationDays).toBe(4);
    expect(createdActivity.hotelIncluded).toBe(true);
  });

  it('rejects outside-Oman packages without destination basics', async () => {
    const response = await request(app)
      .post('/api/activities')
      .set(
        'Authorization',
        `Bearer ${activityProviderToken}`
      )
      .send({
        ...activityPayload,
        titleEn: 'Incomplete Outside Oman Package',
        price: 'OMR 100',
        travelRegion: 'OUTSIDE_OMAN'
      })
      .expect(400);

    expect(response.body).toMatchObject({
      message: 'Validation failed'
    });

    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'destinationCountry' }),
        expect.objectContaining({ path: 'destinationCity' }),
        expect.objectContaining({ path: 'tripDurationDays' })
      ])
    );
  });

  it('rejects fixed structured pricing without an amount', async () => {
    await request(app)
      .post('/api/activities')
      .set(
        'Authorization',
        `Bearer ${activityProviderToken}`
      )
      .send({
        ...activityPayload,
        titleEn: 'Invalid Structured Price Activity',
        priceCurrency: 'OMR',
        priceQualifier: 'FIXED',
        priceUnit: 'PERSON'
      })
      .expect(400);
  });
});
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/middleware/auth';
import { authAbuseRateLimitRules } from '../src/middleware/rateLimit';
import { createOauthLoginCode } from '../src/services/googleOAuth';

const app = createApp();

let ownerToken = '';
let activityProviderToken = '';
let customerToken = '';
let adminToken = '';

function extractTokenFromDevUrl(devUrl?: string | null) {
  expect(devUrl).toBeTruthy();

  const parsedUrl = new URL(devUrl ?? '');
  const token = parsedUrl.searchParams.get('token');

  expect(token).toBeTruthy();

  return token ?? '';
}

async function clearTestDatabase() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  const databaseName = databaseUrl.pathname.replace(/^\/+/, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing destructive cleanup for database: ${databaseName}`
    );
  }

  await prisma.inquiry.deleteMany();
  await prisma.accountSecurityEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.bookingEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();

  await prisma.rentPaymentDueItem.deleteMany();
  await prisma.rentPaymentSchedule.deleteMany();

  await prisma.transactionAuditEvent.deleteMany();
  await prisma.transactionParticipant.deleteMany();
  await prisma.marketplacePaymentLedger.deleteMany();
  await prisma.marketplaceTransaction.deleteMany();

  await prisma.verificationRecord.deleteMany();
  await prisma.rentalContractDraft.deleteMany();

  await prisma.investorWatchlistItem.deleteMany();
  await prisma.savedSearch.deleteMany();
  await prisma.savedActivity.deleteMany();
  await prisma.savedListing.deleteMany();

  await prisma.trustReport.deleteMany();
  await prisma.review.deleteMany();

  await prisma.activityHighlight.deleteMany();
  await prisma.activityImage.deleteMany();
  await prisma.activity.deleteMany();

  await prisma.listingImage.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.listing.deleteMany();

  await prisma.travelAgency.deleteMany();
  await prisma.developerCompany.deleteMany();
  await prisma.landmark.deleteMany();
  await prisma.oauthLoginCode.deleteMany();
  await prisma.user.deleteMany();
}

async function seedMarketplaceFixtures() {
  const owner = await prisma.user.create({
    data: {
      name: 'Integration Owner',
      email: 'integration-owner@lux.test',
      password: 'test-password',
      role: 'OWNER',
      emailVerified: true,
    }
  });

  const activityProvider = await prisma.user.create({
    data: {
      name: 'Integration Activity Provider',
      email: 'integration-activities@lux.test',
      password: 'test-password',
      role: 'ACTIVITY_PROVIDER',
      emailVerified: true,
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

  const admin = await prisma.user.create({
    data: {
      name: 'Integration Admin',
      email: 'integration-admin@lux.test',
      password: 'test-password',
      role: 'ADMIN',
      emailVerified: true,
    }
  });

  ownerToken = signToken(owner);
  activityProviderToken = signToken(activityProvider);
  customerToken = signToken(customer);
  adminToken = signToken(admin);

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
      priceQualifier: 'FIXED' as const,
      priceUnit: 'MONTH',
      beds: 1,
      baths: 1,
      sqm: 80,
      status: 'APPROVED',
      ownerId: owner.id,
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
      priceQualifier: 'FIXED' as const,
      priceUnit: 'TOTAL' as const,
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
      priceQualifier: 'FIXED' as const,
      priceUnit: 'PERSON' as const,
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
      priceUnit: 'PERSON' as const,
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
      priceQualifier: 'FIXED' as const,
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


describe('auth and account security hardening', () => {
  it('rejects weak registration passwords and verifies a new email once', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Weak Register User',
        email: 'weak-register@lux.test',
        password: 'weak',
        role: 'USER'
      })
      .expect(400);

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Secure Register User',
        email: 'secure-register@lux.test',
        password: 'SafeMarket2026!',
        role: 'USER'
      })
      .expect(201);

    expect(registerResponse.body.user).toMatchObject({
      email: 'secure-register@lux.test',
      emailVerified: false
    });

    expect(registerResponse.body.verification.required).toBe(true);

    const verificationToken = extractTokenFromDevUrl(
      registerResponse.body.verification.devVerificationUrl
    );

    const verifyResponse = await request(app)
      .post('/api/auth/verify-email')
      .send({
        token: verificationToken
      })
      .expect(200);

    expect(verifyResponse.body.user).toMatchObject({
      email: 'secure-register@lux.test',
      emailVerified: true
    });

    await request(app)
      .post('/api/auth/verify-email')
      .send({
        token: verificationToken
      })
      .expect(400);
  });

  it('resends verification for unverified users and blocks publishing until verified', async () => {
    const unverifiedOwner = await prisma.user.create({
      data: {
        name: 'Unverified Owner',
        email: 'unverified-owner@lux.test',
        password: 'test-password',
        role: 'OWNER',
        emailVerified: false
      }
    });

    const unverifiedOwnerToken = signToken(unverifiedOwner);

    const resendResponse = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${unverifiedOwnerToken}`)
      .expect(200);

    expect(resendResponse.body.verification.required).toBe(true);
    expect(resendResponse.body.verification.devVerificationUrl).toContain('/verify-email');

    const updatedOwner = await prisma.user.findUniqueOrThrow({
      where: {
        id: unverifiedOwner.id
      }
    });

    expect(updatedOwner.emailVerificationTokenHash).toBeTruthy();

    await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${unverifiedOwnerToken}`)
      .send({
        title: 'Blocked Unverified Listing',
        description:
          'This listing should not be accepted because the owner has not verified email.',
        type: 'Apartment',
        transaction: 'Rent',
        location: 'Muscat, Oman',
        price: 'OMR 500 /mo',
        beds: 1,
        baths: 1,
        sqm: 80,
        image: 'https://example.com/unverified-listing.jpg'
      })
      .expect(403);
  });

  it('handles password reset safely, enforces policy, and prevents token reuse', async () => {
    await prisma.user.create({
      data: {
        name: 'Password Reset User',
        email: 'password-reset-user@lux.test',
        password: 'old-password',
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const fakeResetResponse = await request(app)
      .post('/api/auth/request-password-reset')
      .send({
        email: 'missing-reset-user@lux.test'
      })
      .expect(200);

    expect(fakeResetResponse.body).toMatchObject({
      ok: true,
      reset: {
        devPasswordResetUrl: null
      }
    });

    const resetRequestResponse = await request(app)
      .post('/api/auth/request-password-reset')
      .send({
        email: 'password-reset-user@lux.test'
      })
      .expect(200);

    const resetToken = extractTokenFromDevUrl(
      resetRequestResponse.body.reset.devPasswordResetUrl
    );

    await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        password: 'weak'
      })
      .expect(400);

    await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        password: 'SafeMarket2026!'
      })
      .expect(200);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'password-reset-user@lux.test',
        password: 'SafeMarket2026!'
      })
      .expect(200);

    expect(loginResponse.body.user.email).toBe('password-reset-user@lux.test');
    expect(loginResponse.body.token).toBeTruthy();

    await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        password: 'AnotherSafe2026!'
      })
      .expect(400);
  });

  it('exchanges Google OAuth login codes once only', async () => {
    const googleUser = await prisma.user.create({
      data: {
        name: 'Google Exchange User',
        email: 'google-exchange-user@lux.test',
        password: 'test-password',
        role: 'USER',
        googleId: 'google-exchange-user-id',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const loginCode = await createOauthLoginCode({
      userId: googleUser.id,
      returnTo: '/profile'
    });

    const exchangeResponse = await request(app)
      .post('/api/auth/google/exchange')
      .send({
        code: loginCode.code
      })
      .expect(200);

    expect(exchangeResponse.body).toMatchObject({
      returnTo: '/profile',
      user: {
        email: 'google-exchange-user@lux.test',
        emailVerified: true
      }
    });
    expect(exchangeResponse.body.token).toBeTruthy();

    await request(app)
      .post('/api/auth/google/exchange')
      .send({
        code: loginCode.code
      })
      .expect(400);
  });

  it('allows safe profile updates but rejects role and email changes through profile', async () => {
    const profileUser = await prisma.user.create({
      data: {
        name: 'Profile Safety User',
        email: 'profile-safety-user@lux.test',
        password: 'test-password',
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const profileToken = signToken(profileUser);

    await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${profileToken}`)
      .send({
        email: 'changed-profile-safety-user@lux.test',
        role: 'ADMIN'
      })
      .expect(400);

    const updateResponse = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${profileToken}`)
      .send({
        name: 'Updated Profile Safety User',
        phone: ''
      })
      .expect(200);

    expect(updateResponse.body.user).toMatchObject({
      name: 'Updated Profile Safety User',
      email: 'profile-safety-user@lux.test',
      role: 'USER'
    });
  });
});

describe('saved, reviews, and reports hardening', () => {
  it('only lets users save approved public listings and activities', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const approvedListing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    const draftListing = await prisma.listing.create({
      data: {
        title: 'Draft listing not public',
        titleEn: 'Draft listing not public',
        slug: 'draft-listing-not-public',
        description: 'Draft listing used to verify saved item access control.',
        transaction: 'Sale',
        type: 'Apartment',
        typeEn: 'Apartment',
        location: 'Muscat, Oman',
        price: 'OMR 100',
        priceAmount: '100',
        priceCurrency: 'OMR',
        priceQualifier: 'FIXED' as const,
        priceUnit: 'MONTH',
        beds: 1,
        baths: 1,
        sqm: 80,
        image: 'https://example.com/draft.jpg',
        status: 'PENDING',
        ownerId: owner.id
      }
    });

    const approvedActivity = await prisma.activity.findFirstOrThrow({
      where: {
        status: 'APPROVED'
      }
    });

const draftActivity = await prisma.activity.create({
  data: {
    titleEn: 'Draft activity not public',
    slug: 'draft-activity-not-public',
    descriptionEn: 'Draft activity used to verify saved item access control.',
    locationEn: 'Muscat, Oman',
    categoryEn: 'Tour',
    price: 'OMR 20',
    priceAmount: '20',
    priceCurrency: 'OMR',
    priceQualifier: 'FIXED' as const,
    priceUnit: 'PERSON' as const,
    status: 'PENDING',
    ownerId: owner.id
  }
});

    await request(app)
      .post(`/api/saved/listings/${approvedListing.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    await request(app)
      .post(`/api/saved/listings/${draftListing.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(404);

    await request(app)
      .post(`/api/saved/activities/${approvedActivity.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    await request(app)
      .post(`/api/saved/activities/${draftActivity.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(404);
  });

  it('validates watchlist listing and valuation ownership targets', async () => {
    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-customer@lux.test'
      }
    });

    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const approvedListing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    const valuation = await prisma.valuationRequest.create({
      data: {
        location: 'Muscat',
        requestedById: customer.id,
        disclaimer: 'Integration test valuation request.'
      }
    });

    await request(app)
      .post('/api/saved/watchlist')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        listingId: approvedListing.id,
        targetPrice: 900,
        notes: 'Watch approved listing.'
      })
      .expect(201);

    await request(app)
      .post('/api/saved/watchlist')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        valuationRequestId: valuation.id,
        notes: 'Watch own valuation.'
      })
      .expect(201);

    await request(app)
      .post('/api/saved/watchlist')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        valuationRequestId: valuation.id,
        notes: 'Trying to watch another user valuation.'
      })
      .expect(404);
  });

  it('validates review targets and blocks duplicate active reviews by the same user', async () => {
    const activity = await prisma.activity.findFirstOrThrow({
      where: {
        status: 'APPROVED'
      }
    });

    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        targetType: 'ACTIVITY',
        targetId: activity.id,
        rating: 5,
        title: 'Great experience',
        body: 'A moderated review pending approval.'
      })
      .expect(201);

    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        targetType: 'ACTIVITY',
        targetId: activity.id,
        rating: 4,
        title: 'Duplicate review'
      })
      .expect(409);

    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        targetType: 'ACTIVITY',
        targetId: 'missing-activity-id',
        rating: 5
      })
      .expect(404);
  });

  it('validates report targets while still allowing OTHER reports', async () => {
    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED'
      }
    });

    await request(app)
      .post('/api/reports')
      .send({
        targetType: 'LISTING',
        targetId: listing.id,
        reason: 'MISLEADING_INFO',
        message: 'Anonymous report for a real listing.',
        reporterEmail: 'reporter@lux.test'
      })
      .expect(201);

    await request(app)
      .post('/api/reports')
      .send({
        targetType: 'LISTING',
        targetId: 'missing-listing-id',
        reason: 'MISLEADING_INFO'
      })
      .expect(404);

    await request(app)
      .post('/api/reports')
      .send({
        targetType: 'OTHER',
        targetId: 'general-platform-report',
        reason: 'OTHER',
        message: 'General platform safety feedback.'
      })
      .expect(201);
  });
});

describe('security hardening', () => {
  it('rejects stale JWTs when the stored user role changes', async () => {
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: {
        role: 'OWNER',
        emailVerified: true,
      }
    });

    const staleOwnerToken = signToken(ownerUser);

    try {
      await prisma.user.update({
        where: {
          id: ownerUser.id
        },
        data: {
          role: 'USER'
        }
      });

      await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${staleOwnerToken}`)
        .send({
          title: 'Stale role listing',
          titleEn: 'Stale role listing',
          titleAr: 'إعلان بدور قديم',
          description: 'This should not be created because the token role is stale.',
          price: 'OMR 100',
          city: 'Muscat',
          location: 'Muscat',
          propertyType: 'APARTMENT',
          listingType: 'SALE',
          bedrooms: 1,
          bathrooms: 1,
          areaSqm: 80
        })
        .expect(401);
    } finally {
      await prisma.user.update({
        where: {
          id: ownerUser.id
        },
        data: {
          role: 'OWNER',
          emailVerified: true,
        }
      });
    }
  });

  it('blocks non-admin users from admin booking finance reports', async () => {
    await request(app)
      .get('/api/bookings/admin/finance')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    await request(app)
      .get('/api/bookings/admin/finance/export.csv')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

});


describe('POST /api/verification', () => {
  it('lets a listing owner submit owner document verification for their listing', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    const response = await request(app)
      .post('/api/verification')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        targetType: 'LISTING',
        targetId: listing.id,
        source: 'OWNER_DOCUMENT_SUBMISSION',
        submittedDocumentUrls: ['https://example.com/ownership-document.pdf'],
        notes: 'Submitting ownership documents for review.'
      })
      .expect(201);

    expect(response.body.verification).toMatchObject({
      targetType: 'LISTING',
      targetId: listing.id,
      source: 'OWNER_DOCUMENT_SUBMISSION',
      status: 'SUBMITTED',
      submittedById: owner.id
    });
  });

  it('blocks non-admin users from submitting future or official verification sources', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    await request(app)
      .post('/api/verification')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        targetType: 'LISTING',
        targetId: listing.id,
        source: 'FUTURE_MOLUP_API',
        notes: 'This should be admin-only.'
      })
      .expect(403);
  });

  it('blocks users from submitting verification for another owner listing', async () => {
    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        owner: {
          email: 'integration-owner@lux.test'
        }
      }
    });

    await request(app)
      .post('/api/verification')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        targetType: 'LISTING',
        targetId: listing.id,
        source: 'OWNER_DOCUMENT_SUBMISSION',
        notes: 'Trying to verify someone else listing.'
      })
      .expect(403);
  });

  it('lets users submit verification for their own user profile only', async () => {
    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-customer@lux.test'
      }
    });

    const response = await request(app)
      .post('/api/verification')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        targetType: 'USER',
        targetId: customer.id,
        source: 'OWNER_DOCUMENT_SUBMISSION',
        notes: 'Submitting profile identity documents.'
      })
      .expect(201);

    expect(response.body.verification).toMatchObject({
      targetType: 'USER',
      targetId: customer.id,
      source: 'OWNER_DOCUMENT_SUBMISSION',
      submittedById: customer.id
    });
  });

  it('blocks users from submitting verification for another user profile', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    await request(app)
      .post('/api/verification')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        targetType: 'USER',
        targetId: owner.id,
        source: 'OWNER_DOCUMENT_SUBMISSION',
        notes: 'Trying to verify another user.'
      })
      .expect(403);
  });

  it('lets admins submit admin and future verification sources', async () => {
    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        owner: {
          email: 'integration-owner@lux.test'
        }
      }
    });

    const response = await request(app)
      .post('/api/verification')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetType: 'LISTING',
        targetId: listing.id,
        source: 'FUTURE_MOLUP_API',
        notes: 'Admin-submitted future integration verification request.'
      })
      .expect(201);

    expect(response.body.verification).toMatchObject({
      targetType: 'LISTING',
      targetId: listing.id,
      source: 'FUTURE_MOLUP_API',
      status: 'SUBMITTED',
      submittedById: expect.any(String)
    });
  });

  it('returns not found for missing verification targets', async () => {
    await request(app)
      .post('/api/verification')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetType: 'LISTING',
        targetId: 'missing-listing-id',
        source: 'LUX_OM_ADMIN_REVIEW'
      })
      .expect(404);
  });
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

    it('creates a listing booking request with payment not required', async () => {
    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-customer@lux.test'
      }
    });

    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: {
          not: customer.id
        }
      }
    });

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        listingId: listing.id,
        scheduledDate: '2026-07-16',
        preferredTime: '11:00',
        guests: 1,
        contactName: 'Integration Customer',
        contactEmail: 'customer@lux.test',
        contactPhone: '+96890000000',
        message: 'I would like to arrange a viewing.'
      })
      .expect(201);

    expect(response.body.booking).toMatchObject({
      listingId: listing.id,
      activityId: null,
      status: 'PENDING',
      guests: 1,
      preferredTime: '11:00',
      contactName: 'Integration Customer',
      contactEmail: 'customer@lux.test',
      contactPhone: '+96890000000',
      message: 'I would like to arrange a viewing.'
    });

    expect(response.body.booking.payment).toMatchObject({
      status: 'NOT_REQUIRED',
      provider: null,
      reference: null
    });
    expect(Number(response.body.booking.payment.amount)).toBe(0);
    expect(Number(response.body.booking.payment.commission)).toBe(0);
  });

  it('rejects listing booking payloads with client-controlled payment amounts', async () => {
    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-customer@lux.test'
      }
    });

    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: {
          not: customer.id
        }
      }
    });

    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        listingId: listing.id,
        guests: 1,
        amount: 999,
        commission: 99
      })
      .expect(400);
  });

  it('rejects activity booking payloads with client-controlled payment amounts', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        activityId: activity.id,
        scheduledDate: '2026-07-17',
        guests: 1,
        amount: 1,
        commission: 0
      })
      .expect(400);
  });

  it('creates notification and audit records for a new booking request', async () => {
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
        scheduledDate: '2026-07-21',
        guests: 2
      })
      .expect(201);

    const providerNotification = await prisma.notification.findFirst({
      where: {
        userId: activity.ownerId,
        bookingId: bookingResponse.body.booking.id,
        type: 'BOOKING_CREATED'
      }
    });

    const bookingEvent = await prisma.bookingEvent.findFirst({
      where: {
        bookingId: bookingResponse.body.booking.id,
        type: 'BOOKING_CREATED'
      }
    });

    expect(providerNotification).toMatchObject({
      title: 'New booking request'
    });
    expect(bookingEvent).toMatchObject({
      actorId: expect.any(String),
      toStatus: 'PENDING'
    });
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

  it('creates customer, admin, and audit records when the provider approves', async () => {
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
        scheduledDate: '2026-07-22',
        guests: 1
      })
      .expect(201);

    await request(app)
      .patch(`/api/bookings/${bookingResponse.body.booking.id}/owner-status`)
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .send({
        status: 'OWNER_APPROVED'
      })
      .expect(200);

    const customerNotification = await prisma.notification.findFirst({
      where: {
        bookingId: bookingResponse.body.booking.id,
        type: 'BOOKING_OWNER_APPROVED',
        user: {
          email: 'integration-customer@lux.test'
        }
      }
    });

    const adminNotification = await prisma.notification.findFirst({
      where: {
        bookingId: bookingResponse.body.booking.id,
        type: 'BOOKING_OWNER_APPROVED',
        user: {
          email: 'integration-admin@lux.test'
        }
      }
    });

    const approvalEvent = await prisma.bookingEvent.findFirst({
      where: {
        bookingId: bookingResponse.body.booking.id,
        type: 'OWNER_APPROVED'
      }
    });

    expect(customerNotification).toMatchObject({
      title: 'Booking approved by provider'
    });
    expect(adminNotification).toMatchObject({
      title: 'Booking needs admin follow-up'
    });
    expect(approvalEvent).toMatchObject({
      fromStatus: 'PENDING',
      toStatus: 'OWNER_APPROVED'
    });
  });

  it('returns booking audit events in admin booking management', async () => {
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
        scheduledDate: '2026-07-25',
        guests: 1
      })
      .expect(201);

    await request(app)
      .patch(`/api/bookings/${bookingResponse.body.booking.id}/owner-status`)
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .send({
        status: 'OWNER_APPROVED'
      })
      .expect(200);

    const response = await request(app)
      .get('/api/bookings/admin/all')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const booking = response.body.bookings.find(
      (item: { id: string }) => item.id === bookingResponse.body.booking.id
    );

    expect(booking.events.map((event: { type: string }) => event.type)).toEqual(
      expect.arrayContaining(['BOOKING_CREATED', 'OWNER_APPROVED'])
    );

    expect(booking.events[0].actor).toMatchObject({
      name: expect.any(String),
      email: expect.any(String)
    });
  });

  it('lets customers request cancellation and records notifications and audit events', async () => {
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
        scheduledDate: '2026-08-04',
        preferredTime: '10:00',
        guests: 1
      })
      .expect(201);

    const response = await request(app)
      .patch(`/api/bookings/${bookingResponse.body.booking.id}/cancellation-request`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reason: 'Plans changed and I cannot attend.'
      })
      .expect(200);

    expect(response.body.booking).toMatchObject({
      id: bookingResponse.body.booking.id,
      status: 'CANCELLATION_REQUESTED',
      cancellationReason: 'Plans changed and I cannot attend.',
      cancellationRequestedAt: expect.any(String)
    });

    const event = await prisma.bookingEvent.findFirstOrThrow({
      where: {
        bookingId: bookingResponse.body.booking.id,
        type: 'CANCELLATION_REQUESTED'
      }
    });

    expect(event).toMatchObject({
      fromStatus: 'PENDING',
      toStatus: 'CANCELLATION_REQUESTED'
    });

    const notifications = await prisma.notification.findMany({
      where: {
        bookingId: bookingResponse.body.booking.id,
        type: 'BOOKING_CANCELLATION_REQUESTED'
      }
    });

    expect(notifications.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks non-customers from requesting booking cancellation', async () => {
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
        scheduledDate: '2026-08-05',
        preferredTime: '10:00',
        guests: 1
      })
      .expect(201);

    await request(app)
      .patch(`/api/bookings/${bookingResponse.body.booking.id}/cancellation-request`)
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .send({
        reason: 'Provider should not be able to request this as the customer.'
      })
      .expect(403);
  });

  it('requires refunded payment before admin completes cancellation of a paid booking', async () => {
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
        scheduledDate: '2026-08-06',
        preferredTime: '10:00',
        guests: 1
      })
      .expect(201);

    await request(app)
      .patch(`/api/bookings/${bookingResponse.body.booking.id}/owner-status`)
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .send({
        status: 'OWNER_APPROVED'
      })
      .expect(200);

    const payment = await prisma.payment.update({
      where: {
        bookingId: bookingResponse.body.booking.id
      },
      data: {
        status: 'PAID',
        paidAt: new Date()
      }
    });

    await request(app)
      .patch(`/api/bookings/admin/${bookingResponse.body.booking.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'CANCELLED'
      })
      .expect(400);

    await request(app)
      .patch(`/api/bookings/admin/payments/${payment.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'REFUNDED'
      })
      .expect(200);

    const cancelledResponse = await request(app)
      .patch(`/api/bookings/admin/${bookingResponse.body.booking.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'CANCELLED'
      })
      .expect(200);

    expect(cancelledResponse.body.booking).toMatchObject({
      id: bookingResponse.body.booking.id,
      status: 'CANCELLED'
    });
  });

  it('returns live activity availability for a selected date and time', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    try {
      await prisma.activity.update({
        where: {
          id: activity.id
        },
        data: {
          capacity: 3
        }
      });

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          activityId: activity.id,
          scheduledDate: '2026-08-03',
          preferredTime: '10:00',
          guests: 2
        })
        .expect(201);

      const availableResponse = await request(app)
        .get(`/api/activities/${activity.id}/availability`)
        .query({
          date: '2026-08-03',
          time: '10:00',
          guests: 1
        })
        .expect(200);

      expect(availableResponse.body.availability).toMatchObject({
        activityId: activity.id,
        capacity: 3,
        reservedGuests: 2,
        availableGuests: 1,
        requestedGuests: 1,
        available: true
      });

      const unavailableResponse = await request(app)
        .get(`/api/activities/${activity.id}/availability`)
        .query({
          date: '2026-08-03',
          time: '10:00',
          guests: 2
        })
        .expect(200);

      expect(unavailableResponse.body.availability).toMatchObject({
        available: false,
        unavailableReason: 'Not enough availability for the selected date and time'
      });
    } finally {
      await prisma.activity.update({
        where: {
          id: activity.id
        },
        data: {
          capacity: null
        }
      });
    }
  });

  it('prevents overbooking an activity date and time when capacity is full', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    try {
      await prisma.activity.update({
        where: {
          id: activity.id
        },
        data: {
          capacity: 2
        }
      });

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          activityId: activity.id,
          scheduledDate: '2026-08-01',
          preferredTime: '10:00',
          guests: 2
        })
        .expect(201);

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          activityId: activity.id,
          scheduledDate: '2026-08-01',
          preferredTime: '10:00',
          guests: 1
        })
        .expect(409);
    } finally {
      await prisma.activity.update({
        where: {
          id: activity.id
        },
        data: {
          capacity: null
        }
      });
    }
  });

  it('blocks checkout when capacity is no longer available', async () => {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: {
        slug: 'integration-city-walk'
      }
    });

    try {
      await prisma.activity.update({
        where: {
          id: activity.id
        },
        data: {
          capacity: 2
        }
      });

      const firstBookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          activityId: activity.id,
          scheduledDate: '2026-08-02',
          preferredTime: '10:00',
          guests: 1
        })
        .expect(201);

      await request(app)
        .patch(`/api/bookings/${firstBookingResponse.body.booking.id}/owner-status`)
        .set('Authorization', `Bearer ${activityProviderToken}`)
        .send({
          status: 'OWNER_APPROVED'
        })
        .expect(200);

      const secondBookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          activityId: activity.id,
          scheduledDate: '2026-08-02',
          preferredTime: '10:00',
          guests: 1
        })
        .expect(201);

      await request(app)
        .patch(`/api/bookings/${secondBookingResponse.body.booking.id}/owner-status`)
        .set('Authorization', `Bearer ${activityProviderToken}`)
        .send({
          status: 'OWNER_APPROVED'
        })
        .expect(200);

      await prisma.activity.update({
        where: {
          id: activity.id
        },
        data: {
          capacity: 1
        }
      });

      await request(app)
        .post(`/api/bookings/${secondBookingResponse.body.booking.id}/payments/session`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(409);
    } finally {
      await prisma.activity.update({
        where: {
          id: activity.id
        },
        data: {
          capacity: null
        }
      });
    }
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

      const paymentEvent = await prisma.bookingEvent.findFirst({
        where: {
          bookingId,
          type: 'PAYMENT_PAID'
        }
      });

      const customerPaymentNotification = await prisma.notification.findFirst({
        where: {
          bookingId,
          type: 'BOOKING_PAYMENT_PAID',
          user: {
            email: 'integration-customer@lux.test'
          }
        }
      });

      const providerPaymentNotification = await prisma.notification.findFirst({
        where: {
          bookingId,
          type: 'BOOKING_PAYMENT_PAID',
          user: {
            email: 'integration-activities@lux.test'
          }
        }
      });

      const adminPaymentNotification = await prisma.notification.findFirst({
        where: {
          bookingId,
          type: 'BOOKING_PAYMENT_PAID',
          user: {
            email: 'integration-admin@lux.test'
          }
        }
      });

      expect(paymentEvent).toMatchObject({
        type: 'PAYMENT_PAID'
      });
      expect(customerPaymentNotification).toMatchObject({
        title: 'Payment completed'
      });
      expect(providerPaymentNotification).toMatchObject({
        title: 'Customer payment completed'
      });
      expect(adminPaymentNotification).toMatchObject({
        title: 'Booking payment completed'
      });

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


describe('POST/PATCH /api/rent-payments', () => {
  it('lets a listing owner create a rent schedule, add a due item, and mark it paid', async () => {
    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        owner: {
          email: 'integration-owner@lux.test'
        }
      }
    });

    const scheduleResponse = await request(app)
      .post('/api/rent-payments/schedules')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Integration rent schedule',
        frequency: 'MONTHLY',
        amount: 500,
        currency: 'OMR',
        startDate: '2026-08-01T00:00:00.000Z',
        dueDayOfMonth: 1,
        listingId: listing.id,
        landlordUserId: listing.ownerId,
        notes: 'Created by listing owner.'
      })
      .expect(201);

    expect(scheduleResponse.body.schedule).toMatchObject({
      title: 'Integration rent schedule',
      frequency: 'MONTHLY',
      currency: 'OMR',
      listingId: listing.id,
      landlordUserId: listing.ownerId
    });
    expect(Number(scheduleResponse.body.schedule.amount)).toBe(500);

    const dueItemResponse = await request(app)
      .post(`/api/rent-payments/schedules/${scheduleResponse.body.schedule.id}/due-items`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        dueDate: '2026-08-01T00:00:00.000Z',
        periodStart: '2026-08-01T00:00:00.000Z',
        periodEnd: '2026-08-31T00:00:00.000Z',
        amount: 500,
        currency: 'OMR',
        notes: 'August rent.'
      })
      .expect(201);

    expect(dueItemResponse.body.dueItem).toMatchObject({
      scheduleId: scheduleResponse.body.schedule.id,
      status: 'PENDING',
      currency: 'OMR',
      notes: 'August rent.'
    });
    expect(Number(dueItemResponse.body.dueItem.amount)).toBe(500);

    const paidResponse = await request(app)
      .patch(`/api/rent-payments/due-items/${dueItemResponse.body.dueItem.id}/paid`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        paymentProvider: 'BANK_TRANSFER',
        paymentReference: 'RENT-STAGE9-OWNER-001',
        receiptNumber: 'RECEIPT-STAGE9-OWNER-001',
        notes: 'Confirmed by owner.'
      })
      .expect(200);

    expect(paidResponse.body.dueItem).toMatchObject({
      id: dueItemResponse.body.dueItem.id,
      status: 'PAID',
      paymentProvider: 'BANK_TRANSFER',
      paymentReference: 'RENT-STAGE9-OWNER-001',
      receiptNumber: 'RECEIPT-STAGE9-OWNER-001',
      notes: 'Confirmed by owner.'
    });
    expect(paidResponse.body.dueItem.paidAt).toEqual(expect.any(String));
  });

  it('blocks a customer from creating a rent schedule for another owner listing', async () => {
    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        owner: {
          email: 'integration-owner@lux.test'
        }
      }
    });

    await request(app)
      .post('/api/rent-payments/schedules')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Unauthorized rent schedule',
        frequency: 'MONTHLY',
        amount: 500,
        currency: 'OMR',
        startDate: '2026-08-01T00:00:00.000Z',
        listingId: listing.id,
        landlordUserId: listing.ownerId
      })
      .expect(403);
  });

  it('blocks a customer from adding due items to another user rent schedule', async () => {
    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        owner: {
          email: 'integration-owner@lux.test'
        }
      }
    });

    const schedule = await prisma.rentPaymentSchedule.create({
      data: {
        title: 'Protected owner schedule',
        frequency: 'MONTHLY',
        amount: '700',
        currency: 'OMR',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        dueDayOfMonth: 1,
        listingId: listing.id,
        createdById: listing.ownerId,
        landlordUserId: listing.ownerId
      }
    });

    await request(app)
      .post(`/api/rent-payments/schedules/${schedule.id}/due-items`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        dueDate: '2026-09-01T00:00:00.000Z',
        amount: 700,
        currency: 'OMR'
      })
      .expect(403);
  });

  it('blocks a customer from marking another user rent due item as paid', async () => {
    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        owner: {
          email: 'integration-owner@lux.test'
        }
      }
    });

    const schedule = await prisma.rentPaymentSchedule.create({
      data: {
        title: 'Protected paid schedule',
        frequency: 'MONTHLY',
        amount: '800',
        currency: 'OMR',
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        dueDayOfMonth: 1,
        listingId: listing.id,
        createdById: listing.ownerId,
        landlordUserId: listing.ownerId
      }
    });

    const dueItem = await prisma.rentPaymentDueItem.create({
      data: {
        scheduleId: schedule.id,
        dueDate: new Date('2026-10-01T00:00:00.000Z'),
        amount: '800',
        currency: 'OMR'
      }
    });

    await request(app)
      .patch(`/api/rent-payments/due-items/${dueItem.id}/paid`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        paymentProvider: 'BANK_TRANSFER',
        paymentReference: 'RENT-STAGE9-CUSTOMER-BLOCKED',
        receiptNumber: 'RECEIPT-STAGE9-CUSTOMER-BLOCKED'
      })
      .expect(403);

    const unchangedDueItem = await prisma.rentPaymentDueItem.findUniqueOrThrow({
      where: {
        id: dueItem.id
      }
    });

    expect(unchangedDueItem.status).toBe('PENDING');
    expect(unchangedDueItem.paymentReference).toBeNull();
    expect(unchangedDueItem.receiptNumber).toBeNull();
  });

  it('lets an admin manage any rent schedule and mark due items paid', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const scheduleResponse = await request(app)
      .post('/api/rent-payments/schedules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin rent schedule',
        frequency: 'ONE_TIME',
        amount: 900,
        currency: 'OMR',
        startDate: '2026-11-01T00:00:00.000Z',
        landlordUserId: owner.id
      })
      .expect(201);

    const dueItemResponse = await request(app)
      .post(`/api/rent-payments/schedules/${scheduleResponse.body.schedule.id}/due-items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dueDate: '2026-11-01T00:00:00.000Z',
        amount: 900,
        currency: 'OMR'
      })
      .expect(201);

    await request(app)
      .patch(`/api/rent-payments/due-items/${dueItemResponse.body.dueItem.id}/paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        paymentProvider: 'ADMIN_RECORDED',
        paymentReference: 'RENT-STAGE9-ADMIN-001',
        receiptNumber: 'RECEIPT-STAGE9-ADMIN-001'
      })
      .expect(200);
  });
});


describe('POST /api/contracts', () => {
  function contractPayload(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Integration rental contract',
      landlordName: 'Integration Owner',
      landlordEmail: 'owner@lux.test',
      landlordPhone: '+96891111111',
      tenantName: 'Integration Tenant',
      tenantEmail: 'tenant@lux.test',
      tenantPhone: '+96892222222',
      propertyTitle: 'Integration Property',
      propertyAddress: 'Muscat, Oman',
      propertyType: 'Apartment',
      propertyNotes: 'Integration test contract draft.',
      rentAmount: 500,
      currency: 'OMR',
      securityDeposit: 500,
      contractStartDate: '2026-08-01T00:00:00.000Z',
      contractEndDate: '2027-07-31T00:00:00.000Z',
      paymentSchedule: 'Monthly',
      utilitiesResponsibility: 'Tenant pays utilities.',
      maintenanceTerms: 'Landlord handles structural maintenance.',
      noticePeriod: '30 days',
      additionalClauses: 'Subject to final legal review.',
      attachmentsNotes: 'Civil ID and ownership documents pending.',
      ...overrides
    };
  }

  it('lets a listing owner create a contract draft for their own listing', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    const response = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(
        contractPayload({
          listingId: listing.id,
          landlordUserId: owner.id
        })
      )
      .expect(201);

    expect(response.body.contract).toMatchObject({
      title: 'Integration rental contract',
      listingId: listing.id,
      createdById: owner.id,
      landlordUserId: owner.id,
      tenantUserId: null,
      currency: 'OMR'
    });
    expect(Number(response.body.contract.rentAmount)).toBe(500);
    expect(Number(response.body.contract.securityDeposit)).toBe(500);
  });

  it('blocks a customer from creating a contract draft for another owner listing', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(
        contractPayload({
          listingId: listing.id,
          landlordUserId: owner.id
        })
      )
      .expect(403);
  });

  it('blocks non-admin users from linking arbitrary tenant accounts', async () => {
    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-customer@lux.test'
      }
    });

    await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(
        contractPayload({
          tenantUserId: customer.id
        })
      )
      .expect(403);
  });

  it('lets admins create a contract draft with reviewed user links', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-customer@lux.test'
      }
    });

    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    const response = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(
        contractPayload({
          listingId: listing.id,
          landlordUserId: owner.id,
          tenantUserId: customer.id
        })
      )
      .expect(201);

    expect(response.body.contract).toMatchObject({
      listingId: listing.id,
      createdById: expect.any(String),
      landlordUserId: owner.id,
      tenantUserId: customer.id
    });
  });

  it('keeps contract drafts visible to linked owners in their workspace', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const listing = await prisma.listing.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    const createResponse = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(
        contractPayload({
          title: 'Owner workspace contract',
          listingId: listing.id,
          landlordUserId: owner.id
        })
      )
      .expect(201);

    const mineResponse = await request(app)
      .get('/api/contracts/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      mineResponse.body.contracts.map((contract: { id: string }) => contract.id)
    ).toContain(createResponse.body.contract.id);
  });
});


describe('POST /api/transactions', () => {
  it('blocks non-admin users from creating marketplace transactions', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-customer@lux.test'
      }
    });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Unauthorized customer transaction',
        type: 'PROPERTY_RENTAL',
        amount: 1000,
        currency: 'OMR',
        landlordId: owner.id,
        tenantId: customer.id,
        adminNotes: 'This should not be accepted from a customer.'
      })
      .expect(403);
  });

  it('lets admins create marketplace transactions and records an audit event', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-customer@lux.test'
      }
    });

    const response = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin-created rental transaction',
        type: 'PROPERTY_RENTAL',
        amount: 1200,
        currency: 'OMR',
        landlordId: owner.id,
        tenantId: customer.id,
        adminNotes: 'Created by admin during Stage 9 hardening.',
        documentChecklist: {
          contractDraft: true,
          paymentSchedule: true
        }
      })
      .expect(201);

    expect(response.body.transaction).toMatchObject({
      title: 'Admin-created rental transaction',
      type: 'PROPERTY_RENTAL',
      currency: 'OMR',
      landlordId: owner.id,
      tenantId: customer.id,
      adminId: expect.any(String),
      adminNotes: 'Created by admin during Stage 9 hardening.'
    });
    expect(Number(response.body.transaction.amount)).toBe(1200);
    expect(response.body.transaction.documentChecklist).toMatchObject({
      contractDraft: true,
      paymentSchedule: true
    });
    expect(response.body.transaction.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'CREATED',
          message: 'Transaction created.'
        })
      ])
    );
  });
});


describe('GET/PATCH /api/notifications', () => {
  it('returns notifications for the current user with unread count', async () => {
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
        scheduledDate: '2026-07-23',
        guests: 2
      })
      .expect(201);

    const providerNotification = await prisma.notification.findFirstOrThrow({
      where: {
        userId: activity.ownerId,
        bookingId: bookingResponse.body.booking.id,
        type: 'BOOKING_CREATED'
      }
    });

    const response = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .expect(200);

    expect(
      response.body.notifications.map(
        (notification: { id: string }) => notification.id
      )
    ).toContain(providerNotification.id);

    expect(response.body.unreadCount).toBeGreaterThan(0);
    expect(response.body.pagination).toMatchObject({
      count: expect.any(Number),
      total: expect.any(Number)
    });
  });

  it('marks one notification as read and blocks other users from changing it', async () => {
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
        scheduledDate: '2026-07-24',
        guests: 1
      })
      .expect(201);

    const providerNotification = await prisma.notification.findFirstOrThrow({
      where: {
        userId: activity.ownerId,
        bookingId: bookingResponse.body.booking.id,
        type: 'BOOKING_CREATED'
      }
    });

    await request(app)
      .patch(`/api/notifications/${providerNotification.id}/read`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(404);

    const response = await request(app)
      .patch(`/api/notifications/${providerNotification.id}/read`)
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .expect(200);

    expect(response.body.notification).toMatchObject({
      id: providerNotification.id,
      readAt: expect.any(String)
    });

    const updatedNotification = await prisma.notification.findUniqueOrThrow({
      where: {
        id: providerNotification.id
      }
    });

    expect(updatedNotification.readAt).toBeInstanceOf(Date);
  });

  it('marks all current-user notifications as read without touching other users', async () => {
    const provider = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-activities@lux.test'
      }
    });

    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-customer@lux.test'
      }
    });

    const providerNotification = await prisma.notification.create({
      data: {
        userId: provider.id,
        type: 'BOOKING_CREATED',
        title: 'Provider unread test',
        message: 'Provider notification should be marked read.'
      }
    });

    const customerNotification = await prisma.notification.create({
      data: {
        userId: customer.id,
        type: 'BOOKING_CREATED',
        title: 'Customer unread test',
        message: 'Customer notification should stay unread.'
      }
    });

    const response = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${activityProviderToken}`)
      .expect(200);

    expect(response.body.count).toBeGreaterThan(0);

    const updatedProviderNotification = await prisma.notification.findUniqueOrThrow({
      where: {
        id: providerNotification.id
      }
    });

    const updatedCustomerNotification = await prisma.notification.findUniqueOrThrow({
      where: {
        id: customerNotification.id
      }
    });

    expect(updatedProviderNotification.readAt).toBeInstanceOf(Date);
    expect(updatedCustomerNotification.readAt).toBeNull();
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
        priceQualifier: 'FIXED' as const,
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
        priceQualifier: 'FIXED' as const,
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
        priceUnit: 'PERSON' as const,
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
        priceQualifier: 'FIXED' as const,
        priceUnit: 'PERSON'
      })
      .expect(400);
  });
});

describe('auth abuse protection rate limiting', () => {
  it('rate limits repeated login attempts', async () => {
    const ip = '203.0.113.10';

    for (let index = 0; index < authAbuseRateLimitRules.login.productionLimit; index += 1) {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({
          email: 'rate-login@lux.test',
          password: 'WrongPassword2026!'
        })
        .expect(401);
    }

    const response = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({
        email: 'rate-login@lux.test',
        password: 'WrongPassword2026!'
      })
      .expect(429);

    expect(response.body.message).toContain('Too many login attempts');
  });

  it('rate limits repeated account creation attempts', async () => {
    const ip = '203.0.113.11';

    for (let index = 0; index < authAbuseRateLimitRules.register.productionLimit; index += 1) {
      await request(app)
        .post('/api/auth/register')
        .set('X-Forwarded-For', ip)
        .send({
          name: `Rate Register User ${index}`,
          email: `rate-register-${index}@lux.test`,
          password: 'SafeMarket2026!',
          role: 'USER'
        })
        .expect(201);
    }

    const response = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send({
        name: 'Rate Register Blocked',
        email: 'rate-register-blocked@lux.test',
        password: 'SafeMarket2026!',
        role: 'USER'
      })
      .expect(429);

    expect(response.body.message).toContain('Too many account creation attempts');
  });

  it('rate limits repeated password reset requests', async () => {
    const ip = '203.0.113.12';

    for (
      let index = 0;
      index < authAbuseRateLimitRules.passwordResetRequest.productionLimit;
      index += 1
    ) {
      await request(app)
        .post('/api/auth/request-password-reset')
        .set('X-Forwarded-For', ip)
        .send({
          email: `rate-reset-${index}@lux.test`
        })
        .expect(200);
    }

    const response = await request(app)
      .post('/api/auth/request-password-reset')
      .set('X-Forwarded-For', ip)
      .send({
        email: 'rate-reset-blocked@lux.test'
      })
      .expect(429);

    expect(response.body.message).toContain('Too many password reset requests');
  });

  it('rate limits repeated verification resend requests', async () => {
    const ip = '203.0.113.13';

    const unverifiedUser = await prisma.user.create({
      data: {
        name: 'Rate Verification User',
        email: 'rate-verification-user@lux.test',
        password: 'test-password',
        role: 'USER',
        emailVerified: false
      }
    });

    const unverifiedToken = signToken(unverifiedUser);

    for (
      let index = 0;
      index < authAbuseRateLimitRules.verificationResend.productionLimit;
      index += 1
    ) {
      await request(app)
        .post('/api/auth/resend-verification')
        .set('X-Forwarded-For', ip)
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .expect(200);
    }

    const response = await request(app)
      .post('/api/auth/resend-verification')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${unverifiedToken}`)
      .expect(429);

    expect(response.body.message).toContain('Too many verification email requests');
  });

  it('rate limits repeated Google OAuth start attempts', async () => {
    const ip = '203.0.113.14';

    for (
      let index = 0;
      index < authAbuseRateLimitRules.googleStart.productionLimit;
      index += 1
    ) {
      const response = await request(app)
        .get('/api/auth/google/start')
        .set('X-Forwarded-For', ip)
        .query({
          role: 'USER',
          returnTo: '/dashboard'
        });

      expect([302, 503]).toContain(response.status);
    }

    const response = await request(app)
      .get('/api/auth/google/start')
      .set('X-Forwarded-For', ip)
      .query({
        role: 'USER',
        returnTo: '/dashboard'
      })
      .expect(429);

    expect(response.body.message).toContain('Too many Google login attempts');
  });

  it('rate limits repeated Google OAuth exchange attempts', async () => {
    const ip = '203.0.113.15';

    for (
      let index = 0;
      index < authAbuseRateLimitRules.googleExchange.productionLimit;
      index += 1
    ) {
      await request(app)
        .post('/api/auth/google/exchange')
        .set('X-Forwarded-For', ip)
        .send({
          code: `invalid-google-exchange-code-${index}-00000000000000000000000000000000`
        })
        .expect(400);
    }

    const response = await request(app)
      .post('/api/auth/google/exchange')
      .set('X-Forwarded-For', ip)
      .send({
        code: 'invalid-google-exchange-code-blocked-00000000000000000000000000000000'
      })
      .expect(429);

    expect(response.body.message).toContain('Too many Google login exchange attempts');
  });
});

describe('account password security settings', () => {
  it('changes password with current password and rejects wrong or weak changes', async () => {
    const passwordHash = await bcrypt.hash('CurrentSafe2026!', 12);

    const passwordUser = await prisma.user.create({
      data: {
        name: 'Change Password User',
        email: 'change-password-user@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const passwordUserToken = signToken(passwordUser);

    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${passwordUserToken}`)
      .send({
        currentPassword: 'WrongCurrent2026!',
        newPassword: 'NextSafe2026!'
      })
      .expect(401);

    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${passwordUserToken}`)
      .send({
        currentPassword: 'CurrentSafe2026!',
        newPassword: 'weak'
      })
      .expect(400);

    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${passwordUserToken}`)
      .send({
        currentPassword: 'CurrentSafe2026!',
        newPassword: 'NextSafe2026!'
      })
      .expect(200);

    await request(app)
      .post('/api/auth/login')
      .send({
        email: 'change-password-user@lux.test',
        password: 'CurrentSafe2026!'
      })
      .expect(401);

    await request(app)
      .post('/api/auth/login')
      .send({
        email: 'change-password-user@lux.test',
        password: 'NextSafe2026!'
      })
      .expect(200);
  });

  it('lets Google-only users set a password without a current password', async () => {
    const googlePasswordHash = await bcrypt.hash('RandomGoogleOnly2026!', 12);

    const googleOnlyUser = await prisma.user.create({
      data: {
        name: 'Google Only Password User',
        email: 'google-only-password-user@lux.test',
        password: googlePasswordHash,
        passwordLoginEnabled: false,
        googleId: 'google-only-password-user-id',
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const googleOnlyToken = signToken(googleOnlyUser);

    await request(app)
      .post('/api/auth/login')
      .send({
        email: 'google-only-password-user@lux.test',
        password: 'RandomGoogleOnly2026!'
      })
      .expect(401);

    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${googleOnlyToken}`)
      .send({
        newPassword: 'SafeAccess2026!'
      })
      .expect(200);

    expect(response.body.user).toMatchObject({
      email: 'google-only-password-user@lux.test',
      googleConnected: true,
      passwordLoginEnabled: true
    });

    await request(app)
      .post('/api/auth/login')
      .send({
        email: 'google-only-password-user@lux.test',
        password: 'SafeAccess2026!'
      })
      .expect(200);
  });
});

describe('session token invalidation after password security events', () => {
  it('rejects old authenticated tokens after password reset', async () => {
    const passwordHash = await bcrypt.hash('OldAccess2026!', 12);

    const resetSessionUser = await prisma.user.create({
      data: {
        name: 'Reset Session Account',
        email: 'reset-session-account@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const oldToken = signToken(resetSessionUser);

    const resetRequestResponse = await request(app)
      .post('/api/auth/request-password-reset')
      .set('X-Forwarded-For', '203.0.113.40')
      .send({
        email: 'reset-session-account@lux.test'
      })
      .expect(200);

    const resetToken = extractTokenFromDevUrl(
      resetRequestResponse.body.reset.devPasswordResetUrl
    );

    await request(app)
      .post('/api/auth/reset-password')
      .set('X-Forwarded-For', '203.0.113.41')
      .send({
        token: resetToken,
        password: 'VaultAccess2026!'
      })
      .expect(200);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.42')
      .send({
        email: 'reset-session-account@lux.test',
        password: 'VaultAccess2026!'
      })
      .expect(200);

    expect(loginResponse.body.token).toBeTruthy();

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .expect(200);
  });

  it('returns a replacement token and rejects the old token after password change', async () => {
    const passwordHash = await bcrypt.hash('StartAccess2026!', 12);

    const changeSessionUser = await prisma.user.create({
      data: {
        name: 'Change Session Account',
        email: 'change-session-account@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const oldToken = signToken(changeSessionUser);

    const changeResponse = await request(app)
      .post('/api/auth/change-password')
      .set('X-Forwarded-For', '203.0.113.43')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({
        currentPassword: 'StartAccess2026!',
        newPassword: 'VaultAccess2026!'
      })
      .expect(200);

    expect(changeResponse.body.token).toBeTruthy();
    expect(changeResponse.body.token).not.toBe(oldToken);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${changeResponse.body.token}`)
      .expect(200);
  });
});

describe('logout all sessions security control', () => {
  it('returns a replacement token and rejects older tokens', async () => {
    const passwordHash = await bcrypt.hash('SessionExit2026!', 12);

    const sessionUser = await prisma.user.create({
      data: {
        name: 'Logout Session Account',
        email: 'logout-session-account@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const oldToken = signToken(sessionUser);

    const response = await request(app)
      .post('/api/auth/logout-all-sessions')
      .set('X-Forwarded-For', '203.0.113.50')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      user: {
        email: 'logout-session-account@lux.test'
      }
    });
    expect(response.body.token).toBeTruthy();
    expect(response.body.token).not.toBe(oldToken);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.token}`)
      .expect(200);
  });

  it('rate limits repeated logout all sessions requests', async () => {
    const passwordHash = await bcrypt.hash('SessionLimit2026!', 12);

    const limitedUser = await prisma.user.create({
      data: {
        name: 'Logout Session Limit Account',
        email: 'logout-session-limit-account@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    let currentToken = signToken(limitedUser);

    for (
      let index = 0;
      index < authAbuseRateLimitRules.logoutAllSessions.productionLimit;
      index += 1
    ) {
      const response = await request(app)
        .post('/api/auth/logout-all-sessions')
        .set('X-Forwarded-For', '203.0.113.51')
        .set('Authorization', `Bearer ${currentToken}`)
        .expect(200);

      currentToken = response.body.token;
    }

    const response = await request(app)
      .post('/api/auth/logout-all-sessions')
      .set('X-Forwarded-For', '203.0.113.51')
      .set('Authorization', `Bearer ${currentToken}`)
      .expect(429);

    expect(response.body.message).toContain('Too many session logout requests');
  });
});

describe('secure email change workflow', () => {
  it('blocks duplicate email change requests', async () => {
    const passwordHash = await bcrypt.hash('EmailMove2026!', 12);

    await prisma.user.create({
      data: {
        name: 'Existing Email Owner',
        email: 'existing-email-owner@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const requester = await prisma.user.create({
      data: {
        name: 'Email Change Requester',
        email: 'email-change-requester@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    await request(app)
      .post('/api/auth/request-email-change')
      .set('X-Forwarded-For', '203.0.113.60')
      .set('Authorization', `Bearer ${signToken(requester)}`)
      .send({
        email: 'existing-email-owner@lux.test',
        currentPassword: 'EmailMove2026!'
      })
      .expect(409);
  });

  it('rejects invalid and expired email change confirmation links', async () => {
    const passwordHash = await bcrypt.hash('EmailExpire2026!', 12);

    const requester = await prisma.user.create({
      data: {
        name: 'Expired Email Change',
        email: 'expired-email-change@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    await request(app)
      .post('/api/auth/confirm-email-change')
      .set('X-Forwarded-For', '203.0.113.61')
      .send({
        token: '0'.repeat(64)
      })
      .expect(400);

    const requestResponse = await request(app)
      .post('/api/auth/request-email-change')
      .set('X-Forwarded-For', '203.0.113.62')
      .set('Authorization', `Bearer ${signToken(requester)}`)
      .send({
        email: 'expired-email-change-new@lux.test',
        currentPassword: 'EmailExpire2026!'
      })
      .expect(200);

    const expiredToken = extractTokenFromDevUrl(
      requestResponse.body.emailChange.devEmailChangeVerificationUrl
    );

    await prisma.user.update({
      where: {
        id: requester.id
      },
      data: {
        emailChangeExpiresAt: new Date(Date.now() - 60 * 1000)
      }
    });

    await request(app)
      .post('/api/auth/confirm-email-change')
      .set('X-Forwarded-For', '203.0.113.63')
      .send({
        token: expiredToken
      })
      .expect(400);
  });

  it('confirms a new email and invalidates older sessions', async () => {
    const passwordHash = await bcrypt.hash('EmailConfirm2026!', 12);

    const requester = await prisma.user.create({
      data: {
        name: 'Email Confirm Account',
        email: 'email-confirm-account@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const oldToken = signToken(requester);

    const requestResponse = await request(app)
      .post('/api/auth/request-email-change')
      .set('X-Forwarded-For', '203.0.113.64')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({
        email: 'email-confirm-account-new@lux.test',
        currentPassword: 'EmailConfirm2026!'
      })
      .expect(200);

    expect(requestResponse.body.emailChange.pendingEmail).toBe(
      'email-confirm-account-new@lux.test'
    );

    const confirmationToken = extractTokenFromDevUrl(
      requestResponse.body.emailChange.devEmailChangeVerificationUrl
    );

    const confirmResponse = await request(app)
      .post('/api/auth/confirm-email-change')
      .set('X-Forwarded-For', '203.0.113.65')
      .send({
        token: confirmationToken
      })
      .expect(200);

    expect(confirmResponse.body.user).toMatchObject({
      email: 'email-confirm-account-new@lux.test',
      emailVerified: true
    });
    expect(confirmResponse.body.token).toBeTruthy();

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${confirmResponse.body.token}`)
      .expect(200);

    await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.66')
      .send({
        email: 'email-confirm-account@lux.test',
        password: 'EmailConfirm2026!'
      })
      .expect(401);

    await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.67')
      .send({
        email: 'email-confirm-account-new@lux.test',
        password: 'EmailConfirm2026!'
      })
      .expect(200);
  });

  it('rate limits email change confirmation attempts', async () => {
    for (
      let index = 0;
      index < authAbuseRateLimitRules.emailChangeConfirm.productionLimit;
      index += 1
    ) {
      await request(app)
        .post('/api/auth/confirm-email-change')
        .set('X-Forwarded-For', '203.0.113.68')
        .send({
          token: `${index}`.padStart(64, '1')
        })
        .expect(400);
    }

    const response = await request(app)
      .post('/api/auth/confirm-email-change')
      .set('X-Forwarded-For', '203.0.113.68')
      .send({
        token: '2'.repeat(64)
      })
      .expect(429);

    expect(response.body.message).toContain('Too many email change confirmation attempts');
  });
});

describe('account security notifications and audit trail', () => {
  it('creates notification and audit event after password reset completion', async () => {
    const passwordHash = await bcrypt.hash('AuditReset2026!', 12);

    const resetUser = await prisma.user.create({
      data: {
        name: 'Audit Reset User',
        email: 'audit-reset-user@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const resetRequestResponse = await request(app)
      .post('/api/auth/request-password-reset')
      .set('X-Forwarded-For', '203.0.113.80')
      .send({
        email: 'audit-reset-user@lux.test'
      })
      .expect(200);

    const resetToken = extractTokenFromDevUrl(
      resetRequestResponse.body.reset.devPasswordResetUrl
    );

    await request(app)
      .post('/api/auth/reset-password')
      .set('X-Forwarded-For', '203.0.113.81')
      .send({
        token: resetToken,
        password: 'FortressAccess2026!'
      })
      .expect(200);

    const event = await prisma.accountSecurityEvent.findFirstOrThrow({
      where: {
        userId: resetUser.id,
        type: 'PASSWORD_RESET_COMPLETED'
      }
    });

    expect(event.title).toContain('Password reset');

    const notification = await prisma.notification.findFirstOrThrow({
      where: {
        userId: resetUser.id,
        type: 'ACCOUNT_SECURITY',
        title: 'Password reset completed'
      }
    });

    expect(notification.message).toContain('password was reset');
  });

  it('creates notification and audit event after password change', async () => {
    const passwordHash = await bcrypt.hash('AuditChange2026!', 12);

    const changeUser = await prisma.user.create({
      data: {
        name: 'Audit Change User',
        email: 'audit-change-user@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    await request(app)
      .post('/api/auth/change-password')
      .set('X-Forwarded-For', '203.0.113.82')
      .set('Authorization', `Bearer ${signToken(changeUser)}`)
      .send({
        currentPassword: 'AuditChange2026!',
        newPassword: 'FortressAccess2026!'
      })
      .expect(200);

    const [event, notification] = await Promise.all([
      prisma.accountSecurityEvent.findFirstOrThrow({
        where: {
          userId: changeUser.id,
          type: 'PASSWORD_CHANGED'
        }
      }),
      prisma.notification.findFirstOrThrow({
        where: {
          userId: changeUser.id,
          type: 'ACCOUNT_SECURITY',
          title: 'Password changed'
        }
      })
    ]);

    expect(event.message).toContain('password was changed');
    expect(notification.message).toContain('password was changed');
  });

  it('creates notification and audit event after logout all sessions', async () => {
    const passwordHash = await bcrypt.hash('AuditLogout2026!', 12);

    const logoutUser = await prisma.user.create({
      data: {
        name: 'Audit Logout User',
        email: 'audit-logout-user@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    await request(app)
      .post('/api/auth/logout-all-sessions')
      .set('X-Forwarded-For', '203.0.113.83')
      .set('Authorization', `Bearer ${signToken(logoutUser)}`)
      .expect(200);

    const [event, notification] = await Promise.all([
      prisma.accountSecurityEvent.findFirstOrThrow({
        where: {
          userId: logoutUser.id,
          type: 'LOGOUT_ALL_SESSIONS'
        }
      }),
      prisma.notification.findFirstOrThrow({
        where: {
          userId: logoutUser.id,
          type: 'ACCOUNT_SECURITY',
          title: 'Other sessions logged out'
        }
      })
    ]);

    expect(event.message).toContain('sessions');
    expect(notification.message).toContain('sessions');
  });

  it('creates notification and audit events for email change request and confirmation', async () => {
    const passwordHash = await bcrypt.hash('AuditEmail2026!', 12);

    const emailUser = await prisma.user.create({
      data: {
        name: 'Audit Email User',
        email: 'audit-email-user@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const requestResponse = await request(app)
      .post('/api/auth/request-email-change')
      .set('X-Forwarded-For', '203.0.113.84')
      .set('Authorization', `Bearer ${signToken(emailUser)}`)
      .send({
        email: 'audit-email-user-new@lux.test',
        currentPassword: 'AuditEmail2026!'
      })
      .expect(200);

    await prisma.accountSecurityEvent.findFirstOrThrow({
      where: {
        userId: emailUser.id,
        type: 'EMAIL_CHANGE_REQUESTED'
      }
    });

    await prisma.notification.findFirstOrThrow({
      where: {
        userId: emailUser.id,
        type: 'ACCOUNT_SECURITY',
        title: 'Email change requested'
      }
    });

    const confirmationToken = extractTokenFromDevUrl(
      requestResponse.body.emailChange.devEmailChangeVerificationUrl
    );

    await request(app)
      .post('/api/auth/confirm-email-change')
      .set('X-Forwarded-For', '203.0.113.85')
      .send({
        token: confirmationToken
      })
      .expect(200);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: emailUser.id
      }
    });

    await prisma.accountSecurityEvent.findFirstOrThrow({
      where: {
        userId: emailUser.id,
        type: 'EMAIL_CHANGE_CONFIRMED'
      }
    });

    const notification = await prisma.notification.findFirstOrThrow({
      where: {
        userId: emailUser.id,
        type: 'ACCOUNT_SECURITY',
        title: 'Email changed'
      }
    });

    expect(updatedUser.email).toBe('audit-email-user-new@lux.test');
    expect(notification.message).toContain('audit-email-user-new@lux.test');
  });
});

describe('admin user account controls', () => {
  it('blocks non-admin access and lets admins list/search users with security summaries', async () => {
    await request(app)
      .get('/api/auth/admin/users')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    const listResponse = await request(app)
      .get('/api/auth/admin/users?query=integration-admin&page=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listResponse.body.records.length).toBeGreaterThanOrEqual(1);
    expect(listResponse.body.records[0]).toMatchObject({
      email: 'integration-admin@lux.test',
      accountStatus: 'ACTIVE'
    });
    expect(listResponse.body.pagination.total).toBeGreaterThanOrEqual(1);

    const adminUserId = listResponse.body.records[0].id;

    const securityResponse = await request(app)
      .get(`/api/auth/admin/users/${adminUserId}/security`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(securityResponse.body.user.email).toBe('integration-admin@lux.test');
    expect(Array.isArray(securityResponse.body.securityEvents)).toBe(true);
  });

  it('suspends and unsuspends a user, invalidates sessions, and records audit events', async () => {
    const passwordHash = await bcrypt.hash('SuspendAccess2026!', 12);

    const targetUser = await prisma.user.create({
      data: {
        name: 'Suspend Target User',
        email: 'suspend-target-user@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    const oldToken = signToken(targetUser);

    const suspendResponse = await request(app)
      .patch(`/api/auth/admin/users/${targetUser.id}/suspension`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        suspended: true,
        reason: 'Confirmed abusive account activity in integration test'
      })
      .expect(200);

    expect(suspendResponse.body.user.accountStatus).toBe('SUSPENDED');

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(403);

    await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.91')
      .send({
        email: 'suspend-target-user@lux.test',
        password: 'SuspendAccess2026!'
      })
      .expect(403);

    await prisma.accountSecurityEvent.findFirstOrThrow({
      where: {
        userId: targetUser.id,
        type: 'ADMIN_USER_SUSPENDED'
      }
    });

    await prisma.notification.findFirstOrThrow({
      where: {
        userId: targetUser.id,
        type: 'ACCOUNT_SECURITY',
        title: 'Account suspended by admin'
      }
    });

    const unsuspendResponse = await request(app)
      .patch(`/api/auth/admin/users/${targetUser.id}/suspension`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        suspended: false,
        reason: 'Suspension removed after admin review'
      })
      .expect(200);

    expect(unsuspendResponse.body.user.accountStatus).toBe('ACTIVE');

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);

    await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.92')
      .send({
        email: 'suspend-target-user@lux.test',
        password: 'SuspendAccess2026!'
      })
      .expect(200);

    await prisma.accountSecurityEvent.findFirstOrThrow({
      where: {
        userId: targetUser.id,
        type: 'ADMIN_USER_UNSUSPENDED'
      }
    });
  });

  it('prevents admins from suspending their own account', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-admin@lux.test'
      }
    });

    await request(app)
      .patch(`/api/auth/admin/users/${admin.id}/suspension`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        suspended: true,
        reason: 'Self suspension should be blocked'
      })
      .expect(400);
  });

  it('lets admins force email verification changes with reasons and audit events', async () => {
    const passwordHash = await bcrypt.hash('VerifyAccess2026!', 12);

    const targetUser = await prisma.user.create({
      data: {
        name: 'Admin Verify Target',
        email: 'admin-verify-target@lux.test',
        password: passwordHash,
        passwordLoginEnabled: true,
        role: 'USER',
        emailVerified: false
      }
    });

    const oldToken = signToken(targetUser);

    const verifyResponse = await request(app)
      .patch(`/api/auth/admin/users/${targetUser.id}/email-verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        emailVerified: true,
        reason: 'Manual document-backed verification from admin review'
      })
      .expect(200);

    expect(verifyResponse.body.user.emailVerified).toBe(true);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);

    await prisma.accountSecurityEvent.findFirstOrThrow({
      where: {
        userId: targetUser.id,
        type: 'ADMIN_EMAIL_VERIFIED'
      }
    });

    await prisma.notification.findFirstOrThrow({
      where: {
        userId: targetUser.id,
        type: 'ACCOUNT_SECURITY',
        title: 'Email verified by admin'
      }
    });

    const unverifyResponse = await request(app)
      .patch(`/api/auth/admin/users/${targetUser.id}/email-verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        emailVerified: false,
        reason: 'Verification removed because submitted evidence was invalid'
      })
      .expect(200);

    expect(unverifyResponse.body.user.emailVerified).toBe(false);

    await prisma.accountSecurityEvent.findFirstOrThrow({
      where: {
        userId: targetUser.id,
        type: 'ADMIN_EMAIL_UNVERIFIED'
      }
    });
  });
});

describe('verification backend hardening and notifications', () => {
  it('notifies submitter and admins when verification is submitted and blocks duplicate pending requests', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const listing = await prisma.listing.create({
      data: {
        slug: 'verification-hardening-submission-listing',
        title: 'Verification Hardening Submission Listing',
        description:
          'A sufficiently detailed listing created to test verification submission notifications.',
        type: 'Apartment',
        transaction: 'Sale',
        location: 'Muscat, Oman',
        price: 'OMR 85,000',
        beds: 2,
        baths: 2,
        sqm: 120,
        image: 'https://example.com/verification-hardening.jpg',
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    const response = await request(app)
      .post('/api/verification')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        targetType: 'LISTING',
        targetId: listing.id,
        source: 'OWNER_DOCUMENT_SUBMISSION',
        submittedDocumentUrls: ['https://example.com/title-deed.pdf'],
        notes: 'Submitting title deed for internal admin review.',
        documentChecklist: {
          titleDeed: true,
          ownerCivilId: true
        }
      })
      .expect(201);

    expect(response.body.verification).toMatchObject({
      targetType: 'LISTING',
      targetId: listing.id,
      source: 'OWNER_DOCUMENT_SUBMISSION',
      status: 'SUBMITTED',
      submittedById: owner.id
    });

    await prisma.notification.findFirstOrThrow({
      where: {
        userId: owner.id,
        type: 'VERIFICATION_STATUS_UPDATED',
        title: 'Verification submitted'
      }
    });

    const admin = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-admin@lux.test'
      }
    });

    await prisma.notification.findFirstOrThrow({
      where: {
        userId: admin.id,
        type: 'VERIFICATION_STATUS_UPDATED',
        title: 'New verification submitted'
      }
    });

    await request(app)
      .post('/api/verification')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        targetType: 'LISTING',
        targetId: listing.id,
        source: 'OWNER_DOCUMENT_SUBMISSION',
        submittedDocumentUrls: ['https://example.com/title-deed.pdf'],
        notes: 'Duplicate pending request should be blocked.'
      })
      .expect(409);
  });

  it('validates risky admin review decisions before saving', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const listing = await prisma.listing.create({
      data: {
        slug: 'verification-hardening-validation-listing',
        title: 'Verification Hardening Validation Listing',
        description:
          'A sufficiently detailed listing created to test verification review validation.',
        type: 'Villa',
        transaction: 'Sale',
        location: 'Muscat, Oman',
        price: 'OMR 145,000',
        beds: 4,
        baths: 4,
        sqm: 260,
        image: 'https://example.com/verification-validation.jpg',
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    const verification = await prisma.verificationRecord.create({
      data: {
        targetType: 'LISTING',
        targetId: listing.id,
        source: 'OWNER_DOCUMENT_SUBMISSION',
        status: 'SUBMITTED',
        submittedById: owner.id,
        notes: 'Owner submitted local title documents for review.'
      }
    });

    await request(app)
      .patch(`/api/verification/admin/${verification.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'REJECTED',
        notes: 'Too short'
      })
      .expect(400);

    await request(app)
      .patch(`/api/verification/admin/${verification.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'ADMIN_VERIFIED',
        notes: 'Documents look valid, but expiry cannot be in the past.',
        expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      })
      .expect(400);

    await request(app)
      .patch(`/api/verification/admin/${verification.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'EXTERNALLY_VERIFIED',
        notes: 'External status should not be used for owner-uploaded documents.'
      })
      .expect(400);
  });

  it('updates listing verification snapshot and notifies the submitter after admin approval', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const listing = await prisma.listing.create({
      data: {
        slug: 'verification-hardening-approval-listing',
        title: 'Verification Hardening Approval Listing',
        description:
          'A sufficiently detailed listing created to test verification approval sync.',
        type: 'Townhouse',
        transaction: 'Sale',
        location: 'Muscat, Oman',
        price: 'OMR 99,500',
        beds: 3,
        baths: 3,
        sqm: 175,
        image: 'https://example.com/verification-approval.jpg',
        status: 'APPROVED',
        ownerId: owner.id
      }
    });

    const verification = await prisma.verificationRecord.create({
      data: {
        targetType: 'LISTING',
        targetId: listing.id,
        source: 'OWNER_DOCUMENT_SUBMISSION',
        status: 'SUBMITTED',
        submittedById: owner.id,
        notes: 'Owner submitted title deed and identity proof.'
      }
    });

    const reviewResponse = await request(app)
      .patch(`/api/verification/admin/${verification.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'ADMIN_VERIFIED',
        notes: 'Title deed and owner identity were reviewed and accepted.',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      })
      .expect(200);

    expect(reviewResponse.body.verification).toMatchObject({
      id: verification.id,
      status: 'ADMIN_VERIFIED',
      targetType: 'LISTING',
      targetId: listing.id
    });

    const updatedListing = await prisma.listing.findUniqueOrThrow({
      where: {
        id: listing.id
      }
    });

    expect(updatedListing.verificationStatus).toBe('ADMIN_VERIFIED');
    expect(updatedListing.verificationSource).toBe('OWNER_DOCUMENT_SUBMISSION');
    expect(updatedListing.verificationReviewedById).toBeTruthy();
    expect(updatedListing.verificationDate).toBeTruthy();
    expect(updatedListing.verificationExpiryDate).toBeTruthy();

    const notification = await prisma.notification.findFirstOrThrow({
      where: {
        userId: owner.id,
        type: 'VERIFICATION_STATUS_UPDATED',
        title: 'Verification approved'
      }
    });

    expect(notification.message).toContain('admin verified');
  });
});

describe('verified discovery filters and trust sorting', () => {
  it('filters public listings to verified records and ranks trusted matches first', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-owner@lux.test'
      }
    });

    const baseListing = {
      description:
        'A sufficiently detailed verified discovery listing description.',
      transaction: 'Sale',
      location: 'Muscat, Oman',
      type: 'Apartment',
      price: 'OMR 100,000',
      priceAmount: '100000',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED' as const,
      priceUnit: 'TOTAL' as const,
      beds: 2,
      baths: 2,
      sqm: 120,
      image: 'https://example.com/verified-discovery.jpg',
      status: 'APPROVED' as const,
      ownerId: owner.id,
      partnerTier: 0,
      createdAt: new Date('2026-04-01T00:00:00.000Z')
    };

    const unverified = await prisma.listing.create({
      data: {
        ...baseListing,
        slug: 'verified-discovery-unverified-listing',
        title: 'Verified Discovery Trust Home',
        verificationStatus: 'UNVERIFIED'
      }
    });

    const verified = await prisma.listing.create({
      data: {
        ...baseListing,
        slug: 'verified-discovery-approved-listing',
        title: 'Verified Discovery Trust Residence',
        verificationStatus: 'ADMIN_VERIFIED',
        verificationSource: 'LUX_OM_ADMIN_REVIEW',
        verificationDate: new Date('2026-04-02T00:00:00.000Z')
      }
    });

    const filteredResponse = await request(app)
      .get('/api/listings')
      .query({
        search: 'Verified Discovery Trust',
        verifiedOnly: 'true',
        pageSize: 20
      })
      .expect(200);

    const filteredIds = filteredResponse.body.listings.map(
      (listing: { id: string }) => listing.id
    );

    expect(filteredIds).toContain(verified.id);
    expect(filteredIds).not.toContain(unverified.id);

    const rankedResponse = await request(app)
      .get('/api/listings')
      .query({
        search: 'Verified Discovery Trust',
        pageSize: 20
      })
      .expect(200);

    const rankedIds = rankedResponse.body.listings.map(
      (listing: { id: string }) => listing.id
    );

    expect(rankedIds.indexOf(verified.id)).toBeGreaterThanOrEqual(0);
    expect(rankedIds.indexOf(unverified.id)).toBeGreaterThanOrEqual(0);
    expect(rankedIds.indexOf(verified.id)).toBeLessThan(
      rankedIds.indexOf(unverified.id)
    );
  });

  it('filters public activities to verified records and ranks trusted matches first', async () => {
    const provider = await prisma.user.findUniqueOrThrow({
      where: {
        email: 'integration-activities@lux.test'
      }
    });

    const baseActivity = {
      descriptionEn:
        'A sufficiently detailed verified discovery activity description.',
      locationEn: 'Muscat, Oman',
      categoryEn: 'Experience',
      price: 'OMR 25',
      priceAmount: '25',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED' as const,
      priceUnit: 'PERSON' as const,
      ownerId: provider.id,
      status: 'APPROVED' as const,
      partnerTier: 0,
      createdAt: new Date('2026-04-01T00:00:00.000Z')
    };

    const unverified = await prisma.activity.create({
      data: {
        ...baseActivity,
        slug: 'verified-discovery-unverified-activity',
        titleEn: 'Verified Discovery Trust Tour',
        verificationStatus: 'UNVERIFIED'
      }
    });

    const verified = await prisma.activity.create({
      data: {
        ...baseActivity,
        slug: 'verified-discovery-approved-activity',
        titleEn: 'Verified Discovery Trust Experience',
        verificationStatus: 'EXTERNALLY_VERIFIED',
        verificationSource: 'FUTURE_THIRD_PARTY_PROVIDER',
        verificationDate: new Date('2026-04-02T00:00:00.000Z')
      }
    });

    const filteredResponse = await request(app)
      .get('/api/activities')
      .query({
        search: 'Verified Discovery Trust',
        verifiedOnly: 'true',
        pageSize: 20
      })
      .expect(200);

    const filteredIds = filteredResponse.body.activities.map(
      (activity: { id: string }) => activity.id
    );

    expect(filteredIds).toContain(verified.id);
    expect(filteredIds).not.toContain(unverified.id);

    const rankedResponse = await request(app)
      .get('/api/activities')
      .query({
        search: 'Verified Discovery Trust',
        pageSize: 20
      })
      .expect(200);

    const rankedIds = rankedResponse.body.activities.map(
      (activity: { id: string }) => activity.id
    );

    expect(rankedIds.indexOf(verified.id)).toBeGreaterThanOrEqual(0);
    expect(rankedIds.indexOf(unverified.id)).toBeGreaterThanOrEqual(0);
    expect(rankedIds.indexOf(verified.id)).toBeLessThan(
      rankedIds.indexOf(unverified.id)
    );
  });
});

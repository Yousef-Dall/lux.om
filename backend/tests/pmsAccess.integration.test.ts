import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/middleware/auth';

const app = createApp();

async function clearPmsTestDatabase() {
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
  await prisma.developerProjectImage.deleteMany();
  await prisma.developerProject.deleteMany();
  await prisma.pmsCompanyMember.deleteMany();
  await prisma.pmsCompanyEntitlement.deleteMany();
  await prisma.travelAgency.deleteMany();
  await prisma.developerCompany.deleteMany();
  await prisma.landmark.deleteMany();
  await prisma.oauthLoginCode.deleteMany();
  await prisma.user.deleteMany();
}

describe('PMS company entitlement access architecture', () => {
  beforeEach(async () => {
    await clearPmsTestDatabase();
  });

  it('blocks non-PMS users from the PMS overview', async () => {
    const customer = await prisma.user.create({
      data: {
        name: 'PMS Customer',
        email: 'pms-customer@lux.test',
        password: 'test-password',
        role: 'USER',
        emailVerified: true
      }
    });

    const token = signToken(customer);

    await request(app)
      .get('/api/pms/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('lets admins enable PMS for a company and grant scoped staff access', async () => {
    const admin = await prisma.user.create({
      data: {
        name: 'PMS Admin',
        email: 'pms-admin@lux.test',
        password: 'test-password',
        role: 'ADMIN',
        emailVerified: true
      }
    });

    const developerUser = await prisma.user.create({
      data: {
        name: 'PMS Developer',
        email: 'pms-developer@lux.test',
        password: 'test-password',
        role: 'DEVELOPER',
        emailVerified: true
      }
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: 'pms-test-developer',
        nameEn: 'PMS Test Developer',
        verified: true,
        featured: false
      }
    });

    await prisma.developerProject.create({
      data: {
        slug: 'pms-test-project',
        nameEn: 'PMS Test Project',
        locationEn: 'Muscat',
        status: 'APPROVED',
        developerId: company.id,
        ownerId: developerUser.id
      }
    });

    await prisma.listing.create({
      data: {
        slug: 'pms-test-listing',
        title: 'PMS Test Listing',
        titleEn: 'PMS Test Listing',
        description: 'A PMS linked property for integration coverage.',
        type: 'Apartment',
        typeEn: 'Apartment',
        transaction: 'Rent',
        location: 'Muscat',
        locationEn: 'Muscat',
        price: 'OMR 900/month',
        priceAmount: '900',
        priceCurrency: 'OMR',
        beds: 2,
        baths: 2,
        sqm: 120,
        image: 'https://example.com/pms.jpg',
        status: 'APPROVED',
        ownerId: developerUser.id,
        developerId: company.id
      }
    });

    const adminToken = signToken(admin);

    const entitlementResponse = await request(app)
      .patch(`/api/pms/admin/companies/${company.id}/entitlement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'ACTIVE',
        notes: 'Integration PMS activation'
      })
      .expect(200);

    expect(entitlementResponse.body.entitlement.status).toBe('ACTIVE');

    const memberResponse = await request(app)
      .post(`/api/pms/admin/companies/${company.id}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: developerUser.email,
        role: 'PMS_MANAGER'
      })
      .expect(201);

    expect(memberResponse.body.member.role).toBe('PMS_MANAGER');

    const developerToken = signToken(developerUser);
    const overviewResponse = await request(app)
      .get('/api/pms/overview')
      .set('Authorization', `Bearer ${developerToken}`)
      .expect(200);

    expect(overviewResponse.body.workspace.company.id).toBe(company.id);
    expect(overviewResponse.body.workspace.member.role).toBe('PMS_MANAGER');
    expect(overviewResponse.body.metrics.totalListings).toBe(1);
    expect(overviewResponse.body.metrics.approvedProjects).toBe(1);

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${developerToken}`)
      .expect(200);

    expect(meResponse.body.user.pmsAccess.hasAccess).toBe(true);
  });

  it('removes PMS route access when the company entitlement is suspended', async () => {
    const admin = await prisma.user.create({
      data: {
        name: 'PMS Suspend Admin',
        email: 'pms-suspend-admin@lux.test',
        password: 'test-password',
        role: 'ADMIN',
        emailVerified: true
      }
    });

    const staff = await prisma.user.create({
      data: {
        name: 'PMS Staff',
        email: 'pms-staff@lux.test',
        password: 'test-password',
        role: 'OWNER',
        emailVerified: true
      }
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: 'pms-suspended-company',
        nameEn: 'PMS Suspended Company',
        verified: true
      }
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: 'ACTIVE',
        enabledAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id
      }
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: company.id,
        userId: staff.id,
        role: 'PMS_VIEWER',
        active: true,
        createdById: admin.id
      }
    });

    const staffToken = signToken(staff);

    await request(app)
      .get('/api/pms/overview')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    await request(app)
      .patch(`/api/pms/admin/companies/${company.id}/entitlement`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({
        status: 'SUSPENDED',
        notes: 'Billing hold'
      })
      .expect(200);

    await request(app)
      .get('/api/pms/overview')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);
  });
});

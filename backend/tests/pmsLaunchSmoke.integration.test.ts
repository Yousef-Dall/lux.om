import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/middleware/auth';

const app = createApp();

async function clearPmsLaunchSmokeDatabase() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/lux_om_test');
  const databaseName = databaseUrl.pathname.replace(/^\/+/, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing destructive cleanup for database: ${databaseName}`);
  }

  await prisma.inquiry.deleteMany();
  await prisma.accountSecurityEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.emailDeliveryEvent.deleteMany();
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

  await prisma.pmsMoveChecklistItem.deleteMany();
  await prisma.pmsDocument.deleteMany();
  await prisma.pmsInspection.deleteMany();
  await prisma.pmsCommunicationLog.deleteMany();
  await prisma.pmsCommunicationTemplate.deleteMany();
  await prisma.pmsImportBatch.deleteMany();
  await prisma.pmsPolicy.deleteMany();
  await prisma.pmsAccountingLedgerEntry.deleteMany();
  await prisma.pmsMaintenanceQuote.deleteMany();
  await prisma.pmsWorkOrder.deleteMany();
  await prisma.pmsVendor.deleteMany();
  await prisma.pmsRentPayment.deleteMany();
  await prisma.pmsRentDueItem.deleteMany();
  await prisma.pmsLease.deleteMany();
  await prisma.pmsTenantPortalAccess.deleteMany();
  await prisma.pmsTenant.deleteMany();
  await prisma.pmsUnit.deleteMany();
  await prisma.pmsPortfolioProperty.deleteMany();
  await prisma.pmsPortfolio.deleteMany();
  await prisma.pmsMemberPermission.deleteMany();
  await prisma.pmsMemberPropertyAccess.deleteMany();
  await prisma.pmsProperty.deleteMany();
  await prisma.pmsCompanyMember.deleteMany();
  await prisma.pmsCompanyEntitlement.deleteMany();

  await prisma.travelAgency.deleteMany();
  await prisma.developerCompany.deleteMany();
  await prisma.landmark.deleteMany();
  await prisma.oauthLoginCode.deleteMany();
  await prisma.user.deleteMany();
}

describe('PMS production launch smoke coverage', () => {
  beforeEach(async () => {
    await clearPmsLaunchSmokeDatabase();
  });

  it('critical-launch-smoke: completes core PMS onboarding, operations, finance, document, and communication flow with strict company scoping', async () => {
    const admin = await prisma.user.create({
      data: {
        name: 'Launch Admin',
        email: 'launch-admin@lux.test',
        password: 'test-password',
        role: 'ADMIN',
        emailVerified: true,
      },
    });

    const pmsOwner = await prisma.user.create({
      data: {
        name: 'Launch PMS Owner',
        email: 'launch-owner@lux.test',
        password: 'test-password',
        role: 'DEVELOPER',
        emailVerified: true,
      },
    });

    const outsider = await prisma.user.create({
      data: {
        name: 'Launch Outsider',
        email: 'launch-outsider@lux.test',
        password: 'test-password',
        role: 'USER',
        emailVerified: true,
      },
    });

    const tenantPortalUser = await prisma.user.create({
      data: {
        name: 'Launch Tenant Portal User',
        email: 'launch-tenant@lux.test',
        password: 'test-password',
        role: 'USER',
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: 'launch-pms-company',
        nameEn: 'Launch PMS Company',
        verified: true,
        featured: false,
      },
    });

    const otherCompany = await prisma.developerCompany.create({
      data: {
        slug: 'other-launch-pms-company',
        nameEn: 'Other Launch PMS Company',
        verified: true,
        featured: false,
      },
    });

    const otherProperty = await prisma.pmsProperty.create({
      data: {
        companyId: otherCompany.id,
        name: 'Other Company Property',
        code: 'OTHER-001',
      },
    });

    const adminToken = signToken(admin);
    const ownerToken = signToken(pmsOwner);
    const outsiderToken = signToken(outsider);

    await request(app)
      .patch(`/api/pms/admin/companies/${company.id}/entitlement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE', notes: 'Launch smoke activation' })
      .expect(200);

    await request(app)
      .post(`/api/pms/admin/companies/${company.id}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: pmsOwner.email, role: 'PMS_OWNER' })
      .expect(201);

    const propertyResponse = await request(app)
      .post('/api/pms/properties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        companyId: company.id,
        name: 'Launch Tower',
        code: 'LAUNCH-TOWER',
        propertyType: 'Residential',
        city: 'Muscat',
        area: 'Al Mouj',
      })
      .expect(201);

    const property = propertyResponse.body.property;
    expect(property.companyId).toBe(company.id);

    await request(app)
      .get(`/api/pms/properties/${otherProperty.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);

    await request(app)
      .get(`/api/pms/properties/${property.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    const unitResponse = await request(app)
      .post(`/api/pms/properties/${property.id}/units`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        unitNumber: 'A-101',
        unitName: 'Launch Suite',
        bedrooms: 2,
        bathrooms: 2,
        areaSqm: 110,
        status: 'VACANT',
        rentAmount: 750,
        currency: 'OMR',
      })
      .expect(201);

    const unit = unitResponse.body.unit;

    const tenantResponse = await request(app)
      .post('/api/pms/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        companyId: company.id,
        fullName: 'Launch Tenant',
        email: tenantPortalUser.email,
        phone: '+968 9000 1111',
      })
      .expect(201);

    const tenant = tenantResponse.body.tenant;

    await request(app)
      .post(`/api/pms/tenants/${tenant.id}/portal-access`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: tenantPortalUser.email, active: true })
      .expect(201);

    const leaseResponse = await request(app)
      .post('/api/pms/leases')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        companyId: company.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        title: 'Launch Lease',
        status: 'ACTIVE',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2027-06-30T00:00:00.000Z',
        rentFrequency: 'MONTHLY',
        rentAmount: 750,
        currency: 'OMR',
        securityDeposit: 750,
        dueDayOfMonth: 5,
        generateRentDueItems: true,
      })
      .expect(201);

    const lease = leaseResponse.body.lease;
    expect(lease.status).toBe('ACTIVE');

    const rentDueResponse = await request(app)
      .get(`/api/pms/leases/${lease.id}/rent-due`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(rentDueResponse.body.rentDueItems.length).toBeGreaterThan(0);
    const firstRentDueItem = rentDueResponse.body.rentDueItems[0];

    const paymentResponse = await request(app)
      .post(`/api/pms/rent-due/${firstRentDueItem.id}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 250, method: 'CASH', referenceNumber: 'SMOKE-RENT-001' })
      .expect(201);

    expect(paymentResponse.body.payment.status).toBe('CONFIRMED');
    expect(paymentResponse.body.receipt.receiptNumber).toBeTruthy();

    const workOrderResponse = await request(app)
      .post('/api/pms/maintenance')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        companyId: company.id,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        title: 'Launch AC maintenance',
        priority: 'HIGH',
        status: 'OPEN',
        targetDate: '2026-07-15T00:00:00.000Z',
      })
      .expect(201);

    const workOrder = workOrderResponse.body.workOrder;
    expect(workOrder.property.id).toBe(property.id);

    const documentResponse = await request(app)
      .post('/api/pms/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        companyId: company.id,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        type: 'LEASE_AGREEMENT',
        title: 'Launch lease agreement',
        fileUrl: '/uploads/launch-lease.pdf',
        status: 'ACTIVE',
      })
      .expect(201);

    expect(documentResponse.body.document.tenant.id).toBe(tenant.id);

    const templateResponse = await request(app)
      .post('/api/pms/communication-templates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        companyId: company.id,
        name: 'Launch rent reminder',
        channel: 'EMAIL',
        type: 'rent',
        subject: 'Rent reminder for {{unitLabel}}',
        body: 'Hello {{tenantName}}, {{amount}} {{currency}} is due on {{dueDate}}.',
        active: true,
      })
      .expect(201);

    await request(app)
      .post('/api/pms/communication-templates/preview')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        companyId: company.id,
        templateId: templateResponse.body.template.id,
        tenantId: tenant.id,
        rentDueItemId: firstRentDueItem.id,
      })
      .expect(200);

    await request(app)
      .get(`/api/pms/reports/summary?companyId=${company.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const overviewResponse = await request(app)
      .get(`/api/pms/overview?companyId=${company.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(overviewResponse.body.metrics.totalPmsProperties).toBe(1);
    expect(overviewResponse.body.metrics.totalPmsTenants).toBe(1);
    expect(overviewResponse.body.metrics.activePmsLeases).toBe(1);
  });
});

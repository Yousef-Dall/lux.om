import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signToken } from "../src/middleware/auth";

const app = createApp();
const TEST_PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

async function clearPmsTestDatabase() {
  await prisma.domainAuditEvent.deleteMany();
  await prisma.pmsOwnerStatement.deleteMany();
  await prisma.crmActivity.deleteMany();
  await prisma.crmLead.deleteMany();
  await prisma.crmContact.deleteMany();
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
  await prisma.pmsMoveChecklistItem.deleteMany();
  await prisma.pmsDocument.deleteMany();
  await prisma.pmsInspection.deleteMany();
  await prisma.pmsAccountingLedgerEntry.deleteMany();
  await prisma.pmsMaintenanceQuote.deleteMany();
  await prisma.pmsWorkOrder.deleteMany();
  await prisma.pmsVendor.deleteMany();
  await prisma.pmsTenantPortalAccess.deleteMany();
  await prisma.pmsCommunicationLog.deleteMany();
  await prisma.pmsCommunicationTemplate.deleteMany();
  await prisma.pmsImportBatch.deleteMany();
  await prisma.pmsPolicy.deleteMany();
  await prisma.pmsAccountingLedgerEntry.deleteMany();
  await prisma.pmsMaintenanceQuote.deleteMany();
  await prisma.pmsRentPayment.deleteMany();
  await prisma.pmsMoveChecklistItem.deleteMany();
  await prisma.pmsDocument.deleteMany();
  await prisma.pmsRentDueItem.deleteMany();
  await prisma.pmsLease.deleteMany();
  await prisma.pmsTenant.deleteMany();
  await prisma.pmsUnit.deleteMany();
  await prisma.pmsProperty.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.developerProjectImage.deleteMany();
  await prisma.developerProject.deleteMany();
  await prisma.pmsRentPayment.deleteMany();
  await prisma.pmsRentDueItem.deleteMany();
  await prisma.pmsLease.deleteMany();
  await prisma.pmsTenantPortalAccess.deleteMany();
  await prisma.pmsTenant.deleteMany();
  await prisma.pmsUnit.deleteMany();
  await prisma.pmsProperty.deleteMany();
  await prisma.pmsVendor.deleteMany();
  await prisma.pmsMemberPermission.deleteMany();
  await prisma.pmsMemberPropertyAccess.deleteMany();
  await prisma.pmsPortfolioProperty.deleteMany();
  await prisma.pmsPortfolio.deleteMany();
  await prisma.pmsCompanyMember.deleteMany();
  await prisma.pmsCompanyEntitlement.deleteMany();
  await prisma.travelAgency.deleteMany();
  await prisma.developerCompany.deleteMany();
  await prisma.landmark.deleteMany();
  await prisma.oauthLoginCode.deleteMany();
  await prisma.user.deleteMany();
}

describe("PMS company entitlement access architecture", () => {
  beforeEach(async () => {
    await clearPmsTestDatabase();
  });

  it("blocks non-PMS users from the PMS overview", async () => {
    const customer = await prisma.user.create({
      data: {
        name: "PMS Customer",
        email: "pms-customer@lux.test",
        password: "test-password",
        role: "USER",
        emailVerified: true,
      },
    });

    const token = signToken(customer);

    await request(app)
      .get("/api/pms/overview")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("lets admins enable PMS for a company and grant scoped staff access", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "PMS Admin",
        email: "pms-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const developerUser = await prisma.user.create({
      data: {
        name: "PMS Developer",
        email: "pms-developer@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "pms-test-developer",
        nameEn: "PMS Test Developer",
        verified: true,
        featured: false,
      },
    });

    await prisma.developerProject.create({
      data: {
        slug: "pms-test-project",
        nameEn: "PMS Test Project",
        locationEn: "Muscat",
        status: "APPROVED",
        developerId: company.id,
        ownerId: developerUser.id,
      },
    });

    await prisma.listing.create({
      data: {
        slug: "pms-test-listing",
        title: "PMS Test Listing",
        titleEn: "PMS Test Listing",
        description: "A PMS linked property for integration coverage.",
        type: "Apartment",
        typeEn: "Apartment",
        transaction: "Rent",
        location: "Muscat",
        locationEn: "Muscat",
        price: "OMR 900/month",
        priceAmount: "900",
        priceCurrency: "OMR",
        beds: 2,
        baths: 2,
        sqm: 120,
        image: "https://example.com/pms.jpg",
        status: "APPROVED",
        ownerId: developerUser.id,
        developerId: company.id,
      },
    });

    const adminToken = signToken(admin);

    const entitlementResponse = await request(app)
      .patch(`/api/pms/admin/companies/${company.id}/entitlement`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "ACTIVE",
        notes: "Integration PMS activation",
      })
      .expect(200);

    expect(entitlementResponse.body.entitlement.status).toBe("ACTIVE");

    const memberResponse = await request(app)
      .post(`/api/pms/admin/companies/${company.id}/members`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: developerUser.email,
        role: "PMS_MANAGER",
      })
      .expect(201);

    expect(memberResponse.body.member.role).toBe("PMS_MANAGER");

    const developerToken = signToken(developerUser);
    const overviewResponse = await request(app)
      .get("/api/pms/overview")
      .set("Authorization", `Bearer ${developerToken}`)
      .expect(200);

    expect(overviewResponse.body.workspace.company.id).toBe(company.id);
    expect(overviewResponse.body.workspace.member.role).toBe("PMS_MANAGER");
    expect(overviewResponse.body.metrics.totalListings).toBe(1);
    expect(overviewResponse.body.metrics.approvedProjects).toBe(1);

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${developerToken}`)
      .expect(200);

    expect(meResponse.body.user.pmsAccess.hasAccess).toBe(true);
  });

  it("removes PMS route access when the company entitlement is suspended", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "PMS Suspend Admin",
        email: "pms-suspend-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const staff = await prisma.user.create({
      data: {
        name: "PMS Staff",
        email: "pms-staff@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "pms-suspended-company",
        nameEn: "PMS Suspended Company",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: "ACTIVE",
        enabledAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: company.id,
        userId: staff.id,
        role: "PMS_VIEWER",
        active: true,
        createdById: admin.id,
      },
    });

    const staffToken = signToken(staff);

    await request(app)
      .get("/api/pms/overview")
      .set("Authorization", `Bearer ${staffToken}`)
      .expect(200);

    await request(app)
      .patch(`/api/pms/admin/companies/${company.id}/entitlement`)
      .set("Authorization", `Bearer ${signToken(admin)}`)
      .send({
        status: "SUSPENDED",
        notes: "Billing hold",
      })
      .expect(200);

    await request(app)
      .get("/api/pms/overview")
      .set("Authorization", `Bearer ${staffToken}`)
      .expect(403);
  });

  it("lets PMS managers create private properties and units without publishing marketplace listings", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "PMS Inventory Admin",
        email: "pms-inventory-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "PMS Inventory Manager",
        email: "pms-inventory-manager@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "pms-inventory-company",
        nameEn: "PMS Inventory Company",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: "ACTIVE",
        enabledAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: company.id,
        userId: manager.id,
        role: "PMS_MANAGER",
        active: true,
        createdById: admin.id,
      },
    });

    const token = signToken(manager);
    const propertyResponse = await request(app)
      .post("/api/pms/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyId: company.id,
        name: "Al Mouj Managed Building A",
        code: "AM-A",
        propertyType: "Apartment building",
        city: "Muscat",
        area: "Al Mouj",
        addressLine: "Block A, Al Mouj",
        mapGoogleUrl: "https://maps.google.com/?q=23.626,58.278",
        latitude: 23.626,
        longitude: 58.278,
      })
      .expect(201);

    expect(propertyResponse.body.property.name).toBe(
      "Al Mouj Managed Building A",
    );
    expect(propertyResponse.body.property.counts.units).toBe(0);

    await request(app)
      .post(`/api/pms/properties/${propertyResponse.body.property.id}/units`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        unitNumber: "A-101",
        floor: "1",
        bedrooms: 2,
        bathrooms: 2,
        areaSqm: 118,
        status: "VACANT",
        rentAmount: 850,
        currency: "OMR",
      })
      .expect(201);

    await request(app)
      .post(`/api/pms/properties/${propertyResponse.body.property.id}/units`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        unitNumber: "A-102",
        floor: "1",
        bedrooms: 1,
        bathrooms: 1,
        areaSqm: 74,
        status: "VACANT",
        rentAmount: 620,
        currency: "OMR",
      })
      .expect(201);

    await request(app)
      .post(`/api/pms/properties/${propertyResponse.body.property.id}/units`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        unitNumber: "A-103",
        floor: "1",
        bedrooms: 1,
        bathrooms: 1,
        areaSqm: 70,
        status: "MAINTENANCE",
      })
      .expect(201);

    const unitsResponse = await request(app)
      .get(`/api/pms/properties/${propertyResponse.body.property.id}/units`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(unitsResponse.body.units).toHaveLength(3);

    const overviewResponse = await request(app)
      .get(`/api/pms/overview?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(overviewResponse.body.metrics.totalPmsProperties).toBe(1);
    expect(overviewResponse.body.metrics.totalPmsUnits).toBe(3);
    expect(overviewResponse.body.metrics.vacantPmsUnits).toBe(3);
    expect(overviewResponse.body.metrics.occupiedPmsUnits).toBe(0);
    expect(overviewResponse.body.metrics.maintenancePmsUnits).toBe(1);
    expect(overviewResponse.body.metrics.pmsOccupancyRate).toBe(0);

    const publicListings = await request(app).get("/api/listings").expect(200);
    expect(
      publicListings.body.checklistItems ?? publicListings.body.listings ?? [],
    ).toHaveLength(0);
  });

  it("keeps PMS inventory access scoped to the member company", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "PMS Scope Admin",
        email: "pms-scope-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "PMS Scope Manager",
        email: "pms-scope-manager@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });

    const companyA = await prisma.developerCompany.create({
      data: {
        slug: "pms-scope-company-a",
        nameEn: "PMS Scope Company A",
        verified: true,
      },
    });
    const companyB = await prisma.developerCompany.create({
      data: {
        slug: "pms-scope-company-b",
        nameEn: "PMS Scope Company B",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.createMany({
      data: [
        {
          companyId: companyA.id,
          status: "ACTIVE",
          enabledAt: new Date(),
          createdById: admin.id,
          updatedById: admin.id,
        },
        {
          companyId: companyB.id,
          status: "ACTIVE",
          enabledAt: new Date(),
          createdById: admin.id,
          updatedById: admin.id,
        },
      ],
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: companyA.id,
        userId: manager.id,
        role: "PMS_MANAGER",
        active: true,
        createdById: admin.id,
      },
    });

    const companyBProperty = await prisma.pmsProperty.create({
      data: {
        companyId: companyB.id,
        name: "Company B private tower",
        code: "B-TOWER",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const token = signToken(manager);

    await request(app)
      .get(`/api/pms/properties?companyId=${companyB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app)
      .get(`/api/pms/properties/${companyBProperty.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app)
      .patch(`/api/pms/properties/${companyBProperty.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Should not update",
      })
      .expect(403);
  });

  it("blocks PMS viewers from changing inventory while allowing read access", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "PMS Viewer Admin",
        email: "pms-viewer-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const viewer = await prisma.user.create({
      data: {
        name: "PMS Viewer",
        email: "pms-viewer@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "pms-viewer-company",
        nameEn: "PMS Viewer Company",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: "ACTIVE",
        enabledAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: company.id,
        userId: viewer.id,
        role: "PMS_VIEWER",
        active: true,
        createdById: admin.id,
      },
    });

    const property = await prisma.pmsProperty.create({
      data: {
        companyId: company.id,
        name: "Viewer readable building",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const token = signToken(viewer);

    await request(app)
      .get(`/api/pms/properties/${property.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .post("/api/pms/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyId: company.id,
        name: "Viewer should not create",
      })
      .expect(403);
  });

  it("lets PMS managers create tenants, leases, and private rent due items", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "PMS Lease Admin",
        email: "pms-lease-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "PMS Lease Manager",
        email: "pms-lease-manager@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "pms-lease-company",
        nameEn: "PMS Lease Company",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: "ACTIVE",
        enabledAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: company.id,
        userId: manager.id,
        role: "PMS_MANAGER",
        active: true,
        createdById: admin.id,
      },
    });

    const property = await prisma.pmsProperty.create({
      data: {
        companyId: company.id,
        name: "Tenant tower",
        code: "TENANT-TOWER",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const unit = await prisma.pmsUnit.create({
      data: {
        companyId: company.id,
        propertyId: property.id,
        unitNumber: "T-101",
        status: "VACANT",
        occupancyStatus: "VACANT",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const token = signToken(manager);
    const tenantResponse = await request(app)
      .post("/api/pms/tenants")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyId: company.id,
        fullName: "Aisha Al Balushi",
        phone: "+96890000000",
        email: "aisha.tenant@lux.test",
        nationality: "Omani",
        nationalId: "OM-123456",
        emergencyContactName: "Salim Al Balushi",
        emergencyContactPhone: "+96891111111",
      })
      .expect(201);

    expect(tenantResponse.body.tenant.fullName).toBe("Aisha Al Balushi");

    const leaseResponse = await request(app)
      .post("/api/pms/leases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyId: company.id,
        tenantId: tenantResponse.body.tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        title: "T-101 annual lease",
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-09-30T00:00:00.000Z",
        rentFrequency: "MONTHLY",
        rentAmount: 750,
        securityDeposit: 750,
        currency: "OMR",
        dueDayOfMonth: 1,
      })
      .expect(201);

    expect(leaseResponse.body.lease.tenant.id).toBe(
      tenantResponse.body.tenant.id,
    );
    expect(leaseResponse.body.lease.counts.rentDueItems).toBe(3);

    const refreshedUnit = await prisma.pmsUnit.findUniqueOrThrow({
      where: { id: unit.id },
    });
    expect(refreshedUnit.status).toBe("OCCUPIED");
    expect(refreshedUnit.occupancyStatus).toBe("OCCUPIED");

    const rentDueResponse = await request(app)
      .get(`/api/pms/leases/${leaseResponse.body.lease.id}/rent-due`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(rentDueResponse.body.rentDueItems).toHaveLength(3);
    expect(rentDueResponse.body.rentDueItems[0].amount).toBe("750");

    const partialPaymentResponse = await request(app)
      .post(`/api/pms/rent-due/${rentDueResponse.body.rentDueItems[0].id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        amount: 250,
        method: "BANK_TRANSFER",
        referenceNumber: "BANK-250",
      })
      .expect(201);

    expect(partialPaymentResponse.body.rentDueItem.status).toBe("PARTIALLY_PAID");
    expect(partialPaymentResponse.body.rentDueItem.paidAmount).toBe("250");

    await request(app)
      .post(`/api/pms/rent-due/${rentDueResponse.body.rentDueItems[0].id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        amount: 501,
        method: "CASH",
      })
      .expect(400);

    const paymentResponse = await request(app)
      .post(`/api/pms/rent-due/${rentDueResponse.body.rentDueItems[0].id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        amount: 500,
        method: "CASH",
      })
      .expect(201);

    expect(paymentResponse.body.rentDueItem.status).toBe("PAID");
    expect(paymentResponse.body.rentDueItem.paidAt).toBeTruthy();
    expect(paymentResponse.body.receipt.receiptNumber).toBeTruthy();

    const receiptResponse = await request(app)
      .get(`/api/pms/rent-payments/${paymentResponse.body.payment.id}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(receiptResponse.body.receipt.amount).toBe("500");

    const overviewResponse = await request(app)
      .get(`/api/pms/overview?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(overviewResponse.body.metrics.totalPmsTenants).toBe(1);
    expect(overviewResponse.body.metrics.activePmsLeases).toBe(1);
    expect(overviewResponse.body.metrics.unpaidPmsRentDueItems).toBe(2);
    expect(overviewResponse.body.metrics.paidPmsRentDueItems).toBe(1);
    expect(overviewResponse.body.metrics.pmsRentCollectedAmount).toBe("750");
  });

  it("keeps PMS tenants, leases, and rent due items scoped to the member company", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "PMS Tenant Scope Admin",
        email: "pms-tenant-scope-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "PMS Tenant Scope Manager",
        email: "pms-tenant-scope-manager@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });

    const companyA = await prisma.developerCompany.create({
      data: {
        slug: "pms-tenant-scope-a",
        nameEn: "PMS Tenant Scope A",
        verified: true,
      },
    });
    const companyB = await prisma.developerCompany.create({
      data: {
        slug: "pms-tenant-scope-b",
        nameEn: "PMS Tenant Scope B",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.createMany({
      data: [
        {
          companyId: companyA.id,
          status: "ACTIVE",
          enabledAt: new Date(),
          createdById: admin.id,
          updatedById: admin.id,
        },
        {
          companyId: companyB.id,
          status: "ACTIVE",
          enabledAt: new Date(),
          createdById: admin.id,
          updatedById: admin.id,
        },
      ],
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: companyA.id,
        userId: manager.id,
        role: "PMS_MANAGER",
        active: true,
        createdById: admin.id,
      },
    });

    const companyBProperty = await prisma.pmsProperty.create({
      data: {
        companyId: companyB.id,
        name: "Company B tenancy building",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    const companyBUnit = await prisma.pmsUnit.create({
      data: {
        companyId: companyB.id,
        propertyId: companyBProperty.id,
        unitNumber: "B-1",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    const companyBTenant = await prisma.pmsTenant.create({
      data: {
        companyId: companyB.id,
        fullName: "Company B Tenant",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    const companyBLease = await prisma.pmsLease.create({
      data: {
        companyId: companyB.id,
        tenantId: companyBTenant.id,
        propertyId: companyBProperty.id,
        unitId: companyBUnit.id,
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        rentFrequency: "MONTHLY",
        rentAmount: 500,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    const companyBRentDue = await prisma.pmsRentDueItem.create({
      data: {
        companyId: companyB.id,
        leaseId: companyBLease.id,
        tenantId: companyBTenant.id,
        propertyId: companyBProperty.id,
        unitId: companyBUnit.id,
        dueDate: new Date("2026-07-01T00:00:00.000Z"),
        amount: 500,
        paidAmount: 0,
        currency: "OMR",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const token = signToken(manager);

    await request(app)
      .get(`/api/pms/tenants/${companyBTenant.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app)
      .get(`/api/pms/leases/${companyBLease.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app)
      .post(`/api/pms/rent-due/${companyBRentDue.id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 500, method: "BANK_TRANSFER" })
      .expect(403);
  });


  it("lets PMS managers create work orders, templates, policies, inspections, and real reports", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "PMS Ops Admin",
        email: "pms-ops-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "PMS Ops Manager",
        email: "pms-ops-manager@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "pms-ops-company",
        nameEn: "PMS Ops Company",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: "ACTIVE",
        enabledAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: company.id,
        userId: manager.id,
        role: "PMS_MANAGER",
        active: true,
        createdById: admin.id,
      },
    });

    const property = await prisma.pmsProperty.create({
      data: {
        companyId: company.id,
        name: "Operations Tower",
        code: "OPS-TOWER",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const unit = await prisma.pmsUnit.create({
      data: {
        companyId: company.id,
        propertyId: property.id,
        unitNumber: "OPS-101",
        status: "OCCUPIED",
        occupancyStatus: "OCCUPIED",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const tenant = await prisma.pmsTenant.create({
      data: {
        companyId: company.id,
        fullName: "Ops Tenant",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const lease = await prisma.pmsLease.create({
      data: {
        companyId: company.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        rentFrequency: "MONTHLY",
        rentAmount: 900,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const paidRentDueItem = await prisma.pmsRentDueItem.create({
      data: {
        companyId: company.id,
        leaseId: lease.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        dueDate: new Date("2026-07-01T00:00:00.000Z"),
        amount: 900,
        paidAmount: 900,
        status: "PAID",
        currency: "OMR",
        paidAt: new Date("2026-07-02T00:00:00.000Z"),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsRentPayment.create({
      data: {
        companyId: company.id,
        rentDueItemId: paidRentDueItem.id,
        leaseId: lease.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        amount: 900,
        currency: "OMR",
        method: "BANK_TRANSFER",
        status: "CONFIRMED",
        paidAt: new Date("2026-07-02T00:00:00.000Z"),
        confirmedAt: new Date("2026-07-02T00:00:00.000Z"),
        receiptNumber: "PMS-RENT-TEST-001",
        recordedById: manager.id,
      },
    });

    await prisma.pmsRentDueItem.create({
      data: {
        companyId: company.id,
        leaseId: lease.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        dueDate: new Date("2026-07-03T00:00:00.000Z"),
        amount: 900,
        paidAmount: 0,
        status: "OVERDUE",
        currency: "OMR",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const token = signToken(manager);
    const workOrderResponse = await request(app)
      .post("/api/pms/maintenance")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyId: company.id,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        title: "AC repair",
        description: "Tenant reported cooling issue.",
        priority: "HIGH",
        assignedToText: "Internal maintenance",
        vendorText: "Vendor A",
        cost: 120,
        currency: "OMR",
      })
      .expect(201);

    expect(workOrderResponse.body.workOrder.title).toBe("AC repair");
    expect(workOrderResponse.body.workOrder.property.id).toBe(property.id);

    const resolvedResponse = await request(app)
      .patch(`/api/pms/maintenance/${workOrderResponse.body.workOrder.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "RESOLVED",
        cost: 125,
      })
      .expect(200);

    expect(resolvedResponse.body.workOrder.status).toBe("RESOLVED");
    expect(resolvedResponse.body.workOrder.resolvedAt).toBeTruthy();

    const templateResponse = await request(app)
      .post("/api/pms/communication-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyId: company.id,
        name: "Overdue rent WhatsApp",
        channel: "WHATSAPP",
        type: "OVERDUE_RENT",
        body: "Hello {{tenantName}}, your rent is overdue.",
      })
      .expect(201);

    expect(templateResponse.body.template.channel).toBe("WHATSAPP");

    const policyResponse = await request(app)
      .post("/api/pms/policies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyId: company.id,
        title: "Late fee policy foundation",
        category: "PAYMENT",
        body: "Late fee rules are reviewed manually before posting.",
      })
      .expect(201);

    expect(policyResponse.body.policy.category).toBe("PAYMENT");

    const inspectionResponse = await request(app)
      .post("/api/pms/inspections")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyId: company.id,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        title: "Move-in inspection",
        status: "NEEDS_ACTION",
        feedback: "Paint touch-up needed.",
        rating: 3,
      })
      .expect(201);

    expect(inspectionResponse.body.inspection.status).toBe("NEEDS_ACTION");

    const reportsResponse = await request(app)
      .get(`/api/pms/reports/summary?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(reportsResponse.body.accounting.incomeCollected).toBe("900");
    expect(reportsResponse.body.accounting.maintenanceCosts).toBe("125");
    expect(reportsResponse.body.reports.maintenance.resolved).toBe(1);
    expect(reportsResponse.body.reports.inspections.needsAction).toBe(1);
    expect(reportsResponse.body.reports.communications.activeTemplates).toBe(1);
    expect(reportsResponse.body.reports.policies.activePolicies).toBe(1);
    expect(reportsResponse.body.reports.overdueTopList).toHaveLength(1);
  });

  it("keeps PMS operational resources company-scoped and role restricted", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "PMS Ops Scope Admin",
        email: "pms-ops-scope-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "PMS Ops Scope Manager",
        email: "pms-ops-scope-manager@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });

    const viewer = await prisma.user.create({
      data: {
        name: "PMS Ops Viewer",
        email: "pms-ops-viewer@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const companyA = await prisma.developerCompany.create({
      data: {
        slug: "pms-ops-scope-a",
        nameEn: "PMS Ops Scope A",
        verified: true,
      },
    });
    const companyB = await prisma.developerCompany.create({
      data: {
        slug: "pms-ops-scope-b",
        nameEn: "PMS Ops Scope B",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.createMany({
      data: [
        {
          companyId: companyA.id,
          status: "ACTIVE",
          enabledAt: new Date(),
          createdById: admin.id,
          updatedById: admin.id,
        },
        {
          companyId: companyB.id,
          status: "ACTIVE",
          enabledAt: new Date(),
          createdById: admin.id,
          updatedById: admin.id,
        },
      ],
    });

    await prisma.pmsCompanyMember.createMany({
      data: [
        {
          companyId: companyA.id,
          userId: manager.id,
          role: "PMS_MANAGER",
          active: true,
          createdById: admin.id,
        },
        {
          companyId: companyA.id,
          userId: viewer.id,
          role: "PMS_VIEWER",
          active: true,
          createdById: admin.id,
        },
      ],
    });

    const companyBProperty = await prisma.pmsProperty.create({
      data: {
        companyId: companyB.id,
        name: "Company B ops property",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const companyBWorkOrder = await prisma.pmsWorkOrder.create({
      data: {
        companyId: companyB.id,
        propertyId: companyBProperty.id,
        title: "Company B private issue",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const managerToken = signToken(manager);
    const viewerToken = signToken(viewer);

    await request(app)
      .get(`/api/pms/maintenance?companyId=${companyB.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(403);

    await request(app)
      .patch(`/api/pms/maintenance/${companyBWorkOrder.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "RESOLVED" })
      .expect(403);

    await request(app)
      .post("/api/pms/policies")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        companyId: companyA.id,
        title: "Viewer cannot create policy",
        category: "GENERAL",
        body: "Should fail.",
      })
      .expect(403);

    await request(app)
      .get(`/api/pms/reports/summary?companyId=${companyA.id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);
  });


  it("enforces Stage 11 PMS role boundaries and audits sensitive changes", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "Stage 11 Admin",
        email: "stage11-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const accountant = await prisma.user.create({
      data: {
        name: "Stage 11 Accountant",
        email: "stage11-accountant@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const maintenance = await prisma.user.create({
      data: {
        name: "Stage 11 Maintenance",
        email: "stage11-maintenance@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const viewer = await prisma.user.create({
      data: {
        name: "Stage 11 Viewer",
        email: "stage11-viewer@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "stage11-role-company",
        nameEn: "Stage 11 Role Company",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: "ACTIVE",
        enabledAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsCompanyMember.createMany({
      data: [
        {
          companyId: company.id,
          userId: accountant.id,
          role: "PMS_ACCOUNTANT",
          active: true,
          createdById: admin.id,
        },
        {
          companyId: company.id,
          userId: maintenance.id,
          role: "PMS_MAINTENANCE",
          active: true,
          createdById: admin.id,
        },
        {
          companyId: company.id,
          userId: viewer.id,
          role: "PMS_VIEWER",
          active: true,
          createdById: admin.id,
        },
      ],
    });

    const property = await prisma.pmsProperty.create({
      data: {
        companyId: company.id,
        name: "Stage 11 Role Property",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const unit = await prisma.pmsUnit.create({
      data: {
        companyId: company.id,
        propertyId: property.id,
        unitNumber: "A-101",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const tenant = await prisma.pmsTenant.create({
      data: {
        companyId: company.id,
        fullName: "Stage 11 Tenant",
        active: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const lease = await prisma.pmsLease.create({
      data: {
        companyId: company.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        title: "Stage 11 Lease",
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        rentAmount: 600,
        currency: "OMR",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const rentDueItem = await prisma.pmsRentDueItem.create({
      data: {
        companyId: company.id,
        leaseId: lease.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        dueDate: new Date("2026-02-01T00:00:00.000Z"),
        amount: 600,
        currency: "OMR",
        status: "UNPAID",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const accountantToken = signToken(accountant);
    const maintenanceToken = signToken(maintenance);
    const viewerToken = signToken(viewer);

    await request(app)
      .post(`/api/pms/rent-due/${rentDueItem.id}/payments`)
      .set("Authorization", `Bearer ${accountantToken}`)
      .send({ amount: 600, method: "BANK_TRANSFER" })
      .expect(201);

    await request(app)
      .post("/api/pms/leases")
      .set("Authorization", `Bearer ${accountantToken}`)
      .send({
        companyId: company.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        title: "Accountant blocked lease",
        startDate: "2026-03-01T00:00:00.000Z",
        rentAmount: 700,
        currency: "OMR",
      })
      .expect(403);

    await request(app)
      .post("/api/pms/maintenance")
      .set("Authorization", `Bearer ${accountantToken}`)
      .send({
        companyId: company.id,
        propertyId: property.id,
        title: "Accountant blocked maintenance",
      })
      .expect(403);

    await request(app)
      .post("/api/pms/maintenance")
      .set("Authorization", `Bearer ${maintenanceToken}`)
      .send({
        companyId: company.id,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        title: "Maintenance allowed work order",
        priority: "HIGH",
      })
      .expect(201);

    await request(app)
      .post(`/api/pms/rent-due/${rentDueItem.id}/payments`)
      .set("Authorization", `Bearer ${maintenanceToken}`)
      .send({ amount: 600, method: "CASH" })
      .expect(403);

    await request(app)
      .post(`/api/pms/rent-due/${rentDueItem.id}/payments`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ amount: 600, method: "CASH" })
      .expect(403);

    await request(app)
      .get(`/api/pms/maintenance?companyId=${company.id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    await request(app)
      .post("/api/pms/maintenance")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        companyId: company.id,
        propertyId: property.id,
        title: "Viewer blocked work order",
      })
      .expect(403);

    const auditEvents = await prisma.domainAuditEvent.findMany({
      where: {
        companyId: company.id,
        domain: "PMS",
        action: "create",
        entityType: { in: ["pmsRentPayment", "pmsWorkOrder"] },
      },
      select: { metadata: true },
    });
    const auditTitles = auditEvents
      .map((event) => (event.metadata as { title?: unknown } | null)?.title)
      .filter((title): title is string => typeof title === "string")
      .sort();

    expect(auditTitles).toEqual([
      "PMS maintenance work order created",
      "PMS rent payment recorded",
    ]);
  });

  it("supports Stage 14 PMS accounting ledger and owner statements with strict permissions", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "Stage 14 Admin",
        email: "stage14-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const accountant = await prisma.user.create({
      data: {
        name: "Stage 14 Accountant",
        email: "stage14-accountant@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const viewer = await prisma.user.create({
      data: {
        name: "Stage 14 Viewer",
        email: "stage14-viewer@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const maintenance = await prisma.user.create({
      data: {
        name: "Stage 14 Maintenance",
        email: "stage14-maintenance@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: { slug: "stage14-ledger-company", nameEn: "Stage 14 Ledger Company", verified: true },
    });
    const otherCompany = await prisma.developerCompany.create({
      data: { slug: "stage14-other-company", nameEn: "Stage 14 Other Company", verified: true },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: { companyId: company.id, status: "ACTIVE", enabledAt: new Date(), createdById: admin.id, updatedById: admin.id },
    });
    await prisma.pmsCompanyEntitlement.create({
      data: { companyId: otherCompany.id, status: "ACTIVE", enabledAt: new Date(), createdById: admin.id, updatedById: admin.id },
    });

    await prisma.pmsCompanyMember.createMany({
      data: [
        { companyId: company.id, userId: accountant.id, role: "PMS_ACCOUNTANT", active: true, createdById: admin.id },
        { companyId: company.id, userId: viewer.id, role: "PMS_VIEWER", active: true, createdById: admin.id },
        { companyId: company.id, userId: maintenance.id, role: "PMS_MAINTENANCE", active: true, createdById: admin.id },
      ],
    });

    const property = await prisma.pmsProperty.create({
      data: { companyId: company.id, name: "Statement Property", createdById: admin.id, updatedById: admin.id },
    });
    const otherProperty = await prisma.pmsProperty.create({
      data: { companyId: otherCompany.id, name: "Other Statement Property", createdById: admin.id, updatedById: admin.id },
    });
    const unit = await prisma.pmsUnit.create({
      data: { companyId: company.id, propertyId: property.id, unitNumber: "S-1", createdById: admin.id, updatedById: admin.id },
    });
    const tenant = await prisma.pmsTenant.create({
      data: { companyId: company.id, fullName: "Statement Tenant", active: true, createdById: admin.id, updatedById: admin.id },
    });
    const lease = await prisma.pmsLease.create({
      data: {
        companyId: company.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        title: "Statement Lease",
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        rentAmount: 1000,
        securityDeposit: 500,
        currency: "OMR",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    const rentDueItem = await prisma.pmsRentDueItem.create({
      data: {
        companyId: company.id,
        leaseId: lease.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        dueDate: new Date("2026-07-01T00:00:00.000Z"),
        amount: 1000,
        paidAmount: 0,
        currency: "OMR",
        status: "UNPAID",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    const workOrder = await prisma.pmsWorkOrder.create({
      data: {
        companyId: company.id,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        title: "Statement repair",
        status: "RESOLVED",
        cost: 150,
        currency: "OMR",
        resolvedAt: new Date("2026-07-05T00:00:00.000Z"),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const accountantToken = signToken(accountant);
    const viewerToken = signToken(viewer);
    const maintenanceToken = signToken(maintenance);

    await request(app)
      .post(`/api/pms/rent-due/${rentDueItem.id}/payments`)
      .set("Authorization", `Bearer ${accountantToken}`)
      .send({ amount: 700, method: "BANK_TRANSFER", paidAt: "2026-07-03T00:00:00.000Z" })
      .expect(201);

    const ledgerResponse = await request(app)
      .post("/api/pms/accounting/ledger")
      .set("Authorization", `Bearer ${accountantToken}`)
      .send({
        companyId: company.id,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        workOrderId: workOrder.id,
        type: "EXPENSE",
        category: "Utilities",
        amount: 25,
        currency: "OMR",
        transactionDate: "2026-07-06T00:00:00.000Z",
        referenceNumber: "UTIL-1",
      })
      .expect(201);

    expect(ledgerResponse.body.ledgerEntry.category).toBe("Utilities");

    await request(app)
      .post("/api/pms/accounting/ledger")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        companyId: company.id,
        type: "INCOME",
        category: "Other income",
        amount: 10,
        currency: "OMR",
        transactionDate: "2026-07-06T00:00:00.000Z",
      })
      .expect(403);

    await request(app)
      .get(`/api/pms/accounting/ledger?companyId=${company.id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    await request(app)
      .get(`/api/pms/accounting/ledger?companyId=${company.id}`)
      .set("Authorization", `Bearer ${maintenanceToken}`)
      .expect(403);

    await request(app)
      .post("/api/pms/accounting/ledger")
      .set("Authorization", `Bearer ${accountantToken}`)
      .send({
        companyId: company.id,
        propertyId: otherProperty.id,
        type: "EXPENSE",
        category: "Cross scope",
        amount: 10,
        currency: "OMR",
        transactionDate: "2026-07-07T00:00:00.000Z",
      })
      .expect(400);

    const statementResponse = await request(app)
      .get(`/api/pms/accounting/owner-statement?companyId=${company.id}&propertyId=${property.id}&month=2026-07`)
      .set("Authorization", `Bearer ${accountantToken}`)
      .expect(200);

    expect(statementResponse.body.statement.totals.rentCollected).toBe("700");
    expect(statementResponse.body.statement.totals.maintenanceCosts).toBe("150");
    expect(statementResponse.body.statement.totals.expenses).toBe("175");
    expect(statementResponse.body.statement.totals.outstandingRent).toBe("300");
    expect(statementResponse.body.statement.totals.netAmount).toBe("525");

    const reportsResponse = await request(app)
      .get(`/api/pms/reports/summary?companyId=${company.id}`)
      .set("Authorization", `Bearer ${accountantToken}`)
      .expect(200);

    expect(reportsResponse.body.accounting.incomeCollected).toBe("700");
    expect(reportsResponse.body.accounting.expenses).toBe("175");
  });

  it("supports Stage 11 PMS list pagination, search, filters, and sorting", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "Stage 11 List Admin",
        email: "stage11-list-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "Stage 11 List Manager",
        email: "stage11-list-manager@lux.test",
        password: "test-password",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "stage11-list-company",
        nameEn: "Stage 11 List Company",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: "ACTIVE",
        enabledAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: company.id,
        userId: manager.id,
        role: "PMS_MANAGER",
        active: true,
        createdById: admin.id,
      },
    });

    const property = await prisma.pmsProperty.create({
      data: {
        companyId: company.id,
        name: "Stage 11 List Property",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const unit = await prisma.pmsUnit.create({
      data: {
        companyId: company.id,
        propertyId: property.id,
        unitNumber: "B-201",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const tenant = await prisma.pmsTenant.create({
      data: {
        companyId: company.id,
        fullName: "Stage 11 List Tenant",
        active: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const lease = await prisma.pmsLease.create({
      data: {
        companyId: company.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        title: "Move lease",
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        rentAmount: 700,
        currency: "OMR",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsWorkOrder.createMany({
      data: [
        {
          companyId: company.id,
          propertyId: property.id,
          title: "Pump A repair",
          priority: "HIGH",
          createdById: admin.id,
          updatedById: admin.id,
        },
        {
          companyId: company.id,
          propertyId: property.id,
          title: "Pump B repair",
          priority: "MEDIUM",
          createdById: admin.id,
          updatedById: admin.id,
        },
        {
          companyId: company.id,
          propertyId: property.id,
          title: "Door handle",
          priority: "LOW",
          createdById: admin.id,
          updatedById: admin.id,
        },
      ],
    });

    await prisma.pmsCommunicationTemplate.createMany({
      data: [
        {
          companyId: company.id,
          name: "Rent email reminder",
          channel: "EMAIL",
          body: "Please pay rent.",
          createdById: admin.id,
          updatedById: admin.id,
        },
        {
          companyId: company.id,
          name: "Move SMS",
          channel: "SMS",
          body: "Move-in update.",
          createdById: admin.id,
          updatedById: admin.id,
        },
      ],
    });

    await prisma.pmsPolicy.createMany({
      data: [
        {
          companyId: company.id,
          title: "Payment rules",
          category: "PAYMENT",
          body: "Payment rules for tenants.",
          createdById: admin.id,
          updatedById: admin.id,
        },
        {
          companyId: company.id,
          title: "General conduct",
          category: "GENERAL",
          body: "Community notes.",
          createdById: admin.id,
          updatedById: admin.id,
        },
      ],
    });

    await prisma.pmsInspection.createMany({
      data: [
        {
          companyId: company.id,
          propertyId: property.id,
          unitId: unit.id,
          tenantId: tenant.id,
          leaseId: lease.id,
          title: "Move in inspection",
          status: "SCHEDULED",
          notes: "Move readiness check",
          createdById: admin.id,
          updatedById: admin.id,
        },
        {
          companyId: company.id,
          propertyId: property.id,
          title: "Safety inspection",
          status: "COMPLETED",
          feedback: "Completed",
          createdById: admin.id,
          updatedById: admin.id,
        },
      ],
    });

    const managerToken = signToken(manager);

    const firstMaintenancePage = await request(app)
      .get(`/api/pms/maintenance?companyId=${company.id}&search=Pump&sortBy=title&direction=asc&take=1&skip=0`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(firstMaintenancePage.body.pagination.total).toBe(2);
    expect(firstMaintenancePage.body.pagination.count).toBe(1);
    expect(firstMaintenancePage.body.workOrders[0].title).toBe("Pump A repair");

    const secondMaintenancePage = await request(app)
      .get(`/api/pms/maintenance?companyId=${company.id}&search=Pump&sortBy=title&direction=asc&take=1&skip=1`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(secondMaintenancePage.body.workOrders[0].title).toBe("Pump B repair");

    const templatesResponse = await request(app)
      .get(`/api/pms/communication-templates?companyId=${company.id}&search=rent&channel=EMAIL&sortBy=name&direction=asc`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(templatesResponse.body.pagination.total).toBe(1);
    expect(templatesResponse.body.templates[0].name).toBe("Rent email reminder");

    const policiesResponse = await request(app)
      .get(`/api/pms/policies?companyId=${company.id}&search=rules&category=PAYMENT&sortBy=title&direction=asc`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(policiesResponse.body.pagination.total).toBe(1);
    expect(policiesResponse.body.policies[0].title).toBe("Payment rules");

    const inspectionsResponse = await request(app)
      .get(`/api/pms/inspections?companyId=${company.id}&search=move&status=SCHEDULED&sortBy=title&direction=asc`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(inspectionsResponse.body.pagination.total).toBe(1);
    expect(inspectionsResponse.body.inspections[0].title).toBe("Move in inspection");

  });

  it("previews, logs, and scopes PMS communications", async () => {
    const owner = await prisma.user.create({
      data: { name: "Comms Owner", email: "comms-owner@lux.test", password: "test-password", role: "USER", emailVerified: true },
    });
    const tenantUser = await prisma.user.create({
      data: { name: "Comms Tenant", email: "comms-tenant@lux.test", password: "test-password", role: "USER", emailVerified: true },
    });
    const otherOwner = await prisma.user.create({
      data: { name: "Other Comms Owner", email: "other-comms-owner@lux.test", password: "test-password", role: "USER", emailVerified: true },
    });
    const company = await prisma.developerCompany.create({ data: { slug: "comms-company", nameEn: "Comms Company" } });
    const otherCompany = await prisma.developerCompany.create({ data: { slug: "other-comms-company", nameEn: "Other Comms Company" } });
    await prisma.pmsCompanyEntitlement.create({ data: { companyId: company.id, status: "ACTIVE", createdById: owner.id, updatedById: owner.id } });
    await prisma.pmsCompanyEntitlement.create({ data: { companyId: otherCompany.id, status: "ACTIVE", createdById: otherOwner.id, updatedById: otherOwner.id } });
    await prisma.pmsCompanyMember.create({ data: { companyId: company.id, userId: owner.id, role: "PMS_MANAGER", createdById: owner.id } });
    await prisma.pmsCompanyMember.create({ data: { companyId: otherCompany.id, userId: otherOwner.id, role: "PMS_MANAGER", createdById: otherOwner.id } });
    const property = await prisma.pmsProperty.create({ data: { companyId: company.id, name: "Comms Tower", createdById: owner.id, updatedById: owner.id } });
    const unit = await prisma.pmsUnit.create({ data: { companyId: company.id, propertyId: property.id, unitNumber: "101", createdById: owner.id, updatedById: owner.id } });
    const tenant = await prisma.pmsTenant.create({ data: { companyId: company.id, fullName: "Tenant Example", email: tenantUser.email, createdById: owner.id, updatedById: owner.id } });
    await prisma.pmsTenantPortalAccess.create({ data: { companyId: company.id, tenantId: tenant.id, userId: tenantUser.id, createdById: owner.id } });
    const lease = await prisma.pmsLease.create({ data: { companyId: company.id, tenantId: tenant.id, propertyId: property.id, unitId: unit.id, startDate: new Date("2026-07-01"), endDate: new Date("2026-12-31"), rentAmount: 500, currency: "OMR", createdById: owner.id, updatedById: owner.id } });
    const rentDueItem = await prisma.pmsRentDueItem.create({ data: { companyId: company.id, leaseId: lease.id, tenantId: tenant.id, propertyId: property.id, unitId: unit.id, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), amount: 500, currency: "OMR", status: "DUE_SOON", createdById: owner.id, updatedById: owner.id } });
    const token = signToken(owner);
    const otherToken = signToken(otherOwner);

    const templateResponse = await request(app)
      .post("/api/pms/communication-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, name: "Rent due notice", channel: "EMAIL", type: "rent", subject: "Rent for {{tenantName}}", body: "Please pay {{amount}} by {{dueDate}}." })
      .expect(201);

    const previewResponse = await request(app)
      .post("/api/pms/communication-templates/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, templateId: templateResponse.body.template.id, rentDueItemId: rentDueItem.id })
      .expect(200);
    expect(previewResponse.body.subject).toBe("Rent for Tenant Example");
    expect(previewResponse.body.body).toContain("500");

    const sendResponse = await request(app)
      .post("/api/pms/communication-logs/send")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, templateId: templateResponse.body.template.id, tenantId: tenant.id, rentDueItemId: rentDueItem.id, channel: "EMAIL", body: "Please pay {{amount}} by {{dueDate}}." })
      .expect(201);
    expect(sendResponse.body.log.tenant.fullName).toBe("Tenant Example");

    const logsResponse = await request(app)
      .get(`/api/pms/communication-logs?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(logsResponse.body.pagination.total).toBe(1);

    await request(app)
      .get(`/api/pms/communication-logs?companyId=${company.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(403);

    const remindersResponse = await request(app)
      .get(`/api/pms/communications/reminders?companyId=${company.id}&type=RENT_DUE_SOON&days=7`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(remindersResponse.body.candidates[0].rentDueItemId).toBe(rentDueItem.id);
  });


  it("scopes tenant portal access to the linked tenant records only", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "Tenant Portal Admin",
        email: "tenant-portal-admin@lux.test",
        password: "test-password",
        role: "ADMIN",
        emailVerified: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "Tenant Portal Manager",
        email: "tenant-portal-manager@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });

    const tenantUser = await prisma.user.create({
      data: {
        name: "Portal Tenant User",
        email: "portal-tenant@lux.test",
        password: "test-password",
        role: "USER",
        emailVerified: true,
      },
    });

    const otherTenantUser = await prisma.user.create({
      data: {
        name: "Other Tenant User",
        email: "other-tenant@lux.test",
        password: "test-password",
        role: "USER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "tenant-portal-company",
        nameEn: "Tenant Portal Company",
        verified: true,
      },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: "ACTIVE",
        enabledAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsCompanyMember.create({
      data: {
        companyId: company.id,
        userId: manager.id,
        role: "PMS_MANAGER",
        active: true,
        createdById: admin.id,
      },
    });

    const property = await prisma.pmsProperty.create({
      data: {
        companyId: company.id,
        name: "Tenant Portal Tower",
        code: "TPT",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const [unit, otherUnit] = await Promise.all([
      prisma.pmsUnit.create({
        data: {
          companyId: company.id,
          propertyId: property.id,
          unitNumber: "TPT-101",
          status: "OCCUPIED",
          occupancyStatus: "OCCUPIED",
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
      prisma.pmsUnit.create({
        data: {
          companyId: company.id,
          propertyId: property.id,
          unitNumber: "TPT-202",
          status: "OCCUPIED",
          occupancyStatus: "OCCUPIED",
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
    ]);

    const [tenant, otherTenant] = await Promise.all([
      prisma.pmsTenant.create({
        data: {
          companyId: company.id,
          fullName: "Portal Linked Tenant",
          email: tenantUser.email,
          active: true,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
      prisma.pmsTenant.create({
        data: {
          companyId: company.id,
          fullName: "Portal Other Tenant",
          email: otherTenantUser.email,
          active: true,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
    ]);

    const lease = await prisma.pmsLease.create({
      data: {
        companyId: company.id,
        tenantId: tenant.id,
        propertyId: property.id,
        unitId: unit.id,
        title: "Linked tenant lease",
        status: "ACTIVE",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2027-06-30T00:00:00.000Z"),
        rentFrequency: "MONTHLY",
        rentAmount: 850,
        currency: "OMR",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const otherLease = await prisma.pmsLease.create({
      data: {
        companyId: company.id,
        tenantId: otherTenant.id,
        propertyId: property.id,
        unitId: otherUnit.id,
        title: "Other tenant lease",
        status: "ACTIVE",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        rentFrequency: "MONTHLY",
        rentAmount: 920,
        currency: "OMR",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.pmsRentDueItem.createMany({
      data: [
        {
          companyId: company.id,
          leaseId: lease.id,
          tenantId: tenant.id,
          propertyId: property.id,
          unitId: unit.id,
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
          amount: 850,
          paidAmount: 0,
          status: "UNPAID",
          currency: "OMR",
          createdById: admin.id,
          updatedById: admin.id,
        },
        {
          companyId: company.id,
          leaseId: otherLease.id,
          tenantId: otherTenant.id,
          propertyId: property.id,
          unitId: otherUnit.id,
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
          amount: 920,
          paidAmount: 0,
          status: "UNPAID",
          currency: "OMR",
          createdById: admin.id,
          updatedById: admin.id,
        },
      ],
    });

    const managerToken = signToken(manager);
    const grantResponse = await request(app)
      .post(`/api/pms/tenants/${tenant.id}/portal-access`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: tenantUser.email })
      .expect(201);

    expect(grantResponse.body.tenantAccess.tenantId).toBe(tenant.id);

    const tenantToken = signToken(tenantUser);
    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);

    expect(meResponse.body.user.tenantAccess.hasAccess).toBe(true);
    expect(meResponse.body.user.pmsAccess.hasAccess).toBe(false);

    const leaseResponse = await request(app)
      .get("/api/tenant/lease")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);

    expect(leaseResponse.body.leases).toHaveLength(1);
    expect(leaseResponse.body.leases[0].id).toBe(lease.id);
    expect(JSON.stringify(leaseResponse.body)).not.toContain(otherLease.id);

    const rentResponse = await request(app)
      .get("/api/tenant/rent")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);

    expect(rentResponse.body.rentDueItems).toHaveLength(1);
    expect(rentResponse.body.rentDueItems[0].leaseId).toBe(lease.id);

    const tenantRentDueItemId = rentResponse.body.rentDueItems[0].id;
    const tenantPaymentResponse = await request(app)
      .post(`/api/pms/rent-due/${tenantRentDueItemId}/payments`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ amount: 400, method: "CHEQUE", referenceNumber: "CHEQUE-400" })
      .expect(201);

    expect(tenantPaymentResponse.body.rentDueItem.status).toBe("PARTIALLY_PAID");
    expect(tenantPaymentResponse.body.receipt.receiptNumber).toBeTruthy();

    const tenantPaymentsResponse = await request(app)
      .get(`/api/tenant/rent/${tenantRentDueItemId}/payments`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);

    expect(tenantPaymentsResponse.body.payments).toHaveLength(1);
    expect(tenantPaymentsResponse.body.payments[0].id).toBe(tenantPaymentResponse.body.payment.id);

    const tenantReceiptResponse = await request(app)
      .get(`/api/tenant/rent-payments/${tenantPaymentResponse.body.payment.id}/receipt`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);

    expect(tenantReceiptResponse.body.receipt.amount).toBe("400");

    const otherRentDueItem = await prisma.pmsRentDueItem.findFirstOrThrow({
      where: { tenantId: otherTenant.id },
    });

    const otherPaymentResponse = await request(app)
      .post(`/api/pms/rent-due/${otherRentDueItem.id}/payments`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ amount: 100, method: "CASH" })
      .expect(201);

    await request(app)
      .get(`/api/tenant/rent/${otherRentDueItem.id}/payments`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(404);

    await request(app)
      .get(`/api/tenant/rent-payments/${otherPaymentResponse.body.payment.id}/receipt`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(404);

    const blockedForeignMaintenanceResponse = await request(app)
      .post("/api/tenant/maintenance")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        leaseId: otherLease.id,
        title: "Foreign lease repair",
      })
      .expect(400);

    expect(blockedForeignMaintenanceResponse.body.message).toContain("No active tenant lease");

    const maintenanceResponse = await request(app)
      .post("/api/tenant/maintenance")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        title: "Kitchen leak",
        description: "Leak under the sink.",
        priority: "HIGH",
      })
      .expect(201);

    expect(maintenanceResponse.body.workOrder.tenantId).toBe(tenant.id);
    expect(maintenanceResponse.body.workOrder.unitId).toBe(unit.id);

    const tenantMaintenanceList = await request(app)
      .get("/api/tenant/maintenance")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);

    expect(tenantMaintenanceList.body.workOrders).toHaveLength(1);
    expect(tenantMaintenanceList.body.workOrders[0].title).toBe("Kitchen leak");

    await request(app)
      .get("/api/pms/overview")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(403);

    await request(app)
      .get("/api/tenant/overview")
      .set("Authorization", `Bearer ${signToken(otherTenantUser)}`)
      .expect(403);

    const pmsMaintenanceResponse = await request(app)
      .get(`/api/pms/maintenance?companyId=${company.id}&search=Kitchen`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(pmsMaintenanceResponse.body.workOrders[0].title).toBe("Kitchen leak");

    const notificationCount = await prisma.notification.count({
      where: {
        userId: manager.id,
        type: "PMS_MAINTENANCE_REQUEST_CREATED",
      },
    });

    expect(notificationCount).toBe(1);

    const tenantListResponse = await request(app)
      .get(`/api/pms/tenants?companyId=${company.id}&search=Portal%20Linked`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(tenantListResponse.body.tenants).toHaveLength(1);
    expect(tenantListResponse.body.tenants[0].portalAccesses).toHaveLength(1);
    expect(tenantListResponse.body.tenants[0].portalAccesses[0].active).toBe(true);
    expect(tenantListResponse.body.tenants[0].portalAccesses[0].user.email).toBe(tenantUser.email);

    const disabledAccessResponse = await request(app)
      .post(`/api/pms/tenants/${tenant.id}/portal-access`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ userId: tenantUser.id, active: false })
      .expect(201);

    expect(disabledAccessResponse.body.tenantAccess.active).toBe(false);

    const disabledTenantListResponse = await request(app)
      .get(`/api/pms/tenants?companyId=${company.id}&search=Portal%20Linked`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(disabledTenantListResponse.body.tenants[0].portalAccesses[0].active).toBe(false);

    await request(app)
      .get("/api/tenant/overview")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(403);
  });


  it("keeps PMS documents private, tenant-scoped, and supports lease renewal lifecycle", async () => {
    const manager = await prisma.user.create({
      data: {
        name: "Document Manager",
        email: "pms-doc-manager@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });
    const viewer = await prisma.user.create({
      data: {
        name: "Document Viewer",
        email: "pms-doc-viewer@lux.test",
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });
    const tenantUser = await prisma.user.create({
      data: {
        name: "Document Tenant",
        email: "pms-doc-tenant@lux.test",
        password: "test-password",
        role: "USER",
        emailVerified: true,
      },
    });
    const otherTenantUser = await prisma.user.create({
      data: {
        name: "Other Document Tenant",
        email: "pms-doc-other-tenant@lux.test",
        password: "test-password",
        role: "USER",
        emailVerified: true,
      },
    });

    const company = await prisma.developerCompany.create({
      data: {
        slug: "pms-doc-company",
        nameEn: "PMS Documents Company",
        verified: true,
        featured: false,
      },
    });

    await prisma.pmsCompanyEntitlement.create({
      data: {
        companyId: company.id,
        status: "ACTIVE",
        enabledAt: new Date(),
        createdById: manager.id,
      },
    });
    await prisma.pmsCompanyMember.createMany({
      data: [
        { companyId: company.id, userId: manager.id, role: "PMS_MANAGER", active: true },
        { companyId: company.id, userId: viewer.id, role: "PMS_VIEWER", active: true },
      ],
    });

    const property = await prisma.pmsProperty.create({
      data: {
        companyId: company.id,
        name: "Document Tower",
        city: "Muscat",
        createdById: manager.id,
      },
    });
    const unit = await prisma.pmsUnit.create({
      data: {
        companyId: company.id,
        propertyId: property.id,
        unitNumber: "D-101",
        rentAmount: "900",
        currency: "OMR",
        createdById: manager.id,
      },
    });
    const tenant = await prisma.pmsTenant.create({
      data: {
        companyId: company.id,
        fullName: "Document Tenant",
        email: tenantUser.email,
        createdById: manager.id,
      },
    });
    const otherTenant = await prisma.pmsTenant.create({
      data: {
        companyId: company.id,
        fullName: "Other Tenant",
        email: otherTenantUser.email,
        createdById: manager.id,
      },
    });
    const lease = await prisma.pmsLease.create({
      data: {
        companyId: company.id,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        title: "Document Lease",
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        rentAmount: "900",
        currency: "OMR",
        securityDeposit: "900",
        createdById: manager.id,
      },
    });

    await prisma.pmsTenantPortalAccess.createMany({
      data: [
        { companyId: company.id, tenantId: tenant.id, userId: tenantUser.id, active: true, createdById: manager.id },
        { companyId: company.id, tenantId: otherTenant.id, userId: otherTenantUser.id, active: true, createdById: manager.id },
      ],
    });

    const managerToken = signToken(manager);
    const viewerToken = signToken(viewer);
    const tenantToken = signToken(tenantUser);
    const otherTenantToken = signToken(otherTenantUser);

    const createdDocument = await request(app)
      .post("/api/pms/documents/upload")
      .set("Authorization", `Bearer ${managerToken}`)
      .field("metadata", JSON.stringify({
        companyId: company.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        propertyId: property.id,
        unitId: unit.id,
        type: "LEASE_AGREEMENT",
        title: "Signed lease agreement",
        expiryDate: "2026-12-20",
        notes: "Private lease document",
      }))
      .attach("file", TEST_PDF, { filename: "signed-lease.pdf", contentType: "application/pdf" })
      .expect(201);

    expect(createdDocument.body.document.tenant.id).toBe(tenant.id);
    expect(createdDocument.body.document.lease.id).toBe(lease.id);

    const listResponse = await request(app)
      .get(`/api/pms/documents?companyId=${company.id}&tenantId=${tenant.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(listResponse.body.documents).toHaveLength(1);
    expect(listResponse.body.documents[0].title).toBe("Signed lease agreement");

    await request(app)
      .post("/api/pms/documents/upload")
      .set("Authorization", `Bearer ${viewerToken}`)
      .field("metadata", JSON.stringify({
        companyId: company.id,
        tenantId: tenant.id,
        type: "OTHER",
        title: "Viewer upload attempt",
      }))
      .attach("file", TEST_PDF, { filename: "viewer.pdf", contentType: "application/pdf" })
      .expect(403);

    const renewalResponse = await request(app)
      .post(`/api/pms/leases/${lease.id}/renewal-draft`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        startDate: "2027-01-01",
        endDate: "2027-12-31",
        rentAmount: 950,
        securityDeposit: 950,
        title: "Document Lease Renewal",
      })
      .expect(201);

    expect(renewalResponse.body.lease.status).toBe("DRAFT");
    expect(renewalResponse.body.lease.previousLeaseId).toBe(lease.id);

    const checklistResponse = await request(app)
      .post(`/api/pms/leases/${lease.id}/checklists`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        type: "MOVE_IN",
        title: "Keys handed over",
      })
      .expect(201);

    expect(checklistResponse.body.checklistItem.status).toBe("PENDING");

    const completedChecklistResponse = await request(app)
      .patch(`/api/pms/lease-checklists/${checklistResponse.body.checklistItem.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "COMPLETED" })
      .expect(200);

    expect(completedChecklistResponse.body.checklistItem.status).toBe("COMPLETED");
    expect(completedChecklistResponse.body.checklistItem.completedAt).toBeTruthy();

    const tenantDocumentsResponse = await request(app)
      .get("/api/tenant/documents")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);

    expect(tenantDocumentsResponse.body.documents).toHaveLength(1);
    expect(tenantDocumentsResponse.body.documents[0].tenantId).toBe(tenant.id);

    const otherTenantDocumentsResponse = await request(app)
      .get("/api/tenant/documents")
      .set("Authorization", `Bearer ${otherTenantToken}`)
      .expect(200);

    expect(otherTenantDocumentsResponse.body.documents).toHaveLength(0);

    const tenantUploadResponse = await request(app)
      .post("/api/tenant/documents/upload")
      .set("Authorization", `Bearer ${tenantToken}`)
      .field("metadata", JSON.stringify({
        type: "PASSPORT_RESIDENCY",
        title: "Updated residency card",
      }))
      .attach("file", TEST_PDF, { filename: "residency.pdf", contentType: "application/pdf" })
      .expect(201);

    expect(tenantUploadResponse.body.document.tenantId).toBe(tenant.id);

    const expiryResponse = await request(app)
      .get(`/api/pms/documents/expiry-alerts?companyId=${company.id}&withinDays=365`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(expiryResponse.body.documents.some((document: { id: string }) => document.id === createdDocument.body.document.id)).toBe(true);
  });


  it("supports maintenance vendors, quote approval, and tenant confirmation scoping", async () => {
    const admin = await prisma.user.create({ data: { name: "Stage 16 Admin", email: "stage16-admin@lux.test", password: "test-password", role: "ADMIN", emailVerified: true } });
    const manager = await prisma.user.create({ data: { name: "Stage 16 Manager", email: "stage16-manager@lux.test", password: "test-password", role: "DEVELOPER", emailVerified: true } });
    const maintenance = await prisma.user.create({ data: { name: "Stage 16 Maintenance", email: "stage16-maintenance@lux.test", password: "test-password", role: "USER", emailVerified: true } });
    const tenantUser = await prisma.user.create({ data: { name: "Stage 16 Tenant", email: "stage16-tenant@lux.test", password: "test-password", role: "USER", emailVerified: true } });
    const company = await prisma.developerCompany.create({ data: { slug: "stage16-company", nameEn: "Stage 16 Company", verified: true } });
    await prisma.pmsCompanyEntitlement.create({ data: { companyId: company.id, status: "ACTIVE", createdById: admin.id, updatedById: admin.id } });
    await prisma.pmsCompanyMember.createMany({ data: [
      { companyId: company.id, userId: manager.id, role: "PMS_MANAGER", active: true, createdById: admin.id },
      { companyId: company.id, userId: maintenance.id, role: "PMS_MAINTENANCE", active: true, createdById: admin.id },
    ] });
    const property = await prisma.pmsProperty.create({ data: { companyId: company.id, name: "Stage 16 Property", createdById: manager.id, updatedById: manager.id } });
    const unit = await prisma.pmsUnit.create({ data: { companyId: company.id, propertyId: property.id, unitNumber: "1601", createdById: manager.id, updatedById: manager.id } });
    const tenant = await prisma.pmsTenant.create({ data: { companyId: company.id, fullName: "Stage 16 Tenant", email: tenantUser.email, createdById: manager.id, updatedById: manager.id } });
    await prisma.pmsTenantPortalAccess.create({ data: { companyId: company.id, tenantId: tenant.id, userId: tenantUser.id, createdById: manager.id, active: true } });
    const managerToken = signToken(manager);
    const maintenanceToken = signToken(maintenance);
    const tenantToken = signToken(tenantUser);

    const vendorResponse = await request(app)
      .post("/api/pms/vendors")
      .set("Authorization", `Bearer ${maintenanceToken}`)
      .send({ companyId: company.id, name: "AC Vendor", trade: "HVAC", active: true })
      .expect(201);

    const workOrderResponse = await request(app)
      .post("/api/pms/maintenance")
      .set("Authorization", `Bearer ${maintenanceToken}`)
      .send({ companyId: company.id, propertyId: property.id, unitId: unit.id, tenantId: tenant.id, vendorId: vendorResponse.body.vendor.id, title: "AC repair", priority: "HIGH", targetDate: new Date(Date.now() - 86400000).toISOString() })
      .expect(201);

    expect(workOrderResponse.body.workOrder.vendor.id).toBe(vendorResponse.body.vendor.id);
    expect(workOrderResponse.body.workOrder.overdue).toBe(true);

    const quoteResponse = await request(app)
      .post(`/api/pms/maintenance/${workOrderResponse.body.workOrder.id}/quotes`)
      .set("Authorization", `Bearer ${maintenanceToken}`)
      .send({ vendorId: vendorResponse.body.vendor.id, amount: 125, currency: "OMR", status: "SUBMITTED", description: "Replace part" })
      .expect(201);

    await request(app)
      .patch(`/api/pms/maintenance/quotes/${quoteResponse.body.quote.id}`)
      .set("Authorization", `Bearer ${maintenanceToken}`)
      .send({ status: "APPROVED" })
      .expect(403);

    const approvedQuoteResponse = await request(app)
      .patch(`/api/pms/maintenance/quotes/${quoteResponse.body.quote.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "APPROVED" })
      .expect(200);

    expect(approvedQuoteResponse.body.quote.status).toBe("APPROVED");

    const updatedWorkOrder = await prisma.pmsWorkOrder.findUniqueOrThrow({ where: { id: workOrderResponse.body.workOrder.id } });
    expect(Number(updatedWorkOrder.cost)).toBe(125);
    expect(updatedWorkOrder.approvedQuoteId).toBe(quoteResponse.body.quote.id);

    await request(app)
      .patch(`/api/pms/maintenance/${workOrderResponse.body.workOrder.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "RESOLVED" })
      .expect(200);

    const tenantConfirmResponse = await request(app)
      .post(`/api/tenant/maintenance/${workOrderResponse.body.workOrder.id}/confirm-resolved`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ notes: "Done" })
      .expect(200);

    expect(tenantConfirmResponse.body.workOrder.tenantConfirmedAt).toBeTruthy();
  });


  it("previews, commits, and scopes PMS bulk import/export", async () => {
    const admin = await prisma.user.create({ data: { name: "Stage 18 Admin", email: "stage18-admin@lux.test", password: "test-password", role: "ADMIN", emailVerified: true } });
    const manager = await prisma.user.create({ data: { name: "Stage 18 Manager", email: "stage18-manager@lux.test", password: "test-password", role: "DEVELOPER", emailVerified: true } });
    const viewer = await prisma.user.create({ data: { name: "Stage 18 Viewer", email: "stage18-viewer@lux.test", password: "test-password", role: "USER", emailVerified: true } });
    const otherManager = await prisma.user.create({ data: { name: "Stage 18 Other", email: "stage18-other@lux.test", password: "test-password", role: "DEVELOPER", emailVerified: true } });
    const company = await prisma.developerCompany.create({ data: { slug: "stage18-company", nameEn: "Stage 18 Company", verified: true } });
    const otherCompany = await prisma.developerCompany.create({ data: { slug: "stage18-other-company", nameEn: "Stage 18 Other Company", verified: true } });
    await prisma.pmsCompanyEntitlement.createMany({ data: [
      { companyId: company.id, status: "ACTIVE", createdById: admin.id, updatedById: admin.id },
      { companyId: otherCompany.id, status: "ACTIVE", createdById: admin.id, updatedById: admin.id },
    ] });
    await prisma.pmsCompanyMember.createMany({ data: [
      { companyId: company.id, userId: manager.id, role: "PMS_MANAGER", active: true, createdById: admin.id },
      { companyId: company.id, userId: viewer.id, role: "PMS_VIEWER", active: true, createdById: admin.id },
      { companyId: otherCompany.id, userId: otherManager.id, role: "PMS_MANAGER", active: true, createdById: admin.id },
    ] });
    const managerToken = signToken(manager);
    const viewerToken = signToken(viewer);
    const otherToken = signToken(otherManager);

    const propertyCsv = "name,code,city\nBulk Tower,BULK-1,Muscat\n,BAD,Muscat";
    const previewResponse = await request(app)
      .post("/api/pms/imports/preview")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ companyId: company.id, type: "PROPERTIES", filename: "properties.csv", csvText: propertyCsv })
      .expect(200);

    expect(previewResponse.body.preview.validRows).toHaveLength(1);
    expect(previewResponse.body.preview.invalidRows).toHaveLength(1);
    expect(await prisma.pmsProperty.count({ where: { companyId: company.id } })).toBe(0);

    await request(app)
      .post("/api/pms/imports/commit")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ companyId: company.id, type: "PROPERTIES", filename: "properties.csv", csvText: propertyCsv })
      .expect(403);

    const commitResponse = await request(app)
      .post("/api/pms/imports/commit")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ companyId: company.id, type: "PROPERTIES", filename: "properties.csv", csvText: propertyCsv })
      .expect(201);

    expect(commitResponse.body.batch.successfulRows).toBe(1);
    expect(commitResponse.body.batch.failedRows).toBe(1);
    expect(await prisma.pmsProperty.count({ where: { companyId: company.id } })).toBe(1);

    await request(app)
      .get(`/api/pms/exports/properties.csv?companyId=${company.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(403);

    await request(app)
      .get(`/api/pms/exports/properties.csv?companyId=${company.id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(403);

    const exportResponse = await request(app)
      .get(`/api/pms/exports/properties.csv?companyId=${company.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    expect(exportResponse.text).toContain("Bulk Tower");
    expect(exportResponse.text).not.toContain("Stage 18 Other Company");
  });

});

describe("PMS advanced permissions and property scopes", () => {
  beforeEach(async () => {
    await clearPmsTestDatabase();
  });

  async function setupScopedCompany() {
    const owner = await prisma.user.create({
      data: {
        name: "Scope Owner",
        email: `scope-owner-${Date.now()}@lux.test`,
        password: "test-password",
        role: "DEVELOPER",
        emailVerified: true,
      },
    });
    const staff = await prisma.user.create({
      data: {
        name: "Scoped Staff",
        email: `scoped-staff-${Date.now()}@lux.test`,
        password: "test-password",
        role: "USER",
        emailVerified: true,
      },
    });
    const company = await prisma.developerCompany.create({
      data: {
        slug: `scope-company-${Date.now()}`,
        nameEn: "Scoped PMS Company",
        verified: true,
        featured: false,
        pmsEntitlement: { create: { status: "ACTIVE", enabledAt: new Date(), createdById: owner.id, updatedById: owner.id } },
      },
    });
    const propertyA = await prisma.pmsProperty.create({
      data: { companyId: company.id, name: "Allowed Tower", code: "A", city: "Muscat", active: true, createdById: owner.id, updatedById: owner.id },
    });
    const propertyB = await prisma.pmsProperty.create({
      data: { companyId: company.id, name: "Blocked Tower", code: "B", city: "Muscat", active: true, createdById: owner.id, updatedById: owner.id },
    });
    const ownerMember = await prisma.pmsCompanyMember.create({
      data: { companyId: company.id, userId: owner.id, role: "PMS_OWNER", active: true, createdById: owner.id },
    });
    const staffMember = await prisma.pmsCompanyMember.create({
      data: { companyId: company.id, userId: staff.id, role: "PMS_MANAGER", active: true, createdById: owner.id },
    });
    await prisma.pmsMemberPropertyAccess.create({
      data: { companyId: company.id, memberId: staffMember.id, propertyId: propertyA.id },
    });

    return { owner, staff, company, propertyA, propertyB, ownerMember, staffMember };
  }

  it("enforces property-scoped PMS access on property and unit routes", async () => {
    const { staff, company, propertyA, propertyB } = await setupScopedCompany();
    const token = signToken(staff);

    const listResponse = await request(app)
      .get(`/api/pms/properties?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(listResponse.body.properties).toHaveLength(1);
    expect(listResponse.body.properties[0].id).toBe(propertyA.id);

    await request(app)
      .get(`/api/pms/properties/${propertyA.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get(`/api/pms/properties/${propertyB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app)
      .post("/api/pms/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, name: "Unauthorized New Property" })
      .expect(403);
  });

  it("scopes overview metrics and exposes effective permissions for property-scoped staff", async () => {
    const { staff, company, propertyA, propertyB } = await setupScopedCompany();
    await prisma.pmsUnit.createMany({
      data: [
        { companyId: company.id, propertyId: propertyA.id, unitNumber: "A-101", status: "OCCUPIED", occupancyStatus: "OCCUPIED" },
        { companyId: company.id, propertyId: propertyB.id, unitNumber: "B-101", status: "VACANT", occupancyStatus: "VACANT" },
      ],
    });

    const response = await request(app)
      .get(`/api/pms/overview?companyId=${company.id}`)
      .set("Authorization", `Bearer ${signToken(staff)}`)
      .expect(200);

    expect(response.body.workspace.member.permissionKeys).toContain("INVENTORY_VIEW");
    expect(response.body.workspace.member.permissionKeys).not.toContain("STAFF_MANAGE");
    expect(response.body.metrics.totalPmsProperties).toBe(1);
    expect(response.body.metrics.totalPmsUnits).toBe(1);
    expect(response.body.metrics.occupiedPmsUnits).toBe(1);
    expect(response.body.metrics.vacantPmsUnits).toBe(0);
    expect(response.body.metrics.pmsOccupancyRate).toBe(100);
  });

  it("redacts overview metrics and restricted modules outside effective permissions", async () => {
    const { staff, staffMember, company } = await setupScopedCompany();
    await prisma.pmsCompanyMember.update({
      where: { id: staffMember.id },
      data: { role: "PMS_MAINTENANCE" },
    });

    const token = signToken(staff);
    const overview = await request(app)
      .get(`/api/pms/overview?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(overview.body.metrics.totalPmsProperties).toBeNull();
    expect(overview.body.metrics.totalPmsTenants).toBeNull();
    expect(overview.body.metrics.pmsRentDueAmount).toBeNull();
    expect(overview.body.metrics.openPmsWorkOrders).toBe(0);
    expect(overview.body.alerts.expiringLeases).toEqual([]);

    await request(app)
      .get(`/api/pms/rent-due?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app)
      .get(`/api/pms/reports/summary?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("computes a property-scoped PMS command center and priority queue", async () => {
    const { staff, company, propertyA, propertyB } = await setupScopedCompany();
    const now = Date.now();
    const unitA = await prisma.pmsUnit.create({
      data: {
        companyId: company.id,
        propertyId: propertyA.id,
        unitNumber: "A-201",
        status: "OCCUPIED",
        occupancyStatus: "OCCUPIED",
      },
    });
    await prisma.pmsUnit.create({
      data: {
        companyId: company.id,
        propertyId: propertyB.id,
        unitNumber: "B-201",
        status: "VACANT",
        occupancyStatus: "VACANT",
      },
    });
    const tenant = await prisma.pmsTenant.create({
      data: { companyId: company.id, fullName: "Scoped Risk Tenant" },
    });
    const lease = await prisma.pmsLease.create({
      data: {
        companyId: company.id,
        propertyId: propertyA.id,
        unitId: unitA.id,
        tenantId: tenant.id,
        startDate: new Date(now - 30 * 86_400_000),
        endDate: new Date(now + 20 * 86_400_000),
        rentAmount: 500,
        status: "ACTIVE",
      },
    });
    const dueItem = await prisma.pmsRentDueItem.create({
      data: {
        companyId: company.id,
        propertyId: propertyA.id,
        unitId: unitA.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        dueDate: new Date(now - 40 * 86_400_000),
        amount: 500,
        paidAmount: 100,
        status: "OVERDUE",
      },
    });
    await prisma.pmsRentPayment.create({
      data: {
        companyId: company.id,
        propertyId: propertyA.id,
        unitId: unitA.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        rentDueItemId: dueItem.id,
        amount: 100,
        method: "BANK_TRANSFER",
        status: "CONFIRMED",
        paidAt: new Date(now - 2 * 86_400_000),
      },
    });
    await prisma.pmsWorkOrder.createMany({
      data: [
        {
          companyId: company.id,
          propertyId: propertyA.id,
          unitId: unitA.id,
          title: "Urgent overdue scoped repair",
          priority: "URGENT",
          status: "OPEN",
          targetDate: new Date(now - 2 * 86_400_000),
        },
        {
          companyId: company.id,
          propertyId: propertyA.id,
          unitId: unitA.id,
          title: "Urgent upcoming scoped repair",
          priority: "URGENT",
          status: "OPEN",
          targetDate: new Date(now + 5 * 86_400_000),
        },
      ],
    });
    await prisma.pmsDocument.create({
      data: {
        companyId: company.id,
        propertyId: propertyA.id,
        leaseId: lease.id,
        type: "OTHER",
        title: "Insurance certificate",
        fileUrl: "/uploads/insurance.pdf",
        expiryDate: new Date(now + 7 * 86_400_000),
      },
    });
    await prisma.pmsInspection.create({
      data: {
        companyId: company.id,
        propertyId: propertyA.id,
        unitId: unitA.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        title: "Move-in follow-up",
        status: "NEEDS_ACTION",
        scheduledFor: new Date(now - 1 * 86_400_000),
      },
    });

    const dateFrom = new Date(now - 60 * 86_400_000).toISOString();
    const dateTo = new Date(now + 1 * 86_400_000).toISOString();
    const token = signToken(staff);
    const response = await request(app)
      .get(`/api/pms/command-center?companyId=${company.id}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}&riskWindowDays=60&take=50`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.metrics.totalProperties).toBe(1);
    expect(response.body.metrics.totalUnits).toBe(1);
    expect(response.body.metrics.occupancyRate).toBe(100);
    expect(response.body.metrics.incompleteProperties).toBe(1);
    expect(response.body.metrics.incompleteUnits).toBe(1);
    expect(response.body.metrics.overdueRentAmount).toBe("400");
    expect(response.body.metrics.outstandingRentAmount).toBe("400");
    expect(response.body.metrics.rentCollectedThisPeriod).toBe("100");
    expect(response.body.metrics.leasesExpiringSoon).toBe(1);
    expect(response.body.metrics.activeMaintenanceRequests).toBe(2);
    expect(response.body.metrics.overdueMaintenanceRequests).toBe(1);
    expect(response.body.metrics.urgentMaintenanceRequests).toBe(2);
    expect(response.body.metrics.missingLeaseDocuments).toBe(1);
    expect(response.body.metrics.expiringDocuments).toBe(1);
    expect(response.body.metrics.inspectionsDue).toBe(1);
    expect(response.body.metrics.ownerStatementReadyProperties).toBe(0);
    expect(response.body.metrics.ownerStatementMissingProperties).toBe(1);
    expect(response.body.metrics.highRiskTenantAccounts).toBe(1);
    expect(response.body.health.portfolio.score).toEqual(expect.any(Number));
    expect(response.body.health.collection.status).not.toBe("NO_DATA");
    expect(response.body.riskSignals.highRiskTenants[0].tenantId).toBe(tenant.id);
    expect(response.body.automation.rentRemindersDue).toBeGreaterThanOrEqual(1);
    expect(response.body.automation.documentExpiryRemindersDue).toBe(1);

    const queueTypes = response.body.priorityQueue.map((item: { type: string }) => item.type);
    expect(queueTypes).toContain("OVERDUE_RENT");
    expect(queueTypes).toContain("MAINTENANCE_OVERDUE");
    expect(queueTypes).toContain("URGENT_MAINTENANCE");
    expect(queueTypes).toContain("LEASE_EXPIRING");
    expect(queueTypes).toContain("MISSING_DOCUMENT");
    expect(queueTypes).toContain("DOCUMENT_EXPIRING");
    expect(queueTypes).toContain("INSPECTION_DUE");
    expect(queueTypes).toContain("STATEMENT_GENERATION");
    expect(response.body.priorityQueue.every((item: { propertyId: string | null }) => item.propertyId === propertyA.id)).toBe(true);

    const openResponse = await request(app)
      .get(`/api/pms/command-center?companyId=${company.id}&status=OPEN&priority=HIGH&take=50`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(openResponse.body.priorityQueue).toHaveLength(1);
    expect(openResponse.body.priorityQueue[0].type).toBe("URGENT_MAINTENANCE");
    expect(openResponse.body.filters.status).toBe("OPEN");
    expect(openResponse.body.filters.priority).toBe("HIGH");

    await request(app)
      .get(`/api/pms/command-center?companyId=${company.id}&propertyId=${propertyB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("generates scoped idempotent PMS automation alerts with role-aware access", async () => {
    const { staff, staffMember, company, propertyA, propertyB } = await setupScopedCompany();
    const unit = await prisma.pmsUnit.create({
      data: {
        companyId: company.id,
        propertyId: propertyA.id,
        unitNumber: "A-AUTO",
        status: "OCCUPIED",
        occupancyStatus: "OCCUPIED",
      },
    });
    const tenant = await prisma.pmsTenant.create({
      data: { companyId: company.id, fullName: "Automation Tenant" },
    });
    const lease = await prisma.pmsLease.create({
      data: {
        companyId: company.id,
        propertyId: propertyA.id,
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: new Date(Date.now() - 90 * 86_400_000),
        endDate: new Date(Date.now() + 20 * 86_400_000),
        rentAmount: 600,
        status: "ACTIVE",
      },
    });
    const dueItem = await prisma.pmsRentDueItem.create({
      data: {
        companyId: company.id,
        propertyId: propertyA.id,
        unitId: unit.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        dueDate: new Date(Date.now() - 10 * 86_400_000),
        amount: 600,
        paidAmount: 0,
        status: "OVERDUE",
      },
    });
    const token = signToken(staff);

    const preview = await request(app)
      .post("/api/pms/automations/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, propertyId: propertyA.id, type: "OVERDUE_RENT", days: 30, dryRun: true })
      .expect(200);
    expect(preview.body.candidateCount).toBe(1);
    expect(preview.body.createdCount).toBe(0);
    expect(preview.body.candidates[0].rentDueItemId).toBe(dueItem.id);

    const firstRun = await request(app)
      .post("/api/pms/automations/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, propertyId: propertyA.id, type: "OVERDUE_RENT", days: 30, dryRun: false })
      .expect(201);
    expect(firstRun.body.createdCount).toBe(1);
    expect(firstRun.body.skippedCount).toBe(0);

    const secondRun = await request(app)
      .post("/api/pms/automations/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, propertyId: propertyA.id, type: "OVERDUE_RENT", days: 30, dryRun: false })
      .expect(201);
    expect(secondRun.body.createdCount).toBe(0);
    expect(secondRun.body.skippedCount).toBe(1);

    const automationLogs = await prisma.pmsCommunicationLog.findMany({
      where: { companyId: company.id, rentDueItemId: dueItem.id, body: { startsWith: "[PMS automation:" } },
    });
    expect(automationLogs).toHaveLength(1);
    expect(automationLogs[0].channel).toBe("INTERNAL");
    expect(automationLogs[0].status).toBe("LOGGED");
    expect(automationLogs[0].notes).toContain("External delivery is not enabled");

    const audit = await prisma.domainAuditEvent.findFirst({
      where: {
        companyId: company.id,
        domain: "PMS",
        actorId: staff.id,
        action: "runOperationalAutomation",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect((audit?.metadata as { title?: unknown } | null)?.title).toBe("PMS automation alerts generated");

    await request(app)
      .post("/api/pms/automations/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, propertyId: propertyB.id, type: "OVERDUE_RENT", dryRun: true })
      .expect(403);

    await prisma.pmsCompanyMember.update({
      where: { id: staffMember.id },
      data: { role: "PMS_ACCOUNTANT" },
    });

    await request(app)
      .post("/api/pms/automations/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, propertyId: propertyA.id, type: "LEASE_EXPIRY", dryRun: true })
      .expect(200);

    await request(app)
      .post("/api/pms/automations/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, propertyId: propertyA.id, type: "LEASE_EXPIRY", dryRun: false })
      .expect(403);

    await request(app)
      .post("/api/pms/automations/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, propertyId: propertyA.id, type: "MAINTENANCE_STATUS", dryRun: true })
      .expect(403);
  });

  it("lets explicit permission grants authorize staff management and audits the change", async () => {
    const { owner, staff, company, propertyA, staffMember } = await setupScopedCompany();
    const ownerToken = signToken(owner);

    await request(app)
      .post("/api/pms/staff")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ companyId: company.id, email: owner.email, role: "PMS_VIEWER" })
      .expect(400);

    const target = await prisma.user.create({
      data: {
        name: "New Scoped Accountant",
        email: `new-accountant-${Date.now()}@lux.test`,
        password: "test-password",
        role: "USER",
        emailVerified: true,
      },
    });

    const response = await request(app)
      .post("/api/pms/staff")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        companyId: company.id,
        email: target.email,
        role: "PMS_ACCOUNTANT",
        propertyIds: [propertyA.id],
        permissionKeys: ["ACCOUNTING_VIEW", "RENT_VIEW"],
      })
      .expect(201);

    expect(response.body.member.user.email).toBe(target.email);
    expect(response.body.member.propertyScope.allProperties).toBe(false);
    expect(response.body.member.propertyScope.propertyIds).toContain(propertyA.id);
    expect(response.body.member.customPermissionKeys).toContain("ACCOUNTING_VIEW");

    const staffList = await request(app)
      .get(`/api/pms/staff?companyId=${company.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(staffList.body.members.some((member: { user: { email: string } }) => member.user.email === target.email)).toBe(true);

    const audit = await prisma.domainAuditEvent.findFirst({
      where: {
        companyId: company.id,
        domain: "PMS",
        entityType: "pmsCompanyMember",
        actorId: owner.id,
        action: "staff_upsert",
      },
    });

    expect(audit).toBeTruthy();
    expect((audit?.metadata as { targetUserId?: unknown } | null)?.targetUserId).toBe(target.id);

    const scopedStaffToken = signToken(staff);
    await request(app)
      .post("/api/pms/staff")
      .set("Authorization", `Bearer ${scopedStaffToken}`)
      .send({ companyId: company.id, email: target.email, role: "PMS_VIEWER" })
      .expect(403);

    await prisma.pmsMemberPermission.create({
      data: {
        companyId: company.id,
        memberId: staffMember.id,
        key: "STAFF_MANAGE",
      },
    });

    await request(app)
      .post("/api/pms/staff")
      .set("Authorization", `Bearer ${scopedStaffToken}`)
      .send({ companyId: company.id, email: target.email, role: "PMS_VIEWER" })
      .expect(403);

    await prisma.pmsMemberPropertyAccess.deleteMany({
      where: { memberId: staffMember.id },
    });

    await request(app)
      .post("/api/pms/staff")
      .set("Authorization", `Bearer ${scopedStaffToken}`)
      .send({ companyId: company.id, email: target.email, role: "PMS_OWNER" })
      .expect(403);

    await request(app)
      .post("/api/pms/staff")
      .set("Authorization", `Bearer ${scopedStaffToken}`)
      .send({ companyId: company.id, email: target.email, role: "PMS_VIEWER" })
      .expect(201);
  });

  it("isolates property-linked PMS records, reports, exports, and imports", async () => {
    const { staff, company, propertyA, propertyB } = await setupScopedCompany();
    const token = signToken(staff);
    const [unitA, unitB] = await Promise.all([
      prisma.pmsUnit.create({
        data: {
          companyId: company.id,
          propertyId: propertyA.id,
          unitNumber: "A-301",
          status: "OCCUPIED",
          occupancyStatus: "OCCUPIED",
        },
      }),
      prisma.pmsUnit.create({
        data: {
          companyId: company.id,
          propertyId: propertyB.id,
          unitNumber: "B-301",
          status: "OCCUPIED",
          occupancyStatus: "OCCUPIED",
        },
      }),
    ]);
    const [tenantA, tenantB] = await Promise.all([
      prisma.pmsTenant.create({ data: { companyId: company.id, fullName: "Allowed Tenant" } }),
      prisma.pmsTenant.create({ data: { companyId: company.id, fullName: "Blocked Tenant" } }),
    ]);
    const [leaseA, leaseB] = await Promise.all([
      prisma.pmsLease.create({
        data: {
          companyId: company.id,
          propertyId: propertyA.id,
          unitId: unitA.id,
          tenantId: tenantA.id,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-12-31T00:00:00.000Z"),
          rentAmount: 500,
          status: "ACTIVE",
        },
      }),
      prisma.pmsLease.create({
        data: {
          companyId: company.id,
          propertyId: propertyB.id,
          unitId: unitB.id,
          tenantId: tenantB.id,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-12-31T00:00:00.000Z"),
          rentAmount: 900,
          status: "ACTIVE",
        },
      }),
    ]);
    const [dueA, dueB] = await Promise.all([
      prisma.pmsRentDueItem.create({
        data: {
          companyId: company.id,
          propertyId: propertyA.id,
          unitId: unitA.id,
          tenantId: tenantA.id,
          leaseId: leaseA.id,
          dueDate: new Date("2026-02-01T00:00:00.000Z"),
          amount: 500,
          paidAmount: 100,
          status: "PARTIALLY_PAID",
        },
      }),
      prisma.pmsRentDueItem.create({
        data: {
          companyId: company.id,
          propertyId: propertyB.id,
          unitId: unitB.id,
          tenantId: tenantB.id,
          leaseId: leaseB.id,
          dueDate: new Date("2026-02-01T00:00:00.000Z"),
          amount: 900,
          paidAmount: 0,
          status: "UNPAID",
        },
      }),
    ]);
    const [workOrderA, workOrderB] = await Promise.all([
      prisma.pmsWorkOrder.create({
        data: { companyId: company.id, propertyId: propertyA.id, unitId: unitA.id, title: "Allowed repair" },
      }),
      prisma.pmsWorkOrder.create({
        data: { companyId: company.id, propertyId: propertyB.id, unitId: unitB.id, title: "Blocked repair" },
      }),
    ]);
    const [ledgerA, ledgerB] = await Promise.all([
      prisma.pmsAccountingLedgerEntry.create({
        data: {
          companyId: company.id,
          propertyId: propertyA.id,
          unitId: unitA.id,
          tenantId: tenantA.id,
          leaseId: leaseA.id,
          rentDueItemId: dueA.id,
          type: "INCOME",
          category: "Allowed income",
          amount: 100,
          transactionDate: new Date("2026-02-02T00:00:00.000Z"),
        },
      }),
      prisma.pmsAccountingLedgerEntry.create({
        data: {
          companyId: company.id,
          propertyId: propertyB.id,
          unitId: unitB.id,
          tenantId: tenantB.id,
          leaseId: leaseB.id,
          rentDueItemId: dueB.id,
          type: "INCOME",
          category: "Blocked income",
          amount: 900,
          transactionDate: new Date("2026-02-02T00:00:00.000Z"),
        },
      }),
    ]);
    const [documentA, documentB] = await Promise.all([
      prisma.pmsDocument.create({
        data: {
          companyId: company.id,
          propertyId: propertyA.id,
          leaseId: leaseA.id,
          type: "OTHER",
          title: "Allowed document",
          fileUrl: "/uploads/allowed.pdf",
        },
      }),
      prisma.pmsDocument.create({
        data: {
          companyId: company.id,
          propertyId: propertyB.id,
          leaseId: leaseB.id,
          type: "OTHER",
          title: "Blocked document",
          fileUrl: "/uploads/blocked.pdf",
        },
      }),
    ]);
    const [communicationA, communicationB] = await Promise.all([
      prisma.pmsCommunicationLog.create({
        data: {
          companyId: company.id,
          tenantId: tenantA.id,
          leaseId: leaseA.id,
          channel: "EMAIL",
          body: "Allowed notice",
        },
      }),
      prisma.pmsCommunicationLog.create({
        data: {
          companyId: company.id,
          tenantId: tenantB.id,
          leaseId: leaseB.id,
          channel: "EMAIL",
          body: "Blocked notice",
        },
      }),
    ]);

    const [
      tenantsResponse,
      leasesResponse,
      rentResponse,
      maintenanceResponse,
      ledgerResponse,
      documentsResponse,
      communicationsResponse,
    ] = await Promise.all([
      request(app).get(`/api/pms/tenants?companyId=${company.id}`).set("Authorization", `Bearer ${token}`).expect(200),
      request(app).get(`/api/pms/leases?companyId=${company.id}`).set("Authorization", `Bearer ${token}`).expect(200),
      request(app).get(`/api/pms/rent-due?companyId=${company.id}`).set("Authorization", `Bearer ${token}`).expect(200),
      request(app).get(`/api/pms/maintenance?companyId=${company.id}`).set("Authorization", `Bearer ${token}`).expect(200),
      request(app).get(`/api/pms/accounting/ledger?companyId=${company.id}`).set("Authorization", `Bearer ${token}`).expect(200),
      request(app).get(`/api/pms/documents?companyId=${company.id}`).set("Authorization", `Bearer ${token}`).expect(200),
      request(app).get(`/api/pms/communication-logs?companyId=${company.id}`).set("Authorization", `Bearer ${token}`).expect(200),
    ]);

    const tenantIds = tenantsResponse.body.tenants.map((tenant: { id: string }) => tenant.id);
    const leaseIds = leasesResponse.body.leases.map((lease: { id: string }) => lease.id);
    const rentDueItemIds = rentResponse.body.rentDueItems.map((item: { id: string }) => item.id);
    const workOrderIds = maintenanceResponse.body.workOrders.map((item: { id: string }) => item.id);
    const ledgerEntryIds = ledgerResponse.body.ledgerEntries.map((item: { id: string }) => item.id);
    const documentIds = documentsResponse.body.documents.map((item: { id: string }) => item.id);
    const communicationIds = communicationsResponse.body.logs.map((item: { id: string }) => item.id);

    expect(tenantIds).toEqual([tenantA.id]);
    expect(tenantIds).not.toContain(tenantB.id);
    expect(leaseIds).toEqual([leaseA.id]);
    expect(leaseIds).not.toContain(leaseB.id);
    expect(rentDueItemIds).toEqual([dueA.id]);
    expect(rentDueItemIds).not.toContain(dueB.id);
    expect(workOrderIds).toEqual([workOrderA.id]);
    expect(workOrderIds).not.toContain(workOrderB.id);
    expect(ledgerEntryIds).toEqual([ledgerA.id]);
    expect(ledgerEntryIds).not.toContain(ledgerB.id);
    expect(documentIds).toEqual([documentA.id]);
    expect(documentIds).not.toContain(documentB.id);
    expect(communicationIds).toEqual([communicationA.id]);
    expect(communicationIds).not.toContain(communicationB.id);

    await request(app)
      .get(`/api/pms/accounting/ledger?companyId=${company.id}&propertyId=${propertyB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app)
      .get(`/api/pms/accounting/owner-statement?companyId=${company.id}&unitId=${unitB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app)
      .get(`/api/pms/documents/${documentB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app)
      .post("/api/pms/communication-templates/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, leaseId: leaseB.id, body: "Blocked preview" })
      .expect(403);

    const reportResponse = await request(app)
      .get(`/api/pms/reports/summary?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(reportResponse.body.reports.occupancy.totalUnits).toBe(1);
    expect(reportResponse.body.accounting.outstandingRent).toBe("400");

    const exportResponse = await request(app)
      .get(`/api/pms/exports/leases.csv?companyId=${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(exportResponse.text).toContain("Allowed Tenant");
    expect(exportResponse.text).not.toContain("Blocked Tenant");

    await request(app)
      .post("/api/pms/imports/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id, type: "PROPERTIES", filename: "properties.csv", csvText: "name\nUnsafe import" })
      .expect(403);
  });

  it("keeps role boundaries compatible while exposing the permission matrix", async () => {
    const { owner, company } = await setupScopedCompany();
    const accountant = await prisma.user.create({
      data: {
        name: "No Maintenance Accountant",
        email: `no-maintenance-accountant-${Date.now()}@lux.test`,
        password: "test-password",
        role: "USER",
        emailVerified: true,
      },
    });
    const maintenance = await prisma.user.create({
      data: {
        name: "No Accounting Maintenance",
        email: `no-accounting-maintenance-${Date.now()}@lux.test`,
        password: "test-password",
        role: "USER",
        emailVerified: true,
      },
    });
    await prisma.pmsCompanyMember.createMany({
      data: [
        { companyId: company.id, userId: accountant.id, role: "PMS_ACCOUNTANT", active: true, createdById: owner.id },
        { companyId: company.id, userId: maintenance.id, role: "PMS_MAINTENANCE", active: true, createdById: owner.id },
      ],
    });

    const ownerResponse = await request(app)
      .get(`/api/pms/staff?companyId=${company.id}`)
      .set("Authorization", `Bearer ${signToken(owner)}`)
      .expect(200);

    expect(ownerResponse.body.permissionMatrix.some((row: { role: string; permissionKeys: string[] }) => row.role === "PMS_OWNER" && row.permissionKeys.includes("STAFF_MANAGE"))).toBe(true);

    await request(app)
      .post("/api/pms/vendors")
      .set("Authorization", `Bearer ${signToken(accountant)}`)
      .send({ companyId: company.id, name: "Blocked Vendor" })
      .expect(403);

    await request(app)
      .get(`/api/pms/accounting/ledger?companyId=${company.id}`)
      .set("Authorization", `Bearer ${signToken(maintenance)}`)
      .expect(403);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signToken } from "../src/middleware/auth";

const app = createApp();

async function clearPmsTestDatabase() {
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
        status: "OCCUPIED",
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
    expect(overviewResponse.body.metrics.vacantPmsUnits).toBe(1);
    expect(overviewResponse.body.metrics.occupiedPmsUnits).toBe(1);
    expect(overviewResponse.body.metrics.maintenancePmsUnits).toBe(1);
    expect(overviewResponse.body.metrics.pmsOccupancyRate).toBeCloseTo(33.3, 1);

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

    const auditEvents = await prisma.accountSecurityEvent.findMany({
      where: {
        type: "ADMIN_PMS_ACCESS_UPDATED",
        title: {
          in: [
            "PMS rent payment recorded",
            "PMS maintenance work order created",
          ],
        },
      },
      select: { title: true },
    });

    expect(auditEvents.map((event) => event.title).sort()).toEqual([
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
      .post("/api/pms/documents")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        companyId: company.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        propertyId: property.id,
        unitId: unit.id,
        type: "LEASE_AGREEMENT",
        title: "Signed lease agreement",
        fileUrl: "/uploads/pms/signed-lease.pdf",
        expiryDate: "2026-12-20",
        notes: "Private lease document",
      })
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
      .post("/api/pms/documents")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        companyId: company.id,
        tenantId: tenant.id,
        type: "OTHER",
        title: "Viewer upload attempt",
        fileUrl: "/uploads/pms/viewer.pdf",
      })
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
    expect(tenantDocumentsResponse.body.documents[0].tenant.id).toBe(tenant.id);

    const otherTenantDocumentsResponse = await request(app)
      .get("/api/tenant/documents")
      .set("Authorization", `Bearer ${otherTenantToken}`)
      .expect(200);

    expect(otherTenantDocumentsResponse.body.documents).toHaveLength(0);

    const tenantUploadResponse = await request(app)
      .post("/api/tenant/documents")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        type: "PASSPORT_RESIDENCY",
        title: "Updated residency card",
        fileUrl: "/uploads/pms/residency.pdf",
      })
      .expect(201);

    expect(tenantUploadResponse.body.document.tenant.id).toBe(tenant.id);

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

});

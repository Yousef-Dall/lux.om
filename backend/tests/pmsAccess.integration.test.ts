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
  await prisma.pmsUnit.deleteMany();
  await prisma.pmsProperty.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.developerProjectImage.deleteMany();
  await prisma.developerProject.deleteMany();
  await prisma.pmsUnit.deleteMany();
  await prisma.pmsProperty.deleteMany();
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
      publicListings.body.items ?? publicListings.body.listings ?? [],
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
});

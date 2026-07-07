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
  await prisma.pmsInspection.deleteMany();
  await prisma.pmsWorkOrder.deleteMany();
  await prisma.pmsCommunicationTemplate.deleteMany();
  await prisma.pmsPolicy.deleteMany();
  await prisma.pmsRentDueItem.deleteMany();
  await prisma.pmsLease.deleteMany();
  await prisma.pmsTenant.deleteMany();
  await prisma.pmsUnit.deleteMany();
  await prisma.pmsProperty.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.developerProjectImage.deleteMany();
  await prisma.developerProject.deleteMany();
  await prisma.pmsRentDueItem.deleteMany();
  await prisma.pmsLease.deleteMany();
  await prisma.pmsTenant.deleteMany();
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

    const paymentResponse = await request(app)
      .patch(`/api/pms/rent-due/${rentDueResponse.body.rentDueItems[0].id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        paidAmount: 750,
      })
      .expect(200);

    expect(paymentResponse.body.rentDueItem.status).toBe("PAID");
    expect(paymentResponse.body.rentDueItem.paidAt).toBeTruthy();

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
      .patch(`/api/pms/rent-due/${companyBRentDue.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ paidAmount: 500 })
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

    await prisma.pmsRentDueItem.create({
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

});

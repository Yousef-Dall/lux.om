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
  await prisma.pmsTenantPortalAccess.deleteMany();
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
  await prisma.pmsTenantPortalAccess.deleteMany();
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
      .patch(`/api/pms/rent-due/${rentDueItem.id}`)
      .set("Authorization", `Bearer ${accountantToken}`)
      .send({ paidAmount: 600 })
      .expect(200);

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
      .patch(`/api/pms/rent-due/${rentDueItem.id}`)
      .set("Authorization", `Bearer ${maintenanceToken}`)
      .send({ paidAmount: 600 })
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
            "PMS rent due item updated",
            "PMS maintenance work order created",
          ],
        },
      },
      select: { title: true },
    });

    expect(auditEvents.map((event) => event.title).sort()).toEqual([
      "PMS maintenance work order created",
      "PMS rent due item updated",
    ]);
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
  });

});

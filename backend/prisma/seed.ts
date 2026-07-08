import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { validatePasswordPolicy } from '../src/utils/passwordPolicy';

const prisma = new PrismaClient();

const isProductionSeed = process.env.NODE_ENV === 'production';

function createGeneratedSeedPassword() {
  return `Lx-${crypto.randomBytes(18).toString('base64url')}!9aA`;
}

function optionalSeedValue(name: string) {
  return process.env[name]?.trim() || undefined;
}

function assertValidEmail(name: string, value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${name} must be a valid email address`);
  }
}

function requireProductionSeedValue(name: string, value?: string) {
  if (isProductionSeed && !value) {
    throw new Error(`${name} is required when running seed in production`);
  }
}

function getSeedConfig() {
  if (isProductionSeed) {
    const allowDestructiveSeed = process.env.ALLOW_DESTRUCTIVE_SEED === 'true';
    const confirmedReset = process.env.CONFIRM_SEED_DATABASE_RESET === 'RESET_LUX_OM_DATABASE';

    if (!allowDestructiveSeed || !confirmedReset) {
      throw new Error(
        'Refusing to run destructive seed in production. Set ALLOW_DESTRUCTIVE_SEED=true and CONFIRM_SEED_DATABASE_RESET=RESET_LUX_OM_DATABASE only if you intentionally want to wipe and reseed the database.'
      );
    }

    if (process.env.SEED_INCLUDE_PMS_DEMO === 'true') {
      throw new Error('SEED_INCLUDE_PMS_DEMO is local/demo-only and cannot be used in production.');
    }
  }

  const seedPassword = optionalSeedValue('SEED_PASSWORD') ?? createGeneratedSeedPassword();

  const adminEmail = optionalSeedValue('SEED_ADMIN_EMAIL') ?? 'local-admin@example.test';
  const ownerEmail = optionalSeedValue('SEED_OWNER_EMAIL') ?? 'local-owner@example.test';
  const activityProviderEmail =
    optionalSeedValue('SEED_ACTIVITY_PROVIDER_EMAIL') ?? 'local-activities@example.test';
  const userEmail = optionalSeedValue('SEED_USER_EMAIL') ?? 'local-user@example.test';

  requireProductionSeedValue('SEED_PASSWORD', optionalSeedValue('SEED_PASSWORD'));
  requireProductionSeedValue('SEED_ADMIN_EMAIL', optionalSeedValue('SEED_ADMIN_EMAIL'));
  requireProductionSeedValue('SEED_OWNER_EMAIL', optionalSeedValue('SEED_OWNER_EMAIL'));
  requireProductionSeedValue(
    'SEED_ACTIVITY_PROVIDER_EMAIL',
    optionalSeedValue('SEED_ACTIVITY_PROVIDER_EMAIL')
  );
  requireProductionSeedValue('SEED_USER_EMAIL', optionalSeedValue('SEED_USER_EMAIL'));

  const emails = {
    SEED_ADMIN_EMAIL: adminEmail,
    SEED_OWNER_EMAIL: ownerEmail,
    SEED_ACTIVITY_PROVIDER_EMAIL: activityProviderEmail,
    SEED_USER_EMAIL: userEmail
  };

  for (const [name, value] of Object.entries(emails)) {
    assertValidEmail(name, value);
  }

  const passwordIssues = validatePasswordPolicy({
    password: seedPassword,
    email: adminEmail,
    name: 'Lux Admin'
  });

  if (passwordIssues.length > 0) {
    throw new Error(
      `SEED_PASSWORD does not meet password policy: ${passwordIssues
        .map((issue) => issue.message)
        .join(' ')}`
    );
  }

  return {
    seedPassword,
    adminEmail,
    ownerEmail,
    activityProviderEmail,
    userEmail
  };
}

const seedConfig = getSeedConfig();
const seedPassword = seedConfig.seedPassword;

async function seedPmsDemoData(input: {
  companyId: string;
  managerId: string;
  hashedPassword: string;
}) {
  if (process.env.SEED_INCLUDE_PMS_DEMO !== 'true') {
    return null;
  }

  const tenantEmail = optionalSeedValue('SEED_PMS_TENANT_EMAIL') ?? 'local-pms-tenant@example.test';
  assertValidEmail('SEED_PMS_TENANT_EMAIL', tenantEmail);

  const now = new Date();
  const leaseStart = new Date(now);
  leaseStart.setMonth(leaseStart.getMonth() - 1);
  leaseStart.setDate(1);

  const leaseEnd = new Date(leaseStart);
  leaseEnd.setFullYear(leaseEnd.getFullYear() + 1);

  const lastMonthDue = new Date(leaseStart);
  lastMonthDue.setDate(5);

  const nextDue = new Date(now);
  nextDue.setMonth(nextDue.getMonth() + 1);
  nextDue.setDate(5);

  const tenantUser = await prisma.user.create({
    data: {
      name: 'PMS Demo Tenant',
      email: tenantEmail,
      password: input.hashedPassword,
      role: 'USER',
      emailVerified: true,
      emailVerifiedAt: now,
      phone: '+968 9888 0000'
    }
  });

  await prisma.pmsCompanyEntitlement.create({
    data: {
      companyId: input.companyId,
      status: 'ACTIVE',
      notes: 'Local PMS demo entitlement for onboarding and QA smoke testing.',
      enabledAt: now,
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  await prisma.pmsCompanyMember.create({
    data: {
      companyId: input.companyId,
      userId: input.managerId,
      invitedEmail: seedConfig.ownerEmail,
      role: 'PMS_OWNER',
      active: true,
      createdById: input.managerId
    }
  });

  const property = await prisma.pmsProperty.create({
    data: {
      companyId: input.companyId,
      name: 'PMS Demo Tower',
      code: 'PMS-DEMO-TOWER',
      propertyType: 'Residential tower',
      city: 'Muscat',
      area: 'Al Mouj',
      addressLine: 'Demo PMS onboarding address',
      notes: 'Local seed property for PMS beta demos.',
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  const unit = await prisma.pmsUnit.create({
    data: {
      companyId: input.companyId,
      propertyId: property.id,
      unitNumber: '1204',
      unitName: 'Sea View Suite',
      floor: '12',
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 118,
      status: 'OCCUPIED',
      occupancyStatus: 'OCCUPIED',
      rentAmount: '850',
      currency: 'OMR',
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  const tenant = await prisma.pmsTenant.create({
    data: {
      companyId: input.companyId,
      fullName: 'PMS Demo Tenant',
      phone: '+968 9888 0000',
      email: tenantEmail,
      nationality: 'Oman',
      notes: 'Local seed tenant linked to the tenant portal.',
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  await prisma.pmsTenantPortalAccess.create({
    data: {
      companyId: input.companyId,
      tenantId: tenant.id,
      userId: tenantUser.id,
      active: true,
      createdById: input.managerId
    }
  });

  const lease = await prisma.pmsLease.create({
    data: {
      companyId: input.companyId,
      tenantId: tenant.id,
      propertyId: property.id,
      unitId: unit.id,
      title: 'PMS Demo Lease',
      status: 'ACTIVE',
      startDate: leaseStart,
      endDate: leaseEnd,
      rentFrequency: 'MONTHLY',
      rentAmount: '850',
      currency: 'OMR',
      securityDeposit: '850',
      dueDayOfMonth: 5,
      notes: 'Local seed lease for PMS onboarding checks.',
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  const paidDueItem = await prisma.pmsRentDueItem.create({
    data: {
      companyId: input.companyId,
      leaseId: lease.id,
      tenantId: tenant.id,
      propertyId: property.id,
      unitId: unit.id,
      dueDate: lastMonthDue,
      periodStart: leaseStart,
      periodEnd: now,
      amount: '850',
      paidAmount: '850',
      currency: 'OMR',
      status: 'PAID',
      paidAt: now,
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  const upcomingDueItem = await prisma.pmsRentDueItem.create({
    data: {
      companyId: input.companyId,
      leaseId: lease.id,
      tenantId: tenant.id,
      propertyId: property.id,
      unitId: unit.id,
      dueDate: nextDue,
      amount: '850',
      paidAmount: '0',
      currency: 'OMR',
      status: 'DUE_SOON',
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  const payment = await prisma.pmsRentPayment.create({
    data: {
      companyId: input.companyId,
      rentDueItemId: paidDueItem.id,
      leaseId: lease.id,
      tenantId: tenant.id,
      propertyId: property.id,
      unitId: unit.id,
      amount: '850',
      currency: 'OMR',
      method: 'BANK_TRANSFER',
      status: 'CONFIRMED',
      referenceNumber: 'DEMO-RENT-001',
      paidAt: now,
      confirmedAt: now,
      receiptNumber: `PMS-DEMO-${Date.now()}`,
      recordedById: input.managerId
    }
  });

  await prisma.pmsAccountingLedgerEntry.createMany({
    data: [
      {
        companyId: input.companyId,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        rentDueItemId: paidDueItem.id,
        rentPaymentId: payment.id,
        type: 'INCOME',
        source: 'RENT_PAYMENT',
        category: 'Rent collection',
        amount: '850',
        currency: 'OMR',
        transactionDate: now,
        referenceNumber: 'DEMO-RENT-001',
        notes: 'Seeded rent payment ledger entry.',
        createdById: input.managerId,
        updatedById: input.managerId
      },
      {
        companyId: input.companyId,
        propertyId: property.id,
        unitId: unit.id,
        tenantId: tenant.id,
        leaseId: lease.id,
        type: 'DEPOSIT',
        source: 'SECURITY_DEPOSIT',
        category: 'Security deposit held',
        amount: '850',
        currency: 'OMR',
        transactionDate: leaseStart,
        referenceNumber: 'DEMO-DEPOSIT-001',
        notes: 'Seeded deposit ledger foundation.',
        createdById: input.managerId,
        updatedById: input.managerId
      }
    ]
  });

  const vendor = await prisma.pmsVendor.create({
    data: {
      companyId: input.companyId,
      name: 'PMS Demo Maintenance Co.',
      phone: '+968 9777 0000',
      email: 'maintenance@example.test',
      trade: 'HVAC',
      active: true,
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  const workOrder = await prisma.pmsWorkOrder.create({
    data: {
      companyId: input.companyId,
      propertyId: property.id,
      unitId: unit.id,
      tenantId: tenant.id,
      vendorId: vendor.id,
      title: 'AC service before peak season',
      description: 'Seeded work order for maintenance workflow demos.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      targetDate: nextDue,
      cost: '120',
      currency: 'OMR',
      recurrenceType: 'QUARTERLY',
      nextScheduledDate: nextDue,
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  await prisma.pmsMaintenanceQuote.create({
    data: {
      companyId: input.companyId,
      workOrderId: workOrder.id,
      vendorId: vendor.id,
      amount: '120',
      currency: 'OMR',
      description: 'Quarterly AC service quote.',
      status: 'APPROVED',
      submittedAt: now,
      approvedAt: now,
      createdById: input.managerId,
      updatedById: input.managerId,
      approvedById: input.managerId
    }
  });

  await prisma.pmsPolicy.create({
    data: {
      companyId: input.companyId,
      title: 'Demo rent and maintenance policy',
      category: 'RENT',
      body: 'Rent is due on the 5th of each month. Maintenance requests should be submitted through the tenant portal.',
      active: true,
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  await prisma.pmsCommunicationTemplate.create({
    data: {
      companyId: input.companyId,
      name: 'Rent due reminder',
      channel: 'EMAIL',
      type: 'rent',
      subject: 'Rent due reminder for {{unitLabel}}',
      body: 'Hello {{tenantName}}, your rent of {{amount}} {{currency}} is due on {{dueDate}}.',
      active: true,
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  await prisma.pmsDocument.create({
    data: {
      companyId: input.companyId,
      propertyId: property.id,
      unitId: unit.id,
      tenantId: tenant.id,
      leaseId: lease.id,
      type: 'LEASE_AGREEMENT',
      title: 'Demo lease agreement placeholder',
      fileUrl: '/uploads/pms-demo-lease.pdf',
      status: 'ACTIVE',
      expiryDate: leaseEnd,
      notes: 'Placeholder file path for local PMS demo data.',
      uploadedById: input.managerId,
      updatedById: input.managerId
    }
  });

  await prisma.pmsInspection.create({
    data: {
      companyId: input.companyId,
      propertyId: property.id,
      unitId: unit.id,
      tenantId: tenant.id,
      leaseId: lease.id,
      title: 'Demo move-in inspection',
      status: 'COMPLETED',
      scheduledFor: leaseStart,
      completedAt: leaseStart,
      rating: 5,
      notes: 'Seeded inspection record for launch QA.',
      createdById: input.managerId,
      updatedById: input.managerId
    }
  });

  await prisma.pmsImportBatch.create({
    data: {
      companyId: input.companyId,
      type: 'TENANTS',
      filename: 'demo-tenants.csv',
      status: 'COMMITTED',
      totalRows: 1,
      successfulRows: 1,
      failedRows: 0,
      createdById: input.managerId
    }
  });

  return { property, unit, tenant, lease, upcomingDueItem, workOrder };
}

async function main() {
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
  await prisma.oauthLoginCode.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash(seedPassword, 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Lux Admin',
      email: seedConfig.adminEmail,
      password: hashedPassword,
      role: 'ADMIN',
      emailVerified: true,
      emailVerifiedAt: new Date()
    }
  });

  const owner = await prisma.user.create({
    data: {
      name: 'Lux Oman Properties',
      email: seedConfig.ownerEmail,
      password: hashedPassword,
      role: 'OWNER',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      phone: '+968 9000 0000'
    }
  });

  const activityProvider = await prisma.user.create({
    data: {
      name: 'Muscat Premium Activities',
      email: seedConfig.activityProviderEmail,
      password: hashedPassword,
      role: 'ACTIVITY_PROVIDER',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      phone: '+968 9111 1111'
    }
  });

  const user = await prisma.user.create({
    data: {
      name: 'Salam User',
      email: seedConfig.userEmail,
      password: hashedPassword,
      role: 'USER',
      emailVerified: true,
      emailVerifiedAt: new Date()
    }
  });

  const mallOfOman = await prisma.landmark.create({
    data: {
      slug: 'mall-of-oman',
      nameEn: 'Mall of Oman',
      nameAr: 'مول عُمان',
      cityEn: 'Muscat',
      cityAr: 'مسقط',
      category: 'Mall'
    }
  });

  const muscatHills = await prisma.landmark.create({
    data: {
      slug: 'muscat-hills',
      nameEn: 'Muscat Hills',
      nameAr: 'مسقط هيلز',
      cityEn: 'Muscat',
      cityAr: 'مسقط',
      category: 'Residential'
    }
  });

  const developer = await prisma.developerCompany.create({
    data: {
      slug: 'omran-developments',
      nameEn: 'Omran Developments',
      nameAr: 'عمران للتطوير',
      descriptionEn:
        'A premium development company creating refined residential and mixed-use destinations across Oman.',
      descriptionAr:
        'شركة تطوير عقاري فاخرة تعمل على إنشاء وجهات سكنية ومتعددة الاستخدامات في عُمان.',
      headquartersEn: 'Muscat, Oman',
      headquartersAr: 'مسقط، عُمان',
      logo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
      phone: '+968 9222 2222',
      email: 'partners@lux.om',
website: 'https://lux.om',
      establishedYear: 2012,
      verified: true,
      featured: true
    }
  });

  const muscatCoastTours = await prisma.travelAgency.create({
    data: {
      slug: 'muscat-coast-tours',
      nameEn: 'Muscat Coast Tours',
      nameAr: 'جولات ساحل مسقط',
      descriptionEn:
        'A verified travel agency specializing in private coastal cruises, sea activities, and curated Muscat experiences.',
      descriptionAr:
        'وكالة سفر موثوقة متخصصة في الرحلات البحرية الخاصة والأنشطة الساحلية والتجارب المختارة في مسقط.',
      headquartersEn: 'Muscat, Oman',
      headquartersAr: 'مسقط، عُمان',
      logo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      phone: '+968 9444 4444',
      email: 'hello@muscatcoast.lux.om',
website: 'https://lux.om/travel-agencies/muscat-coast-tours',
      establishedYear: 2018,
      verified: true,
      featured: true
    }
  });

  await prisma.travelAgency.create({
    data: {
      slug: 'oman-desert-journeys',
      nameEn: 'Oman Desert Journeys',
      nameAr: 'رحلات صحراء عُمان',
      descriptionEn:
        'A boutique travel agency creating desert, mountain, and cultural journeys across Oman.',
      descriptionAr:
        'وكالة سفر متخصصة في تنظيم رحلات الصحراء والجبال والتجارب الثقافية داخل عُمان.',
      headquartersEn: 'Muscat, Oman',
      headquartersAr: 'مسقط، عُمان',
      logo: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1200&q=80',
      phone: '+968 9555 5555',
      email: 'trips@omandesert.lux.om',
website: 'https://lux.om/travel-agencies/oman-desert-journeys',
      establishedYear: 2020,
      verified: true,
      featured: false
    }
  });

  const beachfrontVilla = await prisma.listing.create({
    data: {
      slug: 'al-mouj-beachfront-villa',
      title: 'Al Mouj Beachfront Villa',
      titleEn: 'Al Mouj Beachfront Villa',
      titleAr: 'فيلا شاطئية في الموج',
      description:
        'A private beachfront villa with resort-scale outdoor living, refined interiors, and uninterrupted water views.',
      descriptionEn:
        'A private beachfront villa with resort-scale outdoor living, refined interiors, and uninterrupted water views.',
      descriptionAr:
        'فيلا شاطئية خاصة بتصميم فاخر ومساحات خارجية واسعة وإطلالات مباشرة على المياه.',
      type: 'Villa',
      typeEn: 'Villa',
      typeAr: 'فيلا',
      transaction: 'Sale',
      location: 'Al Mouj, Muscat',
      locationEn: 'Al Mouj, Muscat',
      locationAr: 'الموج، مسقط',
      price: 'OMR 1,250,000',
      priceAmount: '1250000',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED',
      priceUnit: 'TOTAL',
      beds: 5,
      baths: 6,
      sqm: 650,
      image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
      status: 'APPROVED',
      maxGuests: 10,
      parking: true,
      furnishing: 'Furnished',
      view: 'Sea view',
      paymentFrequency: 'Total sale price',
      ownerId: owner.id,
      developerId: developer.id,
      nearestLandmarkId: mallOfOman.id,
      distanceFromLandmarkEn: '12 minutes from Mall of Oman',
      distanceFromLandmarkAr: 'يبعد 12 دقيقة عن مول عُمان',
      amenities: {
        create: [
          { name: 'Private pool', nameEn: 'Private pool', nameAr: 'مسبح خاص' },
          { name: 'Parking', nameEn: 'Parking', nameAr: 'مواقف سيارات' },
          { name: 'Security', nameEn: 'Security', nameAr: 'أمن' }
        ]
      },
      images: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
            altEn: 'Beachfront villa exterior',
            altAr: 'واجهة فيلا شاطئية',
            sortOrder: 0
          },
          {
            url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80',
            altEn: 'Luxury villa living room',
            altAr: 'غرفة معيشة فاخرة',
            sortOrder: 1
          }
        ]
      }
    }
  });

  await prisma.listing.create({
    data: {
      slug: 'qurum-contemporary-villa',
      title: 'Contemporary Villa',
      titleEn: 'Contemporary Villa',
      titleAr: 'فيلا عصرية',
      description: 'A calm architectural villa in Qurum with generous reception spaces and premium finishes.',
      descriptionEn:
        'A calm architectural villa in Qurum with generous reception spaces and premium finishes.',
      descriptionAr: 'فيلا عصرية هادئة في القرم بمساحات استقبال واسعة وتشطيبات راقية.',
      type: 'Villa',
      typeEn: 'Villa',
      typeAr: 'فيلا',
      transaction: 'Rent',
      location: 'Qurum, Muscat',
      locationEn: 'Qurum, Muscat',
      locationAr: 'القرم، مسقط',
      price: 'OMR 2,800 /mo',
      priceAmount: '2800',
      priceCurrency: 'OMR',
      priceQualifier: 'FIXED',
      priceUnit: 'MONTH',
      beds: 4,
      baths: 5,
      sqm: 420,
      image: 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=80',
      status: 'APPROVED',
      parking: true,
      furnishing: 'Furnished',
      view: 'Garden view',
      paymentFrequency: 'Per month',
      ownerId: owner.id,
      nearestLandmarkId: muscatHills.id,
      distanceFromLandmarkEn: '8 minutes from Muscat Hills',
      distanceFromLandmarkAr: 'تبعد 8 دقائق عن مسقط هيلز',
      amenities: {
        create: [
          { name: 'Garden', nameEn: 'Garden', nameAr: 'حديقة' },
          { name: 'Parking', nameEn: 'Parking', nameAr: 'مواقف سيارات' },
          { name: 'Maid room', nameEn: 'Maid room', nameAr: 'غرفة عاملة' }
        ]
      },
      images: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=80',
            altEn: 'Contemporary villa exterior',
            altAr: 'واجهة فيلا عصرية',
            sortOrder: 0
          }
        ]
      }
    }
  });

  const cruiseActivity = await prisma.activity.create({
    data: {
      slug: 'private-muscat-coast-cruise',
      titleEn: 'Private Muscat Coast Cruise',
      titleAr: 'رحلة بحرية خاصة على ساحل مسقط',
      descriptionEn:
        'A private coastal cruise with curated views of Muscat, flexible timing, and premium onboard service.',
      descriptionAr:
        'رحلة بحرية خاصة على ساحل مسقط مع توقيت مرن وخدمة راقية على متن القارب.',
      locationEn: 'Muscat Marina',
      locationAr: 'مارينا مسقط',
      categoryEn: 'Sea activity',
      categoryAr: 'نشاط بحري',
      providerEn: 'Muscat Coast Tours',
      providerAr: 'جولات ساحل مسقط',
      price: 'From OMR 95',
      priceAmount: '95',
      priceCurrency: 'OMR',
      priceQualifier: 'FROM',
      durationMinutes: 180,
durationLabelEn: '3 hours',
durationLabelAr: '3 ساعات',
durationType: 'Half day',
groupSize: 'Up to 8 guests',
availabilityDays: ['Thursday', 'Friday', 'Saturday'],
availabilityStartTime: '16:00',
availabilityEndTime: '19:00',
      language: 'Arabic / English',
      difficulty: 'Easy',
      activityType: 'Private',
      familyFriendly: true,
      includesTransfer: false,
      mealIncluded: true,
      outdoor: true,
      status: 'APPROVED',
      ownerId: activityProvider.id,
      travelAgencyId: muscatCoastTours.id,
      nearestLandmarkId: mallOfOman.id,
      distanceFromLandmarkEn: '20 minutes from Mall of Oman',
      distanceFromLandmarkAr: 'يبعد 20 دقيقة عن مول عُمان',
      images: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
            altEn: 'Private coastal cruise',
            altAr: 'رحلة بحرية خاصة',
            sortOrder: 0
          }
        ]
      },
      highlights: {
        create: [
          {
            textEn: 'Private boat experience',
            textAr: 'تجربة قارب خاصة'
          },
          {
            textEn: 'Sunset timing available',
            textAr: 'إمكانية اختيار وقت الغروب'
          },
          {
            textEn: 'Light refreshments included',
            textAr: 'تشمل ضيافة خفيفة'
          }
        ]
      }
    }
  });

  await prisma.inquiry.create({
    data: {
      type: 'PROPERTY',
      name: 'Sample Lead',
      email: 'lead@example.com',
      phone: '+968 9333 3333',
      message: 'I would like more details about this beachfront villa.',
      userId: user.id,
      listingId: beachfrontVilla.id
    }
  });

  await prisma.inquiry.create({
    data: {
      type: 'ACTIVITY',
      name: 'Sample Activity Lead',
      email: 'activity-lead@example.com',
      phone: '+968 9666 6666',
      message: 'I would like to know if the cruise is available this weekend.',
      userId: user.id,
      activityId: cruiseActivity.id
    }
  });

  const pmsDemo = await seedPmsDemoData({
    companyId: developer.id,
    managerId: owner.id,
    hashedPassword,
  });

  console.log('Seed complete');
  console.log({
    admin: admin.email,
    owner: owner.email,
    activityProvider: activityProvider.email,
    user: user.email,
    pmsDemo: pmsDemo
      ? {
          property: pmsDemo.property.name,
          unit: pmsDemo.unit.unitNumber,
          tenant: pmsDemo.tenant.email
        }
      : 'set SEED_INCLUDE_PMS_DEMO=true for local PMS demo data'
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log({
      seedPassword
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
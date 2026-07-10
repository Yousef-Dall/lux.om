import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/middleware/auth';

const app = createApp();

async function clearCrmTestData() {
  await prisma.crmActivity.deleteMany();
  await prisma.crmLead.deleteMany();
  await prisma.crmContact.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.pmsMemberPermission.deleteMany();
  await prisma.pmsMemberPropertyAccess.deleteMany();
  await prisma.pmsCompanyMember.deleteMany();
  await prisma.pmsCompanyEntitlement.deleteMany();
  await prisma.pmsProperty.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.developerCompany.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser(email: string, role: 'ADMIN' | 'USER' | 'OWNER' = 'USER') {
  return prisma.user.create({
    data: {
      name: email.split('@')[0],
      email,
      password: 'test-password',
      role,
      emailVerified: true
    }
  });
}

async function createListing(ownerId: string) {
  return prisma.listing.create({
    data: {
      slug: `crm-listing-${Date.now()}`,
      title: 'CRM Listing',
      titleEn: 'CRM Listing',
      description: 'Marketplace inquiry CRM integration fixture.',
      type: 'Apartment',
      typeEn: 'Apartment',
      transaction: 'Rent',
      location: 'Muscat',
      locationEn: 'Muscat',
      price: 'OMR 800/month',
      priceAmount: '800',
      priceCurrency: 'OMR',
      beds: 2,
      baths: 2,
      sqm: 120,
      image: 'https://example.com/crm-listing.jpg',
      status: 'APPROVED',
      ownerId
    }
  });
}

async function createPmsWorkspace(slug: string, userIds: string[]) {
  const company = await prisma.developerCompany.create({
    data: { slug, nameEn: `CRM ${slug}`, verified: true }
  });
  await prisma.pmsCompanyEntitlement.create({
    data: { companyId: company.id, status: 'ACTIVE', enabledAt: new Date() }
  });
  const properties = await Promise.all([
    prisma.pmsProperty.create({ data: { companyId: company.id, name: 'Property A', code: 'A' } }),
    prisma.pmsProperty.create({ data: { companyId: company.id, name: 'Property B', code: 'B' } })
  ]);
  const members = [];
  for (let index = 0; index < userIds.length; index += 1) {
    const member = await prisma.pmsCompanyMember.create({
      data: { companyId: company.id, userId: userIds[index], role: 'PMS_MANAGER' }
    });
    await prisma.pmsMemberPropertyAccess.create({
      data: { companyId: company.id, memberId: member.id, propertyId: properties[index % properties.length].id }
    });
    members.push(member);
  }
  return { company, properties, members };
}

describe('CRM foundation access and lifecycle', () => {
  beforeEach(async () => {
    await clearCrmTestData();
  });

  it('captures listing inquiries as private leads for the marketplace owner', async () => {
    const [owner, outsider, customer, admin] = await Promise.all([
      createUser('crm-owner@lux.test', 'OWNER'),
      createUser('crm-outsider@lux.test', 'OWNER'),
      createUser('crm-customer@lux.test'),
      createUser('crm-admin@lux.test', 'ADMIN')
    ]);
    const listing = await createListing(owner.id);

    await request(app)
      .post('/api/inquiries')
      .set('Authorization', `Bearer ${signToken(customer)}`)
      .send({
        type: 'PROPERTY',
        name: 'Interested Customer',
        email: 'interested@lux.test',
        phone: '+96890000000',
        message: 'I would like to arrange a viewing for this property.',
        listingId: listing.id
      })
      .expect(201);

    const ownerResponse = await request(app)
      .get('/api/crm/leads?workspace=personal')
      .set('Authorization', `Bearer ${signToken(owner)}`)
      .expect(200);
    expect(ownerResponse.body.summary.total).toBe(1);
    expect(ownerResponse.body.leads[0]).toMatchObject({
      source: 'LISTING_INQUIRY',
      ownerUserId: owner.id,
      listingId: listing.id,
      contact: { email: 'interested@lux.test' }
    });

    const outsiderResponse = await request(app)
      .get('/api/crm/leads?workspace=personal')
      .set('Authorization', `Bearer ${signToken(outsider)}`)
      .expect(200);
    expect(outsiderResponse.body.summary.total).toBe(0);

    await request(app)
      .get('/api/crm/leads')
      .set('Authorization', `Bearer ${signToken(customer)}`)
      .expect(403);

    await request(app)
      .post('/api/inquiries')
      .set('Authorization', `Bearer ${signToken(customer)}`)
      .send({
        type: 'GENERAL',
        name: 'General Contact',
        email: 'general-contact@lux.test',
        message: 'I need help choosing the right lux.om service.'
      })
      .expect(201);

    const adminOnlyResponse = await request(app)
      .get('/api/crm/leads?workspace=admin')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .expect(200);
    expect(adminOnlyResponse.body.summary.total).toBe(1);
    expect(adminOnlyResponse.body.leads[0]).toMatchObject({ source: 'CONTACT_FORM', companyId: null, ownerUserId: null });

    await request(app)
      .patch(`/api/crm/leads/${ownerResponse.body.leads[0].id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'CONTACTED' })
      .expect(200);

    await request(app)
      .patch(`/api/crm/leads/${ownerResponse.body.leads[0].id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ assignedToId: outsider.id })
      .expect(403);

    const adminResponse = await request(app)
      .get('/api/crm/leads')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .expect(200);
    expect(adminResponse.body.summary.total).toBe(2);
  });

  it('keeps PMS company leads inside company and assigned-property scopes', async () => {
    const [propertyAManager, propertyBManager, crossCompanyManager, admin] = await Promise.all([
      createUser('crm-property-a@lux.test'),
      createUser('crm-property-b@lux.test'),
      createUser('crm-other-company@lux.test'),
      createUser('crm-scope-admin@lux.test', 'ADMIN')
    ]);
    const first = await createPmsWorkspace('crm-company-one', [propertyAManager.id, propertyBManager.id]);
    const second = await createPmsWorkspace('crm-company-two', [crossCompanyManager.id]);

    const created = await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${signToken(propertyAManager)}`)
      .send({
        title: 'Owner onboarding opportunity',
        source: 'PMS_OWNER',
        companyId: first.company.id,
        assignedToId: propertyAManager.id,
        contact: { fullName: 'Portfolio Owner', email: 'portfolio-owner@lux.test' },
        sourceReferences: { pmsPropertyId: first.properties[0].id }
      })
      .expect(201);
    expect(created.body.lead.pmsPropertyId).toBe(first.properties[0].id);

    await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${signToken(propertyAManager)}`)
      .send({
        title: 'Invalid dual-workspace lead',
        source: 'MANUAL',
        companyId: first.company.id,
        ownerUserId: propertyBManager.id,
        contact: { fullName: 'Invalid Contact', email: 'invalid-workspace@lux.test' },
        sourceReferences: { pmsPropertyId: first.properties[0].id }
      })
      .expect(400);

    const assignees = await request(app)
      .get(`/api/crm/assignees?companyId=${first.company.id}&propertyId=${first.properties[0].id}`)
      .set('Authorization', `Bearer ${signToken(propertyAManager)}`)
      .expect(200);
    expect(assignees.body.assignees.map((person: { id: string }) => person.id)).toContain(propertyAManager.id);
    expect(assignees.body.assignees.map((person: { id: string }) => person.id)).not.toContain(propertyBManager.id);

    const sameScope = await request(app)
      .get(`/api/crm/leads?companyId=${first.company.id}`)
      .set('Authorization', `Bearer ${signToken(propertyAManager)}`)
      .expect(200);
    expect(sameScope.body.summary.total).toBe(1);

    const otherProperty = await request(app)
      .get(`/api/crm/leads?companyId=${first.company.id}`)
      .set('Authorization', `Bearer ${signToken(propertyBManager)}`)
      .expect(200);
    expect(otherProperty.body.summary.total).toBe(0);

    await request(app)
      .patch(`/api/crm/leads/${created.body.lead.id}`)
      .set('Authorization', `Bearer ${signToken(propertyAManager)}`)
      .send({ assignedToId: propertyBManager.id })
      .expect(403);

    await request(app)
      .get(`/api/crm/leads?companyId=${first.company.id}`)
      .set('Authorization', `Bearer ${signToken(crossCompanyManager)}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.summary.total).toBe(0);
      });

    await request(app)
      .patch(`/api/crm/leads/${created.body.lead.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ assignedToId: crossCompanyManager.id })
      .expect(403);

    const adminResponse = await request(app)
      .get(`/api/crm/leads?companyId=${first.company.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .expect(200);
    expect(adminResponse.body.summary.total).toBe(1);
    expect(second.company.id).not.toBe(first.company.id);
  });

  it('enforces stage transitions and records tasks in the lead timeline', async () => {
    const owner = await createUser('crm-lifecycle-owner@lux.test', 'OWNER');
    const token = signToken(owner);

    const created = await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Manual rental opportunity',
        source: 'MANUAL',
        ownerUserId: owner.id,
        assignedToId: owner.id,
        nextFollowUpAt: '2026-07-15T08:00:00.000Z',
        contact: { fullName: 'Manual Contact', email: 'manual-contact@lux.test' },
        sourceReferences: {}
      })
      .expect(201);
    const leadId = created.body.lead.id as string;

    await request(app)
      .patch(`/api/crm/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'WON' })
      .expect(400);

    await request(app)
      .patch(`/api/crm/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CONTACTED' })
      .expect(200);

    const task = await request(app)
      .post(`/api/crm/leads/${leadId}/activities`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'TASK', subject: 'Arrange viewing', assignedToId: owner.id, dueAt: '2026-07-16T08:00:00.000Z' })
      .expect(201);

    await request(app)
      .patch(`/api/crm/leads/${leadId}/activities/${task.body.activity.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    await request(app)
      .get('/api/crm/leads?from=2026-07-20T00:00:00.000Z&to=2026-07-01T00:00:00.000Z')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    const detail = await request(app)
      .get(`/api/crm/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.lead.status).toBe('CONTACTED');
    expect(detail.body.lead.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'STATUS_CHANGE', status: 'COMPLETED' }),
      expect.objectContaining({ type: 'TASK', status: 'COMPLETED', subject: 'Arrange viewing' })
    ]));
  });
});

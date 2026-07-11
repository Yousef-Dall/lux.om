import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { clearIntegrationTestDatabase } from './integration/clearDatabase';
import { signToken } from '../src/middleware/auth';

const app = createApp();

async function clearCrmTestData() {
  await clearIntegrationTestDatabase();
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
  it('provides deterministic scoring, pipeline analytics, tasks, and draft-only communications', async () => {
    const owner = await createUser('crm-workflow-owner@lux.test', 'OWNER');
    const token = signToken(owner);

    const created = await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'High-intent sales opportunity',
        source: 'LISTING_INQUIRY',
        priority: 'HIGH',
        ownerUserId: owner.id,
        assignedToId: owner.id,
        expectedValue: 125000,
        nextFollowUpAt: '2000-01-02T08:00:00.000Z',
        contact: { fullName: 'Pipeline Contact', email: 'pipeline-contact@lux.test', phone: '+96890001111' },
        sourceReferences: {}
      })
      .expect(201);
    const leadId = created.body.lead.id as string;

    await request(app).patch(`/api/crm/leads/${leadId}`).set('Authorization', `Bearer ${token}`).send({ status: 'CONTACTED' }).expect(200);
    await request(app).patch(`/api/crm/leads/${leadId}`).set('Authorization', `Bearer ${token}`).send({ status: 'QUALIFIED' }).expect(200);

    const task = await request(app)
      .post(`/api/crm/leads/${leadId}/activities`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'TASK', subject: 'Schedule property viewing', assignedToId: owner.id, priority: 'URGENT', dueAt: '2000-01-01T08:00:00.000Z' })
      .expect(201);
    expect(task.body.activity).toMatchObject({ type: 'TASK', status: 'OPEN', priority: 'URGENT' });

    await request(app)
      .post(`/api/crm/leads/${leadId}/activities`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'EMAIL',
        subject: 'Initial property follow-up',
        body: 'Draft opened and the external outcome was recorded by the operator.',
        priority: 'HIGH',
        communicationDirection: 'OUTBOUND',
        communicationOutcome: 'DRAFT_OPENED',
        templateKey: 'INITIAL_CONTACT'
      })
      .expect(201);

    const detail = await request(app).get(`/api/crm/leads/${leadId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(detail.body.lead.intelligence.score).toBeGreaterThan(0);
    expect(detail.body.lead.intelligence.scoreReasons.length).toBeGreaterThan(0);
    expect(detail.body.lead.intelligence.nextBestAction).toMatchObject({ key: 'COMPLETE_OVERDUE_TASK', priority: 'URGENT' });
    expect(detail.body.lead.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'EMAIL', communicationOutcome: 'DRAFT_OPENED', templateKey: 'INITIAL_CONTACT' }),
      expect.objectContaining({ type: 'TASK', priority: 'URGENT', status: 'OPEN' })
    ]));

    const tasks = await request(app).get('/api/crm/tasks?workspace=personal&overdue=true').set('Authorization', `Bearer ${token}`).expect(200);
    expect(tasks.body.summary).toMatchObject({ total: 1, overdue: 1 });
    expect(tasks.body.tasks[0]).toMatchObject({ leadId, id: task.body.activity.id, priority: 'URGENT' });

    const analytics = await request(app).get('/api/crm/analytics?workspace=personal').set('Authorization', `Bearer ${token}`).expect(200);
    expect(analytics.body.analytics).toMatchObject({ total: 1, openLeads: 1, overdueFollowUps: 1, openTasks: 1, overdueTasks: 1 });
    expect(analytics.body.analytics.bySource).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'LISTING_INQUIRY', total: 1, open: 1 })
    ]));

    const pipeline = await request(app).get('/api/crm/pipeline?workspace=personal&groupBy=status').set('Authorization', `Bearer ${token}`).expect(200);
    expect(pipeline.body.pipeline).toMatchObject({ groupBy: 'status', total: 1 });
    expect(pipeline.body.pipeline.groups).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'QUALIFIED', count: 1 })]));

    const templates = await request(app).get(`/api/crm/leads/${leadId}/communication-templates`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(templates.body.delivery).toMatchObject({ email: 'draft_only', whatsapp: 'draft_only' });
    expect(templates.body.templates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'INITIAL_CONTACT', emailHref: expect.stringContaining('mailto:') }),
      expect.objectContaining({ whatsappHref: expect.stringContaining('https://wa.me/') })
    ]));

    await request(app).patch(`/api/crm/leads/${leadId}/activities/${task.body.activity.id}`).set('Authorization', `Bearer ${token}`).send({ status: 'COMPLETED' }).expect(200);
  });

  it('keeps CRM task queues and communication history inside company property scope', async () => {
    const [propertyAManager, propertyBManager, outsider] = await Promise.all([
      createUser('crm-task-property-a@lux.test'),
      createUser('crm-task-property-b@lux.test'),
      createUser('crm-task-outsider@lux.test')
    ]);
    const workspace = await createPmsWorkspace('crm-task-scope', [propertyAManager.id, propertyBManager.id]);
    const tokenA = signToken(propertyAManager);
    const tokenB = signToken(propertyBManager);

    const created = await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Scoped owner sales follow-up', source: 'PMS_OWNER', companyId: workspace.company.id,
        assignedToId: propertyAManager.id, contact: { fullName: 'Scoped Owner', email: 'scoped-owner@lux.test' },
        sourceReferences: { pmsPropertyId: workspace.properties[0].id }
      })
      .expect(201);
    const leadId = created.body.lead.id as string;

    const task = await request(app)
      .post(`/api/crm/leads/${leadId}/activities`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'TASK', subject: 'Collect ownership documents', priority: 'HIGH', dueAt: '2000-01-01T00:00:00.000Z' })
      .expect(201);

    await request(app)
      .post(`/api/crm/leads/${leadId}/activities`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'WHATSAPP', subject: 'Owner onboarding draft', communicationDirection: 'OUTBOUND', communicationOutcome: 'DRAFT_OPENED', templateKey: 'DOCUMENT_REQUEST' })
      .expect(201);

    const ownTasks = await request(app).get(`/api/crm/tasks?companyId=${workspace.company.id}`).set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(ownTasks.body.summary.total).toBe(1);

    const otherPropertyTasks = await request(app).get(`/api/crm/tasks?companyId=${workspace.company.id}`).set('Authorization', `Bearer ${tokenB}`).expect(200);
    expect(otherPropertyTasks.body.summary.total).toBe(0);

    await request(app).get(`/api/crm/leads/${leadId}`).set('Authorization', `Bearer ${tokenB}`).expect(404);
    await request(app).patch(`/api/crm/leads/${leadId}/activities/${task.body.activity.id}`).set('Authorization', `Bearer ${signToken(outsider)}`).send({ status: 'COMPLETED' }).expect(404);
  });

  it('supports company CRM without PMS entitlement and retains access when PMS is suspended', async () => {
    const [admin, member, outsider] = await Promise.all([
      createUser('crm-workspace-admin@lux.test', 'ADMIN'),
      createUser('crm-workspace-member@lux.test'),
      createUser('crm-workspace-outsider@lux.test')
    ]);
    const company = await prisma.developerCompany.create({
      data: { slug: 'crm-independent-company', nameEn: 'Independent CRM Company', verified: true }
    });

    await request(app)
      .post(`/api/crm/workspaces/company/${company.id}/members`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({
        userId: member.id,
        role: 'MANAGER',
        permissions: ['CRM_VIEW', 'CRM_MANAGE', 'CRM_ASSIGN', 'WORKSPACE_MANAGE']
      })
      .expect(201);

    const access = await request(app)
      .get('/api/crm/access')
      .set('Authorization', `Bearer ${signToken(member)}`)
      .expect(200);
    expect(access.body.access.companyWorkspaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ companyId: company.id, canView: true, canManage: true })
    ]));

    const created = await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${signToken(member)}`)
      .send({
        title: 'CRM-only company opportunity',
        source: 'MANUAL',
        companyId: company.id,
        contact: { fullName: 'CRM-only Contact', email: 'crm-only-contact@lux.test' },
        sourceReferences: {}
      })
      .expect(201);
    expect(created.body.lead.workspaceId).toEqual(expect.any(String));
    expect(created.body.lead.companyId).toBe(company.id);
    expect(created.body.lead.contact.workspaceId).toBe(created.body.lead.workspaceId);
    expect(created.body.lead.activities[0].workspaceId).toBe(created.body.lead.workspaceId);

    await request(app)
      .get(`/api/crm/leads?companyId=${company.id}`)
      .set('Authorization', `Bearer ${signToken(outsider)}`)
      .expect(403);

    await prisma.pmsCompanyEntitlement.create({
      data: { companyId: company.id, status: 'SUSPENDED', disabledAt: new Date() }
    });

    const retained = await request(app)
      .get(`/api/crm/leads?companyId=${company.id}`)
      .set('Authorization', `Bearer ${signToken(member)}`)
      .expect(200);
    expect(retained.body.summary.total).toBe(1);
  });

});

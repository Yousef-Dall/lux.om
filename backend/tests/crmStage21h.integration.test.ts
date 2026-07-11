import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/middleware/auth';
import { ingestCrmRelationshipSignal } from '../src/modules/crm/stage21h/ingestion';
import { clearIntegrationTestDatabase } from './integration/clearDatabase';

const app = createApp();
let fixtureCounter = 0;

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

async function createCompanyWorkspace(input: {
  slug: string;
  members: Array<{ userId: string; allProperties?: boolean; propertyIndex?: number }>;
}) {
  fixtureCounter += 1;
  const company = await prisma.developerCompany.create({
    data: { slug: `${input.slug}-${fixtureCounter}`, nameEn: `CRM ${input.slug} ${fixtureCounter}`, verified: true }
  });
  const workspace = await prisma.workspace.create({
    data: { type: 'COMPANY', name: `${company.nameEn} workspace`, companyId: company.id }
  });
  const properties = await Promise.all([
    prisma.pmsProperty.create({ data: { companyId: company.id, name: 'CRM Property A', code: `A-${fixtureCounter}` } }),
    prisma.pmsProperty.create({ data: { companyId: company.id, name: 'CRM Property B', code: `B-${fixtureCounter}` } })
  ]);
  const memberships = [];
  for (const memberInput of input.members) {
    const member = await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: memberInput.userId, role: 'MANAGER' }
    });
    if (!memberInput.allProperties) {
      await prisma.workspacePropertyScope.create({
        data: { memberId: member.id, propertyId: properties[memberInput.propertyIndex ?? 0].id }
      });
    }
    memberships.push(member);
  }
  return { company, workspace, properties, memberships };
}

async function createLead(input: {
  token: string;
  companyId: string;
  propertyId: string;
  assignedToId: string;
  title: string;
  fullName: string;
  email: string;
  expectedValue?: number;
  currency?: string;
}) {
  return request(app)
    .post('/api/crm/leads')
    .set('Authorization', `Bearer ${input.token}`)
    .send({
      title: input.title,
      source: 'MANUAL',
      companyId: input.companyId,
      assignedToId: input.assignedToId,
      expectedValue: input.expectedValue ?? 1000,
      currency: input.currency ?? 'OMR',
      contact: { fullName: input.fullName, email: input.email },
      sourceReferences: { pmsPropertyId: input.propertyId }
    })
    .expect(201);
}

async function convertLead(input: {
  token: string;
  leadId: string;
  accountId?: string;
  accountName?: string;
  dealName: string;
  pipelineId?: string;
  stageId?: string;
}) {
  return request(app)
    .post(`/api/crm/leads/${input.leadId}/convert`)
    .set('Authorization', `Bearer ${input.token}`)
    .send({
      accountId: input.accountId,
      accountName: input.accountName,
      accountType: 'COMPANY',
      dealName: input.dealName,
      pipelineId: input.pipelineId,
      stageId: input.stageId
    })
    .expect(201);
}

beforeEach(async () => {
  await clearIntegrationTestDatabase();
});

afterEach(() => {
  delete process.env.CRM_PROVIDER_WEBHOOK_SECRET;
});

describe('CRM Stage 21H revenue operations', () => {
  it('supports workspace-scoped accounts with multiple contacts and multiple deals', async () => {
    const [manager, outsider, customer] = await Promise.all([
      createUser('crm21h-manager@lux.test'),
      createUser('crm21h-outsider@lux.test'),
      createUser('crm21h-customer@lux.test')
    ]);
    const first = await createCompanyWorkspace({ slug: 'accounts', members: [{ userId: manager.id, allProperties: true }] });
    const second = await createCompanyWorkspace({ slug: 'outside', members: [{ userId: outsider.id, allProperties: true }] });
    const token = signToken(manager);

    const firstLead = await createLead({
      token,
      companyId: first.company.id,
      propertyId: first.properties[0].id,
      assignedToId: manager.id,
      title: 'Developer partnership one',
      fullName: 'Partnership Contact One',
      email: 'account-contact-one@lux.test'
    });
    const firstConversion = await convertLead({
      token,
      leadId: firstLead.body.lead.id,
      accountName: 'Atlas Development Group',
      dealName: 'Atlas launch partnership'
    });

    const secondLead = await createLead({
      token,
      companyId: first.company.id,
      propertyId: first.properties[0].id,
      assignedToId: manager.id,
      title: 'Developer partnership two',
      fullName: 'Partnership Contact Two',
      email: 'account-contact-two@lux.test'
    });
    await convertLead({
      token,
      leadId: secondLead.body.lead.id,
      accountId: firstConversion.body.account.id,
      dealName: 'Atlas portfolio expansion'
    });

    const account = await request(app)
      .get(`/api/crm/accounts/${firstConversion.body.account.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(account.body.account.contacts).toHaveLength(2);
    expect(account.body.account.deals).toHaveLength(2);
    expect(new Set(account.body.account.deals.map((deal: { sourceLeadId: string }) => deal.sourceLeadId))).toEqual(
      new Set([firstLead.body.lead.id, secondLead.body.lead.id])
    );

    await request(app)
      .get(`/api/crm/accounts?workspaceId=${first.workspace.id}`)
      .set('Authorization', `Bearer ${signToken(outsider)}`)
      .expect(403);
    await request(app)
      .get(`/api/crm/accounts?workspaceId=${second.workspace.id}`)
      .set('Authorization', `Bearer ${signToken(customer)}`)
      .expect(403);
  });

  it('keeps new account, contact, deal, source, and analytics reads inside property scope', async () => {
    const [portfolioManager, propertyAManager] = await Promise.all([
      createUser('crm21h-portfolio@lux.test'),
      createUser('crm21h-property-a@lux.test')
    ]);
    const fixture = await createCompanyWorkspace({
      slug: 'property-scope',
      members: [
        { userId: portfolioManager.id, allProperties: true },
        { userId: propertyAManager.id, propertyIndex: 0 }
      ]
    });
    const portfolioToken = signToken(portfolioManager);
    const propertyToken = signToken(propertyAManager);

    const propertyBLead = await createLead({
      token: portfolioToken,
      companyId: fixture.company.id,
      propertyId: fixture.properties[1].id,
      assignedToId: portfolioManager.id,
      title: 'Property B institutional opportunity',
      fullName: 'Hidden Property Contact',
      email: 'property-b-hidden@lux.test'
    });
    const converted = await convertLead({
      token: portfolioToken,
      leadId: propertyBLead.body.lead.id,
      accountName: 'Property B Investor',
      dealName: 'Property B investment'
    });

    const accounts = await request(app)
      .get(`/api/crm/accounts?workspaceId=${fixture.workspace.id}`)
      .set('Authorization', `Bearer ${propertyToken}`)
      .expect(200);
    expect(accounts.body.accounts).toHaveLength(0);

    const deals = await request(app)
      .get(`/api/crm/deals?workspaceId=${fixture.workspace.id}`)
      .set('Authorization', `Bearer ${propertyToken}`)
      .expect(200);
    expect(deals.body.deals).toHaveLength(0);

    await request(app)
      .get(`/api/crm/contacts/${converted.body.deal.primaryContact.id}`)
      .set('Authorization', `Bearer ${propertyToken}`)
      .expect(403);

    const sourceEvents = await request(app)
      .get(`/api/crm/source-events?workspaceId=${fixture.workspace.id}`)
      .set('Authorization', `Bearer ${propertyToken}`)
      .expect(200);
    expect(sourceEvents.body.events).toHaveLength(0);

    const forecast = await request(app)
      .get(`/api/crm/analytics/forecast?workspaceId=${fixture.workspace.id}`)
      .set('Authorization', `Bearer ${propertyToken}`)
      .expect(200);
    expect(forecast.body.snapshot.leads.total).toBe(0);
    expect(forecast.body.snapshot.deals.forecast).toHaveLength(0);
  });

  it('configures pipelines, preserves outcome after archival, and records immutable stage history', async () => {
    const manager = await createUser('crm21h-pipeline@lux.test');
    const fixture = await createCompanyWorkspace({ slug: 'pipeline', members: [{ userId: manager.id, allProperties: true }] });
    const token = signToken(manager);

    const pipelineResponse = await request(app)
      .post('/api/crm/pipelines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workspaceId: fixture.workspace.id,
        name: 'Institutional pipeline',
        stages: [
          { key: 'DISCOVERY', name: 'Discovery', position: 10, type: 'OPEN', defaultProbability: 20, requiredFields: [] },
          { key: 'COMMITTED', name: 'Committed', position: 20, type: 'WON', defaultProbability: 100, requiredFields: ['expectedValue'] },
          { key: 'DECLINED', name: 'Declined', position: 30, type: 'LOST', defaultProbability: 0, requiredFields: [] }
        ]
      })
      .expect(201);
    const pipeline = pipelineResponse.body.pipeline;
    const openStage = pipeline.stages.find((stage: { type: string }) => stage.type === 'OPEN');
    const wonStage = pipeline.stages.find((stage: { type: string }) => stage.type === 'WON');
    const lostStage = pipeline.stages.find((stage: { type: string }) => stage.type === 'LOST');

    const lead = await createLead({
      token,
      companyId: fixture.company.id,
      propertyId: fixture.properties[0].id,
      assignedToId: manager.id,
      title: 'Institutional deal',
      fullName: 'Institutional Contact',
      email: 'institutional-contact@lux.test',
      expectedValue: 250000
    });
    const conversion = await convertLead({
      token,
      leadId: lead.body.lead.id,
      accountName: 'Institutional Partner',
      dealName: 'Institutional portfolio mandate',
      pipelineId: pipeline.id,
      stageId: openStage.id
    });

    await request(app)
      .post(`/api/crm/deals/${conversion.body.deal.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: lostStage.id })
      .expect(400);

    const won = await request(app)
      .post(`/api/crm/deals/${conversion.body.deal.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: wonStage.id, reason: 'Signed commercial agreement', wonReason: 'Signed annual portfolio agreement' })
      .expect(200);
    expect(won.body.deal.outcome).toBe('WON');
    expect(won.body.deal.wonAt).toBeTruthy();
    expect(won.body.deal.wonReason).toBe('Signed annual portfolio agreement');

    const archived = await request(app)
      .patch(`/api/crm/deals/${conversion.body.deal.id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send({ archived: true, reason: 'Moved to historical portfolio' })
      .expect(200);
    expect(archived.body.deal.outcome).toBe('WON');
    expect(archived.body.deal.archivedAt).toBeTruthy();

    await request(app)
      .post(`/api/crm/deals/${conversion.body.deal.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: openStage.id, reason: 'Expansion opportunity reopened' })
      .expect(409);

    await request(app)
      .patch(`/api/crm/deals/${conversion.body.deal.id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send({ archived: false, reason: 'Restored for a new expansion cycle' })
      .expect(200);

    const reopened = await request(app)
      .post(`/api/crm/deals/${conversion.body.deal.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: openStage.id, reason: 'Expansion opportunity reopened' })
      .expect(200);
    expect(reopened.body.deal.outcome).toBe('OPEN');
    expect(reopened.body.deal.reopenedCount).toBe(1);

    const detail = await request(app)
      .get(`/api/crm/deals/${conversion.body.deal.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.deal.stageHistory).toHaveLength(3);
    expect(detail.body.deal.stageHistory.at(-1).reopened).toBe(true);

    const historyId = detail.body.deal.stageHistory[0].id;
    await expect(prisma.crmStageHistory.update({ where: { id: historyId }, data: { reason: 'tampered' } })).rejects.toThrow();

    await request(app)
      .patch(`/api/crm/pipeline-stages/${openStage.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'LOST' })
      .expect(409);

    await request(app)
      .patch(`/api/crm/pipeline-stages/${wonStage.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false })
      .expect(409);
  });

  it('persists explainable score snapshots and controlled scoring-version recalculation', async () => {
    const manager = await createUser('crm21h-score@lux.test');
    const fixture = await createCompanyWorkspace({ slug: 'score', members: [{ userId: manager.id, allProperties: true }] });
    const token = signToken(manager);
    const lead = await createLead({
      token,
      companyId: fixture.company.id,
      propertyId: fixture.properties[0].id,
      assignedToId: manager.id,
      title: 'High intent investor',
      fullName: 'Scored Investor',
      email: 'scored-investor@lux.test'
    });

    await request(app)
      .post(`/api/crm/leads/${lead.body.lead.id}/activities`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'CALL', subject: 'Completed qualification call', status: 'COMPLETED', communicationOutcome: 'CONNECTED' })
      .expect(201);

    await request(app)
      .post('/api/crm/scores/recalculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: fixture.workspace.id, version: 'crm-deterministic-v3-test' })
      .expect(200);

    const history = await request(app)
      .get(`/api/crm/leads/${lead.body.lead.id}/score-history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(history.body.snapshots.length).toBeGreaterThanOrEqual(2);
    expect(history.body.snapshots[0]).toMatchObject({ version: 'crm-deterministic-v3-test' });
    expect(Array.isArray(history.body.snapshots[0].reasons)).toBe(true);
    expect(history.body.snapshots[0].signals).toBeTypeOf('object');

    const storedLead = await prisma.crmLead.findUniqueOrThrow({ where: { id: lead.body.lead.id } });
    expect(storedLead.scoringVersion).toBe('crm-deterministic-v3-test');
    expect(storedLead.scoreCalculatedAt).toBeTruthy();
    expect(storedLead.score).toBeGreaterThanOrEqual(0);
    await expect(prisma.crmScoreSnapshot.update({
      where: { id: history.body.snapshots[0].id },
      data: { score: 1 }
    })).rejects.toThrow();
  });

  it('detects duplicates, previews controlled merges, preserves links, and blocks cross-workspace merges', async () => {
    const [manager, otherManager] = await Promise.all([
      createUser('crm21h-merge@lux.test'),
      createUser('crm21h-merge-other@lux.test')
    ]);
    const first = await createCompanyWorkspace({ slug: 'merge', members: [{ userId: manager.id, allProperties: true }] });
    const second = await createCompanyWorkspace({ slug: 'merge-other', members: [{ userId: otherManager.id, allProperties: true }] });
    const token = signToken(manager);

    const leadOne = await createLead({ token, companyId: first.company.id, propertyId: first.properties[0].id, assignedToId: manager.id, title: 'Duplicate one', fullName: 'Same Relationship', email: 'same-one@lux.test' });
    const convertedOne = await convertLead({ token, leadId: leadOne.body.lead.id, accountName: 'Merge Account', dealName: 'Merge deal one' });
    const leadTwo = await createLead({ token, companyId: first.company.id, propertyId: first.properties[0].id, assignedToId: manager.id, title: 'Duplicate two', fullName: 'Same Relationship', email: 'same-two@lux.test' });
    const convertedTwo = await convertLead({ token, leadId: leadTwo.body.lead.id, accountId: convertedOne.body.account.id, dealName: 'Merge deal two' });

    const primaryId = convertedOne.body.deal.primaryContact.id;
    const duplicateId = convertedTwo.body.deal.primaryContact.id;
    const contactDetail = await request(app)
      .get(`/api/crm/contacts/${primaryId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(contactDetail.body.duplicates.map((candidate: { id: string }) => candidate.id)).toContain(duplicateId);

    const preview = await request(app)
      .post(`/api/crm/contacts/${primaryId}/merge-preview`)
      .set('Authorization', `Bearer ${token}`)
      .send({ duplicateContactId: duplicateId })
      .expect(200);
    expect(preview.body.preview.movedLinks.leads).toBe(1);
    expect(preview.body.preview.movedLinks.primaryDeals).toBe(1);

    await request(app)
      .post(`/api/crm/contacts/${primaryId}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ duplicateContactId: duplicateId, resolutions: { email: 'same-one@lux.test' } })
      .expect(200);

    expect(await prisma.crmLead.count({ where: { contactId: primaryId } })).toBe(2);
    expect(await prisma.crmDeal.count({ where: { primaryContactId: primaryId } })).toBe(2);
    const duplicate = await prisma.crmContact.findUniqueOrThrow({ where: { id: duplicateId } });
    expect(duplicate.mergedIntoContactId).toBe(primaryId);
    expect(duplicate.archivedAt).toBeTruthy();

    const otherLead = await createLead({ token: signToken(otherManager), companyId: second.company.id, propertyId: second.properties[0].id, assignedToId: otherManager.id, title: 'Other workspace', fullName: 'Other Contact', email: 'other-workspace-contact@lux.test' });
    await request(app)
      .post(`/api/crm/contacts/${primaryId}/merge-preview`)
      .set('Authorization', `Bearer ${token}`)
      .send({ duplicateContactId: otherLead.body.lead.contact.id })
      .expect(403);
  });

  it('ingests canonical source events idempotently and advances stronger signals without duplicating leads', async () => {
    const manager = await createUser('crm21h-ingestion@lux.test');
    const fixture = await createCompanyWorkspace({ slug: 'ingestion', members: [{ userId: manager.id, allProperties: true }] });

    const first = await prisma.$transaction((tx) => ingestCrmRelationshipSignal(tx, {
      workspaceId: fixture.workspace.id,
      sourceType: 'MANUAL',
      sourceRecordId: 'canonical-signal-1',
      ruleKey: 'explicit-high-intent',
      contact: { fullName: 'Canonical Contact', email: 'canonical@lux.test' },
      companyId: fixture.company.id,
      pmsPropertyId: fixture.properties[0].id,
      title: 'Canonical source lead',
      status: 'QUALIFIED',
      consentStatus: 'LEGITIMATE_INTEREST',
      createLead: true,
      actorId: manager.id
    }));
    const duplicate = await prisma.$transaction((tx) => ingestCrmRelationshipSignal(tx, {
      workspaceId: fixture.workspace.id,
      sourceType: 'MANUAL',
      sourceRecordId: 'canonical-signal-1',
      ruleKey: 'explicit-high-intent',
      contact: { fullName: 'Canonical Contact', email: 'canonical@lux.test' },
      companyId: fixture.company.id,
      pmsPropertyId: fixture.properties[0].id,
      title: 'Canonical source lead',
      status: 'QUALIFIED',
      consentStatus: 'LEGITIMATE_INTEREST',
      createLead: true,
      actorId: manager.id
    }));
    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.lead?.id).toBe(first.lead?.id);
    expect(await prisma.crmSourceEvent.count({ where: { sourceRecordId: 'canonical-signal-1' } })).toBe(1);
    expect(await prisma.crmLead.count({ where: { workspaceId: fixture.workspace.id } })).toBe(1);
    expect(await prisma.crmContact.count({ where: { workspaceId: fixture.workspace.id } })).toBe(1);

    const passive = await prisma.$transaction((tx) => ingestCrmRelationshipSignal(tx, {
      workspaceId: fixture.workspace.id,
      sourceType: 'HIGH_INTENT_SAVED_SEARCH',
      sourceRecordId: 'passive-search-1',
      ruleKey: 'passive-no-alerts',
      contact: { fullName: 'Passive Contact', email: 'passive@lux.test' },
      companyId: fixture.company.id,
      title: 'Passive search provenance',
      consentStatus: 'UNKNOWN',
      createLead: false,
      actorId: manager.id
    }));
    expect(passive.lead).toBeNull();
    expect(await prisma.crmSourceEvent.count({ where: { sourceRecordId: 'passive-search-1' } })).toBe(1);
  });

  it('enforces communication consent and suppression and requires provider confirmation for delivery', async () => {
    const manager = await createUser('crm21h-comms@lux.test');
    const fixture = await createCompanyWorkspace({ slug: 'communications', members: [{ userId: manager.id, allProperties: true }] });
    const token = signToken(manager);
    const lead = await createLead({ token, companyId: fixture.company.id, propertyId: fixture.properties[0].id, assignedToId: manager.id, title: 'Communication governance', fullName: 'Governed Contact', email: 'governed@lux.test' });
    const contactId = lead.body.lead.contact.id;

    await request(app)
      .patch(`/api/crm/contacts/${contactId}/communication-governance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'EMAIL', status: 'CONSENTED', lawfulBasis: 'Explicit relationship consent', preferred: true, timezone: 'Asia/Muscat', quietHoursStart: 0, quietHoursEnd: 0 })
      .expect(200);

    const policy = await request(app)
      .patch('/api/crm/communication-policy')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: fixture.workspace.id, timezone: 'Asia/Muscat', quietHoursStart: 0, quietHoursEnd: 0, hourlyRateLimit: 25, retentionDays: 365 })
      .expect(200);
    expect(policy.body.policy.hourlyRateLimit).toBe(25);

    const template = await request(app)
      .post('/api/crm/communication-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: fixture.workspace.id, key: 'relationship-follow-up', name: 'Relationship follow-up', channel: 'EMAIL', subject: 'Follow-up', body: 'Governed follow-up' })
      .expect(201);
    const templateVersionId = template.body.template.versions[0].id;
    await expect(prisma.crmCommunicationTemplateVersion.update({ where: { id: templateVersionId }, data: { body: 'tampered' } })).rejects.toThrow();

    const queued = await request(app)
      .post('/api/crm/delivery-attempts')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: fixture.workspace.id, contactId, leadId: lead.body.lead.id, templateVersionId, channel: 'EMAIL', provider: 'VERIFIED_EMAIL', destination: 'governed@lux.test', subject: 'Queued', body: 'Provider submission must happen in the durable worker', idempotencyKey: 'workspace-scoped-key-0001' })
      .expect(201);
    expect(queued.body.attempt.status).toBe('QUEUED');
    expect(queued.body.deliveryConfirmed).toBe(false);

    const otherManager = await createUser('crm21h-comms-other@lux.test');
    const otherFixture = await createCompanyWorkspace({ slug: 'communications-other', members: [{ userId: otherManager.id, allProperties: true }] });
    const otherToken = signToken(otherManager);
    const otherLead = await createLead({ token: otherToken, companyId: otherFixture.company.id, propertyId: otherFixture.properties[0].id, assignedToId: otherManager.id, title: 'Other governed communication', fullName: 'Other Governed Contact', email: 'other-governed@lux.test' });
    await request(app)
      .patch(`/api/crm/contacts/${otherLead.body.lead.contact.id}/communication-governance`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ channel: 'EMAIL', status: 'CONSENTED', lawfulBasis: 'Explicit relationship consent', preferred: true, quietHoursStart: 0, quietHoursEnd: 0 })
      .expect(200);
    const otherQueued = await request(app)
      .post('/api/crm/delivery-attempts')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ workspaceId: otherFixture.workspace.id, contactId: otherLead.body.lead.contact.id, leadId: otherLead.body.lead.id, channel: 'EMAIL', provider: 'VERIFIED_EMAIL', destination: 'other-governed@lux.test', body: 'Same idempotency key in a different workspace', idempotencyKey: 'workspace-scoped-key-0001' })
      .expect(201);
    expect(otherQueued.body.attempt.workspaceId).toBe(otherFixture.workspace.id);
    expect(otherQueued.body.attempt.id).not.toBe(queued.body.attempt.id);

    const draft = await request(app)
      .post('/api/crm/delivery-attempts')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: fixture.workspace.id, contactId, leadId: lead.body.lead.id, channel: 'EMAIL', provider: 'DRAFT_ONLY', destination: 'governed@lux.test', subject: 'Draft', body: 'Draft-only message', idempotencyKey: 'draft-governed-0001' })
      .expect(201);
    expect(draft.body.attempt.status).toBe('DRAFT');
    expect(draft.body.deliveryConfirmed).toBe(false);

    await request(app)
      .post('/api/crm/suppressions')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: fixture.workspace.id, channel: 'EMAIL', normalizedDestination: 'governed@lux.test', reason: 'OPT_OUT', active: true })
      .expect(201);

    const blocked = await request(app)
      .post('/api/crm/delivery-attempts')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: fixture.workspace.id, contactId, leadId: lead.body.lead.id, channel: 'EMAIL', provider: 'DRAFT_ONLY', destination: 'governed@lux.test', body: 'Blocked draft', idempotencyKey: 'draft-governed-0002' })
      .expect(409);
    expect(blocked.body.attempt.status).toBe('BLOCKED');

    const submitted = await prisma.crmDeliveryAttempt.create({
      data: {
        workspaceId: fixture.workspace.id,
        contactId,
        leadId: lead.body.lead.id,
        channel: 'EMAIL',
        provider: 'VERIFIED_EMAIL',
        status: 'SUBMITTED',
        destination: 'governed@lux.test',
        normalizedDestination: 'governed@lux.test',
        idempotencyKey: 'provider-confirmation-0001',
        providerMessageId: 'provider-message-21h',
        submittedAt: new Date(),
        createdById: manager.id
      }
    });
    await expect(prisma.crmDeliveryAttempt.update({ where: { id: submitted.id }, data: { status: 'DELIVERED' } })).rejects.toThrow();

    process.env.CRM_PROVIDER_WEBHOOK_SECRET = 'crm-stage21h-test-secret';
    const confirmed = await request(app)
      .post('/api/crm-provider-webhooks/verified_email')
      .set('x-crm-webhook-secret', 'crm-stage21h-test-secret')
      .send({ providerMessageId: 'provider-message-21h', status: 'DELIVERED', metadata: { event: 'delivered' } })
      .expect(200);
    expect(confirmed.body.attempt.status).toBe('DELIVERED');
    expect(confirmed.body.attempt.providerConfirmedAt).toBeTruthy();
  });

  it('computes complete conversion and currency-safe forecast analytics', async () => {
    const manager = await createUser('crm21h-analytics@lux.test');
    const fixture = await createCompanyWorkspace({ slug: 'analytics', members: [{ userId: manager.id, allProperties: true }] });
    const token = signToken(manager);

    const pipelines = await request(app)
      .get(`/api/crm/pipelines?workspaceId=${fixture.workspace.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const defaultPipeline = pipelines.body.pipelines[0];
    const wonStage = defaultPipeline.stages.find((stage: { type: string }) => stage.type === 'WON');

    const omrLead = await createLead({ token, companyId: fixture.company.id, propertyId: fixture.properties[0].id, assignedToId: manager.id, title: 'OMR deal', fullName: 'OMR Contact', email: 'omr-contact@lux.test', expectedValue: 100000, currency: 'OMR' });
    const omr = await convertLead({ token, leadId: omrLead.body.lead.id, accountName: 'OMR Account', dealName: 'OMR Opportunity' });
    await request(app)
      .post(`/api/crm/deals/${omr.body.deal.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: wonStage.id, reason: 'Won OMR agreement', wonReason: 'Trusted developer portfolio' })
      .expect(200);

    const usdLead = await createLead({ token, companyId: fixture.company.id, propertyId: fixture.properties[0].id, assignedToId: manager.id, title: 'USD deal', fullName: 'USD Contact', email: 'usd-contact@lux.test', expectedValue: 50000, currency: 'USD' });
    await convertLead({ token, leadId: usdLead.body.lead.id, accountName: 'USD Account', dealName: 'USD Opportunity' });

    const analytics = await request(app)
      .get(`/api/crm/analytics/forecast?workspaceId=${fixture.workspace.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(analytics.body.rules).toEqual({ currenciesCombined: false, historicalOutcomesPreservedAfterArchive: true, truncatedResultSetsUsed: false });
    expect(analytics.body.snapshot.leads.total).toBe(2);
    expect(analytics.body.snapshot.leads.converted).toBe(2);
    expect(analytics.body.snapshot.deals.won).toBe(1);
    const currencies = analytics.body.snapshot.deals.byCurrencyAndOutcome.map((row: { currency: string }) => row.currency);
    expect(currencies).toContain('OMR');
    expect(currencies).toContain('USD');
    expect(analytics.body.snapshot.deals.forecast).toEqual(expect.arrayContaining([expect.objectContaining({ currency: 'USD' })]));
    expect(analytics.body.snapshot.deals.forecast).not.toEqual(expect.arrayContaining([expect.objectContaining({ currency: 'OMR' })]));
    expect(analytics.body.dimensions.wonReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ wonReason: 'Trusted developer portfolio', _count: { _all: 1 } })
    ]));
  });
});

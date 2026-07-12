import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { clearIntegrationTestDatabase } from './integration/clearDatabase';
import { signToken } from '../src/middleware/auth';
import { getPrivatePmsDocumentRoot } from '../src/storage/privatePmsDocumentStorage';

const app = createApp();

async function clearStage21eDatabase() {
  await clearIntegrationTestDatabase();
}

async function createWorkspaceFixture() {
  const [owner, agent, checker, otherOwner] = await Promise.all([
    prisma.user.create({
      data: { name: 'Stage 21E Owner', email: 'stage21e-owner@lux.test', password: 'test-password', role: 'DEVELOPER', emailVerified: true },
    }),
    prisma.user.create({
      data: { name: 'Stage 21E Agent', email: 'stage21e-agent@lux.test', password: 'test-password', role: 'USER', emailVerified: true },
    }),
    prisma.user.create({
      data: { name: 'Stage 21E Checker', email: 'stage21e-checker@lux.test', password: 'test-password', role: 'USER', emailVerified: true },
    }),
    prisma.user.create({
      data: { name: 'Stage 21E Other Owner', email: 'stage21e-other-owner@lux.test', password: 'test-password', role: 'DEVELOPER', emailVerified: true },
    }),
  ]);
  const [company, otherCompany] = await Promise.all([
    prisma.developerCompany.create({ data: { slug: 'stage21e-company', nameEn: 'Stage 21E Company' } }),
    prisma.developerCompany.create({ data: { slug: 'stage21e-other-company', nameEn: 'Stage 21E Other Company' } }),
  ]);
  await prisma.pmsCompanyEntitlement.createMany({
    data: [
      { companyId: company.id, status: 'ACTIVE', enabledAt: new Date() },
      { companyId: otherCompany.id, status: 'ACTIVE', enabledAt: new Date() },
    ],
  });
  const ownerMember = await prisma.pmsCompanyMember.create({ data: { companyId: company.id, userId: owner.id, role: 'PMS_OWNER' } });
  const agentMember = await prisma.pmsCompanyMember.create({ data: { companyId: company.id, userId: agent.id, role: 'PMS_AGENT' } });
  await prisma.pmsCompanyMember.create({ data: { companyId: company.id, userId: checker.id, role: 'PMS_ACCOUNTANT' } });
  await prisma.pmsMemberPermission.create({ data: { companyId: company.id, memberId: agentMember.id, key: 'IMPORT_EXPORT' } });
  await prisma.pmsCompanyMember.create({ data: { companyId: otherCompany.id, userId: otherOwner.id, role: 'PMS_OWNER' } });

  const [propertyA, propertyB, otherProperty] = await Promise.all([
    prisma.pmsProperty.create({ data: { companyId: company.id, name: 'Property A', code: 'A' } }),
    prisma.pmsProperty.create({ data: { companyId: company.id, name: 'Property B', code: 'B' } }),
    prisma.pmsProperty.create({ data: { companyId: otherCompany.id, name: 'Other Property', code: 'OTHER' } }),
  ]);
  await prisma.pmsMemberPropertyAccess.create({
    data: { companyId: company.id, memberId: agentMember.id, propertyId: propertyA.id },
  });
  const [unitA, unitB, otherUnit] = await Promise.all([
    prisma.pmsUnit.create({ data: { companyId: company.id, propertyId: propertyA.id, unitNumber: 'A-101' } }),
    prisma.pmsUnit.create({ data: { companyId: company.id, propertyId: propertyB.id, unitNumber: 'B-101' } }),
    prisma.pmsUnit.create({ data: { companyId: otherCompany.id, propertyId: otherProperty.id, unitNumber: 'O-101' } }),
  ]);
  const [tenantA, tenantB, tenantA2] = await Promise.all([
    prisma.pmsTenant.create({
      data: { companyId: company.id, fullName: 'Tenant A', email: 'tenant-a@lux.test', nationalId: 'NATIONAL-A', passportNumber: 'PASSPORT-A' },
    }),
    prisma.pmsTenant.create({ data: { companyId: company.id, fullName: 'Tenant B', email: 'tenant-b@lux.test' } }),
    prisma.pmsTenant.create({ data: { companyId: company.id, fullName: 'Tenant A2', email: 'tenant-a2@lux.test' } }),
  ]);
  await prisma.pmsLease.create({
    data: {
      companyId: company.id,
      propertyId: propertyA.id,
      unitId: unitA.id,
      tenantId: tenantA.id,
      status: 'DRAFT',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      rentAmount: 700,
      currency: 'OMR',
    },
  });
  await prisma.pmsLease.create({
    data: {
      companyId: company.id,
      propertyId: propertyB.id,
      unitId: unitB.id,
      tenantId: tenantB.id,
      status: 'DRAFT',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      rentAmount: 800,
      currency: 'OMR',
    },
  });

  return {
    owner,
    agent,
    checker,
    otherOwner,
    ownerMember,
    agentMember,
    company,
    otherCompany,
    propertyA,
    propertyB,
    otherProperty,
    unitA,
    unitB,
    otherUnit,
    tenantA,
    tenantB,
    tenantA2,
    ownerToken: signToken(owner),
    agentToken: signToken(agent),
    checkerToken: signToken(checker),
    otherOwnerToken: signToken(otherOwner),
  };
}

beforeEach(async () => {
  await fs.rm(getPrivatePmsDocumentRoot(), { recursive: true, force: true });
  await clearStage21eDatabase();
});

afterAll(async () => {
  await fs.rm(getPrivatePmsDocumentRoot(), { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('PMS Stage 21E production hardening', () => {
  it('enforces module, property, and sensitive-data export boundaries and audits sensitive exports', async () => {
    const fixture = await createWorkspaceFixture();

    await request(app)
      .get(`/api/pms/exports/accounting-summary.csv?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.agentToken}`)
      .expect(403);

    const normalExport = await request(app)
      .get(`/api/pms/exports/tenants.csv?companyId=${fixture.company.id}&propertyId=${fixture.propertyA.id}`)
      .set('Authorization', `Bearer ${fixture.agentToken}`)
      .expect(200);
    expect(normalExport.text).toContain('Tenant A');
    expect(normalExport.text).not.toContain('NATIONAL-A');
    expect(normalExport.text).not.toContain('PASSPORT-A');

    await request(app)
      .get(`/api/pms/exports/tenants.csv?companyId=${fixture.company.id}&propertyId=${fixture.propertyB.id}`)
      .set('Authorization', `Bearer ${fixture.agentToken}`)
      .expect(403);

    await request(app)
      .get(`/api/pms/exports/tenants.csv?companyId=${fixture.company.id}&includeSensitive=true&sensitiveExportConfirmation=EXPORT_SENSITIVE_TENANT_DATA`)
      .set('Authorization', `Bearer ${fixture.agentToken}`)
      .expect(403);

    await request(app)
      .get(`/api/pms/exports/tenants.csv?companyId=${fixture.company.id}&includeSensitive=true`)
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .expect(400);

    const sensitiveExport = await request(app)
      .get(`/api/pms/exports/tenants.csv?companyId=${fixture.company.id}&includeSensitive=true&sensitiveExportConfirmation=EXPORT_SENSITIVE_TENANT_DATA`)
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .set('x-request-id', 'stage21e-sensitive-export')
      .expect(200);
    expect(sensitiveExport.text).toContain('NATIONAL-A');
    expect(sensitiveExport.text).toContain('PASSPORT-A');

    const audit = await prisma.domainAuditEvent.findFirst({
      where: { companyId: fixture.company.id, entityType: 'pmsTenantExport', action: 'sensitive_export' },
    });
    expect(audit).toMatchObject({ actorId: fixture.owner.id, requestId: 'stage21e-sensitive-export', domain: 'PMS' });
    expect(audit?.metadata).toMatchObject({ workspaceId: fixture.company.id, exportType: 'tenants' });
  });

  it('serves PMS documents only through authenticated scoped routes and hides sensitive document metadata', async () => {
    const fixture = await createWorkspaceFixture();
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const upload = await request(app)
      .post('/api/pms/documents/upload')
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .field('metadata', JSON.stringify({
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        tenantId: fixture.tenantA.id,
        type: 'TENANT_ID',
        title: 'Tenant identity',
        status: 'ACTIVE',
      }))
      .attach('file', pdf, { filename: 'tenant-id.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(upload.body.document.fileUrl).toContain(`/api/pms/documents/${upload.body.document.id}/download`);
    expect(upload.body.document.fileUrl).not.toContain('/uploads/');

    const agentList = await request(app)
      .get(`/api/pms/documents?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.agentToken}`)
      .expect(200);
    expect(agentList.body.documents).toHaveLength(0);

    await request(app)
      .get(`/api/pms/documents/${upload.body.document.id}`)
      .set('Authorization', `Bearer ${fixture.agentToken}`)
      .expect(403);
    await request(app)
      .get(`/api/pms/documents/${upload.body.document.id}/download`)
      .set('Authorization', `Bearer ${fixture.agentToken}`)
      .expect(403);
    await request(app)
      .get(`/api/pms/documents/${upload.body.document.id}/download`)
      .set('Authorization', `Bearer ${fixture.otherOwnerToken}`)
      .expect(403);

    const download = await request(app)
      .get(`/api/pms/documents/${upload.body.document.id}/download`)
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .set('x-request-id', 'stage21e-document-download')
      .expect(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(download.body).subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const actions = await prisma.domainAuditEvent.findMany({
      where: { companyId: fixture.company.id, entityType: 'pmsDocument', entityId: upload.body.document.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(actions.map((event) => event.action)).toEqual(expect.arrayContaining(['upload', 'download']));
    expect(actions.find((event) => event.action === 'download')?.requestId).toBe('stage21e-document-download');
  });

  it('groups mixed currencies and preserves published owner statement snapshots', async () => {
    const fixture = await createWorkspaceFixture();
    await prisma.pmsAccountingLedgerEntry.createMany({
      data: [
        { companyId: fixture.company.id, propertyId: fixture.propertyA.id, type: 'INCOME', source: 'MANUAL', category: 'OMR income', amount: 100, currency: 'OMR', transactionDate: new Date('2026-06-10T00:00:00.000Z') },
        { companyId: fixture.company.id, propertyId: fixture.propertyA.id, type: 'INCOME', source: 'MANUAL', category: 'USD income', amount: 50, currency: 'USD', transactionDate: new Date('2026-06-11T00:00:00.000Z') },
      ],
    });

    const report = await request(app)
      .get(`/api/pms/reports/summary?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .expect(200);
    expect(report.body.accounting.currencyState).toMatchObject({ status: 'MIXED', canCombine: false, displayCurrency: null });
    expect(report.body.accounting.incomeCollected).toBeNull();
    expect(report.body.accounting.totalsByCurrency.map((item: { currency: string }) => item.currency)).toEqual(['OMR', 'USD']);

    const generated = await request(app)
      .post('/api/pms/accounting/owner-statements')
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, month: '2026-06', currency: 'OMR', ownerReference: 'OWNER-A' })
      .expect(201);
    const statementId = generated.body.statement.id as string;
    const originalSnapshot = generated.body.statement.immutableSnapshot;
    const originalClosingBalance = generated.body.statement.closingBalance;

    await prisma.pmsFinancialPeriod.create({
      data: {
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        currency: 'OMR',
        periodStart: new Date('2026-06-01T00:00:00.000Z'),
        periodEnd: new Date('2026-06-30T23:59:59.999Z'),
        status: 'CLOSED',
        createdById: fixture.owner.id,
        updatedById: fixture.owner.id,
        closedAt: new Date('2026-07-01T06:00:00.000Z'),
      },
    });
    const statementEvidence = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    await request(app)
      .post('/api/pms/documents/upload')
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .field('metadata', JSON.stringify({
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        statementId,
        type: 'OTHER',
        title: 'Stage 21E owner statement evidence',
        status: 'ACTIVE',
      }))
      .attach('file', statementEvidence, { filename: 'owner-statement-evidence.pdf', contentType: 'application/pdf' })
      .expect(201);

    await request(app)
      .post(`/api/pms/accounting/owner-statements/${statementId}/transition`)
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .send({ status: 'NEEDS_REVIEW' })
      .expect(200);
    await request(app)
      .post(`/api/pms/accounting/owner-statements/${statementId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
    await request(app)
      .post(`/api/pms/accounting/owner-statements/${statementId}/transition`)
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    await request(app)
      .post('/api/pms/accounting/owner-statements')
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, month: '2026-06', currency: 'OMR' })
      .expect(409);

    const omrEntry = await prisma.pmsAccountingLedgerEntry.findFirstOrThrow({ where: { companyId: fixture.company.id, currency: 'OMR' } });
    await prisma.pmsAccountingLedgerEntry.update({ where: { id: omrEntry.id }, data: { amount: 999 } });

    const persisted = await request(app)
      .get(`/api/pms/accounting/owner-statements/${statementId}`)
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .expect(200);
    expect(persisted.body.statement.status).toBe('PUBLISHED');
    expect(persisted.body.statement.closingBalance).toBe(originalClosingBalance);
    expect(persisted.body.statement.immutableSnapshot).toEqual(originalSnapshot);
    expect(await prisma.domainAuditEvent.count({ where: { companyId: fixture.company.id, entityType: 'pmsOwnerStatement', entityId: statementId } })).toBe(4);
  });

  it('serializes concurrent active lease creation and reconciles derived occupancy drift', async () => {
    const fixture = await createWorkspaceFixture();
    const payload = (tenantId: string) => ({
      companyId: fixture.company.id,
      tenantId,
      propertyId: fixture.propertyA.id,
      unitId: fixture.unitA.id,
      status: 'ACTIVE',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-31T23:59:59.999Z',
      rentFrequency: 'MONTHLY',
      rentAmount: 700,
      currency: 'OMR',
      generateRentDueItems: false,
    });

    const responses = await Promise.all([
      request(app).post('/api/pms/leases').set('Authorization', `Bearer ${fixture.ownerToken}`).send(payload(fixture.tenantA.id)),
      request(app).post('/api/pms/leases').set('Authorization', `Bearer ${fixture.ownerToken}`).send(payload(fixture.tenantA2.id)),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);

    const activeLease = await prisma.pmsLease.findFirstOrThrow({
      where: { unitId: fixture.unitA.id, status: { in: ['ACTIVE', 'EXPIRING'] } },
    });
    await prisma.pmsLease.update({ where: { id: activeLease.id }, data: { endDate: new Date('2026-01-31T23:59:59.999Z') } });
    await prisma.pmsUnit.update({
      where: { id: fixture.unitA.id },
      data: { occupancyStatus: 'VACANT', status: 'VACANT' },
    });

    const reconciliation = await request(app)
      .get(`/api/pms/occupancy/reconciliation?companyId=${fixture.company.id}&propertyId=${fixture.propertyA.id}`)
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .expect(200);
    expect(reconciliation.body.issues.map((issue: { type: string }) => issue.type)).toEqual(
      expect.arrayContaining(['ACTIVE_LEASE_ON_VACANT_UNIT', 'EXPIRED_LEASE_STILL_ACTIVE']),
    );

    const applied = await request(app)
      .post('/api/pms/occupancy/reconciliation')
      .set('Authorization', `Bearer ${fixture.ownerToken}`)
      .send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, apply: true })
      .expect(200);
    expect(applied.body.correctedUnits).toBe(1);
    expect(await prisma.pmsUnit.findUniqueOrThrow({ where: { id: fixture.unitA.id } })).toMatchObject({ occupancyStatus: 'OCCUPIED', status: 'OCCUPIED' });

    expect(await prisma.domainAuditEvent.count({
      where: { companyId: fixture.company.id, domain: 'PMS', action: { in: ['create', 'apply'] } },
    })).toBeGreaterThanOrEqual(2);
  });
});

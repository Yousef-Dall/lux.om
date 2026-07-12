import fs from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { clearIntegrationTestDatabase } from './integration/clearDatabase';
import { signToken } from '../src/middleware/auth';
import { generateDuePreventiveWorkOrders } from '../src/modules/pms/maintenance/preventive';
import { getPrivatePmsDocumentRoot } from '../src/storage/privatePmsDocumentStorage';

const app = createApp();

async function clearDatabase() {
  await clearIntegrationTestDatabase();
}

async function createFixture() {
  const [manager, checker, scopedUser, ownerUser, vendorUser, outsider] = await Promise.all([
    prisma.user.create({ data: { name: 'Stage 21G Manager', email: 'stage21g-manager@lux.test', password: 'test-password', role: 'DEVELOPER', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Stage 21G Checker', email: 'stage21g-checker@lux.test', password: 'test-password', role: 'USER', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Stage 21G Scoped', email: 'stage21g-scoped@lux.test', password: 'test-password', role: 'USER', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Stage 21G Owner', email: 'stage21g-owner@lux.test', password: 'test-password', role: 'USER', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Stage 21G Vendor', email: 'stage21g-vendor@lux.test', password: 'test-password', role: 'USER', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Stage 21G Outsider', email: 'stage21g-outsider@lux.test', password: 'test-password', role: 'USER', emailVerified: true } }),
  ]);
  const [company, otherCompany] = await Promise.all([
    prisma.developerCompany.create({ data: { slug: 'stage21g-company', nameEn: 'Stage 21G Company' } }),
    prisma.developerCompany.create({ data: { slug: 'stage21g-other', nameEn: 'Stage 21G Other' } }),
  ]);
  await prisma.pmsCompanyEntitlement.createMany({ data: [{ companyId: company.id, status: 'ACTIVE', enabledAt: new Date() }, { companyId: otherCompany.id, status: 'ACTIVE', enabledAt: new Date() }] });
  await prisma.pmsCompanyMember.create({ data: { companyId: company.id, userId: manager.id, role: 'PMS_OWNER' } });
  await prisma.pmsCompanyMember.create({ data: { companyId: company.id, userId: checker.id, role: 'PMS_ACCOUNTANT' } });
  const scopedMember = await prisma.pmsCompanyMember.create({ data: { companyId: company.id, userId: scopedUser.id, role: 'PMS_MANAGER' } });
  await prisma.pmsCompanyMember.create({ data: { companyId: otherCompany.id, userId: outsider.id, role: 'PMS_OWNER' } });

  const [propertyA, propertyB, otherProperty] = await Promise.all([
    prisma.pmsProperty.create({ data: { companyId: company.id, name: 'Stage 21G Property A', code: '21G-A' } }),
    prisma.pmsProperty.create({ data: { companyId: company.id, name: 'Stage 21G Property B', code: '21G-B' } }),
    prisma.pmsProperty.create({ data: { companyId: otherCompany.id, name: 'Other Property', code: '21G-O' } }),
  ]);
  await prisma.pmsMemberPropertyAccess.create({ data: { companyId: company.id, memberId: scopedMember.id, propertyId: propertyA.id } });
  const [unitA, unitB] = await Promise.all([
    prisma.pmsUnit.create({ data: { companyId: company.id, propertyId: propertyA.id, unitNumber: 'A-101', status: 'OCCUPIED' } }),
    prisma.pmsUnit.create({ data: { companyId: company.id, propertyId: propertyB.id, unitNumber: 'B-101' } }),
  ]);
  const [tenantA, tenantB] = await Promise.all([
    prisma.pmsTenant.create({ data: { companyId: company.id, fullName: 'Private Tenant A', email: 'private-a@lux.test' } }),
    prisma.pmsTenant.create({ data: { companyId: company.id, fullName: 'Private Tenant B', email: 'private-b@lux.test' } }),
  ]);
  const [leaseA, leaseB] = await Promise.all([
    prisma.pmsLease.create({ data: { companyId: company.id, propertyId: propertyA.id, unitId: unitA.id, tenantId: tenantA.id, status: 'ACTIVE', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), rentAmount: 900, securityDeposit: 200, currency: 'OMR' } }),
    prisma.pmsLease.create({ data: { companyId: company.id, propertyId: propertyB.id, unitId: unitB.id, tenantId: tenantB.id, status: 'DRAFT', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), rentAmount: 800, currency: 'OMR' } }),
  ]);
  const vendor = await prisma.pmsVendor.create({ data: { companyId: company.id, name: 'Stage 21G Vendor Co', trade: 'HVAC' } });
  await prisma.pmsOwnerPortalAccess.create({ data: { companyId: company.id, propertyId: propertyA.id, userId: ownerUser.id, canApproveQuotes: true, canViewMaintenanceCosts: true, createdById: manager.id } });
  await prisma.pmsVendorPortalAccess.create({ data: { companyId: company.id, vendorId: vendor.id, userId: vendorUser.id, createdById: manager.id } });

  return {
    manager, checker, scopedUser, ownerUser, vendorUser, outsider, company, otherCompany, propertyA, propertyB, otherProperty,
    unitA, unitB, tenantA, tenantB, leaseA, leaseB, vendor,
    managerToken: signToken(manager), checkerToken: signToken(checker), scopedToken: signToken(scopedUser), ownerToken: signToken(ownerUser), vendorToken: signToken(vendorUser), outsiderToken: signToken(outsider),
  };
}

async function createIssuedCharge(fixture: Awaited<ReturnType<typeof createFixture>>, amount = 100) {
  const created = await request(app)
    .post('/api/pms/accounting/charges')
    .set('Authorization', `Bearer ${fixture.managerToken}`)
    .send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, leaseId: fixture.leaseA.id, tenantId: fixture.tenantA.id, currency: 'OMR', dueDate: '2026-08-01', lines: [{ category: 'RENT', description: 'Structured rent', quantity: 1, unitAmount: amount }] })
    .expect(201);
  await request(app).post(`/api/pms/accounting/charges/${created.body.charge.id}/issue`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id }).expect(200);
  return created.body.charge.id as string;
}

beforeEach(async () => {
  await fs.rm(getPrivatePmsDocumentRoot(), { recursive: true, force: true });
  await clearDatabase();
});

afterAll(async () => {
  await fs.rm(getPrivatePmsDocumentRoot(), { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('PMS Stage 21G financial and portal operations', () => {
  it('enforces charge lifecycle, allocation limits, concurrency, idempotency, reversals, refunds, and allocation receipts', async () => {
    const fixture = await createFixture();
    const chargeId = await createIssuedCharge(fixture, 100);
    const payment = await request(app).post('/api/pms/accounting/payments').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, leaseId: fixture.leaseA.id, tenantId: fixture.tenantA.id, amount: 100, currency: 'OMR', method: 'BANK_TRANSFER', paidAt: '2026-08-01', idempotencyKey: 'stage21g-payment-001' }).expect(201);
    const paymentId = payment.body.payment.id as string;

    const first = await request(app).post(`/api/pms/accounting/payments/${paymentId}/allocations`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, chargeId, amount: 40, idempotencyKey: 'stage21g-allocation-001' }).expect(201);
    await request(app).post(`/api/pms/accounting/payments/${paymentId}/allocations`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, chargeId, amount: 40, idempotencyKey: 'stage21g-allocation-001' }).expect(200).expect(({ body }) => expect(body.idempotent).toBe(true));

    const concurrent = await Promise.all([
      request(app).post(`/api/pms/accounting/payments/${paymentId}/allocations`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, chargeId, amount: 40, idempotencyKey: 'stage21g-allocation-concurrent-a' }),
      request(app).post(`/api/pms/accounting/payments/${paymentId}/allocations`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, chargeId, amount: 40, idempotencyKey: 'stage21g-allocation-concurrent-b' }),
    ]);
    expect(concurrent.map((response) => response.status).sort()).toEqual([201, 409]);

    await request(app).post(`/api/pms/accounting/payments/${paymentId}/allocations`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, chargeId, amount: 30, idempotencyKey: 'stage21g-allocation-over-limit' }).expect(409);
    const receipt = await request(app).get(`/api/pms/accounting/payments/${paymentId}/receipt?companyId=${fixture.company.id}`).set('Authorization', `Bearer ${fixture.managerToken}`).expect(200);
    expect(receipt.body.receipt.allocatedAmount).toBe('80');
    expect(receipt.body.receipt.unallocatedAmount).toBe('20');

    await request(app).post(`/api/pms/accounting/payments/${paymentId}/allocations/${first.body.allocation.id}/reverse`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, reason: 'Correct allocation target' }).expect(200);
    await request(app).post(`/api/pms/accounting/payments/${paymentId}/adjustments`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, type: 'REFUND', amount: 30, reason: 'Approved tenant refund', idempotencyKey: 'stage21g-refund-001' }).expect(201);
    const balance = await request(app).get(`/api/pms/accounting/payments/${paymentId}/balance?companyId=${fixture.company.id}`).set('Authorization', `Bearer ${fixture.managerToken}`).expect(200);
    expect(balance.body.balance).toMatchObject({ allocatedAmount: '40', refundedOrChargedBackAmount: '30', availableAmount: '30' });
  });

  it('supports paginated finance browsing, editable drafts, and atomic multi-charge allocations', async () => {
    const fixture = await createFixture();
    const draft = await request(app)
      .post('/api/pms/accounting/charges')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        unitId: fixture.unitA.id,
        leaseId: fixture.leaseA.id,
        tenantId: fixture.tenantA.id,
        currency: 'OMR',
        dueDate: '2026-09-01',
        notes: 'Initial draft',
        lines: [
          { category: 'RENT', description: 'September rent', quantity: 1, unitAmount: 90 },
          { category: 'UTILITIES', description: 'Water estimate', quantity: 1, unitAmount: 10 },
        ],
      })
      .expect(201);

    const updated = await request(app)
      .patch(`/api/pms/accounting/charges/${draft.body.charge.id}`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        unitId: fixture.unitA.id,
        leaseId: fixture.leaseA.id,
        tenantId: fixture.tenantA.id,
        currency: 'OMR',
        dueDate: '2026-09-05',
        notes: 'Reviewed draft',
        lines: [
          { category: 'RENT', description: 'September rent', quantity: 1, unitAmount: 100 },
          { category: 'SERVICE_CHARGE', description: 'Shared services', quantity: 2, unitAmount: 5 },
        ],
      })
      .expect(200);
    expect(updated.body.charge).toMatchObject({ status: 'DRAFT', totalAmount: '110', balanceAmount: '110', notes: 'Reviewed draft' });
    expect(updated.body.charge.lines).toHaveLength(2);

    await request(app)
      .post(`/api/pms/accounting/charges/${draft.body.charge.id}/issue`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id })
      .expect(200);
    const secondChargeId = await createIssuedCharge(fixture, 40);

    const chargePage = await request(app)
      .get(`/api/pms/accounting/charges?companyId=${fixture.company.id}&take=1&skip=0&status=ISSUED&search=CHG-`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .expect(200);
    expect(chargePage.body.pagination).toMatchObject({ take: 1, skip: 0, count: 1, total: 2 });
    expect(chargePage.body.totalsByCurrency).toEqual([
      expect.objectContaining({ currency: 'OMR', count: 2, balanceAmount: '150' }),
    ]);

    const detail = await request(app)
      .get(`/api/pms/accounting/charges/${draft.body.charge.id}?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .expect(200);
    expect(detail.body.charge.lines.map((line: { description: string }) => line.description)).toEqual([
      'September rent',
      'Shared services',
    ]);

    const payment = await request(app)
      .post('/api/pms/accounting/payments')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        unitId: fixture.unitA.id,
        leaseId: fixture.leaseA.id,
        tenantId: fixture.tenantA.id,
        amount: 150,
        currency: 'OMR',
        method: 'BANK_TRANSFER',
        paidAt: '2026-09-01',
        referenceNumber: 'BANK-STAGE21I-E',
        idempotencyKey: 'stage21i-e-payment-001',
      })
      .expect(201);

    const paymentPage = await request(app)
      .get(`/api/pms/accounting/payments?companyId=${fixture.company.id}&take=1&search=BANK-STAGE21I-E`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .expect(200);
    expect(paymentPage.body.pagination).toMatchObject({ take: 1, count: 1, total: 1 });
    expect(paymentPage.body.totalsByCurrency).toEqual([
      expect.objectContaining({ currency: 'OMR', count: 1, recordedAmount: '150' }),
    ]);
    expect(paymentPage.body.payments[0]).toMatchObject({ availableAmount: '150', allocatedAmount: '0' });

    const batchPayload = {
      companyId: fixture.company.id,
      idempotencyKey: 'stage21i-e-allocation-batch',
      allocations: [
        { chargeId: draft.body.charge.id, amount: 110 },
        { chargeId: secondChargeId, amount: 40 },
      ],
    };
    await request(app)
      .post(`/api/pms/accounting/payments/${payment.body.payment.id}/allocations/batch`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send(batchPayload)
      .expect(201)
      .expect(({ body }) => {
        expect(body.idempotent).toBe(false);
        expect(body.allocations).toHaveLength(2);
      });
    await request(app)
      .post(`/api/pms/accounting/payments/${payment.body.payment.id}/allocations/batch`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send(batchPayload)
      .expect(200)
      .expect(({ body }) => expect(body.idempotent).toBe(true));
    await request(app)
      .post(`/api/pms/accounting/payments/${payment.body.payment.id}/allocations/batch`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({
        ...batchPayload,
        allocations: [...batchPayload.allocations].reverse(),
      })
      .expect(409);

    const paymentDetail = await request(app)
      .get(`/api/pms/accounting/payments/${payment.body.payment.id}?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .expect(200);
    expect(paymentDetail.body.balance).toMatchObject({ allocatedAmount: '150', availableAmount: '0' });
    expect(paymentDetail.body.payment.allocations).toHaveLength(2);

    const overflowPayment = await request(app)
      .post('/api/pms/accounting/payments')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        unitId: fixture.unitA.id,
        leaseId: fixture.leaseA.id,
        tenantId: fixture.tenantA.id,
        amount: 50,
        currency: 'OMR',
        method: 'CASH',
        paidAt: '2026-09-02',
        idempotencyKey: 'stage21i-e-payment-overflow',
      })
      .expect(201);
    await request(app)
      .post(`/api/pms/accounting/payments/${overflowPayment.body.payment.id}/allocations/batch`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({
        companyId: fixture.company.id,
        idempotencyKey: 'stage21i-e-overflow-batch',
        allocations: [
          { chargeId: draft.body.charge.id, amount: 30 },
          { chargeId: secondChargeId, amount: 30 },
        ],
      })
      .expect(409);
    expect(await prisma.pmsPaymentAllocation.count({ where: { paymentId: overflowPayment.body.payment.id } })).toBe(0);

    const concurrentChargeId = await createIssuedCharge(fixture, 20);
    const concurrentPayment = await request(app)
      .post('/api/pms/accounting/payments')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        unitId: fixture.unitA.id,
        leaseId: fixture.leaseA.id,
        tenantId: fixture.tenantA.id,
        amount: 20,
        currency: 'OMR',
        method: 'CASH',
        paidAt: '2026-09-03',
        idempotencyKey: 'stage21i-e-payment-concurrent',
      })
      .expect(201);
    const concurrentBatch = {
      companyId: fixture.company.id,
      idempotencyKey: 'stage21i-e-concurrent-batch',
      allocations: [{ chargeId: concurrentChargeId, amount: 20 }],
    };
    const concurrentResponses = await Promise.all([
      request(app)
        .post(`/api/pms/accounting/payments/${concurrentPayment.body.payment.id}/allocations/batch`)
        .set('Authorization', `Bearer ${fixture.managerToken}`)
        .send(concurrentBatch),
      request(app)
        .post(`/api/pms/accounting/payments/${concurrentPayment.body.payment.id}/allocations/batch`)
        .set('Authorization', `Bearer ${fixture.managerToken}`)
        .send(concurrentBatch),
    ]);
    expect(concurrentResponses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(await prisma.pmsPaymentAllocation.count({ where: { paymentId: concurrentPayment.body.payment.id } })).toBe(1);
  });


  it('keeps deposits as liabilities and requires approval before deductions, refunds, or conversion to income', async () => {
    const fixture = await createFixture();
    const account = await request(app).post('/api/pms/accounting/deposits').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, leaseId: fixture.leaseA.id, expectedAmount: 200 }).expect(201);
    const accountId = account.body.account.id as string;
    const depositPayment = await request(app).post('/api/pms/accounting/payments').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, leaseId: fixture.leaseA.id, tenantId: fixture.tenantA.id, amount: 200, currency: 'OMR', method: 'BANK_TRANSFER', paidAt: '2026-08-01', idempotencyKey: 'stage21g-deposit-payment' }).expect(201);
    await request(app).post(`/api/pms/accounting/deposits/${accountId}/transactions`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, type: 'COLLECTION', amount: 200, reason: 'Deposit collected', idempotencyKey: 'stage21g-deposit-collection', paymentId: depositPayment.body.payment.id }).expect(201).expect(({ body }) => expect(body.transaction.status).toBe('POSTED'));
    const depositPaymentBalance = await request(app).get(`/api/pms/accounting/payments/${depositPayment.body.payment.id}/balance?companyId=${fixture.company.id}`).set('Authorization', `Bearer ${fixture.managerToken}`).expect(200);
    expect(depositPaymentBalance.body.balance).toMatchObject({ depositAllocatedAmount: '200', availableAmount: '0' });

    const deduction = await request(app).post(`/api/pms/accounting/deposits/${accountId}/transactions`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, type: 'DEDUCTION', amount: 50, reason: 'Approved repair deduction', idempotencyKey: 'stage21g-deposit-deduction' }).expect(201);
    expect(deduction.body.transaction.status).toBe('PENDING_APPROVAL');
    await request(app).post(`/api/pms/accounting/deposits/${accountId}/transactions/${deduction.body.transaction.id}/transition`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, action: 'POST', reason: 'Cannot bypass approval' }).expect(409);
    await request(app).post(`/api/pms/accounting/deposits/${accountId}/transactions/${deduction.body.transaction.id}/transition`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, action: 'APPROVE', reason: 'Evidence reviewed' }).expect(200);
    await request(app).post(`/api/pms/accounting/deposits/${accountId}/transactions/${deduction.body.transaction.id}/transition`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, action: 'POST', reason: 'Post approved deduction' }).expect(200);

    await request(app).post(`/api/pms/accounting/deposits/${accountId}/transactions`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, type: 'CONVERSION_TO_INCOME', amount: 25, reason: 'Attempt without charge', idempotencyKey: 'stage21g-deposit-conversion-no-charge' }).expect(400);
    const deductionChargeId = await createIssuedCharge(fixture, 25);
    const conversion = await request(app).post(`/api/pms/accounting/deposits/${accountId}/transactions`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, type: 'CONVERSION_TO_INCOME', amount: 25, reason: 'Approved damage charge conversion', idempotencyKey: 'stage21g-deposit-conversion', chargeId: deductionChargeId }).expect(201);
    await request(app).post(`/api/pms/accounting/deposits/${accountId}/transactions/${conversion.body.transaction.id}/transition`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, action: 'APPROVE', reason: 'Owner evidence approved' }).expect(200);
    await request(app).post(`/api/pms/accounting/deposits/${accountId}/transactions/${conversion.body.transaction.id}/transition`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, action: 'POST', reason: 'Apply held deposit to issued charge' }).expect(200);
    const refreshed = await prisma.pmsSecurityDepositAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(refreshed.liabilityBalance.toString()).toBe('125');
    const convertedCharge = await prisma.pmsCharge.findUniqueOrThrow({ where: { id: deductionChargeId } });
    expect(convertedCharge).toMatchObject({ status: 'PAID' });
    expect(convertedCharge.balanceAmount.toString()).toBe('0');
    const deductionIncomeEntries = await prisma.pmsAccountingLedgerEntry.count({ where: { securityDepositTransactionId: deduction.body.transaction.id, type: 'INCOME' } });
    expect(deductionIncomeEntries).toBe(0);
    const conversionIncomeEntries = await prisma.pmsAccountingLedgerEntry.count({ where: { securityDepositTransactionId: conversion.body.transaction.id, type: 'INCOME' } });
    expect(conversionIncomeEntries).toBe(1);
  });

  it('protects closed financial periods and records reopen history', async () => {
    const fixture = await createFixture();
    const period = await request(app).post('/api/pms/accounting/periods').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, currency: 'OMR', periodStart: '2026-07-01', periodEnd: '2026-07-31' }).expect(201);
    for (const [action, reason] of [['REVIEW', 'Month-end review'], ['CLOSE', 'Approved month close']] as const) {
      await request(app).post(`/api/pms/accounting/periods/${period.body.period.id}/transition`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, action, reason }).expect(200);
    }
    await request(app).post('/api/pms/accounting/payments').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, leaseId: fixture.leaseA.id, tenantId: fixture.tenantA.id, amount: 10, currency: 'OMR', method: 'CASH', paidAt: '2026-07-15', idempotencyKey: 'stage21g-closed-period-payment' }).expect(409);
    await request(app).post(`/api/pms/accounting/periods/${period.body.period.id}/transition`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, action: 'REOPEN', reason: 'Approved correction ticket FIN-21G' }).expect(200);
    await request(app).post('/api/pms/accounting/payments').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, leaseId: fixture.leaseA.id, tenantId: fixture.tenantA.id, amount: 10, currency: 'OMR', method: 'CASH', paidAt: '2026-07-15', idempotencyKey: 'stage21g-reopened-period-payment' }).expect(201);
    expect(await prisma.pmsFinancialPeriodEvent.count({ where: { periodId: period.body.period.id } })).toBe(4);
  });

  it('strictly scopes owner and vendor portals and keeps tenant identity out of their responses', async () => {
    const fixture = await createFixture();
    const assigned = await prisma.pmsWorkOrder.create({ data: { companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, tenantId: fixture.tenantA.id, vendorId: fixture.vendor.id, title: 'Assigned HVAC repair', status: 'OPEN', createdById: fixture.manager.id } });
    await prisma.pmsWorkOrder.create({ data: { companyId: fixture.company.id, propertyId: fixture.propertyB.id, unitId: fixture.unitB.id, tenantId: fixture.tenantB.id, title: 'Unrelated work', status: 'OPEN', createdById: fixture.manager.id } });
    await prisma.pmsOwnerStatement.create({ data: { companyId: fixture.company.id, propertyId: fixture.propertyA.id, status: 'PUBLISHED', periodStart: new Date('2026-06-01'), periodEnd: new Date('2026-06-30'), currency: 'OMR', openingBalance: 0, income: 100, expenses: 20, adjustments: 0, closingBalance: 80, snapshot: { test: true }, publishedAt: new Date(), publishedById: fixture.manager.id } });
    await prisma.pmsAccountingLedgerEntry.create({ data: { companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, leaseId: fixture.leaseA.id, tenantId: fixture.tenantA.id, type: 'DEPOSIT', source: 'SECURITY_DEPOSIT', category: 'Security deposit collection', amount: 500, currency: 'OMR', transactionDate: new Date('2026-06-15'), createdById: fixture.manager.id } });

    const ownerMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${fixture.ownerToken}`).expect(200);
    expect(ownerMe.body.user.ownerAccess.hasAccess).toBe(true);
    const ownerOverview = await request(app).get('/api/owner/overview').set('Authorization', `Bearer ${fixture.ownerToken}`).expect(200);
    expect(JSON.stringify(ownerOverview.body)).not.toContain('Private Tenant A');
    expect(ownerOverview.body.access.property.id).toBe(fixture.propertyA.id);
    expect(ownerOverview.body.financialSummaries).toEqual([expect.objectContaining({ currency: 'OMR', income: '100', expenses: '20', net: '80' })]);
    await request(app).get('/api/owner/overview').set('Authorization', `Bearer ${fixture.outsiderToken}`).expect(403);

    const vendorMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${fixture.vendorToken}`).expect(200);
    expect(vendorMe.body.user.vendorAccess.hasAccess).toBe(true);
    const queue = await request(app).get('/api/vendor/work-orders').set('Authorization', `Bearer ${fixture.vendorToken}`).expect(200);
    expect(queue.body.workOrders.map((item: { id: string }) => item.id)).toEqual([assigned.id]);
    expect(JSON.stringify(queue.body)).not.toContain('Private Tenant A');
    await request(app).post(`/api/vendor/work-orders/${assigned.id}/progress`).set('Authorization', `Bearer ${fixture.vendorToken}`).send({ action: 'START', comment: 'Technician has arrived' }).expect(200).expect(({ body }) => expect(body.workOrder.status).toBe('IN_PROGRESS'));
    await request(app).get('/api/vendor/work-orders').set('Authorization', `Bearer ${fixture.ownerToken}`).expect(403);
  });

  it('governs deposit liabilities, reconciliation exceptions, and financial-period closing', async () => {
    const fixture = await createFixture();
    const accountResponse = await request(app)
      .post('/api/pms/accounting/deposits')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, leaseId: fixture.leaseA.id, expectedAmount: 200 })
      .expect(201);
    const accountId = accountResponse.body.account.id as string;
    const depositPayment = await request(app)
      .post('/api/pms/accounting/payments')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, leaseId: fixture.leaseA.id, tenantId: fixture.tenantA.id, amount: 200, currency: 'OMR', method: 'BANK_TRANSFER', paidAt: '2026-07-10', idempotencyKey: 'stage21i-f-deposit-payment' })
      .expect(201);
    await request(app)
      .post(`/api/pms/accounting/deposits/${accountId}/transactions`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, type: 'COLLECTION', amount: 200, reason: 'Security deposit received', idempotencyKey: 'stage21i-f-deposit-collection', paymentId: depositPayment.body.payment.id })
      .expect(201);
    const deduction = await request(app)
      .post(`/api/pms/accounting/deposits/${accountId}/transactions`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, type: 'DEDUCTION', amount: 20, reason: 'Repair deduction awaiting approval', idempotencyKey: 'stage21i-f-deposit-deduction' })
      .expect(201);
    expect(deduction.body.transaction.status).toBe('PENDING_APPROVAL');

    const reconciliation = await request(app)
      .post('/api/pms/accounting/reconciliation')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, source: 'BANK', externalReference: 'BANK-21I-F-001', amount: 200, currency: 'OMR', transactionDate: '2026-07-10', payerReference: 'TENANT-21I-F' })
      .expect(201);

    const createdPeriod = await request(app)
      .post('/api/pms/accounting/periods')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, currency: 'OMR', periodStart: '2026-07-01', periodEnd: '2026-07-31T23:59:59.999Z' })
      .expect(201);
    const periodId = createdPeriod.body.period.id as string;
    await request(app)
      .post(`/api/pms/accounting/periods/${periodId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'REVIEW', reason: 'Begin month-end review' })
      .expect(200);

    const readiness = await request(app)
      .get(`/api/pms/accounting/periods/${periodId}/readiness?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .expect(200);
    expect(readiness.body.readiness).toEqual({ canClose: false, reconciliationExceptions: 1, pendingDepositTransactions: 1 });
    await request(app)
      .post(`/api/pms/accounting/periods/${periodId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'CLOSE', reason: 'Attempt close with blockers' })
      .expect(409);

    await request(app)
      .post(`/api/pms/accounting/reconciliation/${reconciliation.body.item.id}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'IGNORE', reason: 'Verified external non-rent transfer' })
      .expect(200)
      .expect(({ body }) => expect(body.item.status).toBe('IGNORED'));
    await request(app)
      .post(`/api/pms/accounting/deposits/${accountId}/transactions/${deduction.body.transaction.id}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'APPROVE', reason: 'Repair evidence reviewed' })
      .expect(200);
    await request(app)
      .post(`/api/pms/accounting/deposits/${accountId}/transactions/${deduction.body.transaction.id}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'POST', reason: 'Post approved repair deduction' })
      .expect(200);

    const readyToClose = await request(app)
      .get(`/api/pms/accounting/periods/${periodId}/readiness?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .expect(200);
    expect(readyToClose.body.readiness).toEqual({ canClose: true, reconciliationExceptions: 0, pendingDepositTransactions: 0 });
    await request(app)
      .post(`/api/pms/accounting/periods/${periodId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'CLOSE', reason: 'All month-end exceptions resolved' })
      .expect(200)
      .expect(({ body }) => expect(body.period.status).toBe('CLOSED'));
    await request(app)
      .post(`/api/pms/accounting/periods/${periodId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'REOPEN', reason: 'Approved correction required' })
      .expect(200)
      .expect(({ body }) => expect(body.period.status).toBe('OPEN'));

    const depositList = await request(app)
      .get(`/api/pms/accounting/deposits?companyId=${fixture.company.id}&status=PARTIALLY_REFUNDED&take=1&skip=0`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .expect(200);
    expect(depositList.body.pagination).toMatchObject({ take: 1, skip: 0, count: 1, total: 1 });
    expect(depositList.body.totalsByCurrency).toEqual([expect.objectContaining({ currency: 'OMR', liabilityBalance: '180' })]);
    const reconciliationList = await request(app)
      .get(`/api/pms/accounting/reconciliation?companyId=${fixture.company.id}&status=IGNORED&take=1&skip=0`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .expect(200);
    expect(reconciliationList.body.pagination).toMatchObject({ take: 1, skip: 0, count: 1, total: 1 });
    expect(reconciliationList.body.totalsByStatus).toEqual([{ status: 'IGNORED', count: 1 }]);

    const outsideScopeAccount = await request(app)
      .post('/api/pms/accounting/deposits')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, leaseId: fixture.leaseB.id, expectedAmount: 150 })
      .expect(201);
    const scopedDeposits = await request(app)
      .get(`/api/pms/accounting/deposits?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.scopedToken}`)
      .expect(200);
    expect(scopedDeposits.body.accounts.map((account: { propertyId: string }) => account.propertyId)).toEqual([fixture.propertyA.id]);
    await request(app)
      .get(`/api/pms/accounting/deposits/${outsideScopeAccount.body.account.id}?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.scopedToken}`)
      .expect(404);

    await request(app)
      .post('/api/pms/accounting/periods')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, currency: 'OMR', periodStart: '2026-08-01', periodEnd: '2026-08-31T23:59:59.999Z' })
      .expect(201);
    const scopedPeriods = await request(app)
      .get(`/api/pms/accounting/periods?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.scopedToken}`)
      .expect(200);
    expect(scopedPeriods.body.periods.every((period: { propertyId: string | null }) => period.propertyId === fixture.propertyA.id)).toBe(true);
    await request(app)
      .post('/api/pms/accounting/periods')
      .set('Authorization', `Bearer ${fixture.scopedToken}`)
      .send({ companyId: fixture.company.id, currency: 'OMR', periodStart: '2026-09-01', periodEnd: '2026-09-30T23:59:59.999Z' })
      .expect(403);

    await request(app)
      .post('/api/pms/accounting/reconciliation')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, source: 'BANK', externalReference: 'BANK-21I-F-GLOBAL', amount: 75, currency: 'OMR', transactionDate: '2026-07-12', payerReference: 'GLOBAL-TRANSFER' })
      .expect(201);
    const scopedReconciliation = await request(app)
      .get(`/api/pms/accounting/reconciliation?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.scopedToken}`)
      .expect(200);
    expect(scopedReconciliation.body.items.every((item: { propertyId: string | null }) => item.propertyId === fixture.propertyA.id)).toBe(true);
    await request(app)
      .post('/api/pms/accounting/reconciliation')
      .set('Authorization', `Bearer ${fixture.scopedToken}`)
      .send({ companyId: fixture.company.id, source: 'BANK', externalReference: 'BANK-21I-F-SCOPED-GLOBAL', amount: 50, currency: 'OMR', transactionDate: '2026-07-12' })
      .expect(403);
  });

  it('prevents duplicate payment reconciliation and reusing published statements across active payouts', async () => {
    const fixture = await createFixture();
    const payment = await request(app).post('/api/pms/accounting/payments').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, leaseId: fixture.leaseA.id, tenantId: fixture.tenantA.id, amount: 50, currency: 'OMR', method: 'BANK_TRANSFER', paidAt: '2026-06-30', idempotencyKey: 'stage21g-reconcile-payment' }).expect(201);
    const firstItem = await request(app).post('/api/pms/accounting/reconciliation').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, source: 'BANK', externalReference: 'BANK-21G-001', amount: 50, currency: 'OMR', transactionDate: '2026-06-30', payerReference: 'TENANT-A' }).expect(201);
    const secondItem = await request(app).post('/api/pms/accounting/reconciliation').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, source: 'BANK', externalReference: 'BANK-21G-002', amount: 50, currency: 'OMR', transactionDate: '2026-07-01', payerReference: 'TENANT-A-SECOND' }).expect(201);
    await request(app).post(`/api/pms/accounting/reconciliation/${firstItem.body.item.id}/match`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, paymentId: payment.body.payment.id, reason: 'Verified bank reference' }).expect(200);
    await request(app).post(`/api/pms/accounting/reconciliation/${secondItem.body.item.id}/match`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, paymentId: payment.body.payment.id, reason: 'Duplicate payment match attempt' }).expect(409);

    const statement = await prisma.pmsOwnerStatement.create({ data: { companyId: fixture.company.id, propertyId: fixture.propertyA.id, status: 'PUBLISHED', periodStart: new Date('2026-06-01T00:00:00.000Z'), periodEnd: new Date('2026-06-30T00:00:00.000Z'), currency: 'OMR', openingBalance: 0, income: 100, expenses: 20, adjustments: 0, closingBalance: 80, snapshot: { test: true }, publishedAt: new Date(), publishedById: fixture.manager.id } });
    const payoutPayload = { companyId: fixture.company.id, ownerUserId: fixture.ownerUser.id, currency: 'OMR', periodStart: '2026-06-01T00:00:00.000Z', periodEnd: '2026-06-30T00:00:00.000Z', lines: [{ propertyId: fixture.propertyA.id, statementId: statement.id, incomeAmount: 100, expenseAmount: 20, managementFeeAmount: 0, reservedAmount: 0 }] };
    await request(app).post('/api/pms/accounting/owner-payouts').set('Authorization', `Bearer ${fixture.managerToken}`).send(payoutPayload).expect(201);
    await request(app).post('/api/pms/accounting/owner-payouts').set('Authorization', `Bearer ${fixture.managerToken}`).send(payoutPayload).expect(409);
  });


  it('publishes immutable owner statements and records evidence-backed maker-checker payouts', async () => {
    const fixture = await createFixture();
    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const periodEnd = new Date('2026-06-30T23:59:59.999Z');
    await prisma.pmsFinancialPeriod.create({
      data: {
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        currency: 'OMR',
        periodStart,
        periodEnd,
        status: 'CLOSED',
        closeReason: 'Closed test period for owner statement publication',
        createdById: fixture.manager.id,
        updatedById: fixture.manager.id,
        closedAt: new Date('2026-07-01T06:00:00.000Z'),
      },
    });
    await prisma.pmsAccountingLedgerEntry.createMany({
      data: [
        {
          companyId: fixture.company.id,
          propertyId: fixture.propertyA.id,
          type: 'INCOME',
          source: 'MANUAL',
          category: 'June owner income',
          amount: 100,
          currency: 'OMR',
          transactionDate: new Date('2026-06-15T00:00:00.000Z'),
          createdById: fixture.manager.id,
        },
        {
          companyId: fixture.company.id,
          propertyId: fixture.propertyA.id,
          type: 'EXPENSE',
          source: 'MANUAL',
          category: 'June owner expense',
          amount: 20,
          currency: 'OMR',
          transactionDate: new Date('2026-06-20T00:00:00.000Z'),
          createdById: fixture.manager.id,
        },
      ],
    });

    const created = await request(app)
      .post('/api/pms/accounting/owner-statements')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, month: '2026-06', currency: 'OMR', ownerReference: 'OWNER-JUNE-2026' })
      .expect(201);
    const statementId = created.body.statement.id as string;
    expect(created.body.statement).toMatchObject({ status: 'GENERATED', revision: 1, ownerReference: 'OWNER-JUNE-2026' });
    expect(Number(created.body.statement.closingBalance)).toBe(80);

    await request(app)
      .post(`/api/pms/accounting/owner-statements/${statementId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ status: 'NEEDS_REVIEW' })
      .expect(200);
    await request(app)
      .post(`/api/pms/accounting/owner-statements/${statementId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ status: 'APPROVED' })
      .expect(409);
    await request(app)
      .post(`/api/pms/accounting/owner-statements/${statementId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
    await request(app)
      .post(`/api/pms/accounting/owner-statements/${statementId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(409);

    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const statementEvidence = await request(app)
      .post('/api/pms/documents/upload')
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .field('metadata', JSON.stringify({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, statementId, type: 'OTHER', title: 'Closed period statement evidence', status: 'ACTIVE' }))
      .attach('file', pdf, { filename: 'owner-statement.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(statementEvidence.body.document.statementId).toBe(statementId);

    await request(app)
      .post(`/api/pms/accounting/owner-statements/${statementId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(409);
    await expect(prisma.pmsOwnerStatement.update({
      where: { id: statementId },
      data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: fixture.manager.id, income: 999 },
    })).rejects.toThrow(/publication|snapshot|immutable/i);
    const published = await request(app)
      .post(`/api/pms/accounting/owner-statements/${statementId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    expect(published.body.statement).toMatchObject({ status: 'PUBLISHED', approvedBy: { id: fixture.checker.id }, publishedBy: { id: fixture.manager.id } });

    await expect(prisma.pmsOwnerStatement.update({ where: { id: statementId }, data: { income: 999 } })).rejects.toThrow(/immutable/i);

    const mismatchPayload = {
      companyId: fixture.company.id,
      ownerUserId: fixture.ownerUser.id,
      currency: 'OMR',
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      lines: [{ statementId, incomeAmount: 999, expenseAmount: Number(published.body.statement.expenses), managementFeeAmount: 0, reservedAmount: 0 }],
    };
    await request(app)
      .post('/api/pms/accounting/owner-payouts')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send(mismatchPayload)
      .expect(400);

    await request(app)
      .post('/api/pms/accounting/owner-payouts')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({
        companyId: fixture.company.id,
        ownerUserId: fixture.ownerUser.id,
        currency: 'OMR',
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        managementFeeAmount: 5,
        lines: [{ statementId, managementFeeAmount: 0, reservedAmount: 0 }],
      })
      .expect(400);

    const payoutCreated = await request(app)
      .post('/api/pms/accounting/owner-payouts')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({
        companyId: fixture.company.id,
        ownerUserId: fixture.ownerUser.id,
        currency: 'OMR',
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        notes: 'June owner payout',
        lines: [{ statementId, managementFeeAmount: 5, reservedAmount: 2 }],
      })
      .expect(201);
    const payoutId = payoutCreated.body.batch.id as string;
    expect(payoutCreated.body.batch.lines[0]).toMatchObject({ statementId, managementFeeAmount: '5', reservedAmount: '2' });
    expect(payoutCreated.body.batch.lines[0].incomeAmount).not.toBe('999');

    await request(app)
      .post(`/api/pms/accounting/owner-payouts/${payoutId}/transition`)
      .set('Authorization', `Bearer ${fixture.outsiderToken}`)
      .send({ companyId: fixture.otherCompany.id, action: 'APPROVE' })
      .expect(404);
    await expect(prisma.pmsOwnerPayoutBatch.update({
      where: { id: payoutId },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: fixture.checker.id, payoutAmount: 1 },
    })).rejects.toThrow(/immutable/i);

    const approvalEvidence = await request(app)
      .post('/api/pms/documents/upload')
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .field('metadata', JSON.stringify({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, ownerPayoutBatchId: payoutId, type: 'OTHER', title: 'Payout approval evidence', status: 'ACTIVE' }))
      .attach('file', pdf, { filename: 'payout-approval.pdf', contentType: 'application/pdf' })
      .expect(201);

    await request(app)
      .post(`/api/pms/accounting/owner-payouts/${payoutId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'APPROVE', evidenceDocumentId: approvalEvidence.body.document.id })
      .expect(409);
    await request(app)
      .post(`/api/pms/accounting/owner-payouts/${payoutId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'APPROVE', evidenceDocumentId: approvalEvidence.body.document.id })
      .expect(200);
    await request(app)
      .post(`/api/pms/accounting/owner-payouts/${payoutId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'SUBMIT', evidenceDocumentId: approvalEvidence.body.document.id, payoutReference: 'BANK-SUBMISSION-21G', paymentMethodNote: 'Confirmed by bank adapter', adapter: 'MANUAL_BANK_EVIDENCE', providerConfirmed: true })
      .expect(409);
    const processing = await request(app)
      .post(`/api/pms/accounting/owner-payouts/${payoutId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'SUBMIT', evidenceDocumentId: approvalEvidence.body.document.id, payoutReference: 'BANK-SUBMISSION-21G', paymentMethodNote: 'Confirmed by bank adapter', adapter: 'MANUAL_BANK_EVIDENCE', providerConfirmed: true })
      .expect(200);
    expect(processing.body.batch.status).toBe('PROCESSING');

    await request(app)
      .post(`/api/pms/accounting/owner-payouts/${payoutId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'RECORD_PAID', evidenceDocumentId: approvalEvidence.body.document.id, payoutReference: 'BANK-SETTLED-21G', paymentMethodNote: 'Settlement result received' })
      .expect(409);
    const paidEvidence = await request(app)
      .post('/api/pms/documents/upload')
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .field('metadata', JSON.stringify({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, ownerPayoutBatchId: payoutId, type: 'OTHER', title: 'Final bank settlement evidence', status: 'ACTIVE' }))
      .attach('file', pdf, { filename: 'payout-paid.pdf', contentType: 'application/pdf' })
      .expect(201);
    await request(app)
      .post(`/api/pms/accounting/owner-payouts/${payoutId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'RECORD_PAID', evidenceDocumentId: paidEvidence.body.document.id, payoutReference: 'BANK-SETTLED-21G', paymentMethodNote: 'Settlement result received' })
      .expect(409);
    const paid = await request(app)
      .post(`/api/pms/accounting/owner-payouts/${payoutId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'RECORD_PAID', evidenceDocumentId: paidEvidence.body.document.id, payoutReference: 'BANK-SETTLED-21G', paymentMethodNote: 'Settlement result received' })
      .expect(200);
    expect(paid.body.batch).toMatchObject({ status: 'PAID_MANUAL', payoutReference: 'BANK-SETTLED-21G', paidBy: { id: fixture.checker.id } });

    await expect(prisma.pmsOwnerPayoutLine.update({ where: { id: paid.body.batch.lines[0].id }, data: { netAmount: 1 } })).rejects.toThrow(/immutable/i);

    const ownerOverview = await request(app).get('/api/owner/overview').set('Authorization', `Bearer ${fixture.ownerToken}`).expect(200);
    expect(ownerOverview.body.statements.map((statement: { id: string }) => statement.id)).toContain(statementId);
    expect(ownerOverview.body.payouts).toEqual([expect.objectContaining({ id: payoutId, status: 'PAID_MANUAL', payoutReference: 'BANK-SETTLED-21G' })]);
  });

  it('governs vendor invoice submission, approval, evidence-backed payment, and one-time expense posting', async () => {
    const fixture = await createFixture();
    const workOrder = await prisma.pmsWorkOrder.create({
      data: {
        companyId: fixture.company.id,
        propertyId: fixture.propertyA.id,
        unitId: fixture.unitA.id,
        tenantId: fixture.tenantA.id,
        vendorId: fixture.vendor.id,
        title: 'Replace chilled-water valve',
        status: 'IN_PROGRESS',
        currency: 'OMR',
        createdById: fixture.manager.id,
      },
    });
    const quote = await prisma.pmsMaintenanceQuote.create({
      data: {
        companyId: fixture.company.id,
        workOrderId: workOrder.id,
        vendorId: fixture.vendor.id,
        amount: 120,
        currency: 'OMR',
        status: 'APPROVED',
        submittedAt: new Date('2026-07-10T08:00:00.000Z'),
        approvedAt: new Date('2026-07-10T09:00:00.000Z'),
        createdById: fixture.vendorUser.id,
        approvedById: fixture.manager.id,
      },
    });
    await prisma.pmsWorkOrder.update({ where: { id: workOrder.id }, data: { approvedQuoteId: quote.id } });

    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const submitted = await request(app)
      .post(`/api/vendor/work-orders/${workOrder.id}/invoices`)
      .set('Authorization', `Bearer ${fixture.vendorToken}`)
      .field('invoiceNumber', 'INV-21H-001')
      .field('externalInvoiceNumber', 'SUPPLIER-001')
      .field('issueDate', '2026-07-11')
      .field('dueDate', '2026-07-31')
      .field('currency', 'OMR')
      .field('subtotalAmount', '100')
      .field('taxAmount', '5')
      .field('totalAmount', '105')
      .field('notes', 'Approved valve replacement')
      .attach('file', pdf, { filename: 'vendor-invoice.pdf', contentType: 'application/pdf' })
      .expect(201);
    const invoiceId = submitted.body.invoice.id as string;
    expect(submitted.body.invoice).toMatchObject({ status: 'SUBMITTED', invoiceNumber: 'INV-21H-001', totalAmount: '105' });
    await expect(prisma.pmsVendorInvoice.update({ where: { id: invoiceId }, data: { totalAmount: 104 } })).rejects.toThrow(/immutable/i);

    const vendorQueue = await request(app).get('/api/vendor/invoices').set('Authorization', `Bearer ${fixture.vendorToken}`).expect(200);
    expect(vendorQueue.body.invoices).toEqual([expect.objectContaining({ id: invoiceId, property: expect.objectContaining({ id: fixture.propertyA.id }) })]);
    await request(app).get('/api/vendor/invoices').set('Authorization', `Bearer ${fixture.ownerToken}`).expect(403);

    const scopedList = await request(app)
      .get(`/api/pms/accounting/vendor-invoices?companyId=${fixture.company.id}`)
      .set('Authorization', `Bearer ${fixture.scopedToken}`)
      .expect(200);
    expect(scopedList.body.invoices.map((invoice: { id: string }) => invoice.id)).toEqual([invoiceId]);
    expect(scopedList.body.workOrders).toEqual([expect.objectContaining({ id: workOrder.id, approvedQuote: expect.objectContaining({ amount: '120' }) })]);
    await request(app)
      .get(`/api/pms/accounting/vendor-invoices?companyId=${fixture.otherCompany.id}`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .expect(403);

    await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'REVIEW' })
      .expect(200);
    await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.vendorToken}`)
      .send({ companyId: fixture.company.id, action: 'APPROVE', approvedAmount: 103 })
      .expect(403);
    const sourceDocument = await prisma.pmsDocument.findFirstOrThrow({ where: { vendorInvoiceId: invoiceId, type: 'MAINTENANCE_INVOICE' } });
    await expect(prisma.pmsDocument.update({ where: { id: sourceDocument.id }, data: { status: 'ARCHIVED' } })).rejects.toThrow(/immutable/i);
    const approved = await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'APPROVE', approvedAmount: 103, evidenceDocumentId: sourceDocument.id })
      .expect(200);
    expect(approved.body.invoice).toMatchObject({ status: 'APPROVED', approvedAmount: '103', approvedBy: { id: fixture.checker.id } });
    await expect(prisma.pmsVendorInvoice.update({ where: { id: invoiceId }, data: { totalAmount: 1 } })).rejects.toThrow(/immutable/i);
    await expect(prisma.pmsVendorInvoice.update({ where: { id: invoiceId }, data: { status: 'DRAFT' } })).rejects.toThrow(/payment processing/i);

    const submissionEvidence = await request(app)
      .post('/api/pms/documents/upload')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .field('metadata', JSON.stringify({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, workOrderId: workOrder.id, vendorInvoiceId: invoiceId, type: 'OTHER', title: 'Vendor payment submission evidence', status: 'ACTIVE' }))
      .attach('file', pdf, { filename: 'payment-submission.pdf', contentType: 'application/pdf' })
      .expect(201);
    const vendorWorkOrdersAfterEvidence = await request(app).get('/api/vendor/work-orders').set('Authorization', `Bearer ${fixture.vendorToken}`).expect(200);
    expect(vendorWorkOrdersAfterEvidence.body.workOrders.flatMap((item: { pmsDocuments: Array<{ id: string }> }) => item.pmsDocuments.map((document) => document.id))).not.toContain(submissionEvidence.body.document.id);
    const vendorInvoicesAfterEvidence = await request(app).get('/api/vendor/invoices').set('Authorization', `Bearer ${fixture.vendorToken}`).expect(200);
    expect(vendorInvoicesAfterEvidence.body.invoices[0].documents.map((document: { id: string }) => document.id)).toEqual([sourceDocument.id]);
    await request(app).get(`/api/vendor/documents/${submissionEvidence.body.document.id}/download`).set('Authorization', `Bearer ${fixture.vendorToken}`).expect(404);
    await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'SUBMIT_PAYMENT', evidenceDocumentId: submissionEvidence.body.document.id, paymentReference: 'AP-SUBMIT-21H', paymentMethodNote: 'Bank instruction accepted', providerConfirmed: true })
      .expect(409);
    const processing = await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'SUBMIT_PAYMENT', evidenceDocumentId: submissionEvidence.body.document.id, paymentReference: 'AP-SUBMIT-21H', paymentMethodNote: 'Bank instruction accepted', adapter: 'MANUAL_BANK_EVIDENCE', providerConfirmed: true })
      .expect(200);
    expect(processing.body.invoice).toMatchObject({ status: 'PROCESSING', processingBy: { id: fixture.manager.id } });

    const failed = await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'RECORD_FAILED', reason: 'Bank beneficiary validation failed' })
      .expect(200);
    expect(failed.body.invoice).toMatchObject({ status: 'FAILED', failureReason: 'Bank beneficiary validation failed' });
    const retried = await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'RETRY', reason: 'Verified corrected beneficiary details' })
      .expect(200);
    expect(retried.body.invoice).toMatchObject({ status: 'APPROVED', paymentReference: null, failureReason: null, approvedBy: { id: fixture.checker.id } });
    await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'SUBMIT_PAYMENT', evidenceDocumentId: submissionEvidence.body.document.id, paymentReference: 'AP-SUBMIT-RETRY-STALE-21H', paymentMethodNote: 'Stale bank instruction', adapter: 'MANUAL_BANK_EVIDENCE', providerConfirmed: true })
      .expect(409);
    const retryEvidence = await request(app)
      .post('/api/pms/documents/upload')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .field('metadata', JSON.stringify({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, vendorInvoiceId: invoiceId, type: 'OTHER', title: 'Corrected vendor payment submission evidence', status: 'ACTIVE' }))
      .attach('file', pdf, { filename: 'payment-retry.pdf', contentType: 'application/pdf' })
      .expect(201);
    await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'SUBMIT_PAYMENT', evidenceDocumentId: retryEvidence.body.document.id, paymentReference: 'AP-SUBMIT-RETRY-21H', paymentMethodNote: 'Corrected bank instruction accepted', adapter: 'MANUAL_BANK_EVIDENCE', providerConfirmed: true })
      .expect(200);

    await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'RECORD_PAID', evidenceDocumentId: submissionEvidence.body.document.id, paymentReference: 'AP-PAID-21H', paymentMethodNote: 'Bank settlement confirmed', providerConfirmed: true })
      .expect(409);
    const paidEvidence = await request(app)
      .post('/api/pms/documents/upload')
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .field('metadata', JSON.stringify({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, vendorInvoiceId: invoiceId, type: 'OTHER', title: 'Final vendor payment evidence', status: 'ACTIVE' }))
      .attach('file', pdf, { filename: 'payment-result.pdf', contentType: 'application/pdf' })
      .expect(201);
    await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'RECORD_PAID', evidenceDocumentId: paidEvidence.body.document.id, paymentReference: 'AP-PAID-21H', paymentMethodNote: 'Bank settlement confirmed', providerConfirmed: true })
      .expect(409);
    const paid = await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'RECORD_PAID', evidenceDocumentId: paidEvidence.body.document.id, paymentReference: 'AP-PAID-21H', paymentMethodNote: 'Bank settlement confirmed', providerConfirmed: true, paidAt: '2026-07-13T12:00:00.000Z' })
      .expect(200);
    expect(paid.body.invoice).toMatchObject({ status: 'PAID', paidAmount: '103', paymentReference: 'AP-PAID-21H', paidBy: { id: fixture.checker.id } });
    const ledgerEntry = await prisma.pmsAccountingLedgerEntry.findFirstOrThrow({ where: { vendorInvoiceId: invoiceId, source: 'VENDOR_INVOICE' } });
    expect(await prisma.pmsAccountingLedgerEntry.count({ where: { vendorInvoiceId: invoiceId, source: 'VENDOR_INVOICE' } })).toBe(1);
    await expect(prisma.pmsVendorInvoice.update({ where: { id: invoiceId }, data: { paymentReference: 'DIRECT-DB-EDIT' } })).rejects.toThrow(/immutable/i);
    await expect(prisma.pmsAccountingLedgerEntry.update({ where: { id: ledgerEntry.id }, data: { amount: 1 } })).rejects.toThrow(/immutable/i);
    await expect(prisma.pmsAccountingLedgerEntry.delete({ where: { id: ledgerEntry.id } })).rejects.toThrow(/cannot be deleted/i);
    await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`)
      .set('Authorization', `Bearer ${fixture.checkerToken}`)
      .send({ companyId: fixture.company.id, action: 'RECORD_PAID', evidenceDocumentId: paidEvidence.body.document.id, paymentReference: 'AP-PAID-REPLAY', paymentMethodNote: 'Replay', providerConfirmed: true })
      .expect(409);

    const draftToVoid = await request(app)
      .post('/api/pms/accounting/vendor-invoices')
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, vendorId: fixture.vendor.id, workOrderId: workOrder.id, approvedQuoteId: quote.id, invoiceNumber: 'INV-21H-VOID', issueDate: '2026-07-12', dueDate: '2026-07-31', currency: 'OMR', subtotalAmount: 25, taxAmount: 0, totalAmount: 25 })
      .expect(201);
    await request(app)
      .post(`/api/pms/accounting/vendor-invoices/${draftToVoid.body.invoice.id}/transition`)
      .set('Authorization', `Bearer ${fixture.managerToken}`)
      .send({ companyId: fixture.company.id, action: 'VOID', reason: 'Duplicate supplier invoice' })
      .expect(200);
    await expect(prisma.pmsVendorInvoice.update({ where: { id: draftToVoid.body.invoice.id }, data: { notes: 'Direct edit' } })).rejects.toThrow(/immutable/i);
  });

  it('scopes assets, generates preventive work orders idempotently, and converts inspection defects once', async () => {
    const fixture = await createFixture();
    const asset = await request(app).post('/api/pms/assets').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, assetCode: 'HVAC-A-101', name: 'Main HVAC', category: 'HVAC', serviceIntervalDays: 30, nextServiceDate: '2026-07-01', vendorId: fixture.vendor.id, currency: 'OMR' }).expect(201);
    await request(app).get(`/api/pms/assets?companyId=${fixture.company.id}&propertyId=${fixture.propertyB.id}`).set('Authorization', `Bearer ${fixture.scopedToken}`).expect(403);
    await request(app).get(`/api/pms/assets?companyId=${fixture.otherCompany.id}`).set('Authorization', `Bearer ${fixture.managerToken}`).expect(403);

    const plan = await request(app).post('/api/pms/preventive-maintenance/plans').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, assetId: asset.body.asset.id, vendorId: fixture.vendor.id, title: 'Monthly HVAC service', nextServiceDate: '2026-07-01', intervalDays: 30, checklist: ['Inspect filter', 'Measure cooling'] }).expect(201);
    const firstRun = await generateDuePreventiveWorkOrders({ asOf: new Date('2026-07-02'), companyId: fixture.company.id, actorId: fixture.manager.id });
    const secondRun = await generateDuePreventiveWorkOrders({ asOf: new Date('2026-07-02'), companyId: fixture.company.id, actorId: fixture.manager.id });
    expect(firstRun).toHaveLength(1);
    expect(secondRun).toHaveLength(0);
    expect(await prisma.pmsWorkOrder.count({ where: { maintenancePlanId: plan.body.plan.id } })).toBe(1);

    const template = await request(app).post('/api/pms/structured-inspections/templates').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, name: 'Move-out condition', type: 'MOVE_OUT', sections: [{ title: 'HVAC', items: [{ label: 'Cooling condition', required: true, requiresPhotoOnFailure: false }] }] }).expect(201);
    const itemId = template.body.template.sections[0].items[0].id as string;
    const run = await request(app).post('/api/pms/structured-inspections/runs').set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, templateId: template.body.template.id, propertyId: fixture.propertyA.id, unitId: fixture.unitA.id, leaseId: fixture.leaseA.id, tenantId: fixture.tenantA.id, title: 'Move-out inspection' }).expect(201);
    const completed = await request(app).put(`/api/pms/structured-inspections/runs/${run.body.inspection.id}/results`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, results: [{ templateItemId: itemId, result: 'FAIL', notes: 'Cooling insufficient', photoUrls: [], defect: { title: 'Repair HVAC cooling', severity: 'HIGH', photoUrls: [] } }] }).expect(200);
    const defectId = completed.body.inspection.defects[0].id as string;
    const converted = await request(app).post(`/api/pms/structured-inspections/defects/${defectId}/work-order`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, assetId: asset.body.asset.id, vendorId: fixture.vendor.id }).expect(201);
    const replay = await request(app).post(`/api/pms/structured-inspections/defects/${defectId}/work-order`).set('Authorization', `Bearer ${fixture.managerToken}`).send({ companyId: fixture.company.id, assetId: asset.body.asset.id, vendorId: fixture.vendor.id }).expect(200);
    expect(replay.body).toMatchObject({ idempotent: true });
    expect(replay.body.workOrder.id).toBe(converted.body.workOrder.id);
  });

  it('serves owner portal documents privately and denies cross-owner access', async () => {
    const fixture = await createFixture();
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const upload = await request(app).post('/api/pms/documents/upload').set('Authorization', `Bearer ${fixture.managerToken}`).field('metadata', JSON.stringify({ companyId: fixture.company.id, propertyId: fixture.propertyA.id, type: 'MAINTENANCE_INVOICE', title: 'Approved property invoice', status: 'ACTIVE' })).attach('file', pdf, { filename: 'invoice.pdf', contentType: 'application/pdf' }).expect(201);
    await request(app).get(`/api/owner/documents/${upload.body.document.id}/download`).set('Authorization', `Bearer ${fixture.ownerToken}`).expect(200);
    await request(app).get(`/api/owner/documents/${upload.body.document.id}/download`).set('Authorization', `Bearer ${fixture.outsiderToken}`).expect(403);
  });
});

import { expect, test, type Page, type Route } from '@playwright/test';

import { mockNotificationsApi } from './support/apiMocks';

const companyId = 'company-settlements';
const propertyId = 'property-settlements';
const statementId = 'statement-settlements';
const payoutId = 'payout-settlements';
const ownerId = 'owner-settlements';

const property = { id: propertyId, name: 'Harbour Owner Residences', code: 'HOR' };
const baseStatement = {
  id: statementId,
  companyId,
  propertyId,
  property,
  status: 'PUBLISHED',
  revision: 1,
  revisionOfId: null,
  ownerReference: 'OWNER-JUN-2026',
  periodStart: '2026-06-01T00:00:00.000Z',
  periodEnd: '2026-06-30T23:59:59.999Z',
  currency: 'OMR',
  includedRentPaymentIds: [],
  includedAccountingEntryIds: [],
  includedMaintenanceWorkOrderIds: [],
  openingBalance: '20',
  income: '500',
  expenses: '100',
  adjustments: '10',
  closingBalance: '430',
  snapshotVersion: 1,
  immutableSnapshot: { version: 1 },
  generatedAt: '2026-07-01T08:00:00.000Z',
  reviewedAt: '2026-07-01T09:00:00.000Z',
  approvedAt: '2026-07-01T09:00:00.000Z',
  publishedAt: '2026-07-01T10:00:00.000Z',
  voidedAt: null,
  generatedBy: { id: 'preparer', name: 'Statement Preparer', email: 'preparer@lux.test' },
  approvedBy: { id: 'checker', name: 'Statement Checker', email: 'checker@lux.test' },
  publishedBy: { id: 'publisher', name: 'Statement Publisher', email: 'publisher@lux.test' },
  reviewedBy: { id: 'checker', name: 'Statement Checker', email: 'checker@lux.test' },
  voidedBy: null,
  documents: [{ id: 'statement-evidence', title: 'Closed period owner statement', type: 'OTHER', status: 'ACTIVE', originalFilename: 'statement.pdf', createdAt: '2026-07-01T09:30:00.000Z', uploadedBy: { id: 'checker', name: 'Statement Checker', email: 'checker@lux.test' } }],
  revisions: [],
  payoutLines: [],
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const ownerAccess = { id: 'owner-access', propertyId, property, userId: ownerId, user: { id: ownerId, name: 'Harbour Owner', email: 'owner@lux.test' } };

const basePayout = {
  id: payoutId,
  payoutNumber: 'PAY-20260701-OWNER',
  status: 'APPROVED',
  grossAmount: '520',
  managementFeeAmount: '20',
  reservedAmount: '10',
  payoutAmount: '400',
  currency: 'OMR',
  periodStart: baseStatement.periodStart,
  periodEnd: baseStatement.periodEnd,
  payoutReference: null,
  paymentMethodNote: null,
  approvedAt: '2026-07-02T09:00:00.000Z',
  processingAt: null,
  paidAt: null,
  cancelledAt: null,
  failureReason: null,
  notes: 'June owner payout',
  ownerUserId: ownerId,
  ownerUser: ownerAccess.user,
  createdBy: { id: 'preparer', name: 'Payout Preparer', email: 'payout-preparer@lux.test' },
  approvedBy: { id: 'checker', name: 'Payout Checker', email: 'checker@lux.test' },
  paidBy: null,
  cancelledBy: null,
  lines: [{ id: 'payout-line', propertyId, property, statementId, statement: { id: statementId, revision: 1, status: 'PUBLISHED', periodStart: baseStatement.periodStart, periodEnd: baseStatement.periodEnd, currency: 'OMR', openingBalance: '20', income: '500', expenses: '100', adjustments: '10', closingBalance: '430' }, incomeAmount: '530', expenseAmount: '100', managementFeeAmount: '20', reservedAmount: '10', netAmount: '400', currency: 'OMR', createdAt: '2026-07-02T08:00:00.000Z' }],
  documents: [{ id: 'approval-evidence', title: 'Approval checklist', type: 'OTHER', status: 'ACTIVE', originalFilename: 'approval.pdf', createdAt: '2026-07-02T08:30:00.000Z', uploadedBy: { id: 'preparer', name: 'Payout Preparer', email: 'payout-preparer@lux.test' } }],
  createdAt: '2026-07-02T08:00:00.000Z',
  updatedAt: '2026-07-02T09:00:00.000Z',
};

async function authenticate(page: Page, permissions = ['ACCOUNTING_VIEW', 'ACCOUNTING_MANAGE'], userId = 'manager') {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'settlements-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: userId, name: 'Settlement Manager', email: 'manager@lux.test', role: 'USER', emailVerified: true, pmsAccess: { hasAccess: true, workspaces: [{ memberId: 'member', role: permissions.includes('ACCOUNTING_MANAGE') ? 'PMS_ACCOUNTANT' : 'PMS_VIEWER', permissionKeys: permissions, propertyScope: { allProperties: true, propertyIds: [] }, company: { id: companyId, slug: 'settlements', nameEn: 'Settlement Company', nameAr: 'شركة التسويات' }, entitlement: { status: 'ACTIVE', trialEndsAt: null } }] } } } }));
  await mockNotificationsApi(page);
}

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

type SettlementCallbacks = {
  statementList?: (url: URL) => void;
  statementTransition?: (body: Record<string, unknown>) => void;
  createPayout?: (body: Record<string, unknown>) => void;
  payoutTransition?: (body: Record<string, unknown>) => void;
};

async function mockSettlementApi(page: Page, callbacks: SettlementCallbacks = {}, initialStatement = baseStatement, initialPayout = basePayout) {
  let statement = { ...initialStatement } as Record<string, any>;
  let payout = { ...initialPayout, documents: [...initialPayout.documents] } as Record<string, any>;
  await page.route('**/api/pms/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    if (path === '/api/pms/accounting/owner-statements' && method === 'GET') {
      callbacks.statementList?.(url);
      const requestedStatus = url.searchParams.get('status');
      return fulfill(route, { statements: !requestedStatus || statement.status === requestedStatus ? [statement] : [], pagination: { take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1, total: 26 }, totalsByStatus: [{ status: statement.status, count: 1 }], totalsByCurrency: [{ currency: 'OMR', count: 26, closingBalance: '11180' }], properties: [property] });
    }
    if (path === `/api/pms/accounting/owner-statements/${statementId}` && method === 'GET') return fulfill(route, { statement, events: [{ id: 'statement-event', action: 'status_transition', createdAt: '2026-07-01T10:00:00.000Z' }] });
    if (path === `/api/pms/accounting/owner-statements/${statementId}/transition` && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>; callbacks.statementTransition?.(body);
      statement = { ...statement, status: body.status, approvedBy: body.status === 'APPROVED' ? { id: 'manager', name: 'Settlement Manager', email: 'manager@lux.test' } : statement.approvedBy, publishedBy: body.status === 'PUBLISHED' ? { id: 'manager', name: 'Settlement Manager', email: 'manager@lux.test' } : statement.publishedBy };
      return fulfill(route, { statement });
    }
    if (path === '/api/pms/documents/upload' && method === 'POST') {
      const isPayout = request.postData()?.includes(payoutId) ?? false;
      const document = { id: isPayout ? 'submission-evidence' : 'uploaded-statement-evidence', title: isPayout ? 'Bank submission evidence' : 'Statement evidence', type: 'OTHER', status: 'ACTIVE', originalFilename: 'evidence.pdf', createdAt: '2026-07-03T10:00:00.000Z', uploadedBy: { id: 'manager', name: 'Settlement Manager', email: 'manager@lux.test' } };
      if (isPayout) payout = { ...payout, documents: [...payout.documents, document] }; else statement = { ...statement, documents: [...(statement.documents ?? []), document] };
      return fulfill(route, { document }, 201);
    }
    if (path === '/api/pms/accounting/owner-payouts' && method === 'GET') return fulfill(route, { batches: [payout], pagination: { take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1, total: 1 }, totalsByStatus: [{ status: payout.status, count: 1 }], totalsByCurrency: [{ currency: 'OMR', count: 1, payoutAmount: payout.payoutAmount }], ownerAccesses: [ownerAccess] });
    if (path === '/api/pms/accounting/owner-payouts' && method === 'POST') { const body = request.postDataJSON() as Record<string, unknown>; callbacks.createPayout?.(body); return fulfill(route, { batch: payout }, 201); }
    if (path === `/api/pms/accounting/owner-payouts/${payoutId}` && method === 'GET') return fulfill(route, { batch: payout, events: [{ id: 'payout-event', action: 'PMS_OWNER_PAYOUT_APPROVE', createdAt: '2026-07-02T09:00:00.000Z' }] });
    if (path === `/api/pms/accounting/owner-payouts/${payoutId}/transition` && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>; callbacks.payoutTransition?.(body);
      payout = { ...payout, status: body.action === 'SUBMIT' ? 'PROCESSING' : body.action === 'RECORD_PAID' ? 'PAID_MANUAL' : body.action === 'RECORD_FAILED' ? 'FAILED' : body.action === 'RETRY' ? 'DRAFT' : body.action === 'CANCEL' ? 'CANCELLED' : 'APPROVED', payoutReference: body.payoutReference ?? payout.payoutReference, paymentMethodNote: body.paymentMethodNote ?? payout.paymentMethodNote, processingAt: body.action === 'SUBMIT' ? '2026-07-03T09:00:00.000Z' : payout.processingAt, paidAt: body.action === 'RECORD_PAID' ? '2026-07-03T11:00:00.000Z' : payout.paidAt };
      return fulfill(route, { batch: payout });
    }
    return fulfill(route, { message: `Unhandled settlements mock: ${method} ${path}` }, 404);
  });
}

test('owner statements use server pagination and URL-persisted financial filters', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page); await mockSettlementApi(page, { statementList: (url) => queries.push(url) });
  await page.goto(`/pms/finance/statements?companyId=${companyId}`);
  await expect(page.getByRole('table', { name: 'Owner statements', exact: true }).getByText('Harbour Owner Residences', { exact: true })).toBeVisible();
  await expect(page.getByText('1–1 of 26')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('PUBLISHED');
  await page.getByLabel('Search').fill('harbour');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/status=PUBLISHED/);
  await expect(page).toHaveURL(/q=harbour/);
  await expect(page).not.toHaveURL(/page=2/);
});

test('statement publication exposes immutable evidence and maker-checker controls', async ({ page }) => {
  let transitionBody: Record<string, unknown> | undefined;
  const approved = { ...baseStatement, status: 'APPROVED', publishedAt: null, publishedBy: null, approvedBy: { id: 'checker', name: 'Statement Checker', email: 'checker@lux.test' } };
  await authenticate(page, ['ACCOUNTING_VIEW', 'ACCOUNTING_MANAGE'], 'publisher'); await mockSettlementApi(page, { statementTransition: (body) => { transitionBody = body; } }, approved);
  await page.goto(`/pms/finance/statements?companyId=${companyId}`);
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Harbour Owner Residences.*Approved/ });
  await expect(dialog.getByText('Publication requires a closed matching period and at least one active supporting document.')).toBeVisible();
  await expect(dialog.getByText('Closed period owner statement')).toBeVisible();
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect.poll(() => transitionBody).toMatchObject({ status: 'PUBLISHED' });
  const publishedDialog = page.getByRole('dialog', { name: /Harbour Owner Residences.*Published/ });
  await expect(publishedDialog.getByText('Published', { exact: true }).first()).toBeVisible();
});

test('payout preparation sends only immutable statement references and controlled deductions', async ({ page }) => {
  let createBody: Record<string, any> | undefined;
  await authenticate(page); await mockSettlementApi(page, { createPayout: (body) => { createBody = body; } });
  await page.goto(`/pms/finance/payouts?companyId=${companyId}`);
  await page.getByRole('button', { name: 'Prepare payout batch', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Prepare payout batch', exact: true });
  await dialog.getByRole('combobox', { name: 'Owner', exact: true }).selectOption(ownerId);
  await dialog.getByRole('checkbox').check();
  await dialog.getByLabel('Management fee').fill('20');
  await dialog.getByLabel('Reserve').fill('10');
  await dialog.getByRole('button', { name: 'Prepare payout batch', exact: true }).click();
  await expect.poll(() => createBody).toMatchObject({ companyId, ownerUserId: ownerId, currency: 'OMR', lines: [{ statementId, managementFeeAmount: 20, reservedAmount: 10 }] });
  expect(createBody?.lines[0]).not.toHaveProperty('incomeAmount');
  expect(createBody?.lines[0]).not.toHaveProperty('expenseAmount');
});

test('payout submission requires linked evidence, adapter confirmation, and an external reference', async ({ page }) => {
  let transitionBody: Record<string, unknown> | undefined;
  await authenticate(page); await mockSettlementApi(page, { payoutTransition: (body) => { transitionBody = body; } });
  await page.goto(`/pms/finance/payouts?companyId=${companyId}`);
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /PAY-20260701-OWNER.*Approved/ });
  await dialog.getByRole('button', { name: 'Submit payout', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Evidence document', exact: true }).selectOption('approval-evidence');
  await dialog.getByLabel('External payout reference').fill('BANK-TRANSFER-7788');
  await dialog.getByLabel('Payment-method evidence note').fill('Bank adapter response verified against the beneficiary account.');
  await dialog.getByLabel('The payout adapter confirmed submission').check();
  await dialog.getByRole('button', { name: 'Submit payout', exact: true }).last().click();
  await expect.poll(() => transitionBody).toMatchObject({ companyId, action: 'SUBMIT', evidenceDocumentId: 'approval-evidence', adapter: 'MANUAL_BANK_EVIDENCE', providerConfirmed: true, payoutReference: 'BANK-TRANSFER-7788' });
});

test('accounting viewers can inspect settlements without mutation controls', async ({ page }) => {
  await authenticate(page, ['ACCOUNTING_VIEW']); await mockSettlementApi(page);
  await page.goto(`/pms/finance/statements?companyId=${companyId}`);
  await expect(page.getByRole('button', { name: 'Prepare owner statement', exact: true })).toHaveCount(0);
  await expect(page.getByText('Accounting management permission is required for workflow actions.')).toBeVisible();
  await page.goto(`/pms/finance/payouts?companyId=${companyId}`);
  await expect(page.getByRole('button', { name: 'Prepare payout batch', exact: true })).toHaveCount(0);
});

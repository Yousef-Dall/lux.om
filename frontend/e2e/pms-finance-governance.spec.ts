import { expect, test, type Page, type Route } from '@playwright/test';

import { mockNotificationsApi } from './support/apiMocks';

const companyId = 'company-governance';
const propertyId = 'property-governance';
const accountId = 'deposit-governance';
const periodId = 'period-governance';
const reconciliationId = 'reconciliation-governance';

const lease = {
  id: 'lease-governance', companyId, tenantId: 'tenant-governance', tenant: { id: 'tenant-governance', fullName: 'Governance Tenant', active: true },
  propertyId, property: { id: propertyId, name: 'Governance Residences', code: 'GOV', companyId }, unitId: 'unit-governance', unit: { id: 'unit-governance', unitNumber: 'G-101', unitName: 'G-101', status: 'ACTIVE', occupancyStatus: 'OCCUPIED' },
  title: 'Governance lease', status: 'ACTIVE', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentFrequency: 'MONTHLY', rentAmount: '500', currency: 'OMR', counts: { rentDueItems: 1 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
};

const payment = {
  id: 'payment-governance', amount: '200', currency: 'OMR', method: 'BANK_TRANSFER', status: 'CONFIRMED', paidAt: '2026-07-10T00:00:00.000Z', confirmedAt: '2026-07-10T00:00:00.000Z', receiptNumber: 'RCP-GOV-001',
  propertyId, property: { id: propertyId, name: 'Governance Residences' }, unitId: lease.unitId, unit: { id: lease.unitId, unitNumber: lease.unit.unitNumber }, tenantId: lease.tenantId, tenant: { id: lease.tenantId, fullName: lease.tenant.fullName }, leaseId: lease.id, lease: { id: lease.id, title: lease.title, currency: 'OMR' }, allocations: [], adjustments: [], allocatedAmount: '0', adjustedAmount: '0', depositAllocatedAmount: '0', availableAmount: '200', createdAt: '2026-07-10T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z',
};

const baseAccount = {
  id: accountId, status: 'HELD', expectedAmount: '200', liabilityBalance: '200', currency: 'OMR', companyId, propertyId, property: { id: propertyId, name: 'Governance Residences' }, unitId: lease.unitId, unit: { id: lease.unitId, unitNumber: lease.unit.unitNumber }, leaseId: lease.id, lease: { id: lease.id, title: lease.title, status: 'ACTIVE' }, tenantId: lease.tenantId, tenant: { id: lease.tenantId, fullName: lease.tenant.fullName }, transactions: [], _count: { transactions: 0 }, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z',
};

const reviewingPeriod = {
  id: periodId, status: 'REVIEWING', periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-07-31T23:59:59.000Z', currency: 'OMR', propertyId, property: { id: propertyId, name: 'Governance Residences' }, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z',
  events: [{ id: 'period-event', fromStatus: 'OPEN', toStatus: 'REVIEWING', reason: 'Month-end review', createdAt: '2026-07-10T00:00:00.000Z', createdBy: { id: 'manager', name: 'Finance Manager' } }],
  closes: [{
    id: 'close-pack-governance', revision: 1, snapshotHash: 'a'.repeat(64), snapshotVersion: 1, reviewEventId: 'review-event-governance',
    reviewReason: 'Initial review', closeReason: 'Initial close', reviewedAt: '2026-07-08T00:00:00.000Z', closedAt: '2026-07-08T01:00:00.000Z',
    reopenedAt: '2026-07-09T00:00:00.000Z', reopenReason: 'Approved correction', reviewedBy: { id: 'reviewer', name: 'Independent Reviewer' },
    closedBy: { id: 'closer', name: 'Independent Closer' }, reopenedBy: { id: 'manager', name: 'Finance Manager' },
  }],
};

const reconciliation = {
  id: reconciliationId, source: 'BANK', direction: 'CREDIT', status: 'UNMATCHED', externalReference: 'BANK-GOV-001', amount: '200', currency: 'OMR', transactionDate: '2026-07-10T00:00:00.000Z', payerReference: 'Governance Tenant', propertyId, property: { id: propertyId, name: 'Governance Residences' }, createdAt: '2026-07-10T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z',
};


const treasuryImportPreview = {
  headers: ['externalReference', 'amount', 'currency', 'transactionDate'],
  totalRows: 3,
  validRows: [{ rowNumber: 2, status: 'VALID', errors: [], data: { source: 'BANK', direction: 'CREDIT', externalReference: 'BANK-IMPORT-001', amount: 200, currency: 'OMR', transactionDate: '2026-07-10T00:00:00.000Z', propertyId, payerReference: 'Governance Tenant' } }],
  duplicateRows: [{ rowNumber: 3, status: 'DUPLICATE', errors: [], duplicateReason: 'DUPLICATE_IN_FILE', data: { source: 'BANK', direction: 'CREDIT', externalReference: 'BANK-IMPORT-001', amount: 200, currency: 'OMR', transactionDate: '2026-07-10T00:00:00.000Z', propertyId, payerReference: null } }],
  invalidRows: [{ rowNumber: 4, status: 'INVALID', errors: ['Currency must be a three-letter code.'], data: null }],
  contentHash: 'hash-governance',
};

const paidVendorInvoice = {
  id: 'invoice-governance', invoiceNumber: 'INV-GOV-001', status: 'PAID', issueDate: '2026-07-01T00:00:00.000Z', dueDate: '2026-07-10T00:00:00.000Z', currency: 'OMR', subtotalAmount: '100', taxAmount: '3', totalAmount: '103', approvedAmount: '103', paidAmount: '103', paidAt: '2026-07-12T00:00:00.000Z', paymentReference: 'BANK-AP-GOV', companyId, propertyId, vendorId: 'vendor-governance', workOrderId: 'work-order-governance', property: { id: propertyId, name: 'Governance Residences' }, vendor: { id: 'vendor-governance', name: 'Governance Vendor' }, workOrder: { id: 'work-order-governance', title: 'Valve repair', status: 'COMPLETED', currency: 'OMR' }, documents: [], ledgerEntries: [], createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
};

const paidOwnerPayout = {
  id: 'payout-governance', payoutNumber: 'PO-GOV-001', status: 'PAID_MANUAL', grossAmount: '80', managementFeeAmount: '5', reservedAmount: '2', payoutAmount: '73', currency: 'OMR', periodStart: '2026-06-01T00:00:00.000Z', periodEnd: '2026-06-30T23:59:59.000Z', payoutReference: 'BANK-OWNER-GOV', paidAt: '2026-07-03T00:00:00.000Z', ownerUserId: 'owner-governance', ownerUser: { id: 'owner-governance', name: 'Governance Owner', email: 'owner@lux.test' }, lines: [], documents: [], createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-03T00:00:00.000Z',
};

async function authenticate(page: Page, permissions = ['ACCOUNTING_VIEW', 'ACCOUNTING_MANAGE', 'RENT_MANAGE'], allProperties = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'governance-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'manager', name: 'Finance Manager', email: 'manager@lux.test', role: 'USER', emailVerified: true, pmsAccess: { hasAccess: true, workspaces: [{ memberId: 'member', role: permissions.includes('ACCOUNTING_MANAGE') ? 'PMS_OWNER' : 'PMS_VIEWER', permissionKeys: permissions, propertyScope: { allProperties, propertyIds: allProperties ? [] : [propertyId] }, company: { id: companyId, slug: 'governance', nameEn: 'Governance Company', nameAr: 'شركة الحوكمة' }, entitlement: { status: 'ACTIVE', trialEndsAt: null } }] } } } }));
  await mockNotificationsApi(page);
}

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockGovernanceApi(page: Page, callbacks: { depositTransaction?: (body: Record<string, unknown>) => void; depositTransition?: (body: Record<string, unknown>) => void; periodTransition?: (body: Record<string, unknown>) => void; reconciliationMatch?: (body: Record<string, unknown>) => void; treasuryPreview?: (body: Record<string, unknown>) => void; treasuryCommit?: (body: Record<string, unknown>) => void; depositList?: (url: URL) => void; reconciliationItem?: Record<string, unknown> } = {}) {
  let transactions: Record<string, unknown>[] = [];
  const activeReconciliation = callbacks.reconciliationItem ?? reconciliation;
  await page.route('**/api/pms/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    if (path === '/api/pms/leases' && method === 'GET') return fulfill(route, { workspace: {}, leases: [lease], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/properties' && method === 'GET') return fulfill(route, { workspace: {}, properties: [lease.property], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/accounting/deposits' && method === 'GET') { callbacks.depositList?.(url); return fulfill(route, { accounts: [baseAccount], pagination: { take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1, total: 26 }, totalsByCurrency: [{ currency: 'OMR', count: 26, expectedAmount: '5200', liabilityBalance: '5000' }] }); }
    if (path === `/api/pms/accounting/deposits/${accountId}` && method === 'GET') return fulfill(route, { account: { ...baseAccount, transactions } });
    if (path === `/api/pms/accounting/deposits/${accountId}/transactions` && method === 'POST') { const body = request.postDataJSON() as Record<string, unknown>; callbacks.depositTransaction?.(body); const transaction = { id: 'deposit-transaction', type: body.type, status: 'PENDING_APPROVAL', amount: String(body.amount), currency: 'OMR', reason: body.reason, createdAt: '2026-07-11T00:00:00.000Z', createdBy: { id: 'manager', name: 'Finance Manager' }, documents: [] }; transactions = [transaction]; return fulfill(route, { transaction, idempotent: false }, 201); }
    if (path.includes('/transactions/deposit-transaction/transition') && method === 'POST') { const body = request.postDataJSON() as Record<string, unknown>; callbacks.depositTransition?.(body); transactions = transactions.map((item) => ({ ...item, status: body.action === 'APPROVE' ? 'APPROVED' : body.action === 'POST' ? 'POSTED' : 'VOID', approvedAt: '2026-07-11T01:00:00.000Z', approvedBy: { id: 'manager', name: 'Finance Manager' } })); return fulfill(route, { transaction: transactions[0] }); }
    if (path === '/api/pms/accounting/payments' && method === 'GET') return fulfill(route, { payments: [payment], pagination: { take: 100, skip: 0, count: 1, total: 1 }, totalsByCurrency: [{ currency: 'OMR', count: 1, recordedAmount: '200' }] });
    if (path === '/api/pms/accounting/charges' && method === 'GET') return fulfill(route, { charges: [], pagination: { take: 100, skip: 0, count: 0, total: 0 }, totalsByCurrency: [] });
    if (path === '/api/pms/accounting/periods' && method === 'GET') return fulfill(route, { periods: [reviewingPeriod], pagination: { take: 25, skip: 0, count: 1, total: 1 } });
    if (path === `/api/pms/accounting/periods/${periodId}/readiness` && method === 'GET') return fulfill(route, { period: reviewingPeriod, readiness: { canClose: false, blockerTotal: 6, reconciliationExceptions: 1, pendingDepositTransactions: 1, unallocatedPayments: 1, unallocatedAmount: '200', unreconciledRentPayments: 1, unreconciledVendorPayments: 1, unreconciledOwnerPayouts: 1 } });
    if (path === `/api/pms/accounting/periods/${periodId}/transition` && method === 'POST') { const body = request.postDataJSON() as Record<string, unknown>; callbacks.periodTransition?.(body); return fulfill(route, { period: { ...reviewingPeriod, status: body.action === 'CLOSE' ? 'CLOSED' : 'OPEN' } }); }
    if (path === '/api/pms/accounting/reconciliation' && method === 'GET') return fulfill(route, { items: [activeReconciliation], pagination: { take: 25, skip: 0, count: 1, total: 1 }, totalsByStatus: [{ status: 'UNMATCHED', count: 1 }], totalsByCurrency: [{ currency: 'OMR', count: 1, amount: String(activeReconciliation.amount ?? '0') }] });
    if (path === '/api/pms/accounting/reconciliation/imports/preview' && method === 'POST') { const body = request.postDataJSON() as Record<string, unknown>; callbacks.treasuryPreview?.(body); return fulfill(route, { preview: treasuryImportPreview }); }
    if (path === '/api/pms/accounting/reconciliation/imports/commit' && method === 'POST') { const body = request.postDataJSON() as Record<string, unknown>; callbacks.treasuryCommit?.(body); return fulfill(route, { preview: treasuryImportPreview, batch: { id: 'treasury-batch-governance', source: 'BANK', filename: 'bank-july.csv', accountReference: 'OMR-OPERATING', status: 'PARTIAL', totalRows: 3, importedRows: 1, duplicateRows: 1, failedRows: 1, itemCount: 1, createdAt: '2026-07-13T00:00:00.000Z', updatedAt: '2026-07-13T00:00:00.000Z' } }, 201); }
    if (path.startsWith('/api/pms/accounting/reconciliation/') && path.endsWith('/match') && method === 'POST') { const body = request.postDataJSON() as Record<string, unknown>; callbacks.reconciliationMatch?.(body); return fulfill(route, { item: { ...activeReconciliation, status: 'MATCHED' } }); }
    if (path === '/api/pms/accounting/vendor-invoices' && method === 'GET') return fulfill(route, { invoices: [paidVendorInvoice], pagination: { take: 100, skip: 0, count: 1, total: 1 }, totalsByStatus: [{ status: 'PAID', count: 1 }], totalsByCurrency: [{ currency: 'OMR', count: 1, totalAmount: '103', approvedAmount: '103', paidAmount: '103' }], overdueCount: 0, vendors: [], properties: [], workOrders: [] });
    if (path === '/api/pms/accounting/owner-payouts' && method === 'GET') return fulfill(route, { batches: [paidOwnerPayout], pagination: { take: 100, skip: 0, count: 1, total: 1 }, totalsByStatus: [{ status: 'PAID_MANUAL', count: 1 }], totalsByCurrency: [{ currency: 'OMR', count: 1, payoutAmount: '73' }], ownerAccesses: [] });
    return fulfill(route, { message: `Unhandled governance mock: ${method} ${path}` }, 404);
  });
}

test('deposit liabilities use server pagination and URL-persisted browsing filters', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page); await mockGovernanceApi(page, { depositList: (url) => queries.push(url) });
  await page.goto(`/pms/finance/deposits?companyId=${companyId}`);
  await expect(page.getByText('Governance Residences')).toBeVisible();
  await expect(page.getByText('1–1 of 26')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('HELD');
  await page.getByLabel('Search').fill('tenant');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/status=HELD/);
  await expect(page).toHaveURL(/q=tenant/);
  await expect(page).not.toHaveURL(/page=2/);
});

test('deposit deductions require visible approval before posting', async ({ page }) => {
  let transactionBody: Record<string, unknown> | undefined; let transitionBody: Record<string, unknown> | undefined;
  await authenticate(page); await mockGovernanceApi(page, { depositTransaction: (body) => { transactionBody = body; }, depositTransition: (body) => { transitionBody = body; } });
  await page.goto(`/pms/finance/deposits?companyId=${companyId}`);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Deposits.*Governance Residences/ });
  await dialog.getByRole('combobox', { name: 'Type', exact: true }).selectOption('DEDUCTION');
  await dialog.getByLabel('Amount').fill('25');
  await dialog.getByLabel('Reason').fill('Approved repair deduction');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => transactionBody?.type).toBe('DEDUCTION');
  await expect(dialog.getByText('Pending approval')).toBeVisible();
  await dialog.getByRole('button', { name: 'Approve', exact: true }).click();
  await dialog.getByLabel('Reason').last().fill('Evidence reviewed by finance');
  await dialog.getByRole('button', { name: 'Approve', exact: true }).last().click();
  await expect.poll(() => transitionBody?.action).toBe('APPROVE');
});

test('financial period close readiness exposes blockers and disables unsafe closing', async ({ page }) => {
  await authenticate(page); await mockGovernanceApi(page);
  await page.goto(`/pms/finance/periods?companyId=${companyId}`);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Financial periods', exact: true });
  await expect(dialog.getByText('Blocked')).toBeVisible();
  const readinessGrid = dialog.locator('.pms-governance-readiness__grid');
  await expect(readinessGrid.locator('p').filter({ hasText: 'Reconciliation exceptions' })).toContainText('1');
  await expect(readinessGrid.locator('p').filter({ hasText: 'Unallocated payments' })).toContainText('1');
  await expect(readinessGrid.locator('p').filter({ hasText: 'Unreconciled vendor payments' })).toContainText('1');
  await expect(dialog.getByText(/OMR.*200\.000/)).toBeVisible();
  await expect(dialog.getByText('A different accounting manager must close the period after review.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close period', exact: true })).toBeDisabled();
  await expect(dialog.getByText('Immutable close pack #1')).toBeVisible();
  await expect(dialog.getByText('a'.repeat(64))).toBeVisible();
  await expect(dialog.getByText('Month-end review')).toBeVisible();
});

test('treasury statement import previews exceptions and commits only validated rows', async ({ page }) => {
  let previewBody: Record<string, unknown> | undefined;
  let commitBody: Record<string, unknown> | undefined;
  await authenticate(page);
  await mockGovernanceApi(page, { treasuryPreview: (body) => { previewBody = body; }, treasuryCommit: (body) => { commitBody = body; } });
  await page.goto(`/pms/finance/reconciliation?companyId=${companyId}`);
  await page.getByRole('button', { name: 'Import statement', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import statement', exact: true });
  await dialog.getByLabel('Account reference').fill('OMR-OPERATING');
  await dialog.getByLabel('CSV statement').setInputFiles({
    name: 'bank-july.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('externalReference,amount,currency,transactionDate,propertyId\nBANK-IMPORT-001,200,OMR,2026-07-10,property-governance'),
  });
  await dialog.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect.poll(() => previewBody).toMatchObject({ companyId, source: 'BANK', accountReference: 'OMR-OPERATING', filename: 'bank-july.csv' });
  await expect(dialog.getByText('Valid rows', { exact: true }).locator('..')).toContainText('1');
  await expect(dialog.getByText('Duplicate rows', { exact: true }).locator('..')).toContainText('1');
  await expect(dialog.getByText('Invalid rows', { exact: true }).locator('..')).toContainText('1');
  await dialog.getByRole('button', { name: 'Commit import', exact: true }).click();
  await expect.poll(() => commitBody).toMatchObject({ companyId, source: 'BANK', accountReference: 'OMR-OPERATING', filename: 'bank-july.csv' });
  await expect(dialog.getByText('Statement import completed')).toBeVisible();
  await expect(dialog.getByText(/treasury-batch-governance/)).toBeVisible();
});

test('reconciliation matches one confirmed equal-currency payment with an explicit reason', async ({ page }) => {
  let matchBody: Record<string, unknown> | undefined;
  await authenticate(page); await mockGovernanceApi(page, { reconciliationMatch: (body) => { matchBody = body; } });
  await page.goto(`/pms/finance/reconciliation?companyId=${companyId}`);
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Match transaction', exact: true });
  await dialog.getByRole('combobox', { name: 'Rent payment', exact: true }).selectOption(payment.id);
  await dialog.getByLabel('Reason').fill('Bank reference and amount verified');
  await dialog.getByRole('button', { name: 'Match transaction', exact: true }).click();
  await expect.poll(() => matchBody).toMatchObject({ companyId, targetType: 'RENT_PAYMENT', targetId: payment.id, reason: 'Bank reference and amount verified' });
});

test('property debit reconciliation matches a paid vendor invoice', async ({ page }) => {
  let matchBody: Record<string, unknown> | undefined;
  await authenticate(page);
  await mockGovernanceApi(page, {
    reconciliationItem: { ...reconciliation, id: 'reconciliation-vendor', direction: 'DEBIT', amount: '103', externalReference: 'BANK-AP-GOV', payerReference: 'Governance Vendor' },
    reconciliationMatch: (body) => { matchBody = body; },
  });
  await page.goto(`/pms/finance/reconciliation?companyId=${companyId}`);
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Match transaction', exact: true });
  await expect(dialog.getByRole('combobox', { name: 'Match target', exact: true })).toHaveValue('VENDOR_INVOICE');
  await dialog.getByRole('combobox', { name: 'Vendor invoice', exact: true }).selectOption(paidVendorInvoice.id);
  await dialog.getByLabel('Reason').fill('Bank debit and supplier payment reference verified');
  await dialog.getByRole('button', { name: 'Match transaction', exact: true }).click();
  await expect.poll(() => matchBody).toMatchObject({ companyId, targetType: 'VENDOR_INVOICE', targetId: paidVendorInvoice.id, reason: 'Bank debit and supplier payment reference verified' });
});

test('company-wide debit reconciliation matches a paid owner payout', async ({ page }) => {
  let matchBody: Record<string, unknown> | undefined;
  await authenticate(page);
  await mockGovernanceApi(page, {
    reconciliationItem: { ...reconciliation, id: 'reconciliation-owner', direction: 'DEBIT', amount: '73', propertyId: null, property: null, externalReference: 'BANK-OWNER-GOV', payerReference: 'Governance Owner' },
    reconciliationMatch: (body) => { matchBody = body; },
  });
  await page.goto(`/pms/finance/reconciliation?companyId=${companyId}`);
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Match transaction', exact: true });
  await expect(dialog.getByRole('combobox', { name: 'Match target', exact: true })).toHaveValue('OWNER_PAYOUT');
  await dialog.getByRole('combobox', { name: 'Owner payout', exact: true }).selectOption(paidOwnerPayout.id);
  await dialog.getByLabel('Reason').fill('Bank debit and owner payout reference verified');
  await dialog.getByRole('button', { name: 'Match transaction', exact: true }).click();
  await expect.poll(() => matchBody).toMatchObject({ companyId, targetType: 'OWNER_PAYOUT', targetId: paidOwnerPayout.id, reason: 'Bank debit and owner payout reference verified' });
});

test('accounting viewers cannot mutate deposit, period, or reconciliation records', async ({ page }) => {
  await authenticate(page, ['ACCOUNTING_VIEW']); await mockGovernanceApi(page);
  await page.goto(`/pms/finance/deposits?companyId=${companyId}`);
  await expect(page.getByRole('button', { name: 'Create deposit account', exact: true })).toHaveCount(0);
  await expect(page.getByText('Accounting management permission is required for this action.')).toBeVisible();
  await page.goto(`/pms/finance/reconciliation?companyId=${companyId}`);
  await expect(page.getByRole('button', { name: 'Add reconciliation item', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import statement', exact: true })).toHaveCount(0);
});


test('property-scoped finance managers cannot create company-wide controlled records', async ({ page }) => {
  await authenticate(page, ['ACCOUNTING_VIEW', 'ACCOUNTING_MANAGE'], false); await mockGovernanceApi(page);
  await page.goto(`/pms/finance/periods?companyId=${companyId}`);
  await page.getByRole('button', { name: 'Open financial period', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Open financial period', exact: true });
  await expect(dialog.getByRole('option', { name: 'Company-wide', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: 'Scope', exact: true })).toHaveValue(propertyId);
  await page.goto(`/pms/finance/reconciliation?companyId=${companyId}`);
  await expect(page.getByRole('button', { name: 'Import statement', exact: true })).toHaveCount(0);
});

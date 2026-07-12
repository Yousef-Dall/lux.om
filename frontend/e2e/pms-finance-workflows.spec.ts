import { expect, test, type Page, type Route } from '@playwright/test';

import { mockNotificationsApi } from './support/apiMocks';

const companyId = 'company-finance';
const managerPermissions = ['ACCOUNTING_VIEW', 'ACCOUNTING_MANAGE', 'RENT_MANAGE'];

const lease = {
  id: 'lease-finance',
  companyId,
  tenantId: 'tenant-finance',
  tenant: { id: 'tenant-finance', fullName: 'Harbour Tenant', phone: '+96890000000', email: 'tenant@lux.test', active: true },
  propertyId: 'property-finance',
  property: { id: 'property-finance', name: 'Harbour Residences', code: 'HR', companyId },
  unitId: 'unit-finance',
  unit: { id: 'unit-finance', unitNumber: 'A-101', unitName: 'Apartment A-101', status: 'ACTIVE', occupancyStatus: 'OCCUPIED' },
  title: 'Harbour Lease',
  status: 'ACTIVE',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-12-31T00:00:00.000Z',
  rentFrequency: 'MONTHLY',
  rentAmount: '500',
  currency: 'OMR',
  counts: { rentDueItems: 1, documents: 0, renewalLeases: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
};

const draftCharge = {
  id: 'charge-draft',
  chargeNumber: 'CHG-202607-001',
  status: 'DRAFT',
  currency: 'OMR',
  dueDate: '2026-07-31T00:00:00.000Z',
  servicePeriodStart: '2026-07-01T00:00:00.000Z',
  servicePeriodEnd: '2026-07-31T00:00:00.000Z',
  subtotal: '500',
  adjustmentTotal: '0',
  totalAmount: '500',
  paidAmount: '0',
  creditedAmount: '0',
  balanceAmount: '500',
  notes: 'July rent',
  propertyId: lease.propertyId,
  property: { id: lease.propertyId, name: lease.property.name },
  unitId: lease.unitId,
  unit: { id: lease.unitId, unitNumber: lease.unit.unitNumber },
  tenantId: lease.tenantId,
  tenant: { id: lease.tenantId, fullName: lease.tenant.fullName },
  leaseId: lease.id,
  lease: { id: lease.id, title: lease.title, currency: 'OMR' },
  lines: [{ id: 'line-rent', category: 'RENT', description: 'July rent', quantity: '1', unitAmount: '500', amount: '500', position: 0 }],
  adjustments: [],
  creditNotes: [],
  allocations: [],
  documents: [],
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-01T08:00:00.000Z',
};

const issuedCharge = (id: string, number: string, balance: string) => ({
  ...draftCharge,
  id,
  chargeNumber: number,
  status: 'ISSUED',
  subtotal: balance,
  totalAmount: balance,
  balanceAmount: balance,
  issuedAt: '2026-07-01T09:00:00.000Z',
  lines: [{ id: `${id}-line`, category: 'RENT', description: number, quantity: '1', unitAmount: balance, amount: balance, position: 0 }],
});

const payment = {
  id: 'payment-finance',
  amount: '150',
  currency: 'OMR',
  method: 'BANK_TRANSFER',
  status: 'CONFIRMED',
  referenceNumber: 'BANK-77',
  notes: 'July receipt',
  paidAt: '2026-07-10T00:00:00.000Z',
  confirmedAt: '2026-07-10T00:00:00.000Z',
  receiptNumber: 'RCP-202607-001',
  propertyId: lease.propertyId,
  property: { id: lease.propertyId, name: lease.property.name },
  unitId: lease.unitId,
  unit: { id: lease.unitId, unitNumber: lease.unit.unitNumber },
  tenantId: lease.tenantId,
  tenant: { id: lease.tenantId, fullName: lease.tenant.fullName },
  leaseId: lease.id,
  lease: { id: lease.id, title: lease.title, currency: 'OMR' },
  allocations: [],
  adjustments: [],
  allocatedAmount: '0',
  adjustedAmount: '0',
  depositAllocatedAmount: '0',
  availableAmount: '150',
  createdAt: '2026-07-10T10:00:00.000Z',
  updatedAt: '2026-07-10T10:00:00.000Z',
};

async function authenticate(page: Page, permissionKeys = managerPermissions) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'finance-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: 'finance-user',
        name: 'Finance User',
        email: 'finance@lux.test',
        role: 'USER',
        emailVerified: true,
        pmsAccess: {
          hasAccess: true,
          workspaces: [{
            memberId: 'finance-member',
            role: permissionKeys.includes('ACCOUNTING_MANAGE') ? 'PMS_OWNER' : 'PMS_VIEWER',
            permissionKeys,
            propertyScope: { allProperties: true, propertyIds: [] },
            company: { id: companyId, slug: 'finance-company', nameEn: 'Finance Company', nameAr: 'شركة المالية' },
            entitlement: { status: 'ACTIVE', trialEndsAt: null },
          }],
        },
      },
    },
  }));
  await mockNotificationsApi(page);
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
}

async function mockFinanceApi(page: Page, callbacks: {
  onChargePatch?: (body: Record<string, unknown>) => void;
  onAllocationBatch?: (body: Record<string, unknown>) => void;
  onChargeList?: (url: URL) => void;
} = {}) {
  await page.route('**/api/pms/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/pms/leases' && method === 'GET') {
      return fulfillJson(route, { workspace: {}, leases: [lease], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    }
    if (path === '/api/pms/accounting/charges' && method === 'GET') {
      callbacks.onChargeList?.(url);
      const openOnly = url.searchParams.get('openOnly') === 'true';
      const charges = openOnly
        ? [issuedCharge('charge-one', 'CHG-OPEN-001', '80'), issuedCharge('charge-two', 'CHG-OPEN-002', '70')]
        : [draftCharge];
      return fulfillJson(route, {
        charges,
        pagination: { take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: charges.length, total: openOnly ? 2 : 26 },
        totalsByCurrency: [{ currency: 'OMR', count: openOnly ? 2 : 26, totalAmount: '13000', paidAmount: '0', creditedAmount: '0', balanceAmount: '13000' }],
      });
    }
    if (path === `/api/pms/accounting/charges/${draftCharge.id}` && method === 'GET') {
      return fulfillJson(route, { charge: draftCharge });
    }
    if (path === `/api/pms/accounting/charges/${draftCharge.id}` && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.onChargePatch?.(body);
      return fulfillJson(route, { charge: { ...draftCharge, ...body, lines: body.lines } });
    }
    if (path === '/api/pms/accounting/payments' && method === 'GET') {
      return fulfillJson(route, {
        payments: [payment],
        pagination: { take: 25, skip: 0, count: 1, total: 1 },
        totalsByCurrency: [{ currency: 'OMR', count: 1, recordedAmount: '150' }],
      });
    }
    if (path === `/api/pms/accounting/payments/${payment.id}` && method === 'GET') {
      return fulfillJson(route, {
        payment: { ...payment, allocatedAmount: undefined, adjustedAmount: undefined, depositAllocatedAmount: undefined, availableAmount: undefined },
        balance: { paymentId: payment.id, receivedAmount: '150', allocatedAmount: '0', adjustedAmount: '0', refundedOrChargedBackAmount: '0', depositAllocatedAmount: '0', availableAmount: '150', currency: 'OMR' },
      });
    }
    if (path === `/api/pms/accounting/payments/${payment.id}/allocations/batch` && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.onAllocationBatch?.(body);
      return fulfillJson(route, { allocations: [], idempotent: false }, 201);
    }
    if (path === '/api/pms/accounting/deposits') return fulfillJson(route, { accounts: [] });
    if (path === '/api/pms/accounting/periods') return fulfillJson(route, { periods: [] });
    if (path === '/api/pms/accounting/owner-payouts') return fulfillJson(route, { batches: [] });
    return fulfillJson(route, { message: `Unhandled finance mock: ${method} ${path}` }, 404);
  });
}

test('finance lists use server pagination and persist browsing filters in the URL', async ({ page }) => {
  const chargeQueries: URL[] = [];
  await authenticate(page);
  await mockFinanceApi(page, { onChargeList: (url) => chargeQueries.push(url) });

  await page.goto(`/pms/finance/charges?companyId=${companyId}`);
  await expect(page.getByText(draftCharge.chargeNumber)).toBeVisible();
  await expect(page.getByText('1–1 of 26')).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect.poll(() => chargeQueries.at(-1)?.searchParams.get('skip')).toBe('25');

  await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('balanceAmount:desc');
  await page.getByLabel('Search charge, property, unit, or tenant').fill('harbour');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/q=harbour/);
  await expect(page).toHaveURL(/sort=balanceAmount%3Adesc/);
  await expect(page).not.toHaveURL(/page=2/);
  await expect.poll(() => chargeQueries.at(-1)?.searchParams.get('search')).toBe('harbour');
  await expect.poll(() => chargeQueries.at(-1)?.searchParams.get('sortBy')).toBe('balanceAmount');
  await expect.poll(() => chargeQueries.at(-1)?.searchParams.get('direction')).toBe('desc');
});

test('draft charges expose editable line items and submit the complete replacement payload', async ({ page }) => {
  let patchBody: Record<string, unknown> | undefined;
  await authenticate(page);
  await mockFinanceApi(page, { onChargePatch: (body) => { patchBody = body; } });

  await page.goto(`/pms/finance/charges?companyId=${companyId}`);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const details = page.getByRole('dialog', { name: new RegExp(`Charge details.*${draftCharge.chargeNumber}`) });
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Edit draft charge', exact: true }).click();

  const editor = page.getByRole('dialog', { name: 'Edit draft charge', exact: true });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('combobox', { name: 'Lease' })).toBeFocused();
  await editor.getByLabel('Description 1').fill('July rent revised');
  await editor.getByRole('button', { name: 'Add line', exact: true }).click();
  await editor.getByLabel('Description 2').fill('Parking service');
  await editor.getByLabel('Unit amount 2').fill('25');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();

  await expect.poll(() => patchBody).toBeTruthy();
  expect(patchBody?.companyId).toBe(companyId);
  expect(patchBody?.leaseId).toBe(lease.id);
  expect(patchBody?.lines).toEqual(expect.arrayContaining([
    expect.objectContaining({ description: 'July rent revised', unitAmount: 500 }),
    expect.objectContaining({ description: 'Parking service', unitAmount: 25 }),
  ]));
});

test('one confirmed payment can be allocated atomically across multiple matching charges', async ({ page }) => {
  let allocationBody: Record<string, unknown> | undefined;
  let allocationRequests = 0;
  await authenticate(page);
  await mockFinanceApi(page, { onAllocationBatch: (body) => { allocationRequests += 1; allocationBody = body; } });

  await page.goto(`/pms/finance/payments?companyId=${companyId}`);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const details = page.getByRole('dialog', { name: new RegExp(`Payment details.*${payment.receiptNumber}`) });
  await details.getByRole('button', { name: 'Allocate payment', exact: true }).click();

  const allocation = page.getByRole('dialog', { name: 'Allocate payment', exact: true });
  await expect(allocation.getByLabel('Allocation amount CHG-OPEN-001')).toBeFocused();
  await allocation.getByLabel('Allocation amount CHG-OPEN-001').fill('80');
  await allocation.getByLabel('Allocation amount CHG-OPEN-002').fill('70');
  await allocation.getByRole('button', { name: 'Allocate payment', exact: true }).click();

  await expect.poll(() => allocationRequests).toBe(1);
  expect(allocationBody?.companyId).toBe(companyId);
  expect(allocationBody?.idempotencyKey).toEqual(expect.stringMatching(/^allocation-batch-/));
  expect(allocationBody?.allocations).toEqual([
    { chargeId: 'charge-one', amount: 80 },
    { chargeId: 'charge-two', amount: 70 },
  ]);
});


test('rent collection permission records receipts without granting accounting allocation controls', async ({ page }) => {
  await authenticate(page, ['ACCOUNTING_VIEW', 'RENT_MANAGE']);
  await mockFinanceApi(page);

  await page.goto(`/pms/finance/payments?companyId=${companyId}`);
  await expect(page.getByRole('button', { name: 'Record payment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const details = page.getByRole('dialog', { name: new RegExp(`Payment details.*${payment.receiptNumber}`) });
  await expect(details.getByRole('button', { name: 'Allocate payment', exact: true })).toHaveCount(0);
  await expect(details.getByRole('button', { name: 'Refund or adjust payment', exact: true })).toHaveCount(0);
});

test('finance mutation controls are permission-aware and dialogs restore keyboard focus', async ({ page }) => {
  await authenticate(page);
  await mockFinanceApi(page);
  await page.goto(`/pms/finance/payments?companyId=${companyId}`);

  const recordButton = page.getByRole('button', { name: 'Record payment', exact: true });
  await recordButton.focus();
  await recordButton.click();
  const dialog = page.getByRole('dialog', { name: 'Record payment', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Lease' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(recordButton).toBeFocused();

  await page.unrouteAll({ behavior: 'wait' });
  await authenticate(page, ['ACCOUNTING_VIEW']);
  await mockFinanceApi(page);
  await page.goto(`/pms/finance/charges?companyId=${companyId}`);
  await expect(page.getByRole('button', { name: 'Create draft charge', exact: true })).toHaveCount(0);
  await expect(page.getByText('You can view financial records, but your PMS role cannot post or change them.')).toBeVisible();
});

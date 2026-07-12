import { expect, test, type Page, type Route } from '@playwright/test';

import { mockNotificationsApi } from './support/apiMocks';

const companyId = 'company-payables';
const propertyId = 'property-payables';
const vendorId = 'vendor-payables';
const workOrderId = 'work-order-payables';
const invoiceId = 'vendor-invoice-payables';
const property = { id: propertyId, name: 'Harbour Service Residences', code: 'HSR' };
const vendor = { id: vendorId, name: 'Precision Facilities', trade: 'HVAC', email: 'vendor@lux.test' };
const workOrderOption = { id: workOrderId, title: 'Replace chilled-water valve', status: 'IN_PROGRESS', propertyId, vendorId, currency: 'OMR', approvedQuoteId: 'quote-payables', property, vendor: { id: vendorId, name: vendor.name }, approvedQuote: { id: 'quote-payables', amount: '120', currency: 'OMR', status: 'APPROVED' } };
const evidence = { id: 'invoice-evidence', title: 'Vendor invoice INV-2026-071', type: 'MAINTENANCE_INVOICE', status: 'ACTIVE', originalFilename: 'invoice.pdf', createdAt: '2026-07-12T08:00:00.000Z', uploadedBy: { id: 'vendor-user', name: 'Vendor User', email: 'vendor@lux.test' } };
const paymentEvidence = { id: 'payment-evidence', title: 'Bank payment instruction', type: 'OTHER', status: 'ACTIVE', originalFilename: 'payment.pdf', createdAt: '2026-07-12T11:00:00.000Z', uploadedBy: { id: 'manager', name: 'AP Manager', email: 'manager@lux.test' } };
const baseInvoice = {
  id: invoiceId, invoiceNumber: 'INV-2026-071', externalInvoiceNumber: 'SUPPLIER-071', status: 'NEEDS_REVIEW', issueDate: '2026-07-10T00:00:00.000Z', dueDate: '2026-07-25T00:00:00.000Z', currency: 'OMR', subtotalAmount: '100', taxAmount: '5', totalAmount: '105', approvedAmount: null, paidAmount: '0', submittedAt: '2026-07-12T08:00:00.000Z', reviewedAt: '2026-07-12T09:00:00.000Z', approvedAt: null, processingAt: null, paidAt: null, failedAt: null, rejectedAt: null, voidedAt: null, paymentReference: null, paymentMethodNote: null, failureReason: null, notes: 'Valve replacement', companyId, propertyId, vendorId, workOrderId, approvedQuoteId: 'quote-payables', createdById: 'vendor-user', submittedById: 'vendor-user', reviewedById: 'manager', approvedById: null, processingById: null, paidById: null, property, vendor, workOrder: { id: workOrderId, title: workOrderOption.title, status: 'IN_PROGRESS', currency: 'OMR', cost: null, approvedQuoteId: 'quote-payables' }, approvedQuote: workOrderOption.approvedQuote, createdBy: { id: 'vendor-user', name: 'Vendor User', email: 'vendor@lux.test' }, submittedBy: { id: 'vendor-user', name: 'Vendor User', email: 'vendor@lux.test' }, reviewedBy: { id: 'manager', name: 'AP Manager', email: 'manager@lux.test' }, approvedBy: null, processingBy: null, paidBy: null, rejectedBy: null, voidedBy: null, documents: [evidence], ledgerEntries: [], createdAt: '2026-07-12T08:00:00.000Z', updatedAt: '2026-07-12T09:00:00.000Z',
};

async function authenticate(page: Page, permissions = ['ACCOUNTING_VIEW', 'ACCOUNTING_MANAGE']) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'payables-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'manager', name: 'AP Manager', email: 'manager@lux.test', role: 'USER', emailVerified: true, pmsAccess: { hasAccess: true, workspaces: [{ memberId: 'member', role: permissions.includes('ACCOUNTING_MANAGE') ? 'PMS_ACCOUNTANT' : 'PMS_VIEWER', permissionKeys: permissions, propertyScope: { allProperties: true, propertyIds: [] }, company: { id: companyId, slug: 'payables', nameEn: 'Payables Company', nameAr: 'شركة المدفوعات' }, entitlement: { status: 'ACTIVE', trialEndsAt: null } }] } } } }));
  await mockNotificationsApi(page);
}

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

type Callbacks = { list?: (url: URL) => void; create?: (body: Record<string, unknown>) => void; transition?: (body: Record<string, unknown>) => void };
async function mockPayablesApi(page: Page, callbacks: Callbacks = {}, initial = baseInvoice) {
  let invoice = { ...initial, documents: [...initial.documents] } as Record<string, any>;
  await page.route('**/api/pms/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    if (path === '/api/pms/accounting/vendor-invoices' && method === 'GET') {
      callbacks.list?.(url);
      return fulfill(route, { invoices: [invoice], pagination: { take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1, total: 26 }, totalsByStatus: [{ status: invoice.status, count: 1 }, { status: 'APPROVED', count: 2 }], totalsByCurrency: [{ currency: 'OMR', count: 26, totalAmount: '2730', approvedAmount: '210', paidAmount: '0' }], overdueCount: 3, vendors: [{ id: vendorId, name: vendor.name }], properties: [property], workOrders: [workOrderOption] });
    }
    if (path === '/api/pms/accounting/vendor-invoices' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>; callbacks.create?.(body); invoice = { ...invoice, ...body, id: 'new-invoice', status: 'DRAFT' }; return fulfill(route, { invoice }, 201);
    }
    if (path === `/api/pms/accounting/vendor-invoices/${invoiceId}` && method === 'GET') return fulfill(route, { invoice });
    if (path === `/api/pms/accounting/vendor-invoices/${invoiceId}/transition` && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>; callbacks.transition?.(body); invoice = { ...invoice, status: body.action === 'APPROVE' ? 'APPROVED' : body.action === 'SUBMIT_PAYMENT' ? 'PROCESSING' : invoice.status, approvedAmount: body.approvedAmount ?? invoice.approvedAmount, paymentReference: body.paymentReference ?? invoice.paymentReference }; return fulfill(route, { invoice });
    }
    if (path === '/api/pms/documents/upload' && method === 'POST') return fulfill(route, { document: evidence }, 201);
    return fulfill(route, { message: `Unhandled payables mock: ${method} ${path}` }, 404);
  });
}

test('vendor invoices use server pagination and URL-persisted financial filters', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page); await mockPayablesApi(page, { list: (url) => queries.push(url) });
  await page.goto(`/pms/finance/vendor-invoices?companyId=${companyId}`);
  await expect(page.getByRole('table', { name: 'Vendor invoices', exact: true }).getByText('INV-2026-071', { exact: true })).toBeVisible();
  await expect(page.getByText('1–1 of 26')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('APPROVED');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/status=APPROVED/);
});

test('draft vendor invoice creation derives vendor, property, currency, and quote from an assigned work order', async ({ page }) => {
  let body: Record<string, unknown> | undefined;
  await authenticate(page); await mockPayablesApi(page, { create: (value) => { body = value; } });
  await page.goto(`/pms/finance/vendor-invoices?companyId=${companyId}`);
  await page.getByRole('button', { name: 'Create draft invoice', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create draft invoice', exact: true });
  await dialog.getByLabel('Work order').selectOption(workOrderId);
  await dialog.getByLabel('Invoice number').fill('INV-NEW-001');
  await dialog.getByLabel('Issue date').fill('2026-07-12');
  await dialog.getByLabel('Due date').fill('2026-07-30');
  await dialog.getByLabel('Subtotal').fill('100');
  await dialog.getByLabel('Tax').fill('5');
  await dialog.getByRole('spinbutton', { name: 'Total', exact: true }).fill('105');
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect.poll(() => body).toMatchObject({ companyId, propertyId, vendorId, workOrderId, approvedQuoteId: 'quote-payables', currency: 'OMR', subtotalAmount: 100, taxAmount: 5, totalAmount: 105 });
});

test('invoice approval requires linked invoice evidence and a controlled approved amount', async ({ page }) => {
  let body: Record<string, unknown> | undefined;
  await authenticate(page); await mockPayablesApi(page, { transition: (value) => { body = value; } });
  await page.goto(`/pms/finance/vendor-invoices?companyId=${companyId}`);
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Invoice INV-2026-071/ });
  await expect(dialog.getByText(/creator or submitter cannot approve/i)).toBeVisible();
  await dialog.getByRole('button', { name: 'Approve invoice', exact: true }).click();
  await dialog.getByLabel('Approved amount').fill('103');
  await dialog.getByLabel('Linked evidence document').selectOption('invoice-evidence');
  await dialog.getByRole('button', { name: 'Approve invoice', exact: true }).last().click();
  await expect.poll(() => body).toMatchObject({ companyId, action: 'APPROVE', approvedAmount: 103, evidenceDocumentId: 'invoice-evidence' });
});

test('payment submission requires evidence, external reference, and provider confirmation', async ({ page }) => {
  let body: Record<string, unknown> | undefined;
  await authenticate(page); await mockPayablesApi(page, { transition: (value) => { body = value; } }, { ...baseInvoice, status: 'APPROVED', approvedAmount: '103', approvedAt: '2026-07-12T10:00:00.000Z', approvedById: 'checker', approvedBy: { id: 'checker', name: 'AP Checker', email: 'checker@lux.test' }, documents: [evidence, paymentEvidence] });
  await page.goto(`/pms/finance/vendor-invoices?companyId=${companyId}`);
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Invoice INV-2026-071/ });
  await dialog.getByRole('button', { name: 'Submit payment', exact: true }).click();
  await dialog.getByLabel('Linked evidence document').selectOption('payment-evidence');
  await dialog.getByLabel('Payment reference').fill('BANK-AP-771');
  await dialog.getByLabel('Payment evidence note').fill('Bank instruction accepted for the verified vendor beneficiary.');
  await dialog.getByLabel('The payment adapter or bank evidence confirms this result').check();
  await dialog.getByRole('button', { name: 'Submit payment', exact: true }).last().click();
  await expect.poll(() => body).toMatchObject({ companyId, action: 'SUBMIT_PAYMENT', evidenceDocumentId: 'payment-evidence', paymentReference: 'BANK-AP-771', providerConfirmed: true, adapter: 'MANUAL_BANK_EVIDENCE' });
});

test('accounting viewers can inspect vendor invoices without mutation controls', async ({ page }) => {
  await authenticate(page, ['ACCOUNTING_VIEW']); await mockPayablesApi(page);
  await page.goto(`/pms/finance/vendor-invoices?companyId=${companyId}`);
  await expect(page.getByRole('button', { name: 'Create draft invoice', exact: true })).toHaveCount(0);
  await expect(page.getByText('Accounting management permission is required for invoice workflow actions.')).toBeVisible();
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Approve invoice', exact: true })).toHaveCount(0);
});

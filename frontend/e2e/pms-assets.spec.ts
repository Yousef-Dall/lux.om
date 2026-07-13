import { expect, test, type Page, type Route } from '@playwright/test';

import { mockNotificationsApi } from './support/apiMocks';

const companyId = 'company-assets';
const propertyId = 'property-assets';
const unitId = 'unit-assets';
const vendorId = 'vendor-assets';

const asset = {
  id: 'asset-hvac-1',
  companyId,
  propertyId,
  unitId,
  vendorId,
  assetCode: 'HVAC-A-101',
  name: 'Main HVAC',
  category: 'HVAC',
  manufacturer: 'Carrier',
  model: 'AquaForce',
  serialNumber: 'SN-1001',
  installationDate: '2025-01-15T00:00:00.000Z',
  warrantyExpiry: '2027-01-15T00:00:00.000Z',
  serviceIntervalDays: 90,
  nextServiceDate: '2026-08-01T00:00:00.000Z',
  status: 'ACTIVE',
  purchaseCost: '8500',
  currency: 'OMR',
  notes: 'Roof plant room',
  property: { id: propertyId, name: 'Harbour Residences' },
  unit: { id: unitId, unitNumber: 'A-101' },
  vendor: { id: vendorId, name: 'Gulf HVAC Services' },
  events: [{ id: 'event-created', type: 'CREATED', occurredAt: '2025-01-15T08:00:00.000Z', cost: null, currency: null, notes: 'Asset registered.', metadata: null, createdAt: '2025-01-15T08:00:00.000Z' }],
  _count: { workOrders: 2, documents: 1, maintenancePlans: 1 },
  createdAt: '2025-01-15T08:00:00.000Z',
  updatedAt: '2026-07-13T08:00:00.000Z',
};

async function authenticate(page: Page, permissionKeys = ['MAINTENANCE_VIEW', 'MAINTENANCE_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_MANAGE']) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'asset-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'asset-user', name: 'Asset User', email: 'asset@lux.test', role: 'USER', emailVerified: true, pmsAccess: { hasAccess: true, workspaces: [{ memberId: 'asset-member', role: permissionKeys.includes('INVENTORY_MANAGE') ? 'PMS_MANAGER' : 'PMS_MAINTENANCE', permissionKeys, propertyScope: { allProperties: true, propertyIds: [] }, company: { id: companyId, slug: 'asset-company', nameEn: 'Asset Company', nameAr: 'شركة الأصول' }, entitlement: { status: 'ACTIVE', trialEndsAt: null } }] } } } }));
  await mockNotificationsApi(page);
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
}

async function mockAssetApi(page: Page, callbacks: {
  assetQuery?: (url: URL) => void;
  createBody?: (body: Record<string, unknown>) => void;
  eventBody?: (body: Record<string, unknown>) => void;
} = {}) {
  await page.route('**/api/pms/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/pms/assets' && method === 'GET') {
      callbacks.assetQuery?.(url);
      return fulfillJson(route, { assets: [asset], pagination: { take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1, total: 26 } });
    }
    if (path === '/api/pms/assets' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.createBody?.(body);
      return fulfillJson(route, { asset: { ...asset, ...body, id: 'asset-created' } }, 201);
    }
    if (path === `/api/pms/assets/${asset.id}/events` && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.eventBody?.(body);
      return fulfillJson(route, { event: { id: 'event-service', ...body, createdAt: '2026-07-13T12:00:00.000Z' } }, 201);
    }
    if (path === '/api/pms/properties' && method === 'GET') return fulfillJson(route, { workspace: {}, properties: [{ id: propertyId, name: 'Harbour Residences', code: 'HR', active: true, counts: { units: 1 }, createdAt: '', updatedAt: '' }], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/units' && method === 'GET') return fulfillJson(route, { workspace: {}, units: [{ id: unitId, companyId, propertyId, property: { id: propertyId, companyId, name: 'Harbour Residences' }, unitNumber: 'A-101', status: 'OCCUPIED', occupancyStatus: 'OCCUPIED', operationalStatus: 'AVAILABLE', currency: 'OMR', createdAt: '', updatedAt: '' }], pagination: { take: 200, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/vendors' && method === 'GET') return fulfillJson(route, { workspace: {}, vendors: [{ id: vendorId, companyId, name: 'Gulf HVAC Services', active: true, counts: { workOrders: 2 }, portalAccesses: [], createdAt: '', updatedAt: '' }], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/preventive-maintenance/plans' && method === 'GET') return fulfillJson(route, { plans: [{ id: 'plan-1', title: 'Quarterly HVAC service', status: 'ACTIVE', nextServiceDate: '2026-08-01T00:00:00.000Z', intervalDays: 90, property: { id: propertyId, name: 'Harbour Residences' }, asset: { id: asset.id, assetCode: asset.assetCode, name: asset.name } }] });
    if (path === '/api/pms/structured-inspections/runs' && method === 'GET') return fulfillJson(route, { inspections: [{ id: 'inspection-1', title: 'HVAC safety inspection', type: 'SAFETY', status: 'NEEDS_ACTION', property: { id: propertyId, name: 'Harbour Residences' }, unit: { id: unitId, unitNumber: 'A-101' }, defects: [{ id: 'defect-1', title: 'Filter replacement', severity: 'MEDIUM', status: 'OPEN' }] }] });
    return fulfillJson(route, { message: `Unhandled asset mock: ${method} ${path}` }, 404);
  });
}

test('asset register uses server pagination and persists browsing filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockAssetApi(page, { assetQuery: (url) => queries.push(url) });

  await page.goto(`/pms/operations/assets-inspections?companyId=${companyId}`);
  await expect(page.getByText(asset.assetCode, { exact: true })).toBeVisible();
  await expect(page.getByText('1–1 of 26', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/assetPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');

  await page.getByLabel('Search asset code, name, serial, property, unit, or vendor').fill('carrier');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('ACTIVE');
  const dueCheckbox = page.getByRole('checkbox', { name: 'Warranty or service due' });
  await dueCheckbox.focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/assetDue=true/);
  await expect(page.getByRole('checkbox', { name: 'Warranty or service due' })).toBeChecked();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/assetQ=carrier/);
  await expect(page).toHaveURL(/assetStatus=ACTIVE/);
  await expect(page).toHaveURL(/assetDue=true/);
  await expect(page).not.toHaveURL(/assetPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('carrier');
  await expect.poll(() => queries.at(-1)?.searchParams.get('dueOnly')).toBe('true');
});

test('asset creation and service history use accessible governed dialogs', async ({ page }) => {
  let createBody: Record<string, unknown> | undefined;
  let eventBody: Record<string, unknown> | undefined;
  await authenticate(page);
  await mockAssetApi(page, { createBody: (body) => { createBody = body; }, eventBody: (body) => { eventBody = body; } });

  await page.goto(`/pms/operations/assets-inspections?companyId=${companyId}`);
  const registerButton = page.getByRole('button', { name: 'Register asset', exact: true });
  await registerButton.click();
  const createDialog = page.getByRole('dialog', { name: 'Register asset', exact: true });
  await expect(createDialog.getByLabel('Asset code')).toBeFocused();
  await createDialog.getByLabel('Asset code').fill('PUMP-A-201');
  await createDialog.getByLabel('Name').fill('Transfer pump');
  await createDialog.getByLabel('Category').fill('Pump');
  await createDialog.getByLabel('Unit').selectOption(unitId);
  await createDialog.getByLabel('Vendor').selectOption(vendorId);
  await createDialog.getByLabel('Purchase cost').fill('450');
  await createDialog.getByRole('button', { name: 'Save asset', exact: true }).click();
  await expect.poll(() => createBody).toBeTruthy();
  expect(createBody).toMatchObject({ companyId, propertyId, unitId, vendorId, assetCode: 'PUMP-A-201', name: 'Transfer pump', category: 'Pump', purchaseCost: 450, currency: 'OMR' });
  await expect(registerButton).toBeFocused();

  const viewButton = page.getByRole('button', { name: 'View asset', exact: true });
  await viewButton.click();
  const details = page.getByRole('dialog', { name: `Asset details · ${asset.assetCode}` });
  await expect(details.getByText('2 work orders', { exact: false })).toBeVisible();
  await details.getByRole('button', { name: 'Record asset event', exact: true }).click();
  const eventDialog = page.getByRole('dialog', { name: 'Record asset event', exact: true });
  await expect(eventDialog.getByLabel('Event type')).toBeFocused();
  await eventDialog.getByLabel('Event type').selectOption('SERVICED');
  await eventDialog.getByLabel('Cost').fill('25');
  await eventDialog.getByLabel('Next service date').fill('2026-11-01');
  await eventDialog.getByLabel('Notes').fill('Quarterly service completed');
  await eventDialog.getByRole('button', { name: 'Record event', exact: true }).click();
  await expect.poll(() => eventBody).toBeTruthy();
  expect(eventBody).toMatchObject({ companyId, type: 'SERVICED', cost: 25, currency: 'OMR', nextServiceDate: '2026-11-01', notes: 'Quarterly service completed' });
});

test('maintenance viewers see a read-only Arabic asset register on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, ['MAINTENANCE_VIEW', 'MAINTENANCE_MANAGE']);
  await mockAssetApi(page);

  await page.goto(`/pms/operations/assets-inspections?companyId=${companyId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'سجل الأصول', exact: true })).toBeVisible();
  await expect(page.getByText('يمكنك تسجيل سجل الصيانة والإصلاح والضمان، لكن لا يمكنك تعديل هوية الأصل أو حالة التقاعد.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تسجيل أصل', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'عرض الأصل', exact: true }).click();
  await expect(page.getByRole('button', { name: 'تسجيل حدث للأصل', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تعديل الأصل', exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

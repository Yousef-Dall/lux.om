import { expect, test, type Page, type Route } from '@playwright/test';

import { mockNotificationsApi } from './support/apiMocks';

const companyId = 'company-preventive';
const propertyId = 'property-preventive';
const unitId = 'unit-preventive';
const vendorId = 'vendor-preventive';
const assetId = 'asset-preventive';

const plan = {
  id: 'plan-preventive-1',
  title: 'Quarterly HVAC service',
  description: 'Inspect the rooftop HVAC before peak cooling demand.',
  status: 'ACTIVE',
  nextServiceDate: '2026-07-20T00:00:00.000Z',
  intervalDays: 90,
  lastGeneratedAt: '2026-04-21T08:00:00.000Z',
  checklist: ['Inspect filter', 'Measure cooling output'],
  slaHours: 48,
  priority: 'HIGH',
  estimatedCost: '120',
  currency: 'OMR',
  propertyId,
  property: { id: propertyId, name: 'Harbour Residences' },
  unitId,
  unit: { id: unitId, unitNumber: 'A-101' },
  assetId,
  asset: { id: assetId, assetCode: 'HVAC-A-101', name: 'Main HVAC', propertyId, unitId },
  vendorId,
  vendor: { id: vendorId, name: 'Gulf HVAC Services', trade: 'HVAC', active: true },
  workOrders: [{ id: 'work-order-1', title: 'Quarterly HVAC service', status: 'RESOLVED', priority: 'HIGH', targetDate: '2026-04-21T00:00:00.000Z', scheduledFor: '2026-04-21T00:00:00.000Z', resolvedAt: '2026-04-22T00:00:00.000Z', cost: '110', currency: 'OMR', preventiveGenerationKey: 'plan-preventive-1:2026-04-21', createdAt: '2026-04-20T08:00:00.000Z' }],
  _count: { workOrders: 4 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

async function authenticate(page: Page, permissionKeys = ['MAINTENANCE_VIEW', 'MAINTENANCE_MANAGE', 'INVENTORY_VIEW'], allProperties = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'preventive-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'preventive-user', name: 'Preventive User', email: 'preventive@lux.test', role: 'USER', emailVerified: true, pmsAccess: { hasAccess: true, workspaces: [{ memberId: 'preventive-member', role: permissionKeys.includes('MAINTENANCE_MANAGE') ? 'PMS_MAINTENANCE' : 'PMS_VIEWER', permissionKeys, propertyScope: { allProperties, propertyIds: allProperties ? [] : [propertyId] }, company: { id: companyId, slug: 'preventive-company', nameEn: 'Preventive Company', nameAr: 'شركة الصيانة الوقائية' }, entitlement: { status: 'ACTIVE', trialEndsAt: null } }] } } } }));
  await mockNotificationsApi(page);
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
}

async function mockPreventiveApi(page: Page, callbacks: {
  planQuery?: (url: URL) => void;
  createBody?: (body: Record<string, unknown>) => void;
  updateBody?: (body: Record<string, unknown>) => void;
  generateBody?: (body: Record<string, unknown>) => void;
} = {}) {
  await page.route('**/api/pms/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/pms/preventive-maintenance/plans' && method === 'GET') {
      callbacks.planQuery?.(url);
      return fulfillJson(route, { plans: [plan], pagination: { take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1, total: 26 }, summary: { active: 17, due: 4 } });
    }
    if (path === '/api/pms/preventive-maintenance/plans' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.createBody?.(body);
      return fulfillJson(route, { plan: { ...plan, ...body, id: 'plan-created', workOrders: [], _count: { workOrders: 0 } } }, 201);
    }
    if (path === `/api/pms/preventive-maintenance/plans/${plan.id}` && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.updateBody?.(body);
      return fulfillJson(route, { plan: { ...plan, ...body } });
    }
    if (path === '/api/pms/preventive-maintenance/generate-due' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.generateBody?.(body);
      return fulfillJson(route, { generated: [{ planId: plan.id, workOrderId: 'work-order-generated', idempotent: false }] });
    }
    if (path === '/api/pms/assets' && method === 'GET') return fulfillJson(route, { assets: [{ id: assetId, companyId, propertyId, unitId, vendorId, assetCode: 'HVAC-A-101', name: 'Main HVAC', category: 'HVAC', status: 'ACTIVE', currency: 'OMR', property: { id: propertyId, name: 'Harbour Residences' }, unit: { id: unitId, unitNumber: 'A-101' }, vendor: { id: vendorId, name: 'Gulf HVAC Services' }, events: [], _count: { workOrders: 1, documents: 0, maintenancePlans: 1 }, createdAt: '', updatedAt: '' }], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/properties' && method === 'GET') return fulfillJson(route, { workspace: {}, properties: [{ id: propertyId, companyId, name: 'Harbour Residences', active: true, counts: { units: 1 }, createdAt: '', updatedAt: '' }], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/units' && method === 'GET') return fulfillJson(route, { workspace: {}, units: [{ id: unitId, companyId, propertyId, property: { id: propertyId, companyId, name: 'Harbour Residences' }, unitNumber: 'A-101', status: 'OCCUPIED', occupancyStatus: 'OCCUPIED', operationalStatus: 'AVAILABLE', currency: 'OMR', createdAt: '', updatedAt: '' }], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/vendors' && method === 'GET') return fulfillJson(route, { workspace: {}, vendors: [{ id: vendorId, companyId, name: 'Gulf HVAC Services', trade: 'HVAC', active: true, createdAt: '', updatedAt: '' }], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/structured-inspections/templates' && method === 'GET') return fulfillJson(route, { templates: [] });
    if (path === '/api/pms/structured-inspections/runs' && method === 'GET') return fulfillJson(route, { inspections: [], pagination: { take: 25, skip: 0, count: 0, total: 0 }, summary: { scheduled: 0, needsAction: 0, openDefects: 0 } });
    return fulfillJson(route, { message: `Unhandled preventive mock: ${method} ${path}` }, 404);
  });
}

test('preventive plans use server pagination and persist filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockPreventiveApi(page, { planQuery: (url) => queries.push(url) });

  await page.goto(`/pms/operations/assets-inspections?companyId=${companyId}`);
  await expect(page.getByText(plan.title, { exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'PMS preventive-maintenance plan results' });
  await expect(navigation.getByText('1–1 of 26', { exact: true })).toBeVisible();
  await navigation.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/pmPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');

  const filters = page.getByRole('form', { name: 'Preventive-maintenance plan filters' });
  await filters.getByLabel('Search plan, property, unit, asset, or vendor').fill('HVAC');
  await filters.getByRole('combobox', { name: 'Property', exact: true }).selectOption(propertyId);
  await filters.getByRole('combobox', { name: 'Status', exact: true }).selectOption('ACTIVE');
  await filters.getByRole('checkbox', { name: 'Due now' }).check();
  await filters.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('priority:desc');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/pmQ=HVAC/);
  await expect(page).toHaveURL(/pmProperty=property-preventive/);
  await expect(page).toHaveURL(/pmStatus=ACTIVE/);
  await expect(page).toHaveURL(/pmDue=true/);
  await expect(page).toHaveURL(/pmSort=priority%3Adesc|pmSort=priority:desc/);
  await expect(page).not.toHaveURL(/pmPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('HVAC');
  await expect.poll(() => queries.at(-1)?.searchParams.get('dueOnly')).toBe('true');
});

test('plan creation, editing, history, and idempotent generation use governed dialogs', async ({ page }) => {
  let createBody: Record<string, unknown> | undefined;
  let updateBody: Record<string, unknown> | undefined;
  let generateBody: Record<string, unknown> | undefined;
  await authenticate(page);
  await mockPreventiveApi(page, {
    createBody: (body) => { createBody = body; },
    updateBody: (body) => { updateBody = body; },
    generateBody: (body) => { generateBody = body; },
  });

  await page.goto(`/pms/operations/assets-inspections?companyId=${companyId}`);
  const createButton = page.getByRole('button', { name: 'Create plan', exact: true });
  await createButton.click();
  const createDialog = page.getByRole('dialog', { name: 'Create preventive-maintenance plan', exact: true });
  await expect(createDialog.getByLabel('Plan title')).toBeFocused();
  await createDialog.getByLabel(/^Property/).selectOption(propertyId);
  await createDialog.getByLabel(/^Unit/).selectOption(unitId);
  await createDialog.getByLabel(/^Asset/).selectOption(assetId);
  await createDialog.getByLabel(/^Vendor/).selectOption(vendorId);
  await createDialog.getByLabel('Plan title').fill('Monthly pump service');
  await createDialog.getByLabel('Interval in days').fill('30');
  await createDialog.getByLabel('Next due date').fill('2026-08-01');
  await createDialog.getByLabel('Checklist, one item per line').fill('Inspect seals\nMeasure pressure');
  await createDialog.getByLabel('Estimated cost').fill('75');
  await createDialog.getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect.poll(() => createBody).toBeTruthy();
  expect(createBody).toMatchObject({ companyId, propertyId, unitId, assetId, vendorId, title: 'Monthly pump service', intervalDays: 30, nextServiceDate: '2026-08-01', checklist: ['Inspect seals', 'Measure pressure'], estimatedCost: 75, currency: 'OMR' });
  await expect(createButton).toBeFocused();

  await page.getByRole('button', { name: 'View plan', exact: true }).click();
  const detailDialog = page.getByRole('dialog', { name: 'Plan details', exact: true });
  await expect(detailDialog.getByText('Showing latest 1 of 4', { exact: true })).toBeVisible();
  await expect(detailDialog.getByText('Quarterly HVAC service', { exact: true }).first()).toBeVisible();
  await detailDialog.getByRole('button', { name: 'Edit plan', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit preventive-maintenance plan', exact: true });
  await editDialog.getByLabel('Plan title').fill('Quarterly HVAC compliance service');
  await editDialog.getByLabel('Status').selectOption('PAUSED');
  await editDialog.getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect.poll(() => updateBody).toBeTruthy();
  expect(updateBody).toMatchObject({ companyId, title: 'Quarterly HVAC compliance service', status: 'PAUSED', intervalDays: 90 });

  const generateButton = page.getByRole('button', { name: 'Generate due work orders', exact: true });
  await generateButton.click();
  const generateDialog = page.getByRole('dialog', { name: 'Generate due preventive work orders', exact: true });
  await expect(generateDialog.getByLabel('Generate plans due on or before')).toBeFocused();
  await generateDialog.getByLabel('Generate plans due on or before').fill('2026-07-31');
  await generateDialog.getByRole('button', { name: 'Generate work orders', exact: true }).click();
  await expect.poll(() => generateBody).toEqual({ companyId, asOf: '2026-07-31' });
  await expect(page.getByText('1 preventive work order generated.', { exact: true })).toBeVisible();
  await expect(generateButton).toBeFocused();
});

test('property-scoped viewers receive a read-only Arabic preventive register on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, ['MAINTENANCE_VIEW', 'INVENTORY_VIEW'], false);
  await mockPreventiveApi(page);

  await page.goto(`/pms/operations/assets-inspections?companyId=${companyId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'خطط الصيانة الوقائية', exact: true })).toBeVisible();
  await expect(page.getByText('يمكنك استعراض الجداول الوقائية، لكن دورك لا يسمح بتعديلها أو توليدها.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء خطة', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'توليد أوامر العمل المستحقة', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'عرض الخطة', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'تفاصيل الخطة', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

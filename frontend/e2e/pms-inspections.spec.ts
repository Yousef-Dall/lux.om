import { expect, test, type Page, type Route } from '@playwright/test';

import { mockNotificationsApi } from './support/apiMocks';

const companyId = 'company-inspections';
const propertyId = 'property-inspections';
const unitId = 'unit-inspections';
const vendorId = 'vendor-inspections';
const assetId = 'asset-inspections';
const templateId = 'template-inspections';
const runId = 'inspection-run-1';
const defectId = 'inspection-defect-1';

const template = {
  id: templateId,
  name: 'HVAC condition checklist',
  description: 'Structured HVAC safety and condition checklist.',
  type: 'SAFETY',
  active: true,
  version: 2,
  propertyId,
  property: { id: propertyId, name: 'Harbour Residences' },
  sections: [{
    id: 'section-hvac',
    title: 'HVAC checklist',
    description: 'Capture operating condition and evidence.',
    position: 0,
    items: [
      { id: 'item-output', sectionId: 'section-hvac', label: 'Cooling output', instructions: 'Confirm cold-air output.', position: 0, required: true, requiresPhotoOnFailure: false },
      { id: 'item-filter', sectionId: 'section-hvac', label: 'Filter condition', instructions: 'Photograph failed filters.', position: 1, required: true, requiresPhotoOnFailure: true },
    ],
  }],
};

const listRun = {
  id: runId,
  title: 'Quarterly HVAC inspection',
  type: 'SAFETY',
  status: 'SCHEDULED',
  scheduledFor: '2026-07-20T08:00:00.000Z',
  completedAt: null,
  notes: 'Inspect before peak cooling demand.',
  propertyId,
  property: { id: propertyId, name: 'Harbour Residences' },
  unitId,
  unit: { id: unitId, unitNumber: 'A-101' },
  templateId,
  template: { id: templateId, name: template.name, version: 2, type: 'SAFETY' },
  defects: [],
  _count: { results: 0, defects: 0, pmsDocuments: 0 },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function detailRun(converted = false) {
  const defect = {
    id: defectId,
    title: 'Replace damaged filter',
    description: 'Filter frame is cracked.',
    severity: 'HIGH',
    status: converted ? 'WORK_ORDER_CREATED' : 'OPEN',
    photoUrls: ['https://cdn.lux.test/inspection/filter.jpg'],
    workOrderId: converted ? 'work-order-inspection-1' : null,
    workOrder: converted ? { id: 'work-order-inspection-1', title: 'Replace damaged filter', status: 'OPEN', priority: 'HIGH', vendorId, assetId, scheduledFor: null, targetDate: '2026-07-22T00:00:00.000Z', createdAt: '2026-07-20T09:00:00.000Z' } : null,
    createdAt: '2026-07-20T09:00:00.000Z',
  };
  return {
    ...listRun,
    status: 'NEEDS_ACTION',
    completedAt: '2026-07-20T09:00:00.000Z',
    acknowledgement: { completedByName: 'Inspector Noor' },
    acknowledgedAt: '2026-07-20T09:00:00.000Z',
    template,
    results: [
      { id: 'result-output', templateItemId: 'item-output', templateItem: template.sections[0].items[0], result: 'PASS', valueText: '18°C', notes: null, photoUrls: [], acknowledgedByName: 'Inspector Noor', acknowledgedAt: '2026-07-20T09:00:00.000Z', defects: [], createdAt: '2026-07-20T09:00:00.000Z', updatedAt: '2026-07-20T09:00:00.000Z' },
      { id: 'result-filter', templateItemId: 'item-filter', templateItem: template.sections[0].items[1], result: 'FAIL', valueText: null, notes: 'Frame cracked', photoUrls: ['https://cdn.lux.test/inspection/filter.jpg'], acknowledgedByName: 'Inspector Noor', acknowledgedAt: '2026-07-20T09:00:00.000Z', defects: [defect], createdAt: '2026-07-20T09:00:00.000Z', updatedAt: '2026-07-20T09:00:00.000Z' },
    ],
    defects: [defect],
    _count: { results: 2, defects: 1, pmsDocuments: 0 },
  };
}

async function authenticate(page: Page, permissionKeys = ['MAINTENANCE_VIEW', 'MAINTENANCE_MANAGE', 'INVENTORY_VIEW']) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'inspection-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'inspection-user', name: 'Inspection User', email: 'inspection@lux.test', role: 'USER', emailVerified: true, pmsAccess: { hasAccess: true, workspaces: [{ memberId: 'inspection-member', role: permissionKeys.includes('MAINTENANCE_MANAGE') ? 'PMS_MAINTENANCE' : 'PMS_VIEWER', permissionKeys, propertyScope: { allProperties: false, propertyIds: [propertyId] }, company: { id: companyId, slug: 'inspection-company', nameEn: 'Inspection Company', nameAr: 'شركة الفحوصات' }, entitlement: { status: 'ACTIVE', trialEndsAt: null } }] } } } }));
  await mockNotificationsApi(page);
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
}

async function mockInspectionApi(page: Page, callbacks: {
  runQuery?: (url: URL) => void;
  scheduleBody?: (body: Record<string, unknown>) => void;
  resultBody?: (body: Record<string, unknown>) => void;
  conversionBody?: (body: Record<string, unknown>) => void;
} = {}) {
  let completed = false;
  let converted = false;
  await page.route('**/api/pms/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/pms/structured-inspections/templates' && method === 'GET') return fulfillJson(route, { templates: [template] });
    if (path === '/api/pms/structured-inspections/runs' && method === 'GET') {
      callbacks.runQuery?.(url);
      return fulfillJson(route, { inspections: [completed ? detailRun(converted) : listRun], pagination: { take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1, total: 26 }, summary: { scheduled: completed ? 0 : 7, needsAction: completed ? 1 : 0, openDefects: completed && !converted ? 1 : 0 } });
    }
    if (path === '/api/pms/structured-inspections/runs' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.scheduleBody?.(body);
      return fulfillJson(route, { inspection: { ...listRun, ...body, id: 'inspection-created', template, defects: [], results: [], _count: { results: 0, defects: 0, pmsDocuments: 0 } } }, 201);
    }
    if (path === `/api/pms/structured-inspections/runs/${runId}` && method === 'GET') return fulfillJson(route, { inspection: completed ? detailRun(converted) : { ...listRun, template, results: [], defects: [] } });
    if (path === `/api/pms/structured-inspections/runs/${runId}/results` && method === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.resultBody?.(body);
      completed = true;
      return fulfillJson(route, { inspection: detailRun(false) });
    }
    if (path === `/api/pms/structured-inspections/defects/${defectId}/work-order` && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      callbacks.conversionBody?.(body);
      converted = true;
      return fulfillJson(route, { workOrder: detailRun(true).defects[0].workOrder, idempotent: false }, 201);
    }
    if (path === '/api/pms/assets' && method === 'GET') return fulfillJson(route, { assets: [{ id: assetId, companyId, propertyId, unitId, assetCode: 'HVAC-A-101', name: 'Main HVAC', category: 'HVAC', status: 'ACTIVE', currency: 'OMR', property: { id: propertyId, name: 'Harbour Residences' }, unit: { id: unitId, unitNumber: 'A-101' }, events: [], _count: { workOrders: 0, documents: 0, maintenancePlans: 0 }, createdAt: '', updatedAt: '' }], pagination: { take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1, total: 1 } });
    if (path === '/api/pms/properties' && method === 'GET') return fulfillJson(route, { workspace: {}, properties: [{ id: propertyId, companyId, name: 'Harbour Residences', active: true, counts: { units: 1 }, createdAt: '', updatedAt: '' }], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/units' && method === 'GET') return fulfillJson(route, { workspace: {}, units: [{ id: unitId, companyId, propertyId, property: { id: propertyId, companyId, name: 'Harbour Residences' }, unitNumber: 'A-101', status: 'OCCUPIED', occupancyStatus: 'OCCUPIED', operationalStatus: 'AVAILABLE', currency: 'OMR', createdAt: '', updatedAt: '' }], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/vendors' && method === 'GET') return fulfillJson(route, { workspace: {}, vendors: [{ id: vendorId, companyId, name: 'Gulf HVAC Services', trade: 'HVAC', active: true, createdAt: '', updatedAt: '' }], pagination: { take: 100, skip: 0, count: 1, total: 1 } });
    if (path === '/api/pms/preventive-maintenance/plans' && method === 'GET') return fulfillJson(route, { plans: [], pagination: { take: 25, skip: 0, count: 0, total: 0 }, summary: { active: 0, due: 0 } });
    return fulfillJson(route, { message: `Unhandled inspection mock: ${method} ${path}` }, 404);
  });
}

test('inspection runs use server pagination and URL-persisted browsing filters', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockInspectionApi(page, { runQuery: (url) => queries.push(url) });

  await page.goto(`/pms/operations/assets-inspections?companyId=${companyId}`);
  await expect(page.getByText(listRun.title, { exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'PMS inspection run results' });
  await expect(navigation.getByText('1–1 of 26', { exact: true })).toBeVisible();
  await navigation.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/inspectionPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');

  const filters = page.getByRole('form', { name: 'Inspection run filters' });
  await filters.getByLabel('Search inspection, template, property, unit, or notes').fill('HVAC');
  await filters.getByRole('combobox', { name: 'Property', exact: true }).selectOption(propertyId);
  await filters.getByRole('combobox', { name: 'Status', exact: true }).selectOption('SCHEDULED');
  await filters.getByRole('combobox', { name: 'Type', exact: true }).selectOption('SAFETY');
  await filters.getByLabel('Scheduled from').fill('2026-07-01');
  await filters.getByLabel('Scheduled to').fill('2026-07-31');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/inspectionQ=HVAC/);
  await expect(page).toHaveURL(/inspectionProperty=property-inspections/);
  await expect(page).toHaveURL(/inspectionStatus=SCHEDULED/);
  await expect(page).toHaveURL(/inspectionType=SAFETY/);
  await expect(page).not.toHaveURL(/inspectionPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('HVAC');
  await expect.poll(() => queries.at(-1)?.searchParams.get('scheduledFrom')).toBe('2026-07-01');
});

test('inspection scheduling, mobile checklist execution, and defect conversion use governed dialogs', async ({ page }) => {
  let scheduleBody: Record<string, unknown> | undefined;
  let resultBody: Record<string, unknown> | undefined;
  let conversionBody: Record<string, unknown> | undefined;
  await authenticate(page);
  await mockInspectionApi(page, {
    scheduleBody: (body) => { scheduleBody = body; },
    resultBody: (body) => { resultBody = body; },
    conversionBody: (body) => { conversionBody = body; },
  });

  await page.goto(`/pms/operations/assets-inspections?companyId=${companyId}`);
  const scheduleButton = page.getByRole('button', { name: 'Schedule inspection', exact: true });
  await scheduleButton.click();
  const scheduleDialog = page.getByRole('dialog', { name: 'Schedule structured inspection', exact: true });
  await expect(scheduleDialog.getByLabel('Inspection title')).toBeFocused();
  await scheduleDialog.getByLabel('Inspection title').fill('Post-service HVAC inspection');
  await scheduleDialog.getByLabel(/^Property/).selectOption(propertyId);
  await scheduleDialog.getByLabel(/^Inspection template/).selectOption(templateId);
  await scheduleDialog.getByLabel(/^Unit/).selectOption(unitId);
  await scheduleDialog.getByLabel('Scheduled date and time').fill('2026-07-21T09:30');
  await scheduleDialog.getByLabel('Notes').fill('Verify contractor remediation.');
  await scheduleDialog.getByRole('button', { name: 'Schedule inspection', exact: true }).click();
  await expect.poll(() => scheduleBody).toBeTruthy();
  expect(scheduleBody).toMatchObject({ companyId, templateId, propertyId, unitId, title: 'Post-service HVAC inspection', scheduledFor: '2026-07-21T09:30', notes: 'Verify contractor remediation.' });
  await expect(scheduleButton).toBeFocused();

  await page.getByRole('button', { name: 'View inspection', exact: true }).click();
  const details = page.getByRole('dialog', { name: `Inspection details · ${listRun.title}`, exact: true });
  await details.getByRole('button', { name: 'Execute inspection', exact: true }).click();
  const executionDialog = page.getByRole('dialog', { name: 'Execute structured inspection', exact: true });
  await expect(executionDialog.getByLabel('Inspector acknowledgement name')).toBeFocused();
  await executionDialog.getByLabel('Inspector acknowledgement name').fill('Inspector Noor');
  const executionItems = executionDialog.locator('.pms-inspection-execution__item');
  await executionItems.nth(0).getByLabel('Outcome').selectOption('PASS');
  await executionItems.nth(0).getByLabel('Value or observation').fill('18°C');
  await executionItems.nth(1).getByLabel('Outcome').selectOption('FAIL');
  await executionItems.nth(1).getByLabel('Result notes').fill('Frame cracked');
  await executionItems.nth(1).getByLabel('Photo URLs, one per line').fill('https://cdn.lux.test/inspection/filter.jpg');
  await executionItems.nth(1).getByRole('checkbox', { name: 'Create a defect from this result' }).check();
  await executionItems.nth(1).getByLabel('Defect title').fill('Replace damaged filter');
  await executionItems.nth(1).getByLabel('Defect description').fill('Filter frame is cracked.');
  await executionItems.nth(1).getByLabel('Severity').selectOption('HIGH');
  await executionDialog.getByRole('button', { name: 'Complete inspection', exact: true }).click();
  await expect.poll(() => resultBody).toBeTruthy();
  expect(resultBody).toMatchObject({ companyId, acknowledgement: { completedByName: 'Inspector Noor' } });
  expect((resultBody?.results as Array<Record<string, unknown>>)).toHaveLength(2);
  expect((resultBody?.results as Array<Record<string, unknown>>)[1]).toMatchObject({ templateItemId: 'item-filter', result: 'FAIL', photoUrls: ['https://cdn.lux.test/inspection/filter.jpg'], defect: { title: 'Replace damaged filter', severity: 'HIGH' } });

  const completedDetails = page.getByRole('dialog', { name: `Inspection details · ${listRun.title}`, exact: true });
  await expect(completedDetails.getByText('Replace damaged filter', { exact: true })).toBeVisible();
  await completedDetails.getByRole('button', { name: 'Create work order', exact: true }).click();
  const conversionDialog = page.getByRole('dialog', { name: 'Convert defect to work order', exact: true });
  await expect(conversionDialog.getByLabel(/^Vendor/)).toBeFocused();
  await conversionDialog.getByLabel(/^Vendor/).selectOption(vendorId);
  await conversionDialog.getByLabel(/^Asset/).selectOption(assetId);
  await conversionDialog.getByLabel('Target date').fill('2026-07-22');
  await conversionDialog.getByRole('button', { name: 'Create work order', exact: true }).click();
  await expect.poll(() => conversionBody).toEqual({ companyId, vendorId, assetId, scheduledFor: null, targetDate: '2026-07-22' });
  await expect(completedDetails.getByRole('status')).toHaveText('Work order work-order-inspection-1 is linked to this defect.');
});

test('property-scoped viewers receive a read-only Arabic inspection workspace on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, ['MAINTENANCE_VIEW', 'INVENTORY_VIEW']);
  await mockInspectionApi(page);

  await page.goto(`/pms/operations/assets-inspections?companyId=${companyId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'جولات الفحص', exact: true })).toBeVisible();
  await expect(page.getByText('يمكنك مراجعة سجلات الفحص، لكن دورك لا يسمح بالجدولة أو التنفيذ أو الإلغاء أو تحويل العيوب.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'جدولة فحص', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'عرض الفحص', exact: true }).click();
  const details = page.getByRole('dialog', { name: `تفاصيل الفحص · ${listRun.title}`, exact: true });
  await expect(details.getByRole('button', { name: 'تنفيذ الفحص', exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

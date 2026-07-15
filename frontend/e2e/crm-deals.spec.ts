import { expect, test, type Page } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspaceId = 'workspace-deals-21i';
const companyId = 'company-deals-21i';
const managerId = 'manager-deals-21i';
const accountId = 'account-deals-21i';
const dealId = 'deal-deals-21i';

const workspace = {
  workspaceId,
  type: 'COMPANY',
  companyId,
  memberId: 'member-deals-21i',
  role: 'MANAGER',
  nameEn: 'Deal Operations Company',
  nameAr: 'شركة عمليات الصفقات',
  canView: true,
  canManage: true,
  canAssign: true,
  canManageWorkspace: true,
  propertyScope: { allProperties: false, propertyIds: ['property-deals-21i'] }
};

const pipeline = {
  id: 'pipeline-deals-21i',
  workspaceId,
  name: 'Enterprise pipeline',
  description: null,
  isDefault: true,
  active: true,
  _count: { deals: 51, leads: 8 },
  stages: [
    { id: 'stage-qualified-21i', pipelineId: 'pipeline-deals-21i', key: 'QUALIFIED', name: 'Qualified', position: 10, type: 'OPEN', defaultProbability: 40, requiredFields: [], slaHours: 72, active: true },
    { id: 'stage-won-21i', pipelineId: 'pipeline-deals-21i', key: 'WON', name: 'Won', position: 20, type: 'WON', defaultProbability: 100, requiredFields: [], slaHours: null, active: true },
    { id: 'stage-lost-21i', pipelineId: 'pipeline-deals-21i', key: 'LOST', name: 'Lost', position: 30, type: 'LOST', defaultProbability: 0, requiredFields: [], slaHours: null, active: true }
  ]
};

const account = {
  id: accountId,
  workspaceId,
  type: 'COMPANY',
  name: 'Harbour Holdings',
  legalName: 'Harbour Holdings LLC',
  archivedAt: null,
  _count: { contacts: 2, deals: 3, activities: 4 }
};

const listDeal = {
  id: dealId,
  workspaceId,
  name: 'Harbour annual portfolio',
  description: 'Annual property operations relationship',
  accountId,
  account: { id: accountId, name: account.name, type: account.type },
  primaryContact: { id: 'contact-deals-21i', fullName: 'Noor Harbour', email: 'noor@harbour.test', phone: null },
  sourceLead: { id: 'lead-deals-21i', title: 'Harbour portfolio inquiry', status: 'QUALIFIED' },
  pipelineId: pipeline.id,
  pipeline: { id: pipeline.id, name: pipeline.name },
  stageId: pipeline.stages[0].id,
  stage: pipeline.stages[0],
  ownerUser: { id: managerId, name: 'Deal Manager', email: 'manager@deals.test' },
  expectedValue: '85000',
  currency: 'OMR',
  probability: 40,
  forecastCategory: 'PIPELINE',
  expectedCloseDate: '2026-08-15T12:00:00.000Z',
  outcome: 'OPEN',
  wonAt: null,
  lostAt: null,
  closedAt: null,
  archivedAt: null as string | null,
  lostReason: null,
  wonReason: null,
  reopenedCount: 0,
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-15T08:00:00.000Z',
  _count: { activities: 2, stageHistory: 1 }
};

function detailDeal() {
  return {
    ...listDeal,
    stageHistory: [
      {
        id: 'history-deals-21i',
        fromStage: null,
        toStage: pipeline.stages[0],
        fromOutcome: 'OPEN',
        toOutcome: 'OPEN',
        reason: 'Deal created',
        reopened: false,
        changedAt: '2026-07-01T08:00:00.000Z',
        changedBy: { id: managerId, name: 'Deal Manager', email: 'manager@deals.test' }
      }
    ],
    activities: [],
    scoreSnapshots: [],
    sourceEvents: []
  };
}

async function authenticate(page: Page, canManage = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'deal-center-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: managerId,
        name: 'Deal Manager',
        email: 'manager@deals.test',
        role: 'USER',
        emailVerified: true,
        crmAccess: {
          hasAccess: true,
          isAdmin: false,
          personalWorkspace: { enabled: false, canView: false, canManage: false },
          companyWorkspaces: [{ ...workspace, canManage }],
          workspaces: [{ ...workspace, canManage }]
        }
      }
    }
  }));
  await mockNotificationsApi(page);
}

async function mockDealApi(
  page: Page,
  queries: URL[] = [],
  createBodies: Array<Record<string, unknown>> = [],
  transitionBodies: Array<Record<string, unknown>> = [],
  archiveBodies: Array<Record<string, unknown>> = []
) {
  let archivedAt: string | null = null;
  let stage = pipeline.stages[0];
  let outcome = 'OPEN';
  let createdDeal: ReturnType<typeof detailDeal> | null = null;

  await page.route(crmApiPattern, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (url.pathname === '/api/crm/accounts' && method === 'GET') {
      return route.fulfill({ json: { accounts: [account], summary: { total: 1, active: 1, archived: 0 }, pagination: { total: 1, take: 100, skip: 0, count: 1 } } });
    }
    if (url.pathname === '/api/crm/pipelines' && method === 'GET') {
      return route.fulfill({ json: { pipelines: [pipeline] } });
    }
    if (url.pathname === '/api/crm/deals' && method === 'GET') {
      queries.push(url);
      const record = { ...listDeal, archivedAt, stageId: stage.id, stage, outcome };
      return route.fulfill({
        json: {
          deals: [record],
          summary: { total: 51, active: archivedAt ? 0 : 50, archived: archivedAt ? 1 : 0, open: outcome === 'OPEN' && !archivedAt ? 50 : 0, won: outcome === 'WON' && !archivedAt ? 1 : 0, lost: outcome === 'LOST' && !archivedAt ? 1 : 0 },
          pagination: { total: 51, take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1 }
        }
      });
    }
    if (url.pathname === '/api/crm/deals' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      createBodies.push(body);
      createdDeal = {
        ...detailDeal(),
        id: 'created-deal-21i',
        name: String(body.name),
        description: body.description as string | null,
        expectedValue: String(body.expectedValue),
        currency: String(body.currency),
        probability: Number(body.probability),
        expectedCloseDate: String(body.expectedCloseDate)
      };
      return route.fulfill({ status: 201, json: { deal: createdDeal } });
    }
    if (url.pathname === `/api/crm/deals/${dealId}` && method === 'GET') {
      return route.fulfill({ json: { deal: { ...detailDeal(), archivedAt, stageId: stage.id, stage, outcome } } });
    }
    if (url.pathname === '/api/crm/deals/created-deal-21i' && method === 'GET' && createdDeal) {
      return route.fulfill({ json: { deal: createdDeal } });
    }
    if (url.pathname === `/api/crm/deals/${dealId}/transition` && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      transitionBodies.push(body);
      stage = pipeline.stages.find((candidate) => candidate.id === body.stageId) ?? stage;
      outcome = stage.type === 'OPEN' ? 'OPEN' : stage.type;
      return route.fulfill({ json: { deal: { ...detailDeal(), archivedAt, stageId: stage.id, stage, outcome } } });
    }
    if (url.pathname === `/api/crm/deals/${dealId}/archive` && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      archiveBodies.push(body);
      archivedAt = body.archived ? '2026-07-15T09:00:00.000Z' : null;
      return route.fulfill({ json: { deal: { ...listDeal, archivedAt, stageId: stage.id, stage, outcome }, idempotent: false } });
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM deal route: ${method} ${url.pathname}` } });
  });
}

test('deal register uses server pagination and persists browsing filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockDealApi(page, queries);

  await page.goto(`/crm/deals?workspaceId=${workspaceId}&dealPage=2`);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');
  await expect(page.getByRole('heading', { name: 'CRM deal center' })).toBeVisible();
  await expect(page.getByText(listDeal.name, { exact: true })).toBeVisible();

  const filters = page.locator('form.crm-deals__filters');
  await filters.getByLabel('Search deals').fill('harbour');
  await filters.getByRole('combobox', { name: 'Pipeline', exact: true }).selectOption(pipeline.id);
  await filters.getByRole('combobox', { name: 'Stage', exact: true }).selectOption(pipeline.stages[0].id);
  await filters.getByRole('combobox', { name: 'Outcome', exact: true }).selectOption('OPEN');
  await filters.getByLabel('Currency', { exact: true }).fill('OMR');
  await filters.getByRole('combobox', { name: 'State', exact: true }).selectOption('ALL');
  await filters.getByLabel('Expected close from').fill('2026-08-01');
  await filters.getByLabel('Expected close to').fill('2026-08-31');
  await filters.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('expectedValue');
  await filters.getByRole('combobox', { name: 'Direction', exact: true }).selectOption('desc');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/dealQ=harbour/);
  await expect(page).toHaveURL(new RegExp(`dealPipeline=${pipeline.id}`));
  await expect(page).toHaveURL(new RegExp(`dealStage=${pipeline.stages[0].id}`));
  await expect(page).toHaveURL(/dealOutcome=OPEN/);
  await expect(page).toHaveURL(/dealCurrency=OMR/);
  await expect(page).toHaveURL(/dealStatus=ALL/);
  await expect(page).toHaveURL(/dealCloseFrom=2026-08-01/);
  await expect(page).toHaveURL(/dealCloseTo=2026-08-31/);
  await expect(page).toHaveURL(/dealSort=expectedValue/);
  await expect(page).toHaveURL(/dealDirection=desc/);
  await expect(page).not.toHaveURL(/dealPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('harbour');
  await expect.poll(() => queries.at(-1)?.searchParams.get('pipelineId')).toBe(pipeline.id);
  await expect.poll(() => queries.at(-1)?.searchParams.get('status')).toBe('ALL');
  await expect.poll(() => queries.at(-1)?.searchParams.get('sortBy')).toBe('expectedValue');

  await page.reload();
  await expect(filters.getByLabel('Search deals')).toHaveValue('harbour');
  await expect(filters.getByRole('combobox', { name: 'Outcome', exact: true })).toHaveValue('OPEN');
});

test('deal creation, stage transition, and archival use governed accessible flows', async ({ page }) => {
  const createBodies: Array<Record<string, unknown>> = [];
  const transitionBodies: Array<Record<string, unknown>> = [];
  const archiveBodies: Array<Record<string, unknown>> = [];
  await authenticate(page);
  await mockDealApi(page, [], createBodies, transitionBodies, archiveBodies);

  await page.goto(`/crm/deals?workspaceId=${workspaceId}`);
  const createTrigger = page.getByRole('button', { name: 'Create deal', exact: true });
  await createTrigger.click();
  let dialog = page.getByRole('dialog', { name: 'Create governed CRM deal', exact: true });
  const dealNameField = dialog.getByRole('textbox', { name: 'Deal', exact: true });
  await expect(dealNameField).toBeFocused();
  await expect(dialog.getByRole('combobox', { name: 'Account', exact: true })).toHaveValue(accountId);
  await dealNameField.fill('Harbour renewal mandate');
  await dialog.getByLabel('Description').fill('Renewed governed relationship');
  await dialog.getByLabel('Expected value').fill('92000');
  await dialog.getByLabel('Expected close date').fill('2026-09-15');
  await dialog.getByRole('button', { name: 'Save deal', exact: true }).click();
  await expect(page.getByRole('status').getByText('The deal was created.', { exact: true })).toBeVisible();
  expect(createBodies).toHaveLength(1);
  expect(createBodies[0]).toMatchObject({
    workspaceId,
    name: 'Harbour renewal mandate',
    description: 'Renewed governed relationship',
    accountId,
    pipelineId: pipeline.id,
    stageId: pipeline.stages[0].id,
    expectedValue: 92000,
    currency: 'OMR',
    probability: 40,
    expectedCloseDate: '2026-09-15T12:00:00.000Z'
  });
  await expect(createTrigger).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Harbour renewal mandate', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Back to deal register', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/crm/deals[?]workspaceId=${workspaceId}$`));
  await expect(page.getByRole('heading', { name: 'Harbour renewal mandate', exact: true })).toBeHidden();
  const stageSelect = page.getByRole('combobox', { name: `Move ${listDeal.name}`, exact: true });
  await stageSelect.selectOption(pipeline.stages[2].id);
  dialog = page.getByRole('dialog', { name: `Move ${listDeal.name} to Lost`, exact: true });
  await expect(dialog.getByLabel(/Lost reason/)).toBeFocused();
  await dialog.getByLabel('Transition note').fill('Commercial qualification completed');
  await dialog.getByLabel(/Lost reason/).fill('Budget was not approved');
  const confirmTransition = dialog.getByRole('button', { name: 'Confirm stage transition', exact: true });
  await expect(confirmTransition).toBeEnabled();
  await confirmTransition.press('Enter');
  await expect(page.getByRole('status').getByText(`${listDeal.name} moved to Lost.`, { exact: true })).toBeVisible();
  expect(transitionBodies).toEqual([{ stageId: pipeline.stages[2].id, reason: 'Commercial qualification completed', lostReason: 'Budget was not approved' }]);
  await expect(stageSelect).toBeFocused();

  await page.getByRole('button', { name: 'Review deal', exact: true }).click();
  await expect(page.getByRole('heading', { name: listDeal.name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Archive deal', exact: true }).click();
  const archiveDialog = page.getByRole('dialog', { name: 'Review deal state change', exact: true });
  await expect(archiveDialog.getByLabel('Change reason')).toBeFocused();
  await archiveDialog.getByLabel('Change reason').fill('Commercial engagement is paused');
  await archiveDialog.getByRole('checkbox', { name: 'I understand this changes the deal’s operational visibility without deleting its commercial history.', exact: true }).check();
  await archiveDialog.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(page.getByRole('status').getByText('The deal was archived.', { exact: true })).toBeVisible();
  expect(archiveBodies).toEqual([{ archived: true, reason: 'Commercial engagement is paused' }]);
  await expect(page.getByRole('button', { name: 'Restore deal', exact: true })).toBeVisible();
});

test('property-scoped viewers receive a read-only Arabic deal center on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, false);
  await mockDealApi(page);

  await page.goto(`/crm/deals?workspaceId=${workspaceId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مركز صفقات CRM' })).toBeVisible();
  await expect(page.getByText('عرض فقط', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء صفقة', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: `Move ${listDeal.name}`, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'مراجعة الصفقة', exact: true }).click();
  await expect(page.getByRole('heading', { name: listDeal.name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'أرشفة الصفقة', exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

import { expect, test, type Page } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspace = {
  workspaceId: 'workspace-crm-21h',
  type: 'COMPANY',
  companyId: 'company-crm-21h',
  personalOwnerUserId: null,
  memberId: 'member-crm-21h',
  role: 'MANAGER',
  nameEn: 'Stage 21H Company',
  nameAr: null,
  canView: true,
  canManage: true,
  canAssign: true,
  canManageWorkspace: true,
  propertyScope: { allProperties: true, propertyIds: [] }
};

const pipeline = {
  id: 'pipeline-1',
  workspaceId: workspace.workspaceId,
  name: 'Revenue pipeline',
  description: null,
  isDefault: true,
  active: true,
  _count: { deals: 2, leads: 3 },
  stages: [
    { id: 'stage-open', pipelineId: 'pipeline-1', key: 'QUALIFIED', name: 'Qualified', position: 10, type: 'OPEN', defaultProbability: 40, requiredFields: [], slaHours: 48, active: true },
    { id: 'stage-won', pipelineId: 'pipeline-1', key: 'WON', name: 'Won', position: 20, type: 'WON', defaultProbability: 100, requiredFields: [], slaHours: null, active: true },
    { id: 'stage-lost', pipelineId: 'pipeline-1', key: 'LOST', name: 'Lost', position: 30, type: 'LOST', defaultProbability: 0, requiredFields: [], slaHours: null, active: true }
  ]
};

const account = {
  id: 'account-1',
  workspaceId: workspace.workspaceId,
  type: 'DEVELOPER',
  name: 'Atlas Development Group',
  legalName: 'Atlas Development Group LLC',
  registrationNumber: 'CR-2100',
  ownerUser: { id: 'user-manager', name: 'Manager', email: 'manager@lux.test' },
  parentAccount: null,
  archivedAt: null,
  _count: { contacts: 2, deals: 2, activities: 4 }
};

const deals = [
  {
    id: 'deal-omr', workspaceId: workspace.workspaceId, name: 'Enterprise onboarding', description: null,
    accountId: account.id, account: { id: account.id, name: account.name, type: account.type },
    primaryContact: { id: 'contact-1', fullName: 'Salma Partner', email: 'salma@lux.test', phone: null },
    sourceLead: { id: 'lead-1', title: 'Enterprise inquiry', status: 'QUALIFIED' },
    pipelineId: pipeline.id, pipeline: { id: pipeline.id, name: pipeline.name }, stageId: 'stage-open', stage: pipeline.stages[0],
    ownerUser: { id: 'user-manager', name: 'Manager', email: 'manager@lux.test' }, expectedValue: '120000', currency: 'OMR', probability: 40,
    forecastCategory: 'PIPELINE', expectedCloseDate: null, outcome: 'OPEN', wonAt: null, lostAt: null, closedAt: null, archivedAt: null, lostReason: null, reopenedCount: 0
  },
  {
    id: 'deal-usd', workspaceId: workspace.workspaceId, name: 'International distribution', description: null,
    accountId: account.id, account: { id: account.id, name: account.name, type: account.type },
    primaryContact: { id: 'contact-2', fullName: 'Omar Partner', email: 'omar@lux.test', phone: null },
    sourceLead: { id: 'lead-2', title: 'Distribution inquiry', status: 'QUALIFIED' },
    pipelineId: pipeline.id, pipeline: { id: pipeline.id, name: pipeline.name }, stageId: 'stage-open', stage: pipeline.stages[0],
    ownerUser: { id: 'user-manager', name: 'Manager', email: 'manager@lux.test' }, expectedValue: '45000', currency: 'USD', probability: 60,
    forecastCategory: 'BEST_CASE', expectedCloseDate: null, outcome: 'OPEN', wonAt: null, lostAt: null, closedAt: null, archivedAt: null, lostReason: null, reopenedCount: 0
  }
];

const forecast = {
  snapshot: {
    leads: { total: 3, qualified: 2, converted: 2, leadToQualifiedRate: 2 / 3, qualifiedToDealRate: 1 },
    deals: {
      decided: 1,
      won: 1,
      winRate: 1,
      byCurrencyAndOutcome: [
        { currency: 'OMR', outcome: 'OPEN', _count: { _all: 1 }, _sum: { expectedValue: '120000' } },
        { currency: 'USD', outcome: 'OPEN', _count: { _all: 1 }, _sum: { expectedValue: '45000' } }
      ],
      forecast: [
        { currency: 'OMR', pipelineValue: 120000, weightedForecast: 48000 },
        { currency: 'USD', pipelineValue: 45000, weightedForecast: 27000 }
      ],
      averageSalesCycleByCurrency: [{ currency: 'OMR', averageSalesCycleDays: 18 }]
    },
    overdueFollowUps: 1
  },
  dimensions: { bySource: [], byAssignee: [], byScoreBand: [], stages: [], timeInStage: [], stageDropOff: [], lostReasons: [], wonReasons: [{ wonReason: 'Trusted partnership', _count: { _all: 1 } }] },
  rules: { currenciesCombined: false, historicalOutcomesPreservedAfterArchive: true, truncatedResultSetsUsed: false }
};

async function authenticate(page: Page, crmAccess: Record<string, unknown> = { hasAccess: true, isAdmin: false, personalWorkspace: { enabled: false, canView: false, canManage: false }, companyWorkspaces: [workspace], workspaces: [workspace] }) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'browser-stage21h-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: { user: { id: 'user-manager', name: 'Manager', email: 'manager@lux.test', role: 'USER', emailVerified: true, crmAccess } }
  }));
  await mockNotificationsApi(page);
}

async function mockRevenueOperations(page: Page, requests: string[] = []) {
  await page.route(crmApiPattern, (route) => {
    const url = new URL(route.request().url());
    requests.push(`${route.request().method()} ${url.pathname}${url.search}`);
    if (url.pathname.endsWith('/api/crm/accounts')) return route.fulfill({ json: { accounts: [account], pagination: { total: 1, take: 100, skip: 0, count: 1 } } });
    if (url.pathname.endsWith('/api/crm/deals')) return route.fulfill({ json: { deals, pagination: { total: 2, take: 200, skip: 0, count: 2 } } });
    if (url.pathname.endsWith('/api/crm/pipelines')) return route.fulfill({ json: { pipelines: [pipeline] } });
    if (url.pathname.endsWith('/api/crm/analytics/forecast')) return route.fulfill({ json: forecast });
    if (url.pathname.endsWith('/api/crm/communication-policy')) return route.fulfill({ json: { policy: { workspaceId: workspace.workspaceId, timezone: 'Asia/Muscat', quietHoursStart: 1200, quietHoursEnd: 480, hourlyRateLimit: 50, retentionDays: 365 } } });
    return route.fulfill({ status: 404, json: { message: `Unhandled Stage 21H test route: ${url.pathname}` } });
  });
}

test('direct CRM operations URL blocks users without CRM access before loading internal records', async ({ page }) => {
  await authenticate(page, { hasAccess: false, isAdmin: false, personalWorkspace: { enabled: false, canView: false, canManage: false }, companyWorkspaces: [], workspaces: [] });
  const internalRequests: string[] = [];
  await page.route(crmApiPattern, (route) => {
    internalRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
  });

  await page.goto('/crm/operations');
  await expect(page.getByRole('heading', { name: 'CRM access is not enabled for this account.' })).toBeVisible();
  expect(internalRequests).toEqual([]);
});

test('CRM revenue operations renders accounts, configurable stages, and currency-separated forecasts', async ({ page }) => {
  await authenticate(page);
  const requests: string[] = [];
  await mockRevenueOperations(page, requests);

  await page.goto('/crm/operations');
  await expect(page.getByRole('heading', { name: 'CRM accounts, deals, pipelines, and governance' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Workspace', exact: true })).toHaveValue(workspace.workspaceId);
  await expect(page.getByRole('button', { name: /Atlas Development Group/ })).toContainText('2 contacts · 2 deals');

  await page.getByRole('navigation', { name: 'CRM sections' }).getByRole('link', { name: 'Deals', exact: true }).click();
  await expect(page.getByText('Enterprise onboarding')).toBeVisible();
  await expect(page.getByText('International distribution')).toBeVisible();
  await expect(page.getByText('Qualified', { exact: true }).first()).toBeVisible();

  await page.getByRole('navigation', { name: 'CRM sections' }).getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conversion and forecast' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OMR' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'USD' })).toBeVisible();
  await expect(page.getByText('Currencies are intentionally separated. Historical won/lost outcomes remain counted after archival.')).toBeVisible();
  expect(requests.some((request) => request.includes('/api/crm/analytics/forecast?workspaceId=workspace-crm-21h'))).toBe(true);
});

test('CRM revenue operations remains usable on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await mockRevenueOperations(page);

  await page.goto('/crm/operations');
  await expect(page.getByRole('heading', { name: 'CRM accounts, deals, pipelines, and governance' })).toBeVisible();
  await page.getByRole('navigation', { name: 'CRM sections' }).getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'OMR' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'USD' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

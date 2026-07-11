import { expect, test, type Page } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const companyWorkspace = {
  workspaceId: 'workspace-shell-routing',
  type: 'COMPANY',
  companyId: 'company-shell-routing',
  personalOwnerUserId: null,
  memberId: 'member-shell-routing',
  role: 'MANAGER',
  nameEn: 'Routing Company',
  nameAr: 'شركة المسارات',
  canView: true,
  canManage: true,
  canAssign: true,
  canManageWorkspace: true,
  propertyScope: { allProperties: true, propertyIds: [] }
};

async function authenticate(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-shell-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: 'crm-shell-user',
        name: 'CRM Shell User',
        email: 'crm-shell@lux.test',
        role: 'USER',
        emailVerified: true,
        crmAccess: {
          hasAccess: true,
          isAdmin: false,
          personalWorkspace: { enabled: false, canView: false, canManage: false },
          companyWorkspaces: [companyWorkspace],
          workspaces: [companyWorkspace]
        }
      }
    }
  }));
  await mockNotificationsApi(page);
}

async function mockCrm(page: Page) {
  await page.route(crmApiPattern, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/api/crm/leads')) return route.fulfill({ json: { leads: [], summary: { total: 0, byStatus: {} } } });
    if (url.pathname.endsWith('/api/crm/analytics')) return route.fulfill({ json: { analytics: { total: 0, newLeads: 0, openLeads: 0, overdueFollowUps: 0, openTasks: 0, overdueTasks: 0, won: 0, lost: 0, conversionRate: null, byStatus: {}, bySource: [] } } });
    if (url.pathname.endsWith('/api/crm/pipeline')) return route.fulfill({ json: { pipeline: { groupBy: 'status', groups: [], total: 0, limited: false } } });
    if (url.pathname.endsWith('/api/crm/tasks')) return route.fulfill({ json: { tasks: [], pagination: { total: 0, take: 12, skip: 0, count: 0 } } });
    if (url.pathname.endsWith('/api/crm/assignees')) return route.fulfill({ json: { assignees: [] } });
    if (url.pathname.endsWith('/api/crm/properties')) return route.fulfill({ json: { properties: [] } });
    if (url.pathname.endsWith('/api/crm/accounts')) return route.fulfill({ json: { accounts: [], pagination: { total: 0 } } });
    if (url.pathname.endsWith('/api/crm/deals')) return route.fulfill({ json: { deals: [], pagination: { total: 0 } } });
    if (url.pathname.endsWith('/api/crm/pipelines')) return route.fulfill({ json: { pipelines: [] } });
    if (url.pathname.endsWith('/api/crm/analytics/forecast')) return route.fulfill({ json: { snapshot: { leads: { total: 0, qualified: 0, converted: 0, leadToQualifiedRate: 0, qualifiedToDealRate: 0 }, deals: { decided: 0, won: 0, winRate: 0, byCurrencyAndOutcome: [], forecast: [], averageSalesCycleByCurrency: [] }, overdueFollowUps: 0 }, dimensions: { bySource: [], byAssignee: [], byScoreBand: [], stages: [], timeInStage: [], stageDropOff: [], lostReasons: [], wonReasons: [] }, rules: { currenciesCombined: false, historicalOutcomesPreservedAfterArchive: true, truncatedResultSetsUsed: false } } });
    if (url.pathname.endsWith('/api/crm/communication-policy')) return route.fulfill({ json: { policy: { workspaceId: companyWorkspace.workspaceId, timezone: 'Asia/Muscat', quietHoursStart: 1200, quietHoursEnd: 480, hourlyRateLimit: 50, retentionDays: 365 } } });
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM shell route: ${url.pathname}` } });
  });
}

test.beforeEach(async ({ page }) => {
  await authenticate(page);
  await mockCrm(page);
});

test('legacy CRM entry redirects to the persistent overview shell and keeps workspace state', async ({ page }) => {
  await page.goto('/crm?workspace=company:company-shell-routing');
  await expect(page).toHaveURL(/\/crm\/overview\?workspace=company(?::|%3A)company-shell-routing/);
  await expect(page.getByRole('navigation', { name: 'CRM sections' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sales and relationship command center' })).toBeVisible();
});

test('CRM shell maps the selected company workspace between lead and operations routes', async ({ page }) => {
  await page.goto('/crm/leads?workspace=company:company-shell-routing');
  const navigation = page.getByRole('navigation', { name: 'CRM sections' });
  await expect(navigation.getByRole('link', { name: 'Accounts', exact: true })).toHaveAttribute(
    'href',
    `/crm/accounts?workspaceId=${companyWorkspace.workspaceId}`
  );
  await navigation.getByRole('link', { name: 'Accounts', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/crm/accounts\\?workspaceId=${companyWorkspace.workspaceId}`));
  await expect(page.getByRole('combobox', { name: 'Workspace', exact: true })).toHaveValue(companyWorkspace.workspaceId);
});

test('lead filters, sorting view, and workspace are persisted in the URL and survive reload', async ({ page }) => {
  await page.goto('/crm/leads?workspace=company:company-shell-routing');
  await page.getByLabel('Search name, email, source').fill('harbour');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('QUALIFIED');
  await page.getByRole('button', { name: 'List', exact: true }).click();

  await expect(page).toHaveURL(/q=harbour/);
  await expect(page).toHaveURL(/status=QUALIFIED/);
  await expect(page).toHaveURL(/view=list/);

  await page.reload();
  await expect(page.getByLabel('Search name, email, source')).toHaveValue('harbour');
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('QUALIFIED');
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveClass(/is-active/);
});

test('legacy operations and lead URLs redirect without dropping query parameters', async ({ page }) => {
  await page.goto(`/crm/operations?workspaceId=${companyWorkspace.workspaceId}&tab=forecast`);
  await expect(page).toHaveURL(new RegExp(`/crm/analytics\\?workspaceId=${companyWorkspace.workspaceId}`));

  await page.goto('/crm/legacy-lead-id?workspace=company:company-shell-routing&q=legacy');
  await expect(page).toHaveURL(/\/crm\/leads\/legacy-lead-id\?workspace=company(?::|%3A)company-shell-routing&q=legacy/);
});

test('CRM shell remains keyboard reachable and usable on narrow RTL screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await page.goto('/crm/overview?workspace=company:company-shell-routing');
  const navigation = page.getByRole('navigation', { name: 'أقسام CRM' });
  await expect(navigation.getByRole('link', { name: 'العملاء المحتملون', exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: 'العملاء المحتملون', exact: true }).focus();
  await expect(navigation.getByRole('link', { name: 'العملاء المحتملون', exact: true })).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

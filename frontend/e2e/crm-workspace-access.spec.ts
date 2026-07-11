import { expect, test, type Page } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const authUser = (role: string, extra: Record<string, unknown> = {}) => ({
  id: `user-${role}`,
  name: role,
  email: `${role.toLowerCase()}@lux.test`,
  role,
  emailVerified: true,
  ...extra
});

async function authenticate(
  page: Page,
  role: string,
  crmAccess: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'browser-test-token'));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { user: authUser(role, { ...extra, crmAccess }) } })
  );
  await mockNotificationsApi(page);
}

async function installEmptyCrmResponses(page: Page, requests: string[] = []) {
  await page.route(crmApiPattern, (route) => {
    requests.push(route.request().url());
    const url = route.request().url();
    if (url.includes('/analytics')) {
      return route.fulfill({
        json: {
          analytics: {
            total: 0,
            newLeads: 0,
            openLeads: 0,
            overdueFollowUps: 0,
            openTasks: 0,
            wonLeads: 0,
            lostLeads: 0,
            conversionRate: 0,
            pipelineValueByCurrency: [],
            byStatus: [],
            bySource: [],
            byAssignee: [],
            sourceConversion: []
          }
        }
      });
    }
    if (url.includes('/pipeline')) {
      return route.fulfill({
        json: { pipeline: { groupBy: 'status', groups: [], total: 0, limited: false } }
      });
    }
    if (url.includes('/tasks')) {
      return route.fulfill({ json: { tasks: [], summary: { total: 0 } } });
    }
    if (url.includes('/assignees')) return route.fulfill({ json: { assignees: [] } });
    if (url.includes('/properties')) return route.fulfill({ json: { properties: [] } });
    if (url.includes('/leads')) {
      return route.fulfill({
        json: {
          leads: [],
          summary: { total: 0, byStatus: {} },
          pagination: { take: 50, skip: 0, total: 0, count: 0 }
        }
      });
    }
    return route.fulfill({ status: 404, json: { message: 'Unhandled browser test route' } });
  });
}

const personalWorkspace = {
  workspaceId: 'workspace-personal',
  type: 'PERSONAL',
  companyId: null,
  personalOwnerUserId: 'user-OWNER',
  memberId: 'member-personal',
  role: 'OWNER',
  nameEn: 'Personal CRM',
  nameAr: null,
  canView: true,
  canManage: true,
  canAssign: true,
  canManageWorkspace: true,
  propertyScope: { allProperties: true, propertyIds: [] }
};

const companyWorkspace = {
  workspaceId: 'workspace-company',
  type: 'COMPANY',
  companyId: 'company-1',
  personalOwnerUserId: null,
  memberId: 'member-company',
  role: 'MANAGER',
  nameEn: 'Independent CRM Company',
  nameAr: null,
  canView: true,
  canManage: true,
  canAssign: true,
  canManageWorkspace: true,
  propertyScope: { allProperties: true, propertyIds: [] }
};

const workspaceSelector = (page: Page) =>
  page.getByRole('combobox', { name: 'Workspace', exact: true });

test('customer direct CRM URL renders denied state and sends no unauthorized record requests', async ({ page }) => {
  await authenticate(page, 'USER', {
    hasAccess: false,
    isAdmin: false,
    personalWorkspace: { enabled: false, canView: false, canManage: false },
    companyWorkspaces: [],
    workspaces: []
  });
  const recordRequests: string[] = [];
  await page.route(crmApiPattern, async (route) => {
    recordRequests.push(route.request().url());
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
  });
  await page.goto('/crm');
  await expect(
    page.getByRole('heading', { name: 'CRM access is not enabled for this account.' })
  ).toBeVisible();
  expect(recordRequests).toEqual([]);
});

test('personal CRM stays in the personal workspace', async ({ page }) => {
  await authenticate(page, 'OWNER', {
    hasAccess: true,
    isAdmin: false,
    personalWorkspace: {
      enabled: true,
      canView: true,
      canManage: true,
      workspaceId: personalWorkspace.workspaceId
    },
    companyWorkspaces: [],
    workspaces: [personalWorkspace]
  });
  const requests: string[] = [];
  await installEmptyCrmResponses(page, requests);
  await page.goto('/crm');
  await expect(workspaceSelector(page)).toHaveValue('personal');
  await expect
    .poll(() => requests.some((url) => new URL(url).searchParams.get('workspace') === 'personal'))
    .toBe(true);
  expect(requests.some((url) => new URL(url).searchParams.has('companyId'))).toBe(false);
});

test('company CRM works without PMS entitlement and retains access with suspended PMS metadata', async ({ page }) => {
  await authenticate(
    page,
    'DEVELOPER',
    {
      hasAccess: true,
      isAdmin: false,
      personalWorkspace: {
        enabled: true,
        canView: true,
        canManage: true,
        workspaceId: 'workspace-personal-developer'
      },
      companyWorkspaces: [companyWorkspace],
      workspaces: [companyWorkspace]
    },
    { pmsAccess: { hasAccess: false, reason: 'SUSPENDED' } }
  );
  const requests: string[] = [];
  await installEmptyCrmResponses(page, requests);
  await page.goto('/crm');
  await workspaceSelector(page).selectOption('company:company-1');
  await expect(page.getByRole('heading', { name: 'Sales and relationship command center' })).toBeVisible();
  await expect
    .poll(() => requests.some((url) => new URL(url).searchParams.get('companyId') === 'company-1'))
    .toBe(true);
});

test('property-scoped company workspace requests only its assigned property data', async ({ page }) => {
  const scoped = {
    ...companyWorkspace,
    propertyScope: { allProperties: false, propertyIds: ['property-a'] }
  };
  await authenticate(page, 'USER', {
    hasAccess: true,
    isAdmin: false,
    personalWorkspace: { enabled: false, canView: false, canManage: false },
    companyWorkspaces: [scoped],
    workspaces: [scoped]
  });
  const requests: string[] = [];
  await installEmptyCrmResponses(page, requests);
  await page.route(/\/api\/crm\/properties(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { properties: [{ id: 'property-a', name: 'Property A' }] } })
  );
  await page.goto('/crm');
  await expect(workspaceSelector(page)).toHaveValue('company:company-1');
  await expect.poll(() => requests.every((url) => !url.includes('company-2'))).toBe(true);
});

test('platform admin can switch between global and company oversight', async ({ page }) => {
  await authenticate(page, 'ADMIN', {
    hasAccess: true,
    isAdmin: true,
    personalWorkspace: { enabled: false, canView: false, canManage: false },
    companyWorkspaces: [companyWorkspace],
    workspaces: [
      { ...companyWorkspace },
      {
        workspaceId: 'workspace-platform',
        type: 'PLATFORM',
        companyId: null,
        personalOwnerUserId: null,
        canView: true,
        canManage: true,
        propertyScope: { allProperties: true, propertyIds: [] }
      }
    ]
  });
  const requests: string[] = [];
  await installEmptyCrmResponses(page, requests);
  await page.goto('/crm');
  await expect(workspaceSelector(page)).toHaveValue('all');
  await workspaceSelector(page).selectOption('company:company-1');
  await expect
    .poll(() => requests.some((url) => new URL(url).searchParams.get('companyId') === 'company-1'))
    .toBe(true);
});

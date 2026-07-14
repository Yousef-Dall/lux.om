import { expect, test, type Page, type Route } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspaceId = 'workspace-contact-merge';
const accountId = 'account-contact-merge';
const primaryContactId = 'contact-primary';
const duplicateContactId = 'contact-duplicate';

const workspace = {
  workspaceId,
  type: 'COMPANY',
  companyId: 'company-contact-merge',
  personalOwnerUserId: null,
  memberId: 'member-contact-merge',
  role: 'MANAGER',
  nameEn: 'Contact Merge Company',
  nameAr: 'شركة دمج جهات الاتصال',
  canView: true,
  canManage: true,
  canAssign: true,
  canManageWorkspace: true,
  propertyScope: { allProperties: true, propertyIds: [] }
};

const account = {
  id: accountId,
  workspaceId,
  type: 'COMPANY',
  name: 'Merge Account',
  legalName: 'Merge Account LLC',
  registrationNumber: 'MERGE-001',
  ownerUser: null,
  parentAccount: null,
  archivedAt: null,
  _count: { contacts: 2, deals: 1, activities: 3 },
  contacts: [],
  deals: [],
  childAccounts: []
};

const primary = {
  id: primaryContactId,
  workspaceId,
  fullName: 'Salma Primary',
  email: 'primary@lux.test',
  phone: '+96890000001',
  notes: 'Primary relationship notes',
  account: { id: accountId, name: account.name, type: account.type },
  identities: [{ id: 'identity-primary-email', type: 'EMAIL', normalizedValue: 'primary@lux.test', verifiedAt: null }],
  channelPreferences: [],
  leads: [],
  primaryDeals: [],
  suppressions: []
};

const duplicate = {
  id: duplicateContactId,
  workspaceId,
  fullName: 'Salma Duplicate',
  email: 'duplicate@lux.test',
  phone: '+96890000002',
  notes: 'Duplicate relationship notes',
  accountId,
  userId: 'user-linked-duplicate',
  pmsTenantId: null,
  identities: [
    { id: 'identity-duplicate-email', type: 'EMAIL', normalizedValue: 'duplicate@lux.test', verifiedAt: null },
    { id: 'identity-duplicate-phone', type: 'PHONE', normalizedValue: '+96890000002', verifiedAt: null }
  ],
  channelPreferences: [],
  _count: { leads: 2, primaryDeals: 1, activities: 3, sourceEvents: 4, deliveryAttempts: 1 }
};

const preview = {
  primary: {
    ...primary,
    accountId,
    userId: null,
    pmsTenantId: null,
    _count: { leads: 1, primaryDeals: 1, activities: 1, sourceEvents: 1, deliveryAttempts: 0 }
  },
  duplicate,
  conflicts: [
    { field: 'fullName', primary: primary.fullName, duplicate: duplicate.fullName },
    { field: 'email', primary: primary.email, duplicate: duplicate.email },
    { field: 'phone', primary: primary.phone, duplicate: duplicate.phone },
    { field: 'notes', primary: primary.notes, duplicate: duplicate.notes }
  ],
  movedLinks: duplicate._count,
  suggested: {
    fullName: primary.fullName,
    email: primary.email,
    phone: primary.phone,
    notes: `${primary.notes}\n\n${duplicate.notes}`,
    accountId,
    userId: duplicate.userId,
    pmsTenantId: null
  }
};

async function authenticate(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-contact-merge-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: 'crm-contact-merge-manager',
        name: 'Merge Manager',
        email: 'merge-manager@lux.test',
        role: 'USER',
        emailVerified: true,
        crmAccess: {
          hasAccess: true,
          isAdmin: false,
          personalWorkspace: { enabled: false, canView: false, canManage: false },
          companyWorkspaces: [workspace],
          workspaces: [workspace]
        }
      }
    }
  }));
  await mockNotificationsApi(page);
}

async function fulfill(route: Route, json: unknown, status = 200) {
  await route.fulfill({ json, status });
}

async function mockMergeApi(
  page: Page,
  calls: string[],
  mergeBodies: Array<Record<string, unknown>>,
  options: { waitForMergeResponse?: Promise<void> } = {}
) {
  let merged = false;
  await page.route(crmApiPattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    calls.push(`${method} ${url.pathname}`);

    if (url.pathname === '/api/crm/contacts' && method === 'GET') return fulfill(route, {
      contacts: [{
        ...primary,
        archivedAt: null,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-13T14:00:00.000Z',
        normalizedEmail: primary.email,
        normalizedPhone: primary.phone,
        _count: { leads: 1, primaryDeals: 1, activities: 1, deliveryAttempts: 0 }
      }],
      summary: { total: 1, active: 1, archived: 0 },
      pagination: { total: 1, count: 1, take: 25, skip: 0 }
    });
    if (url.pathname === '/api/crm/accounts' && method === 'GET') return fulfill(route, { accounts: [account], pagination: { total: 1, count: 1, take: 100, skip: 0 } });
    if (url.pathname === '/api/crm/deals' && method === 'GET') return fulfill(route, { deals: [], pagination: { total: 0, count: 0, take: 200, skip: 0 } });
    if (url.pathname === '/api/crm/pipelines' && method === 'GET') return fulfill(route, { pipelines: [] });
    if (url.pathname === '/api/crm/analytics/forecast' && method === 'GET') return fulfill(route, {
      snapshot: { leads: { total: 0, qualified: 0, converted: 0, leadToQualifiedRate: 0, qualifiedToDealRate: 0 }, deals: { decided: 0, won: 0, winRate: 0, byCurrencyAndOutcome: [], forecast: [], averageSalesCycleByCurrency: [] }, overdueFollowUps: 0 },
      dimensions: { bySource: [], byAssignee: [], byScoreBand: [], stages: [], timeInStage: [], stageDropOff: [], lostReasons: [], wonReasons: [] },
      rules: { currenciesCombined: false, historicalOutcomesPreservedAfterArchive: true, truncatedResultSetsUsed: false }
    });
    if (url.pathname === '/api/crm/communication-policy' && method === 'GET') return fulfill(route, { policy: { workspaceId, timezone: 'Asia/Muscat', quietHoursStart: 1200, quietHoursEnd: 480, hourlyRateLimit: 50, retentionDays: 365 } });
    if (url.pathname === `/api/crm/contacts/${primaryContactId}` && method === 'GET') return fulfill(route, { contact: primary, duplicates: merged ? [] : [{ id: duplicateContactId, fullName: duplicate.fullName, email: duplicate.email, phone: duplicate.phone, reasons: ['same_normalized_name'] }], suppressions: [] });
    if (url.pathname === `/api/crm/contacts/${primaryContactId}/merge-preview` && method === 'POST') return fulfill(route, { preview });
    if (url.pathname === `/api/crm/contacts/${primaryContactId}/merge` && method === 'POST') {
      mergeBodies.push(request.postDataJSON() as Record<string, unknown>);
      if (options.waitForMergeResponse) await options.waitForMergeResponse;
      merged = true;
      return fulfill(route, {
        merge: { id: 'merge-audit-21i', workspaceId, primaryContactId, duplicateContactId, status: 'COMPLETED', mergedAt: '2026-07-13T14:30:00.000Z', actorId: 'crm-contact-merge-manager', createdAt: '2026-07-13T14:30:00.000Z' },
        contact: primary,
        preview
      });
    }
    return fulfill(route, { message: `Unhandled CRM contact merge route: ${method} ${url.pathname}` }, 404);
  });
}

test('contact merge requires preview, field resolution, acknowledgement, and exposes the audit reference', async ({ page }) => {
  await authenticate(page);
  const calls: string[] = [];
  const mergeBodies: Array<Record<string, unknown>> = [];
  let releaseMergeResponse = () => {};
  const waitForMergeResponse = new Promise<void>((resolve) => {
    releaseMergeResponse = resolve;
  });
  await mockMergeApi(page, calls, mergeBodies, { waitForMergeResponse });

  await page.goto(`/crm/contacts/${primaryContactId}?workspaceId=${workspaceId}`);
  const reviewButton = page.getByRole('button', { name: 'Review merge' });
  await expect(reviewButton).toBeVisible();
  await reviewButton.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Review contact merge');
  await expect(dialog).toBeVisible();
  const contactCards = dialog.locator('.crm-contact-merge__parties article');
  await expect(contactCards.first().locator('p').first()).toHaveText('primary@lux.test');
  await expect(contactCards.nth(1).locator('p').first()).toHaveText('duplicate@lux.test');
  const relinkedRecords = dialog.getByRole('region', { name: 'Records that will be relinked to the primary contact' });
  await expect(relinkedRecords.getByText('Activities and tasks', { exact: true })).toBeVisible();
  await expect(relinkedRecords.getByText('4', { exact: true })).toBeVisible();
  expect(calls.filter((call) => call.endsWith('/merge-preview'))).toHaveLength(1);
  expect(calls.filter((call) => call.endsWith('/merge'))).toHaveLength(0);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(reviewButton).toBeFocused();

  await reviewButton.click();
  await dialog.getByRole('radio', { name: /Use duplicate value duplicate@lux\.test/ }).check();
  await dialog.getByRole('button', { name: 'Continue to confirmation' }).click();
  const commitButton = dialog.locator('button[type="submit"]');
  await expect(commitButton).toHaveAccessibleName('Commit contact merge');
  await expect(commitButton).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /I understand this merge is irreversible/ }).check();
  await expect(commitButton).toBeEnabled();
  await commitButton.click();
  await expect.poll(() => mergeBodies.length).toBe(1);
  await expect(commitButton).toBeDisabled();
  await expect(commitButton).toHaveAccessibleName('Merging…');
  releaseMergeResponse();

  await expect(dialog).toHaveAccessibleName('Contact merge completed');
  await expect(dialog.getByText('merge-audit-21i', { exact: true })).toBeVisible();
  expect(mergeBodies).toEqual([{
    duplicateContactId,
    resolutions: {
      fullName: primary.fullName,
      email: duplicate.email,
      phone: primary.phone,
      notes: primary.notes
    }
  }]);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText(`${duplicate.fullName} was merged into ${primary.fullName}.`)).toBeVisible();
});

test('contact merge review renders Arabic copy and remains usable on a narrow RTL viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page);
  await mockMergeApi(page, [], []);

  await page.goto(`/crm/contacts/${primaryContactId}?workspaceId=${workspaceId}`);
  await page.getByRole('button', { name: 'مراجعة الدمج' }).click();

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const dialog = page.getByRole('dialog', { name: 'مراجعة دمج جهة الاتصال' });
  await expect(dialog.getByText('جهة الاتصال الأساسية', { exact: true })).toBeVisible();
  await expect(dialog.getByText('السجلات التي ستُنقل إلى جهة الاتصال الأساسية', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'المتابعة إلى التأكيد' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

import { expect, test, type Page, type Route } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspaceId = 'workspace-accounts-21i';
const companyId = 'company-accounts-21i';
const propertyId = 'property-accounts-21i';
const accountId = 'account-accounts-21i';
const managerId = 'manager-accounts-21i';

const account = {
  id: accountId,
  workspaceId,
  type: 'COMPANY',
  name: 'Harbour Holdings',
  legalName: 'Harbour Holdings LLC',
  registrationNumber: 'HH-2026',
  taxNumber: null,
  website: null,
  email: 'accounts@harbour.test',
  phone: '+96824000000',
  industry: 'Real estate',
  notes: 'Strategic property-owner relationship.',
  pmsPropertyId: propertyId,
  archivedAt: null as string | null,
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-14T08:00:00.000Z',
  ownerUser: { id: managerId, name: 'Maha Manager', email: 'maha@harbour.test' },
  parentAccount: null,
  _count: { contacts: 1, deals: 1, activities: 2 }
};

const initialContact = {
  id: 'contact-account-21i',
  workspaceId,
  fullName: 'Noor Al Harbour',
  email: 'noor@harbour.test',
  phone: '+96890000000',
  notes: null,
  account: { id: accountId, name: account.name, type: 'COMPANY' },
  identities: [],
  channelPreferences: [],
  leads: [],
  primaryDeals: []
};

const deal = {
  id: 'deal-account-21i',
  workspaceId,
  name: 'Harbour portfolio mandate',
  accountId,
  account: { id: accountId, name: account.name, type: 'COMPANY' },
  primaryContact: initialContact,
  sourceLead: null,
  pipelineId: 'pipeline-account-21i',
  pipeline: { id: 'pipeline-account-21i', name: 'Property-owner pipeline' },
  stageId: 'stage-account-21i',
  stage: { id: 'stage-account-21i', pipelineId: 'pipeline-account-21i', key: 'QUALIFIED', name: 'Qualified', position: 20, type: 'OPEN', defaultProbability: 45, active: true },
  ownerUser: account.ownerUser,
  expectedValue: '250000',
  currency: 'OMR',
  probability: 45,
  forecastCategory: 'PIPELINE',
  outcome: 'OPEN',
  archivedAt: null,
  reopenedCount: 0
};

async function authenticate(page: Page, canManage = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-accounts-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: managerId,
        name: 'Maha Manager',
        email: 'maha@harbour.test',
        role: 'USER',
        emailVerified: true,
        crmAccess: {
          hasAccess: true,
          isAdmin: false,
          personalWorkspace: { enabled: false, canView: false, canManage: false },
          companyWorkspaces: [{
            workspaceId,
            type: 'COMPANY',
            companyId,
            personalOwnerUserId: null,
            memberId: 'member-accounts-21i',
            role: canManage ? 'MANAGER' : 'VIEWER',
            nameEn: 'Harbour CRM',
            nameAr: 'إدارة علاقات هاربور',
            canView: true,
            canManage,
            canAssign: canManage,
            canManageWorkspace: canManage,
            propertyScope: { allProperties: false, propertyIds: [propertyId] }
          }],
          workspaces: [{
            workspaceId,
            type: 'COMPANY',
            companyId,
            personalOwnerUserId: null,
            canView: true,
            canManage,
            propertyScope: { allProperties: false, propertyIds: [propertyId] }
          }]
        }
      }
    }
  }));
  await mockNotificationsApi(page);
}

async function mockAccountApi(
  page: Page,
  queries: URL[],
  createBodies: Array<Record<string, unknown>>,
  contactBodies: Array<Record<string, unknown>>,
  archiveBodies: Array<Record<string, unknown>>
) {
  let archivedAt: string | null = null;
  let contacts = [initialContact];
  await page.route(crmApiPattern, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === '/api/crm/accounts' && method === 'GET') {
      queries.push(url);
      return route.fulfill({
        json: {
          accounts: [{ ...account, archivedAt, _count: { ...account._count, contacts: contacts.length } }],
          summary: { total: 51, active: archivedAt ? 50 : 51, archived: archivedAt ? 1 : 0 },
          pagination: { total: 51, take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1 }
        }
      });
    }
    if (url.pathname === '/api/crm/accounts' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      createBodies.push(body);
      return route.fulfill({ status: 201, json: { account: { ...account, id: 'created-account-21i', ...body, _count: { contacts: 0, deals: 0, activities: 1 } } } });
    }
    if (url.pathname === `/api/crm/accounts/${accountId}` && method === 'GET') {
      return route.fulfill({
        json: {
          account: {
            ...account,
            archivedAt,
            contacts,
            deals: [deal],
            childAccounts: [],
            teamMembers: [],
            activities: [],
            sourceEvents: [],
            _count: { ...account._count, contacts: contacts.length }
          }
        }
      });
    }
    if (url.pathname === `/api/crm/accounts/${accountId}/contacts` && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      contactBodies.push(body);
      const contact = { ...initialContact, id: 'created-contact-21i', ...body };
      contacts = [...contacts, contact];
      return route.fulfill({ status: 201, json: { contact } });
    }
    if (url.pathname === `/api/crm/accounts/${accountId}/archive` && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      archiveBodies.push(body);
      archivedAt = body.archived ? '2026-07-14T12:00:00.000Z' : null;
      return route.fulfill({ json: { account: { ...account, archivedAt }, idempotent: false } });
    }
    if (url.pathname === '/api/crm/properties' && method === 'GET') {
      return route.fulfill({ json: { properties: [{ id: propertyId, name: 'Harbour Residences', code: 'HR-01' }] } });
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM account route: ${method} ${url.pathname}` } });
  });
}

test('account register uses server pagination and persists browsing filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockAccountApi(page, queries, [], [], []);

  await page.goto(`/crm/accounts?workspaceId=${workspaceId}&accountPage=2`);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');
  await expect(page.getByRole('heading', { name: 'CRM account center' })).toBeVisible();
  await expect(page.getByText(account.name, { exact: true })).toBeVisible();

  const filters = page.locator('form.crm-accounts__filters');
  await filters.getByLabel('Search accounts').fill('harbour');
  await filters.getByRole('combobox', { name: 'Type', exact: true }).selectOption('COMPANY');
  await filters.getByRole('combobox', { name: 'State', exact: true }).selectOption('ALL');
  await filters.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('updatedAt');
  await filters.getByRole('combobox', { name: 'Direction', exact: true }).selectOption('desc');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/accountQ=harbour/);
  await expect(page).toHaveURL(/accountType=COMPANY/);
  await expect(page).toHaveURL(/accountStatus=ALL/);
  await expect(page).toHaveURL(/accountSort=updatedAt/);
  await expect(page).toHaveURL(/accountDirection=desc/);
  await expect(page).not.toHaveURL(/accountPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('harbour');
  await expect.poll(() => queries.at(-1)?.searchParams.get('type')).toBe('COMPANY');
  await expect.poll(() => queries.at(-1)?.searchParams.get('status')).toBe('ALL');
  await expect.poll(() => queries.at(-1)?.searchParams.get('sortBy')).toBe('updatedAt');
  await expect.poll(() => queries.at(-1)?.searchParams.get('direction')).toBe('desc');

  await page.reload();
  await expect(filters.getByLabel('Search accounts')).toHaveValue('harbour');
  await expect(filters.getByRole('combobox', { name: 'State', exact: true })).toHaveValue('ALL');
});

test('account creation, contact addition, and archival use governed accessible dialogs', async ({ page }) => {
  const createBodies: Array<Record<string, unknown>> = [];
  const contactBodies: Array<Record<string, unknown>> = [];
  const archiveBodies: Array<Record<string, unknown>> = [];
  await authenticate(page);
  await mockAccountApi(page, [], createBodies, contactBodies, archiveBodies);

  await page.goto(`/crm/accounts?workspaceId=${workspaceId}`);
  const createTrigger = page.getByRole('button', { name: 'Create account', exact: true });
  await createTrigger.click();
  let dialog = page.getByRole('dialog', { name: 'Create governed CRM account', exact: true });
  await expect(dialog.getByLabel('Account name')).toBeFocused();
  await dialog.getByLabel('Account name').fill('Marina Investment Group');
  await dialog.getByRole('combobox', { name: 'Type', exact: true }).selectOption('INVESTOR');
  await dialog.getByLabel('Email').fill('marina@invest.test');
  await dialog.getByLabel('Industry').fill('Investment');
  await dialog.getByRole('combobox', { name: 'PMS property', exact: true }).selectOption(propertyId);
  await dialog.getByRole('button', { name: 'Save account', exact: true }).click();
  await expect(page.getByRole('status').getByText('The CRM account was created.', { exact: true })).toBeVisible();
  expect(createBodies).toHaveLength(1);
  expect(createBodies[0]).toMatchObject({ workspaceId, type: 'INVESTOR', name: 'Marina Investment Group', email: 'marina@invest.test', industry: 'Investment', pmsPropertyId: propertyId, teamUserIds: [] });
  await expect(createTrigger).toBeFocused();

  const reviewTrigger = page.getByRole('button', { name: 'Review account', exact: true });
  await reviewTrigger.click();
  dialog = page.getByRole('dialog', { name: `Account details · ${account.name}`, exact: true });
  await expect(dialog.getByText(initialContact.fullName, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Add contact', exact: true }).click();
  const contactDialog = page.getByRole('dialog', { name: 'Add contact to account', exact: true });
  await expect(contactDialog.getByLabel('Full name')).toBeFocused();
  await contactDialog.getByLabel('Full name').fill('Salma Marina');
  await contactDialog.getByLabel('Email').fill('salma@marina.test');
  await contactDialog.getByRole('button', { name: 'Save contact', exact: true }).click();
  await expect(page.getByRole('dialog', { name: `Account details · ${account.name}`, exact: true }).getByRole('status').getByText('The contact was added to the account.', { exact: true })).toBeVisible();
  expect(contactBodies).toEqual([{ fullName: 'Salma Marina', email: 'salma@marina.test', phone: null, notes: null }]);

  dialog = page.getByRole('dialog', { name: `Account details · ${account.name}`, exact: true });
  await expect(dialog.getByText('Salma Marina', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Archive account', exact: true }).click();
  const archiveDialog = page.getByRole('dialog', { name: 'Review account state change', exact: true });
  await expect(archiveDialog.getByLabel('Change reason')).toBeFocused();
  await archiveDialog.getByLabel('Change reason').fill('Relationship is temporarily inactive');
  await archiveDialog.getByRole('checkbox', { name: 'I understand this changes the account’s operational visibility.', exact: true }).check();
  await archiveDialog.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(page.getByRole('dialog', { name: `Account details · ${account.name}`, exact: true }).getByRole('status').getByText('The account was archived.', { exact: true })).toBeVisible();
  expect(archiveBodies).toEqual([{ archived: true, reason: 'Relationship is temporarily inactive' }]);
});

test('property-scoped viewers receive a read-only Arabic account center on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, false);
  await mockAccountApi(page, [], [], [], []);

  await page.goto(`/crm/accounts?workspaceId=${workspaceId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مركز حسابات CRM' })).toBeVisible();
  await expect(page.getByText('عرض فقط', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء حساب', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'مراجعة الحساب', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `تفاصيل الحساب · ${account.name}`, exact: true });
  await expect(dialog.getByRole('button', { name: 'إضافة جهة اتصال', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'أرشفة الحساب', exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

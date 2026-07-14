import { expect, test, type Page, type Route } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspaceId = 'workspace-contacts-21i';
const companyId = 'company-contacts-21i';
const propertyId = 'property-contacts-21i';
const accountId = 'account-contacts-21i';
const contactId = 'contact-contacts-21i';
const duplicateContactId = 'contact-duplicate-21i';
const managerId = 'manager-contacts-21i';

const account = {
  id: accountId,
  workspaceId,
  type: 'COMPANY',
  name: 'Harbour Relationships',
  archivedAt: null,
  _count: { contacts: 2, deals: 1, activities: 2 }
};

const listContact = {
  id: contactId,
  workspaceId,
  fullName: 'Noor Al Harbour',
  email: 'noor@harbour.test',
  phone: '+96890000000',
  normalizedEmail: 'noor@harbour.test',
  normalizedPhone: '+96890000000',
  archivedAt: null as string | null,
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-14T08:00:00.000Z',
  account: { id: accountId, name: account.name, type: 'COMPANY' },
  identities: [{ id: 'identity-contact-email', type: 'EMAIL', normalizedValue: 'noor@harbour.test', verifiedAt: null }],
  channelPreferences: [{ id: 'preference-contact-email', channel: 'EMAIL', status: 'CONSENTED', lawfulBasis: 'Explicit consent', preferred: true, timezone: 'Asia/Muscat' }],
  _count: { leads: 2, primaryDeals: 1, activities: 3, deliveryAttempts: 1 }
};

const detailContact = {
  ...listContact,
  notes: 'Primary relationship owner.',
  mergedIntoContactId: null,
  leads: [{ id: 'lead-contact-21i', title: 'Harbour acquisition lead', status: 'QUALIFIED', score: 82, scoreBand: 'HOT' }],
  primaryDeals: [{ id: 'deal-contact-21i', name: 'Harbour portfolio mandate', outcome: 'OPEN', currency: 'OMR', expectedValue: '250000', stage: { id: 'stage-contact-21i', pipelineId: 'pipeline-contact-21i', key: 'QUALIFIED', name: 'Qualified', position: 20, type: 'OPEN', defaultProbability: 45, active: true } }],
  sourceEvents: [],
  primaryMergeRecords: [],
  duplicateMergeRecords: []
};

const duplicate = {
  id: duplicateContactId,
  fullName: 'Noor Harbour Duplicate',
  email: 'duplicate@harbour.test',
  phone: '+96890000001',
  reasons: ['same_normalized_name', 'same_account']
};

async function authenticate(page: Page, canManage = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-contacts-token'));
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
            memberId: 'member-contacts-21i',
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

async function mockContactApi(
  page: Page,
  queries: URL[],
  createBodies: Array<Record<string, unknown>>,
  archiveBodies: Array<Record<string, unknown>>
) {
  let archivedAt: string | null = null;
  let createdContact: typeof detailContact | null = null;
  await page.route(crmApiPattern, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === '/api/crm/accounts' && method === 'GET') {
      return route.fulfill({ json: { accounts: [account], pagination: { total: 1, take: 100, skip: 0, count: 1 } } });
    }
    if (url.pathname === '/api/crm/contacts' && method === 'GET') {
      queries.push(url);
      const records = [{ ...listContact, archivedAt }, ...(createdContact ? [createdContact] : [])];
      return route.fulfill({
        json: {
          contacts: records,
          summary: { total: 51, active: archivedAt ? 50 : 51, archived: archivedAt ? 1 : 0 },
          pagination: { total: 51, take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: records.length }
        }
      });
    }
    if (url.pathname === `/api/crm/accounts/${accountId}/contacts` && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      createBodies.push(body);
      createdContact = {
        ...detailContact,
        id: 'created-contact-21i',
        fullName: String(body.fullName),
        email: body.email as string,
        phone: body.phone as string | null,
        notes: body.notes as string | null,
        identities: [{ id: 'created-contact-identity', type: 'EMAIL', normalizedValue: String(body.email), verifiedAt: null }],
        channelPreferences: [],
        leads: [],
        primaryDeals: [],
        _count: { leads: 0, primaryDeals: 0, activities: 1, deliveryAttempts: 0 }
      };
      return route.fulfill({ status: 201, json: { contact: createdContact } });
    }
    if (url.pathname === `/api/crm/contacts/${contactId}` && method === 'GET') {
      return route.fulfill({ json: { contact: { ...detailContact, archivedAt }, duplicates: archivedAt ? [] : [duplicate], suppressions: [{ id: 'suppression-contact', channel: 'EMAIL', normalizedDestination: 'noor@harbour.test', reason: 'MANUAL', active: true }] } });
    }
    if (url.pathname === '/api/crm/contacts/created-contact-21i' && method === 'GET' && createdContact) {
      return route.fulfill({ json: { contact: createdContact, duplicates: [], suppressions: [] } });
    }
    if (url.pathname === `/api/crm/contacts/${contactId}/merge-preview` && method === 'POST') {
      return route.fulfill({
        json: {
          preview: {
            primary: { ...detailContact, accountId, userId: null, pmsTenantId: null, _count: { leads: 2, primaryDeals: 1, activities: 3, sourceEvents: 1, deliveryAttempts: 1 } },
            duplicate: { ...duplicate, workspaceId, notes: 'Duplicate notes', accountId, userId: null, pmsTenantId: null, identities: [], channelPreferences: [], _count: { leads: 0, primaryDeals: 0, activities: 1, sourceEvents: 0, deliveryAttempts: 0 } },
            conflicts: [{ field: 'fullName', primary: detailContact.fullName, duplicate: duplicate.fullName }],
            movedLinks: { leads: 0, primaryDeals: 0, activities: 1, sourceEvents: 0, deliveryAttempts: 0 },
            suggested: { fullName: detailContact.fullName, email: detailContact.email, phone: detailContact.phone, notes: detailContact.notes, accountId, userId: null, pmsTenantId: null }
          }
        }
      });
    }
    if (url.pathname === `/api/crm/contacts/${contactId}/archive` && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      archiveBodies.push(body);
      archivedAt = body.archived ? '2026-07-15T09:00:00.000Z' : null;
      return route.fulfill({ json: { contact: { ...listContact, archivedAt }, idempotent: false } });
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM contact route: ${method} ${url.pathname}` } });
  });
}

test('contact register uses server pagination and persists browsing filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockContactApi(page, queries, [], []);

  await page.goto(`/crm/contacts?workspaceId=${workspaceId}&contactPage=2`);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');
  await expect(page.getByRole('heading', { name: 'CRM contact center' })).toBeVisible();
  await expect(page.getByText(listContact.fullName, { exact: true })).toBeVisible();

  const filters = page.locator('form.crm-contacts__filters');
  await filters.getByLabel('Search contacts').fill('harbour');
  await filters.getByRole('combobox', { name: 'Account', exact: true }).selectOption(accountId);
  await filters.getByRole('combobox', { name: 'Consent status', exact: true }).selectOption('CONSENTED');
  await filters.getByRole('combobox', { name: 'State', exact: true }).selectOption('ALL');
  await filters.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('updatedAt');
  await filters.getByRole('combobox', { name: 'Direction', exact: true }).selectOption('desc');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/contactQ=harbour/);
  await expect(page).toHaveURL(new RegExp(`contactAccount=${accountId}`));
  await expect(page).toHaveURL(/contactConsent=CONSENTED/);
  await expect(page).toHaveURL(/contactStatus=ALL/);
  await expect(page).toHaveURL(/contactSort=updatedAt/);
  await expect(page).toHaveURL(/contactDirection=desc/);
  await expect(page).not.toHaveURL(/contactPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('harbour');
  await expect.poll(() => queries.at(-1)?.searchParams.get('accountId')).toBe(accountId);
  await expect.poll(() => queries.at(-1)?.searchParams.get('consentStatus')).toBe('CONSENTED');
  await expect.poll(() => queries.at(-1)?.searchParams.get('status')).toBe('ALL');
  await expect.poll(() => queries.at(-1)?.searchParams.get('sortBy')).toBe('updatedAt');
  await expect.poll(() => queries.at(-1)?.searchParams.get('direction')).toBe('desc');

  await page.reload();
  await expect(filters.getByLabel('Search contacts')).toHaveValue('harbour');
  await expect(filters.getByRole('combobox', { name: 'Consent status', exact: true })).toHaveValue('CONSENTED');
});

test('contact creation, duplicate review, and archival use governed accessible flows', async ({ page }) => {
  const createBodies: Array<Record<string, unknown>> = [];
  const archiveBodies: Array<Record<string, unknown>> = [];
  await authenticate(page);
  await mockContactApi(page, [], createBodies, archiveBodies);

  await page.goto(`/crm/contacts?workspaceId=${workspaceId}`);
  const createTrigger = page.getByRole('button', { name: 'Add contact', exact: true });
  await createTrigger.click();
  let dialog = page.getByRole('dialog', { name: 'Add governed CRM contact', exact: true });
  await expect(dialog.getByLabel('Full name')).toBeFocused();
  await expect(dialog.getByRole('combobox', { name: 'Account', exact: true })).toHaveValue(accountId);
  await dialog.getByLabel('Full name').fill('Salma Marina');
  await dialog.getByLabel('Email').fill('salma@marina.test');
  await dialog.getByLabel('Notes').fill('New relationship contact');
  await dialog.getByRole('button', { name: 'Save contact', exact: true }).click();
  await expect(page.getByRole('status').getByText('The contact was added to the account.', { exact: true })).toBeVisible();
  expect(createBodies).toEqual([{ fullName: 'Salma Marina', email: 'salma@marina.test', phone: null, notes: 'New relationship contact' }]);
  await expect(createTrigger).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Salma Marina', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Back to contact register', exact: true }).click();
  await page.getByRole('button', { name: 'Review contact', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: listContact.fullName, exact: true })).toBeVisible();
  const mergeTrigger = page.getByRole('button', { name: 'Review merge', exact: true });
  await mergeTrigger.click();
  dialog = page.getByRole('dialog', { name: 'Review contact merge', exact: true });
  await expect(dialog.getByRole('heading', { name: duplicate.fullName, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(mergeTrigger).toBeFocused();

  await page.getByRole('button', { name: 'Archive contact', exact: true }).click();
  const archiveDialog = page.getByRole('dialog', { name: 'Review contact state change', exact: true });
  await expect(archiveDialog.getByLabel('Change reason')).toBeFocused();
  await archiveDialog.getByLabel('Change reason').fill('Relationship is temporarily inactive');
  await archiveDialog.getByRole('checkbox', { name: 'I understand this changes the contact’s operational visibility without deleting linked records.', exact: true }).check();
  await archiveDialog.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(page.getByRole('status').getByText('The contact was archived.', { exact: true })).toBeVisible();
  expect(archiveBodies).toEqual([{ archived: true, reason: 'Relationship is temporarily inactive' }]);
  await expect(page.getByRole('button', { name: 'Restore contact', exact: true })).toBeVisible();
});

test('property-scoped viewers receive a read-only Arabic contact center on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, false);
  await mockContactApi(page, [], [], []);

  await page.goto(`/crm/contacts?workspaceId=${workspaceId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مركز جهات اتصال CRM' })).toBeVisible();
  await expect(page.getByText('عرض فقط', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إضافة جهة اتصال', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'مراجعة جهة الاتصال', exact: true }).click();
  await expect(page.getByRole('heading', { name: listContact.fullName, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'مراجعة الدمج', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'أرشفة جهة الاتصال', exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

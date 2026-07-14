import { expect, test, type Page, type Route } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspaceId = 'workspace-communications-21i';
const companyId = 'company-communications-21i';
const contactId = 'contact-communications-21i';
const templateVersionId = 'template-version-communications-21i';

const contact = {
  id: contactId,
  workspaceId,
  fullName: 'Noor Al Harbour',
  email: 'noor@harbour.test',
  phone: '+96890000000',
  normalizedEmail: 'noor@harbour.test',
  normalizedPhone: '+96890000000',
  updatedAt: '2026-07-14T08:00:00.000Z',
  account: { id: 'account-harbour', name: 'Harbour Residences', type: 'PROPERTY_OWNER' },
  identities: [
    { id: 'identity-email', type: 'EMAIL', normalizedValue: 'noor@harbour.test', verifiedAt: '2026-07-01T00:00:00.000Z' },
    { id: 'identity-phone', type: 'PHONE', normalizedValue: '+96890000000', verifiedAt: null }
  ],
  channelPreferences: [
    { id: 'preference-email', channel: 'EMAIL', status: 'CONSENTED', lawfulBasis: 'Explicit relationship consent', preferred: true, timezone: 'Asia/Muscat' }
  ]
};

const template = {
  id: 'template-communications-21i',
  workspaceId,
  key: 'relationship-follow-up',
  name: 'Relationship follow-up',
  channel: 'EMAIL',
  active: true,
  updatedAt: '2026-07-14T08:00:00.000Z',
  versions: [{
    id: templateVersionId,
    templateId: 'template-communications-21i',
    version: 2,
    subject: 'Harbour relationship follow-up',
    body: 'Thank you for speaking with the lux.om relationship team.',
    active: true,
    createdAt: '2026-07-14T08:00:00.000Z'
  }]
};

const listAttempt = {
  id: 'delivery-attempt-list-21i',
  workspaceId,
  contactId,
  leadId: null,
  dealId: null,
  activityId: null,
  templateVersionId,
  channel: 'EMAIL',
  provider: 'DRAFT_ONLY',
  status: 'DRAFT',
  destination: 'noor@harbour.test',
  normalizedDestination: 'noor@harbour.test',
  idempotencyKey: 'fixture-register-21i',
  providerMessageId: null,
  errorCode: null,
  errorMessage: null,
  metadata: { subject: 'Harbour relationship follow-up', body: 'A governed communication draft.' },
  attemptedAt: '2026-07-14T08:00:00.000Z',
  submittedAt: null,
  providerConfirmedAt: null,
  deliveredAt: null,
  failedAt: null,
  bouncedAt: null,
  blockedAt: null,
  contact: { id: contactId, fullName: contact.fullName, email: contact.email, phone: contact.phone },
  lead: null,
  deal: null,
  activity: null,
  templateVersion: { ...template.versions[0], template: { id: template.id, key: template.key, name: template.name, channel: template.channel } }
};

async function authenticate(page: Page, canManage = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-communications-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: 'crm-communications-user',
        name: 'CRM Communications User',
        email: 'crm-communications@lux.test',
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
            memberId: 'member-communications-21i',
            role: canManage ? 'MANAGER' : 'VIEWER',
            nameEn: 'Harbour CRM',
            nameAr: 'إدارة علاقات هاربور',
            canView: true,
            canManage,
            canAssign: canManage,
            canManageWorkspace: canManage,
            propertyScope: { allProperties: true, propertyIds: [] }
          }],
          workspaces: [{
            workspaceId,
            type: 'COMPANY',
            companyId,
            personalOwnerUserId: null,
            canView: true,
            canManage,
            propertyScope: { allProperties: true, propertyIds: [] }
          }]
        }
      }
    }
  }));
  await mockNotificationsApi(page);
}

async function mockCommunicationApi(
  page: Page,
  queries: URL[],
  postBodies: Array<Record<string, unknown>>
) {
  await page.route(crmApiPattern, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.endsWith('/api/crm/delivery-attempts') && method === 'GET') {
      queries.push(url);
      return route.fulfill({
        json: {
          attempts: [listAttempt],
          pagination: { total: 51, take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1 }
        }
      });
    }
    if (url.pathname.endsWith('/api/crm/delivery-attempts') && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      postBodies.push(body);
      const status = body.provider === 'VERIFIED_EMAIL' ? 'QUEUED' : 'DRAFT';
      return route.fulfill({
        status: 201,
        json: {
          attempt: {
            ...listAttempt,
            id: `created-attempt-${postBodies.length}`,
            provider: body.provider,
            channel: body.channel,
            status,
            destination: body.destination,
            normalizedDestination: body.destination,
            idempotencyKey: body.idempotencyKey,
            templateVersionId: body.templateVersionId,
            metadata: { subject: body.subject, body: body.body },
            attemptedAt: '2026-07-14T09:00:00.000Z'
          },
          deliveryConfirmed: false
        }
      });
    }
    if (url.pathname.endsWith('/api/crm/contacts') && method === 'GET') {
      return route.fulfill({ json: { contacts: [contact], pagination: { total: 1, take: 50, skip: 0, count: 1 } } });
    }
    if (url.pathname.endsWith('/api/crm/communication-templates') && method === 'GET') {
      return route.fulfill({ json: { templates: [template] } });
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM communication route: ${method} ${url.pathname}` } });
  });
}

test('communication register uses server pagination and persists browsing filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockCommunicationApi(page, queries, []);

  await page.goto(`/crm/communications?workspaceId=${workspaceId}&communicationPage=2`);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');
  await expect(page.getByRole('heading', { name: 'CRM communications center' })).toBeVisible();
  await expect(page.getByText(contact.fullName, { exact: true })).toBeVisible();

  const filters = page.locator('form.crm-communications__filters');
  await filters.getByLabel('Search name, destination, or template').fill('harbour');
  await filters.getByRole('combobox', { name: 'Status', exact: true }).selectOption('DRAFT');
  await filters.getByRole('combobox', { name: 'Channel', exact: true }).selectOption('EMAIL');
  await filters.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('DRAFT_ONLY');
  await filters.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('channel');
  await filters.getByRole('combobox', { name: 'Direction', exact: true }).selectOption('asc');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/communicationQ=harbour/);
  await expect(page).toHaveURL(/communicationStatus=DRAFT/);
  await expect(page).toHaveURL(/communicationChannel=EMAIL/);
  await expect(page).toHaveURL(/communicationProvider=DRAFT_ONLY/);
  await expect(page).toHaveURL(/communicationSort=channel/);
  await expect(page).toHaveURL(/communicationDirection=asc/);
  await expect(page).not.toHaveURL(/communicationPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('harbour');
  await expect.poll(() => queries.at(-1)?.searchParams.get('status')).toBe('DRAFT');
  await expect.poll(() => queries.at(-1)?.searchParams.get('channel')).toBe('EMAIL');
  await expect.poll(() => queries.at(-1)?.searchParams.get('provider')).toBe('DRAFT_ONLY');
  await expect.poll(() => queries.at(-1)?.searchParams.get('sortBy')).toBe('channel');
  await expect.poll(() => queries.at(-1)?.searchParams.get('direction')).toBe('asc');

  await page.reload();
  await expect(filters.getByLabel('Search name, destination, or template')).toHaveValue('harbour');
  await expect(filters.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('DRAFT');
});

test('draft and queued email creation use an accessible governed composer', async ({ page }) => {
  const postBodies: Array<Record<string, unknown>> = [];
  await authenticate(page);
  await mockCommunicationApi(page, [], postBodies);

  await page.goto(`/crm/communications?workspaceId=${workspaceId}`);
  const trigger = page.getByRole('button', { name: 'Create communication', exact: true });
  await trigger.click();

  let dialog = page.getByRole('dialog', { name: 'Create governed communication', exact: true });
  await expect(dialog.getByLabel('Find contact')).toBeFocused();
  await expect(dialog.getByRole('combobox', { name: /^Contact(?:$|\s)/ })).toHaveValue(contactId);
  await dialog.getByLabel('Optional template').selectOption(templateVersionId);
  await expect(dialog.getByLabel('Subject')).toHaveValue(template.versions[0].subject);
  await expect(dialog.getByLabel('Message body')).toHaveValue(template.versions[0].body);
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();

  await expect(dialog.getByRole('heading', { name: 'The governed draft was saved.', exact: true })).toBeVisible();
  await expect(dialog.getByText('Draft', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(trigger).toBeFocused();

  await trigger.click();
  dialog = page.getByRole('dialog', { name: 'Create governed communication', exact: true });
  await dialog.getByLabel('Optional template').selectOption(templateVersionId);
  await dialog.getByLabel('Delivery mode').selectOption('VERIFIED_EMAIL');
  const queueButton = dialog.getByRole('button', { name: 'Queue verified email', exact: true });
  await expect(queueButton).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /I understand that queueing this email/ }).check();
  await expect(queueButton).toBeEnabled();
  await queueButton.click();

  await expect(dialog.getByRole('heading', { name: 'A queued attempt was created. Delivery is not confirmed.', exact: true })).toBeVisible();
  await expect(dialog.getByText('Queued', { exact: true })).toBeVisible();
  expect(postBodies).toHaveLength(2);
  expect(postBodies[0]).toMatchObject({
    workspaceId,
    contactId,
    templateVersionId,
    channel: 'EMAIL',
    provider: 'DRAFT_ONLY',
    destination: contact.email,
    subject: template.versions[0].subject,
    body: template.versions[0].body
  });
  expect(postBodies[1]).toMatchObject({ provider: 'VERIFIED_EMAIL', destination: contact.email });
  expect(String(postBodies[0].idempotencyKey)).toMatch(/^crm-communications-ui:/);
  expect(postBodies[1].idempotencyKey).not.toBe(postBodies[0].idempotencyKey);
});

test('property-scoped viewers receive a read-only Arabic communication register on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, false);
  await mockCommunicationApi(page, [], []);

  await page.goto(`/crm/communications?workspaceId=${workspaceId}`);

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مركز تواصل CRM' })).toBeVisible();
  await expect(page.getByText('عرض فقط', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء تواصل', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('بحث بالاسم أو الوجهة أو القالب')).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

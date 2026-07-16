import { expect, test, type Page, type Route } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';
import type { CrmCommunicationPolicy, CrmCommunicationTemplate, CrmSuppressionEntry } from '../src/api/crmAdvanced';

const workspaceId = 'workspace-communication-governance-21i';
const companyId = 'company-communication-governance-21i';
const propertyId = 'property-communication-governance-21i';
const managerId = 'manager-communication-governance-21i';

const basePolicy: CrmCommunicationPolicy = {
  workspaceId,
  timezone: 'Asia/Muscat',
  quietHoursStart: 1200,
  quietHoursEnd: 480,
  hourlyRateLimit: 50,
  retentionDays: 365
};

const suppression: CrmSuppressionEntry = {
  id: 'suppression-governance-21i',
  workspaceId,
  channel: 'EMAIL',
  normalizedDestination: 'blocked@harbour.test',
  reason: 'OPT_OUT',
  active: true,
  source: 'Preference center',
  notes: 'Explicit opt-out',
  expiresAt: null,
  createdAt: '2026-07-14T08:00:00.000Z',
  updatedAt: '2026-07-15T08:00:00.000Z'
};

const template: CrmCommunicationTemplate = {
  id: 'template-governance-21i',
  workspaceId,
  key: 'relationship-follow-up',
  name: 'Relationship follow-up',
  channel: 'EMAIL',
  active: true,
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-15T08:00:00.000Z',
  versions: [{
    id: 'template-version-governance-21i',
    templateId: 'template-governance-21i',
    version: 1,
    subject: 'Follow-up',
    body: 'Governed follow-up',
    active: true,
    createdAt: '2026-07-13T08:00:00.000Z',
    _count: { deliveryAttempts: 4 }
  }]
};

async function authenticate(page: Page, canConfigure = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-communication-governance-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: managerId,
        name: 'Maha Manager',
        email: 'maha@governance.test',
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
            memberId: 'member-communication-governance-21i',
            role: canConfigure ? 'MANAGER' : 'VIEWER',
            nameEn: 'Harbour CRM',
            nameAr: 'إدارة علاقات هاربور',
            canView: true,
            canManage: canConfigure,
            canAssign: canConfigure,
            canManageWorkspace: canConfigure,
            propertyScope: { allProperties: false, propertyIds: [propertyId] }
          }],
          workspaces: [{
            workspaceId,
            type: 'COMPANY',
            companyId,
            personalOwnerUserId: null,
            canView: true,
            canManage: canConfigure,
            propertyScope: { allProperties: false, propertyIds: [propertyId] }
          }]
        }
      }
    }
  }));
  await mockNotificationsApi(page);
}

async function mockGovernanceApi(
  page: Page,
  queries: { suppressions: URL[]; templates: URL[] },
  bodies: {
    policies: Array<Record<string, unknown>>;
    suppressions: Array<Record<string, unknown>>;
    templates: Array<Record<string, unknown>>;
    versions: Array<Record<string, unknown>>;
    archives: Array<Record<string, unknown>>;
  }
) {
  let policy: CrmCommunicationPolicy = structuredClone(basePolicy);
  let suppressions: CrmSuppressionEntry[] = [structuredClone(suppression)];
  let templates: CrmCommunicationTemplate[] = [structuredClone(template)];

  await page.route(crmApiPattern, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === '/api/crm/communication-policy' && method === 'GET') {
      return route.fulfill({ json: { policy } });
    }
    if (url.pathname === '/api/crm/communication-policy' && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      bodies.policies.push(body);
      policy = {
        ...policy,
        timezone: String(body.timezone),
        quietHoursStart: Number(body.quietHoursStart),
        quietHoursEnd: Number(body.quietHoursEnd),
        hourlyRateLimit: Number(body.hourlyRateLimit),
        retentionDays: Number(body.retentionDays)
      };
      return route.fulfill({ json: { policy } });
    }
    if (url.pathname === '/api/crm/suppressions' && method === 'GET') {
      queries.suppressions.push(url);
      return route.fulfill({
        json: {
          suppressions,
          summary: {
            total: suppressions.length,
            active: suppressions.filter((item) => item.active).length,
            inactive: suppressions.filter((item) => !item.active).length
          },
          pagination: {
            total: 41,
            take: Number(url.searchParams.get('take') ?? 20),
            skip: Number(url.searchParams.get('skip') ?? 0),
            count: suppressions.length
          }
        }
      });
    }
    if (url.pathname === '/api/crm/suppressions' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      bodies.suppressions.push(body);
      const entry = {
        ...suppression,
        id: 'suppression-created-21i',
        channel: String(body.channel) as CrmSuppressionEntry['channel'],
        normalizedDestination: String(body.normalizedDestination).toLowerCase(),
        reason: String(body.reason) as CrmSuppressionEntry['reason'],
        active: Boolean(body.active),
        source: body.source == null ? null : String(body.source),
        notes: body.notes == null ? null : String(body.notes),
        expiresAt: body.expiresAt == null ? null : String(body.expiresAt),
        updatedAt: '2026-07-16T08:00:00.000Z'
      };
      suppressions = [entry];
      return route.fulfill({ status: 201, json: { suppression: entry } });
    }
    if (url.pathname === '/api/crm/communication-templates' && method === 'GET') {
      queries.templates.push(url);
      return route.fulfill({
        json: {
          templates,
          summary: {
            total: templates.length,
            active: templates.filter((item) => item.active).length,
            archived: templates.filter((item) => !item.active).length,
            versions: templates.reduce((sum, item) => sum + item.versions.length, 0)
          },
          pagination: {
            total: 23,
            take: Number(url.searchParams.get('take') ?? 20),
            skip: Number(url.searchParams.get('skip') ?? 0),
            count: templates.length
          }
        }
      });
    }
    if (url.pathname === '/api/crm/communication-templates' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      bodies.templates.push(body);
      const created = {
        ...template,
        id: 'template-created-21i',
        key: String(body.key),
        name: String(body.name),
        channel: String(body.channel) as CrmCommunicationTemplate['channel'],
        versions: [{
          ...template.versions[0],
          id: 'template-version-created-21i',
          templateId: 'template-created-21i',
          subject: body.subject == null ? null : String(body.subject),
          body: String(body.body),
          _count: { deliveryAttempts: 0 }
        }]
      };
      templates = [created];
      return route.fulfill({ status: 201, json: { template: created } });
    }
    if (url.pathname.endsWith('/versions') && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      bodies.versions.push(body);
      const version = {
        ...template.versions[0],
        id: 'template-version-second-21i',
        templateId: url.pathname.split('/')[4],
        version: 2,
        subject: body.subject == null ? null : String(body.subject),
        body: String(body.body),
        createdAt: '2026-07-16T09:00:00.000Z',
        _count: { deliveryAttempts: 0 }
      };
      templates = templates.map((item) => item.id === version.templateId
        ? { ...item, versions: [version, ...item.versions], updatedAt: version.createdAt }
        : item);
      return route.fulfill({ status: 201, json: { version } });
    }
    if (url.pathname.endsWith('/archive') && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      bodies.archives.push(body);
      const templateId = url.pathname.split('/')[4];
      templates = templates.map((item) => item.id === templateId ? { ...item, active: !body.archived } : item);
      const updated = templates.find((item) => item.id === templateId);
      return route.fulfill({ json: { template: updated, idempotent: false } });
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM governance route: ${method} ${url.pathname}` } });
  });
}

test('communication governance registers use server pagination and URL-persisted filters', async ({ page }) => {
  const queries = { suppressions: [] as URL[], templates: [] as URL[] };
  await authenticate(page);
  await mockGovernanceApi(page, queries, { policies: [], suppressions: [], templates: [], versions: [], archives: [] });

  await page.goto(`/crm/settings/communications?workspaceId=${workspaceId}&communicationGovernanceTab=suppressions&suppressionPage=2`);
  await expect.poll(() => queries.suppressions.at(-1)?.searchParams.get('skip')).toBe('20');
  await expect(page.getByRole('heading', { name: 'CRM communication governance center' })).toBeVisible();
  await expect(page.getByText(suppression.normalizedDestination, { exact: true })).toBeVisible();

  const suppressionFilters = page.locator('form.crm-communication-settings__filters').first();
  await suppressionFilters.getByLabel('Search suppressions').fill('blocked');
  await suppressionFilters.getByRole('combobox', { name: 'Channel', exact: true }).selectOption('EMAIL');
  await suppressionFilters.getByRole('combobox', { name: 'Reason', exact: true }).selectOption('OPT_OUT');
  await suppressionFilters.getByRole('combobox', { name: 'State', exact: true }).selectOption('ACTIVE');
  await suppressionFilters.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('normalizedDestination');
  await suppressionFilters.getByRole('combobox', { name: 'Direction', exact: true }).selectOption('asc');
  await suppressionFilters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/suppressionQ=blocked/);
  await expect(page).toHaveURL(/suppressionChannel=EMAIL/);
  await expect(page).toHaveURL(/suppressionReason=OPT_OUT/);
  await expect(page).toHaveURL(/suppressionStatus=ACTIVE/);
  await expect(page).toHaveURL(/suppressionSort=normalizedDestination/);
  await expect(page).toHaveURL(/suppressionDirection=asc/);
  await expect(page).not.toHaveURL(/suppressionPage=2/);
  await expect.poll(() => queries.suppressions.at(-1)?.searchParams.get('search')).toBe('blocked');

  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  const templateFilters = page.locator('form.crm-communication-settings__filters--templates');
  await templateFilters.getByLabel('Search templates').fill('relationship');
  await templateFilters.getByRole('combobox', { name: 'Channel', exact: true }).selectOption('EMAIL');
  await templateFilters.getByRole('combobox', { name: 'State', exact: true }).selectOption('ACTIVE');
  await templateFilters.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('updatedAt');
  await templateFilters.getByRole('combobox', { name: 'Direction', exact: true }).selectOption('desc');
  await templateFilters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/communicationGovernanceTab=templates/);
  await expect(page).toHaveURL(/templateQ=relationship/);
  await expect(page).toHaveURL(/templateChannel=EMAIL/);
  await expect(page).toHaveURL(/templateStatus=ACTIVE/);
  await expect(page).toHaveURL(/templateSort=updatedAt/);
  await expect(page).toHaveURL(/templateDirection=desc/);
  await expect.poll(() => queries.templates.at(-1)?.searchParams.get('search')).toBe('relationship');

  await page.reload();
  await expect(templateFilters.getByLabel('Search templates')).toHaveValue('relationship');
  await expect(templateFilters.getByRole('combobox', { name: 'State', exact: true })).toHaveValue('ACTIVE');
});

test('policy, suppression, and immutable template mutations use governed accessible dialogs', async ({ page }) => {
  const queries = { suppressions: [] as URL[], templates: [] as URL[] };
  const bodies = {
    policies: [] as Array<Record<string, unknown>>,
    suppressions: [] as Array<Record<string, unknown>>,
    templates: [] as Array<Record<string, unknown>>,
    versions: [] as Array<Record<string, unknown>>,
    archives: [] as Array<Record<string, unknown>>
  };
  await authenticate(page);
  await mockGovernanceApi(page, queries, bodies);

  await page.goto(`/crm/settings/communications?workspaceId=${workspaceId}`);

  const policyTrigger = page.getByRole('button', { name: 'Edit policy', exact: true });
  await policyTrigger.click();
  let dialog = page.getByRole('dialog', { name: 'Edit policy', exact: true });
  await expect(dialog.getByLabel('Timezone')).toBeFocused();
  await dialog.getByLabel('Hourly limit').fill('75');
  await dialog.getByLabel('Retention').fill('730');
  await dialog.getByRole('button', { name: 'Save policy', exact: true }).click();
  await expect(page.getByRole('status').getByText('The communication policy was updated.', { exact: true })).toBeVisible();
  await expect(policyTrigger).toBeFocused();
  expect(bodies.policies[0]).toMatchObject({ workspaceId, hourlyRateLimit: 75, retentionDays: 730 });

  await page.getByRole('button', { name: 'Suppressions', exact: true }).click();
  const suppressionTrigger = page.getByRole('button', { name: 'Add suppression', exact: true });
  await suppressionTrigger.click();
  dialog = page.getByRole('dialog', { name: 'Add suppression', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Destination', exact: true })).toBeFocused();
  await dialog.getByRole('textbox', { name: 'Destination', exact: true }).fill('blocked-new@harbour.test');
  await dialog.getByRole('combobox', { name: 'Reason', exact: true }).selectOption('LEGAL');
  await dialog.getByLabel('Source').fill('Legal review');
  await dialog.getByLabel('Notes').fill('Restricted by counsel');
  await dialog.getByRole('button', { name: 'Save suppression', exact: true }).click();
  await expect(page.getByRole('status').getByText('The suppression entry was saved.', { exact: true })).toBeVisible();
  await expect(suppressionTrigger).toBeFocused();
  expect(bodies.suppressions[0]).toMatchObject({
    workspaceId,
    channel: 'EMAIL',
    normalizedDestination: 'blocked-new@harbour.test',
    reason: 'LEGAL',
    active: true,
    source: 'Legal review',
    notes: 'Restricted by counsel'
  });

  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  const createTrigger = page.getByRole('button', { name: 'Create template', exact: true });
  await createTrigger.click();
  dialog = page.getByRole('dialog', { name: 'Create template', exact: true });
  await expect(dialog.getByLabel('Template key')).toBeFocused();
  await dialog.getByLabel('Template key').fill('investor-review');
  await dialog.getByLabel('Name').fill('Investor review');
  await dialog.getByLabel('Subject').fill('Investment review');
  await dialog.getByLabel('Message body').fill('Version one governed content');
  await dialog.getByRole('button', { name: 'Create template', exact: true }).click();
  await expect(page.getByRole('status').getByText('The communication template was created.', { exact: true })).toBeVisible();
  expect(bodies.templates).toEqual([{
    workspaceId,
    key: 'investor-review',
    name: 'Investor review',
    channel: 'EMAIL',
    subject: 'Investment review',
    body: 'Version one governed content'
  }]);

  const reviewTrigger = page.getByRole('button', { name: 'Review template: Investor review', exact: true });
  await reviewTrigger.click();
  dialog = page.getByRole('dialog', { name: 'Review template · Investor review', exact: true });
  await expect(dialog.getByText('v1', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Delivery attempts: 0', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(reviewTrigger).toBeFocused();

  const versionTrigger = page.getByRole('button', { name: 'New version: Investor review', exact: true });
  await versionTrigger.click();
  dialog = page.getByRole('dialog', { name: 'New version · Investor review', exact: true });
  await expect(dialog.getByLabel('Message body')).toBeFocused();
  await dialog.getByLabel('Subject').fill('Investment review approved');
  await dialog.getByLabel('Message body').fill('Version two immutable content');
  await dialog.getByRole('button', { name: 'New version', exact: true }).click();
  await expect(page.getByRole('status').getByText('An immutable template version was stored.', { exact: true })).toBeVisible();
  expect(bodies.versions).toEqual([{ subject: 'Investment review approved', body: 'Version two immutable content' }]);

  const archiveTrigger = page.getByRole('button', { name: 'Archive: Investor review', exact: true });
  await archiveTrigger.click();
  dialog = page.getByRole('dialog', { name: 'Archive · Investor review', exact: true });
  await expect(dialog.getByLabel('Lifecycle reason')).toBeFocused();
  await dialog.getByLabel('Lifecycle reason').fill('Campaign completed');
  await dialog.getByRole('checkbox', { name: /historical versions remain preserved/ }).check();
  await dialog.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(page.getByRole('status').getByText('The template was archived.', { exact: true })).toBeVisible();
  expect(bodies.archives).toEqual([{ archived: true, reason: 'Campaign completed' }]);
  await expect(page.getByRole('button', { name: 'New version: Investor review', exact: true })).toHaveCount(0);
});

test('property-scoped viewers receive an Arabic read-only governance boundary without workspace-wide requests', async ({ page }) => {
  const requests: string[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, false);
  await page.route(crmApiPattern, (route) => {
    requests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 403, json: { message: 'Workspace-level configuration is unavailable.' } });
  });

  await page.goto(`/crm/settings/communications?workspaceId=${workspaceId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مركز حوكمة تواصل CRM' })).toBeVisible();
  await expect(page.getByText('إعدادات على مستوى مساحة العمل', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تعديل السياسة', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'أقسام حوكمة التواصل' })).toHaveCount(0);
  await expect.poll(() => requests).toEqual([]);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

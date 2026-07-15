import { expect, test, type Page, type Route } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspaceId = 'workspace-pipelines-21i';
const companyId = 'company-pipelines-21i';
const propertyId = 'property-pipelines-21i';
const pipelineId = 'pipeline-partner-21i';
const managerId = 'manager-pipelines-21i';

const baseStages = [
  { id: 'stage-discovery-21i', pipelineId, key: 'DISCOVERY', name: 'Discovery', position: 10, type: 'OPEN', defaultProbability: 20, requiredFields: [], slaHours: 72, active: true, archivedAt: null, _count: { deals: 0, leads: 2 } },
  { id: 'stage-won-21i', pipelineId, key: 'WON', name: 'Won', position: 20, type: 'WON', defaultProbability: 100, requiredFields: ['expectedValue', 'currency'], slaHours: null, active: true, archivedAt: null, _count: { deals: 1, leads: 0 } },
  { id: 'stage-lost-21i', pipelineId, key: 'LOST', name: 'Lost', position: 30, type: 'LOST', defaultProbability: 0, requiredFields: [], slaHours: null, active: true, archivedAt: null, _count: { deals: 0, leads: 0 } }
];

const pipeline = {
  id: pipelineId,
  workspaceId,
  name: 'Partner revenue pipeline',
  description: 'Governed partner opportunities',
  isDefault: false,
  active: true,
  archivedAt: null as string | null,
  createdAt: '2026-07-10T08:00:00.000Z',
  updatedAt: '2026-07-14T08:00:00.000Z',
  stages: baseStages,
  _count: { deals: 1, leads: 2 },
  lifecycleActivities: [] as Array<Record<string, unknown>>
};

async function authenticate(page: Page, canConfigure = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-pipelines-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: managerId,
        name: 'Maha Manager',
        email: 'maha@pipelines.test',
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
            memberId: 'member-pipelines-21i',
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

async function mockPipelineApi(
  page: Page,
  queries: URL[],
  createBodies: Array<Record<string, unknown>>,
  updateBodies: Array<Record<string, unknown>>,
  stageBodies: Array<Record<string, unknown>>,
  archiveBodies: Array<Record<string, unknown>>
) {
  let current = structuredClone(pipeline);
  await page.route(crmApiPattern, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === '/api/crm/pipelines' && method === 'GET') {
      queries.push(url);
      return route.fulfill({
        json: {
          pipelines: [current],
          summary: { total: 41, active: current.archivedAt ? 40 : 41, archived: current.archivedAt ? 1 : 0, defaults: 1 },
          pagination: { total: 41, take: Number(url.searchParams.get('take') ?? 20), skip: Number(url.searchParams.get('skip') ?? 0), count: 1 }
        }
      });
    }
    if (url.pathname === '/api/crm/pipelines' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      createBodies.push(body);
      return route.fulfill({ status: 201, json: { pipeline: { ...current, id: 'created-pipeline-21i', ...body, _count: { deals: 0, leads: 0 } } } });
    }
    if (url.pathname === `/api/crm/pipelines/${pipelineId}` && method === 'GET') {
      return route.fulfill({ json: { pipeline: current } });
    }
    if (url.pathname === `/api/crm/pipelines/${pipelineId}` && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      updateBodies.push(body);
      current = { ...current, ...body, updatedAt: '2026-07-15T08:00:00.000Z' };
      return route.fulfill({ json: { pipeline: current } });
    }
    if (url.pathname === `/api/crm/pipeline-stages/${baseStages[0].id}` && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      stageBodies.push(body);
      const nextStage = { ...current.stages[0], ...body };
      current = { ...current, stages: [nextStage, ...current.stages.slice(1)] };
      return route.fulfill({ json: { stage: nextStage } });
    }
    if (url.pathname === `/api/crm/pipelines/${pipelineId}/archive` && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      archiveBodies.push(body);
      current = {
        ...current,
        active: !body.archived,
        archivedAt: body.archived ? '2026-07-15T09:00:00.000Z' : null,
        lifecycleActivities: [{ id: 'activity-pipeline-21i', subject: body.archived ? `CRM pipeline archived:${pipelineId}` : `CRM pipeline restored:${pipelineId}`, body: body.reason, createdAt: '2026-07-15T09:00:00.000Z', createdBy: { id: managerId, name: 'Maha Manager', email: 'maha@pipelines.test' } }]
      };
      return route.fulfill({ json: { pipeline: current, idempotent: false } });
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM pipeline route: ${method} ${url.pathname}` } });
  });
}

test('pipeline register uses server pagination and persists browsing filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockPipelineApi(page, queries, [], [], [], []);

  await page.goto(`/crm/settings/pipelines?workspaceId=${workspaceId}&pipelinePage=2`);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('20');
  await expect(page.getByRole('heading', { name: 'CRM pipeline center' })).toBeVisible();
  await expect(page.getByText(pipeline.name, { exact: true })).toBeVisible();

  const filters = page.locator('form.crm-pipelines__filters');
  await filters.getByLabel('Search pipelines').fill('partner');
  await filters.getByRole('combobox', { name: 'State', exact: true }).selectOption('ALL');
  await filters.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('updatedAt');
  await filters.getByRole('combobox', { name: 'Direction', exact: true }).selectOption('desc');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/pipelineQ=partner/);
  await expect(page).toHaveURL(/pipelineStatus=ALL/);
  await expect(page).toHaveURL(/pipelineSort=updatedAt/);
  await expect(page).toHaveURL(/pipelineDirection=desc/);
  await expect(page).not.toHaveURL(/pipelinePage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('partner');
  await expect.poll(() => queries.at(-1)?.searchParams.get('status')).toBe('ALL');
  await expect.poll(() => queries.at(-1)?.searchParams.get('sortBy')).toBe('updatedAt');
  await expect.poll(() => queries.at(-1)?.searchParams.get('direction')).toBe('desc');

  await page.reload();
  await expect(filters.getByLabel('Search pipelines')).toHaveValue('partner');
  await expect(filters.getByRole('combobox', { name: 'State', exact: true })).toHaveValue('ALL');
});

test('pipeline creation, stage editing, and archival use governed accessible dialogs', async ({ page }) => {
  const createBodies: Array<Record<string, unknown>> = [];
  const updateBodies: Array<Record<string, unknown>> = [];
  const stageBodies: Array<Record<string, unknown>> = [];
  const archiveBodies: Array<Record<string, unknown>> = [];
  await authenticate(page);
  await mockPipelineApi(page, [], createBodies, updateBodies, stageBodies, archiveBodies);

  await page.goto(`/crm/settings/pipelines?workspaceId=${workspaceId}`);
  const createTrigger = page.getByRole('button', { name: 'Create pipeline', exact: true });
  await createTrigger.click();
  let dialog = page.getByRole('dialog', { name: 'Create governed CRM pipeline', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Pipeline', exact: true })).toBeFocused();
  await dialog.getByRole('textbox', { name: 'Pipeline', exact: true }).fill('Investor growth pipeline');
  await dialog.getByLabel('Description').fill('Governed investor opportunities');
  await dialog.getByRole('checkbox', { name: 'Make this the default pipeline', exact: true }).check();
  await dialog.getByRole('button', { name: 'Save pipeline', exact: true }).click();
  await expect(page.getByRole('status').getByText('The CRM pipeline was created.', { exact: true })).toBeVisible();
  expect(createBodies).toHaveLength(1);
  expect(createBodies[0]).toMatchObject({ workspaceId, name: 'Investor growth pipeline', description: 'Governed investor opportunities', isDefault: true });
  expect((createBodies[0].stages as unknown[])).toHaveLength(5);
  await expect(createTrigger).toBeFocused();

  await page.getByRole('button', { name: 'Review pipeline', exact: true }).click();
  dialog = page.getByRole('dialog', { name: `Pipeline details · ${pipeline.name}`, exact: true });
  await expect(dialog.getByRole('heading', { name: 'Stages', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit pipeline metadata', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit pipeline metadata', exact: true });
  await expect(editDialog.getByRole('textbox', { name: 'Pipeline', exact: true })).toBeFocused();
  await editDialog.getByRole('textbox', { name: 'Pipeline', exact: true }).fill('Partner growth pipeline');
  await editDialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status').getByText('The CRM pipeline was updated.', { exact: true })).toBeVisible();
  expect(updateBodies).toEqual([{ name: 'Partner growth pipeline', description: 'Governed partner opportunities' }]);

  dialog = page.getByRole('dialog', { name: 'Pipeline details · Partner growth pipeline', exact: true });
  await dialog.getByRole('button', { name: 'Edit stage: Discovery', exact: true }).click();
  const stageDialog = page.getByRole('dialog', { name: 'Edit pipeline stage · Discovery', exact: true });
  await expect(stageDialog.getByRole('textbox', { name: 'Stage', exact: true })).toBeFocused();
  await stageDialog.getByLabel('Probability').fill('35');
  await stageDialog.getByRole('checkbox', { name: 'accountId', exact: true }).check();
  await stageDialog.getByRole('button', { name: 'Save stage', exact: true }).click();
  expect(stageBodies).toEqual([expect.objectContaining({ name: 'Discovery', position: 10, type: 'OPEN', defaultProbability: 35, slaHours: 72, active: true, requiredFields: ['accountId'] })]);

  dialog = page.getByRole('dialog', { name: 'Pipeline details · Partner growth pipeline', exact: true });
  await dialog.getByRole('button', { name: 'Archive pipeline', exact: true }).click();
  const archiveDialog = page.getByRole('dialog', { name: 'Review pipeline state change', exact: true });
  await expect(archiveDialog.getByLabel('Change reason')).toBeFocused();
  await archiveDialog.getByLabel('Change reason').fill('Partner workflow is temporarily retired');
  await archiveDialog.getByRole('checkbox', { name: 'I understand an archived pipeline cannot be used for new deals or conversions.', exact: true }).check();
  await archiveDialog.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(page.getByRole('status').getByText('The pipeline was archived.', { exact: true })).toBeVisible();
  expect(archiveBodies).toEqual([{ archived: true, reason: 'Partner workflow is temporarily retired' }]);
});

test('property-scoped viewers receive a read-only Arabic pipeline center on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, false);
  await mockPipelineApi(page, [], [], [], [], []);

  await page.goto(`/crm/settings/pipelines?workspaceId=${workspaceId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مركز مسارات CRM' })).toBeVisible();
  await expect(page.getByText('عرض فقط', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء مسار', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'مراجعة المسار', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `تفاصيل المسار · ${pipeline.name}`, exact: true });
  await expect(dialog.getByRole('button', { name: 'تعديل بيانات المسار', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'أرشفة المسار', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /تعديل المرحلة/ })).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

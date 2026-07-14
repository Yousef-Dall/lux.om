import { expect, test, type Page, type Route } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspaceId = 'workspace-tasks-21i';
const companyId = 'company-tasks-21i';
const leadId = 'lead-tasks-21i';
const taskId = 'task-tasks-21i';
const managerId = 'manager-tasks-21i';

const lead = {
  id: leadId,
  title: 'Harbour viewing follow-up',
  description: 'Qualified relationship requiring a viewing appointment.',
  status: 'QUALIFIED',
  priority: 'HIGH',
  source: 'PMS_OWNER',
  expectedValue: '125000',
  currency: 'OMR',
  nextFollowUpAt: '2026-07-18T08:00:00.000Z',
  companyId,
  ownerUserId: null,
  assignedToId: managerId,
  pmsPropertyId: 'property-tasks-21i',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-14T08:00:00.000Z',
  contact: { id: 'contact-tasks-21i', fullName: 'Noor Al Harbour', email: 'noor@harbour.test', phone: '+96890000000' },
  company: { id: companyId, nameEn: 'Harbour CRM', nameAr: 'إدارة علاقات هاربور' },
  assignedTo: { id: managerId, name: 'Maha Manager', email: 'maha@harbour.test', role: 'USER' },
  ownerUser: null,
  activities: [],
  _count: { activities: 1 }
};

const listTask = {
  id: taskId,
  workspaceId,
  leadId,
  type: 'TASK',
  status: 'OPEN',
  priority: 'HIGH',
  subject: 'Confirm Harbour viewing',
  body: 'Call the owner and confirm the available viewing window.',
  dueAt: '2026-07-18T08:00:00.000Z',
  completedAt: null,
  assignedToId: managerId,
  communicationDirection: null,
  communicationOutcome: null,
  templateKey: null,
  createdById: managerId,
  updatedById: managerId,
  createdAt: '2026-07-14T08:00:00.000Z',
  updatedAt: '2026-07-14T08:00:00.000Z',
  assignedTo: { id: managerId, name: 'Maha Manager', email: 'maha@harbour.test', role: 'USER' },
  createdBy: { id: managerId, name: 'Maha Manager', email: 'maha@harbour.test' },
  lead: {
    id: lead.id,
    title: lead.title,
    status: lead.status,
    priority: lead.priority,
    companyId,
    ownerUserId: null,
    pmsPropertyId: lead.pmsPropertyId,
    contact: lead.contact,
    company: lead.company
  }
};

async function authenticate(page: Page, canManage = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-tasks-token'));
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
            memberId: 'member-tasks-21i',
            role: canManage ? 'MANAGER' : 'VIEWER',
            nameEn: 'Harbour CRM',
            nameAr: 'إدارة علاقات هاربور',
            canView: true,
            canManage,
            canAssign: canManage,
            canManageWorkspace: canManage,
            propertyScope: { allProperties: false, propertyIds: ['property-tasks-21i'] }
          }],
          workspaces: [{
            workspaceId,
            type: 'COMPANY',
            companyId,
            personalOwnerUserId: null,
            canView: true,
            canManage,
            propertyScope: { allProperties: false, propertyIds: ['property-tasks-21i'] }
          }]
        }
      }
    }
  }));
  await mockNotificationsApi(page);
}

async function mockTaskApi(
  page: Page,
  queries: URL[],
  postBodies: Array<Record<string, unknown>>,
  patchBodies: Array<Record<string, unknown>>
) {
  await page.route(crmApiPattern, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.endsWith('/api/crm/tasks') && method === 'GET') {
      queries.push(url);
      return route.fulfill({
        json: {
          tasks: [listTask],
          summary: { total: 51, overdue: 3 },
          pagination: { total: 51, take: Number(url.searchParams.get('take') ?? 25), skip: Number(url.searchParams.get('skip') ?? 0), count: 1 },
          limited: true
        }
      });
    }
    if (url.pathname.endsWith('/api/crm/assignees') && method === 'GET') {
      return route.fulfill({ json: { assignees: [listTask.assignedTo] } });
    }
    if (url.pathname.endsWith('/api/crm/leads') && method === 'GET') {
      return route.fulfill({ json: { leads: [lead], summary: { total: 1, byStatus: { QUALIFIED: 1 } }, pagination: { total: 1, take: 50, skip: 0, count: 1 } } });
    }
    if (url.pathname.endsWith(`/api/crm/leads/${leadId}/activities`) && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      postBodies.push(body);
      return route.fulfill({ status: 201, json: { activity: { ...listTask, id: 'created-task-21i', ...body } } });
    }
    if (url.pathname.endsWith(`/api/crm/leads/${leadId}/activities/${taskId}`) && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      patchBodies.push(body);
      return route.fulfill({ json: { activity: { ...listTask, ...body, completedAt: body.status === 'COMPLETED' ? '2026-07-14T10:00:00.000Z' : null } } });
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM task route: ${method} ${url.pathname}` } });
  });
}

test('task register uses server pagination and persists browsing filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockTaskApi(page, queries, [], []);

  await page.goto(`/crm/tasks?workspaceId=${workspaceId}&taskPage=2`);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');
  await expect(page.getByRole('heading', { name: 'CRM task center' })).toBeVisible();
  await expect(page.getByText(listTask.subject, { exact: true })).toBeVisible();

  const filters = page.locator('form.crm-tasks__filters');
  await filters.getByLabel('Search task, lead, or contact').fill('harbour');
  await filters.getByRole('combobox', { name: /^Status(?:$|\s)/ }).selectOption('OPEN');
  await filters.getByRole('combobox', { name: /^Priority(?:$|\s)/ }).selectOption('HIGH');
  await filters.getByRole('combobox', { name: /^Assignee(?:$|\s)/ }).selectOption(managerId);
  await filters.getByLabel('Due from').fill('2026-07-01');
  await filters.getByLabel('Due to').fill('2026-07-31');
  await filters.getByRole('combobox', { name: /^Sort by(?:$|\s)/ }).selectOption('priority');
  await filters.getByRole('combobox', { name: /^Direction(?:$|\s)/ }).selectOption('desc');
  await filters.getByRole('checkbox', { name: 'Overdue tasks only', exact: true }).check();
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/taskQ=harbour/);
  await expect(page).toHaveURL(/taskStatus=OPEN/);
  await expect(page).toHaveURL(/taskPriority=HIGH/);
  await expect(page).toHaveURL(new RegExp(`taskAssignee=${managerId}`));
  await expect(page).toHaveURL(/taskOverdue=true/);
  await expect(page).toHaveURL(/taskDueFrom=2026-07-01/);
  await expect(page).toHaveURL(/taskDueTo=2026-07-31/);
  await expect(page).toHaveURL(/taskSort=priority/);
  await expect(page).toHaveURL(/taskDirection=desc/);
  await expect(page).not.toHaveURL(/taskPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('harbour');
  await expect.poll(() => queries.at(-1)?.searchParams.get('taskStatus')).toBe('OPEN');
  await expect.poll(() => queries.at(-1)?.searchParams.get('taskPriority')).toBe('HIGH');
  await expect.poll(() => queries.at(-1)?.searchParams.get('assignedToId')).toBe(managerId);
  await expect.poll(() => queries.at(-1)?.searchParams.get('overdue')).toBe('true');
  await expect.poll(() => queries.at(-1)?.searchParams.get('sortBy')).toBe('priority');
  await expect.poll(() => queries.at(-1)?.searchParams.get('direction')).toBe('desc');

  await page.reload();
  await expect(filters.getByLabel('Search task, lead, or contact')).toHaveValue('harbour');
  await expect(filters.getByRole('combobox', { name: /^Priority(?:$|\s)/ })).toHaveValue('HIGH');
});

test('task creation and governed editing use accessible dialogs', async ({ page }) => {
  const postBodies: Array<Record<string, unknown>> = [];
  const patchBodies: Array<Record<string, unknown>> = [];
  await authenticate(page);
  await mockTaskApi(page, [], postBodies, patchBodies);

  await page.goto(`/crm/tasks?workspaceId=${workspaceId}`);
  const createTrigger = page.getByRole('button', { name: 'Create task', exact: true });
  await createTrigger.click();

  let dialog = page.getByRole('dialog', { name: 'Create governed CRM task', exact: true });
  await expect(dialog.getByLabel('Task subject')).toBeFocused();
  await expect(dialog.getByRole('combobox', { name: /^Lead(?:$|\s)/ })).toHaveValue(leadId);
  await dialog.getByLabel('Task subject').fill('Arrange legal document review');
  await dialog.getByLabel('Details').fill('Confirm the owner documents before the viewing.');
  await dialog.getByLabel('Due date and time').fill('2026-07-22T10:30');
  await dialog.getByRole('combobox', { name: /^Priority(?:$|\s)/ }).selectOption('URGENT');
  await dialog.getByRole('combobox', { name: /^Assignee(?:$|\s)/ }).selectOption(managerId);
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();

  await expect(page.getByRole('status').getByText('The CRM task was created.', { exact: true })).toBeVisible();
  expect(postBodies).toHaveLength(1);
  expect(postBodies[0]).toMatchObject({
    type: 'TASK',
    status: 'OPEN',
    priority: 'URGENT',
    subject: 'Arrange legal document review',
    body: 'Confirm the owner documents before the viewing.',
    assignedToId: managerId
  });

  const reviewTrigger = page.getByRole('button', { name: 'Review task', exact: true });
  await reviewTrigger.click();
  dialog = page.getByRole('dialog', { name: `Review task · ${listTask.subject}`, exact: true });
  await expect(dialog.getByLabel('Task subject')).toBeFocused();
  await dialog.getByRole('combobox', { name: /^Status(?:$|\s)/ }).selectOption('COMPLETED');
  await dialog.getByRole('combobox', { name: /^Priority(?:$|\s)/ }).selectOption('URGENT');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();

  await expect(page.getByRole('status').getByText('The CRM task was updated.', { exact: true })).toBeVisible();
  expect(patchBodies).toHaveLength(1);
  expect(patchBodies[0]).toMatchObject({ status: 'COMPLETED', priority: 'URGENT', subject: listTask.subject, assignedToId: managerId });
  await expect(reviewTrigger).toBeFocused();
});

test('property-scoped viewers receive a read-only Arabic task center on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, false);
  await mockTaskApi(page, [], [], []);

  await page.goto(`/crm/tasks?workspaceId=${workspaceId}`);

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مركز مهام CRM' })).toBeVisible();
  await expect(page.getByText('عرض فقط', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء مهمة', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('بحث في المهمة أو العميل أو جهة الاتصال')).toBeVisible();
  await expect(page.getByRole('button', { name: 'مراجعة المهمة', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

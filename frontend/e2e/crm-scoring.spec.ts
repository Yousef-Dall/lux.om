import { expect, test, type Page, type Route } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspaceId = 'workspace-scoring-21i';
const companyId = 'company-scoring-21i';
const propertyId = 'property-scoring-21i';
const leadId = 'lead-scoring-21i';
const managerId = 'manager-scoring-21i';

const snapshot = {
  id: 'snapshot-scoring-21i',
  score: 86,
  band: 'HOT',
  version: 'crm-deterministic-v2',
  previousScore: 61,
  trend: 'RISING',
  reasons: [
    { key: 'repeat-engagement', label: 'Repeat engagement', points: 25 },
    { key: 'completed-communications', label: 'Completed communications', points: 15 }
  ],
  signals: { repeatEngagementCount: 3, completedCommunications: 2, openTasks: 1 },
  calculatedAt: '2026-07-14T08:00:00.000Z'
};

const scoringItem = {
  id: leadId,
  workspaceId,
  title: 'Harbour investor mandate',
  status: 'QUALIFIED',
  archivedAt: null,
  score: 86,
  scoreBand: 'HOT',
  scoringVersion: 'crm-deterministic-v2',
  scoreCalculatedAt: '2026-07-14T08:00:00.000Z',
  updatedAt: '2026-07-14T08:00:00.000Z',
  contact: { id: 'contact-scoring-21i', fullName: 'Noor Harbour', email: 'noor@harbour.test', phone: null },
  assignedTo: { id: managerId, name: 'Maha Manager', email: 'maha@scoring.test' },
  pipeline: { id: 'pipeline-scoring-21i', name: 'Investor pipeline' },
  stage: { id: 'stage-scoring-21i', name: 'Qualified', position: 20, type: 'OPEN' },
  pmsProperty: { id: propertyId, name: 'Harbour Residence', code: 'HR-01' },
  latestSnapshot: snapshot
};

const lead = {
  ...scoringItem,
  priority: 'HIGH',
  source: 'MANUAL',
  currency: 'OMR',
  companyId,
  ownerUserId: null,
  assignedToId: managerId,
  contact: { ...scoringItem.contact, notes: null },
  company: { id: companyId, slug: 'harbour', nameEn: 'Harbour CRM', nameAr: 'إدارة هاربور' },
  createdAt: '2026-07-10T08:00:00.000Z',
  intelligence: {
    score: 86,
    scoreBand: 'HOT',
    scoreReasons: snapshot.reasons,
    nextBestAction: { key: 'follow-up', title: 'Follow up', description: 'Call the investor', priority: 'HIGH', reason: 'High intent' },
    signals: snapshot.signals
  }
};

async function authenticate(page: Page, canConfigure = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-scoring-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: managerId,
        name: 'Maha Manager',
        email: 'maha@scoring.test',
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
            memberId: 'member-scoring-21i',
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

async function mockScoringApi(page: Page, queries: URL[], recalculationBodies: Array<Record<string, unknown>>) {
  let currentVersion = snapshot.version;
  let history = [structuredClone(snapshot)];
  await page.route(crmApiPattern, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === '/api/crm/scores' && method === 'GET') {
      queries.push(url);
      return route.fulfill({
        json: {
          scores: [{ ...scoringItem, scoringVersion: currentVersion, latestSnapshot: history[0] }],
          summary: { total: 41, active: 40, archived: 1, hot: 12, warm: 18, cold: 11, neverCalculated: 0, stale: currentVersion === 'crm-deterministic-v2' ? 0 : 1 },
          pagination: { total: 41, take: Number(url.searchParams.get('take') ?? 20), skip: Number(url.searchParams.get('skip') ?? 0), count: 1 },
          rules: { currentVersion: 'crm-deterministic-v2', propertyScopeApplied: true, editableRules: false, immutableSnapshots: true }
        }
      });
    }
    if (url.pathname === `/api/crm/leads/${leadId}` && method === 'GET') {
      return route.fulfill({ json: { lead: { ...lead, scoringVersion: currentVersion } } });
    }
    if (url.pathname === `/api/crm/leads/${leadId}/score-history` && method === 'GET') {
      return route.fulfill({ json: { snapshots: history } });
    }
    if (url.pathname === '/api/crm/scores/recalculate' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      recalculationBodies.push(body);
      currentVersion = String(body.version);
      history = [{ ...snapshot, id: 'snapshot-recalculated-21i', version: currentVersion, previousScore: 86, trend: 'STABLE', calculatedAt: '2026-07-15T09:00:00.000Z' }, ...history];
      return route.fulfill({ json: { result: { leads: 41, snapshots: 7 }, version: currentVersion } });
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM scoring route: ${method} ${url.pathname}` } });
  });
}

test('scoring register uses server pagination and persists browsing filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockScoringApi(page, queries, []);

  await page.goto(`/crm/settings/scoring?workspaceId=${workspaceId}&scorePage=2`);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('20');
  await expect(page.getByRole('heading', { name: 'CRM scoring center' })).toBeVisible();
  await expect(page.getByText(scoringItem.title, { exact: true })).toBeVisible();

  const filters = page.locator('form.crm-scoring-center__filters');
  await filters.getByLabel('Search scores').fill('harbour');
  await filters.getByRole('combobox', { name: 'Band', exact: true }).selectOption('HOT');
  await filters.getByRole('combobox', { name: 'State', exact: true }).selectOption('ALL');
  await filters.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('scoreCalculatedAt');
  await filters.getByRole('combobox', { name: 'Direction', exact: true }).selectOption('asc');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/scoreQ=harbour/);
  await expect(page).toHaveURL(/scoreBand=HOT/);
  await expect(page).toHaveURL(/scoreStatus=ALL/);
  await expect(page).toHaveURL(/scoreSort=scoreCalculatedAt/);
  await expect(page).toHaveURL(/scoreDirection=asc/);
  await expect(page).not.toHaveURL(/scorePage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('harbour');
  await expect.poll(() => queries.at(-1)?.searchParams.get('band')).toBe('HOT');
  await expect.poll(() => queries.at(-1)?.searchParams.get('status')).toBe('ALL');

  await page.reload();
  await expect(filters.getByLabel('Search scores')).toHaveValue('harbour');
  await expect(filters.getByRole('combobox', { name: 'Band', exact: true })).toHaveValue('HOT');
});

test('scoring evidence and workspace recalculation use governed accessible dialogs', async ({ page }) => {
  const recalculationBodies: Array<Record<string, unknown>> = [];
  await authenticate(page);
  await mockScoringApi(page, [], recalculationBodies);

  await page.goto(`/crm/settings/scoring?workspaceId=${workspaceId}`);
  const reviewTrigger = page.getByRole('button', { name: `Review scoring evidence: ${scoringItem.title}`, exact: true });
  await reviewTrigger.click();
  let dialog = page.getByRole('dialog', { name: `Lead scoring evidence · ${scoringItem.title}`, exact: true });
  await expect(dialog.getByRole('heading', { name: 'Score reasons', exact: true })).toBeVisible();
  await expect(dialog.getByText('Repeat engagement', { exact: true })).toBeVisible();
  await expect(dialog.getByText('completedCommunications', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/61 → 86$/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(reviewTrigger).toBeFocused();

  const recalculateTrigger = page.getByRole('button', { name: 'Recalculate scores', exact: true });
  await recalculateTrigger.click();
  dialog = page.getByRole('dialog', { name: 'Review CRM score recalculation', exact: true });
  await expect(dialog.getByLabel('Scoring version')).toBeFocused();
  await dialog.getByLabel('Scoring version').fill('crm-deterministic-v3-reviewed');
  await dialog.getByRole('checkbox', { name: /historical snapshots will remain preserved/ }).check();
  await dialog.getByRole('button', { name: 'Confirm recalculation', exact: true }).click();
  await expect(page.getByRole('status').getByText('Recalculated 41 leads and stored 7 snapshots.', { exact: true })).toBeVisible();
  expect(recalculationBodies).toEqual([{ workspaceId, version: 'crm-deterministic-v3-reviewed' }]);
  await expect(recalculateTrigger).toBeFocused();
});

test('property-scoped viewers receive a read-only Arabic scoring center on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, false);
  await mockScoringApi(page, [], []);

  await page.goto(`/crm/settings/scoring?workspaceId=${workspaceId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مركز تقييم CRM' })).toBeVisible();
  await expect(page.getByText('عرض فقط', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إعادة احتساب التقييمات', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: `مراجعة دليل التقييم: ${scoringItem.title}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `دليل تقييم العميل · ${scoringItem.title}`, exact: true });
  await expect(dialog.getByRole('heading', { name: 'سجل اللقطات', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

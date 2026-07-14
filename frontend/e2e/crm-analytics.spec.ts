import { expect, test, type Page, type Route } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const workspaceId = 'workspace-analytics-21i';
const companyId = 'company-analytics-21i';

const forecast = {
  snapshot: {
    leads: { total: 12, qualified: 8, converted: 5, leadToQualifiedRate: 8 / 12, qualifiedToDealRate: 5 / 8 },
    deals: {
      decided: 4,
      won: 3,
      winRate: 0.75,
      byCurrencyAndOutcome: [
        { currency: 'OMR', outcome: 'WON', _count: { _all: 2 }, _sum: { expectedValue: '180000' } },
        { currency: 'USD', outcome: 'WON', _count: { _all: 1 }, _sum: { expectedValue: '70000' } },
        { currency: 'USD', outcome: 'OPEN', _count: { _all: 2 }, _sum: { expectedValue: '110000' } }
      ],
      forecast: [
        { currency: 'OMR', pipelineValue: 240000, weightedForecast: 156000 },
        { currency: 'USD', pipelineValue: 110000, weightedForecast: 66000 }
      ],
      averageSalesCycleByCurrency: [
        { currency: 'OMR', averageSalesCycleDays: 38.5 },
        { currency: 'USD', averageSalesCycleDays: 22 }
      ]
    },
    overdueFollowUps: 3
  },
  dimensions: {
    bySource: [
      { source: 'MARKETPLACE_INQUIRY', outcome: 'OPEN', _count: { _all: 4 } },
      { source: 'MARKETPLACE_INQUIRY', outcome: 'WON', _count: { _all: 2 } },
      { source: 'PMS', outcome: 'OPEN', _count: { _all: 2 } },
      { source: 'PMS', outcome: 'LOST', _count: { _all: 1 } }
    ],
    byAssignee: [],
    byScoreBand: [
      { scoreBand: 'HOT', outcome: 'OPEN', _count: { _all: 3 } },
      { scoreBand: 'HOT', outcome: 'WON', _count: { _all: 2 } },
      { scoreBand: 'WARM', outcome: 'LOST', _count: { _all: 1 } }
    ],
    stages: [
      { stageId: 'stage-qualified', outcome: 'OPEN', _count: { _all: 3 }, stage: { id: 'stage-qualified', name: 'Qualified', position: 20 } },
      { stageId: 'stage-proposal', outcome: 'OPEN', _count: { _all: 2 }, stage: { id: 'stage-proposal', name: 'Proposal', position: 30 } }
    ],
    timeInStage: [
      { stageId: 'stage-qualified', averageHours: 36 },
      { stageId: 'stage-proposal', averageHours: 96 }
    ],
    stageDropOff: [{ fromStageId: 'stage-proposal', lostDeals: 1 }],
    lostReasons: [{ lostReason: 'Budget timing', _count: { _all: 1 } }],
    wonReasons: [{ wonReason: 'Trusted portfolio', _count: { _all: 3 } }]
  },
  rules: { currenciesCombined: false, historicalOutcomesPreservedAfterArchive: true, truncatedResultSetsUsed: false }
};

const sourceEvents = [
  {
    id: 'source-event-deal-21i',
    workspaceId,
    type: 'LISTING_INQUIRY',
    sourceRecordId: 'inquiry-harbour-21i',
    ruleKey: 'marketplace-listing-inquiry',
    occurredAt: '2026-07-15T09:00:00.000Z',
    consentStatus: 'LEGITIMATE_INTEREST',
    metadata: { listingId: 'listing-harbour' },
    contact: { id: 'contact-analytics-21i', fullName: 'Noor Al Harbour' },
    lead: { id: 'lead-analytics-21i', title: 'Harbour waterfront inquiry' },
    account: { id: 'account-analytics-21i', name: 'Harbour Residences' },
    deal: { id: 'deal-analytics-21i', name: 'Harbour waterfront opportunity' }
  },
  {
    id: 'source-event-owner-21i',
    workspaceId,
    type: 'PMS_OWNER_ONBOARDING',
    sourceRecordId: 'owner-onboarding-21i',
    ruleKey: 'pms-owner-relationship',
    occurredAt: '2026-07-14T08:00:00.000Z',
    consentStatus: 'CONSENTED',
    metadata: null,
    contact: { id: 'contact-owner-21i', fullName: 'Maha Al Mouj' },
    lead: null,
    account: { id: 'account-owner-21i', name: 'Al Mouj Owner Portfolio' },
    deal: null
  }
];

async function authenticate(page: Page, propertyScoped = false) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'crm-analytics-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: 'crm-analytics-user',
        name: 'CRM Analytics User',
        email: 'crm-analytics@lux.test',
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
            memberId: 'member-analytics-21i',
            role: 'VIEWER',
            nameEn: 'Harbour CRM',
            nameAr: 'إدارة علاقات هاربور',
            canView: true,
            canManage: false,
            canAssign: false,
            canManageWorkspace: false,
            propertyScope: propertyScoped
              ? { allProperties: false, propertyIds: ['property-harbour'] }
              : { allProperties: true, propertyIds: [] }
          }],
          workspaces: [{
            workspaceId,
            type: 'COMPANY',
            companyId,
            personalOwnerUserId: null,
            canView: true,
            canManage: false,
            propertyScope: propertyScoped
              ? { allProperties: false, propertyIds: ['property-harbour'] }
              : { allProperties: true, propertyIds: [] }
          }]
        }
      }
    }
  }));
  await mockNotificationsApi(page);
}

async function mockAnalyticsApi(page: Page, sourceQueries: URL[]) {
  await page.route(crmApiPattern, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/api/crm/analytics/forecast')) {
      return route.fulfill({ json: forecast });
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/api/crm/source-events')) {
      sourceQueries.push(url);
      return route.fulfill({
        json: {
          events: sourceEvents,
          pagination: {
            total: 52,
            take: Number(url.searchParams.get('take') ?? 25),
            skip: Number(url.searchParams.get('skip') ?? 0),
            count: sourceEvents.length
          },
          rules: { propertyScopeApplied: true, completeCountUsed: true }
        }
      });
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled CRM analytics route: ${request.method()} ${url.pathname}` } });
  });
}

test('source audit register uses server pagination and persists analytics filters in the URL', async ({ page }) => {
  const queries: URL[] = [];
  await authenticate(page);
  await mockAnalyticsApi(page, queries);

  await page.goto(`/crm/analytics?workspaceId=${workspaceId}&analyticsPage=2`);
  await expect.poll(() => queries.at(-1)?.searchParams.get('skip')).toBe('25');
  await expect(page.getByRole('heading', { name: 'CRM analytics and source attribution' })).toBeVisible();

  const filters = page.locator('form.crm-analytics-workspace__filters');
  await filters.getByLabel('Search reference, rule, or linked record').fill('harbour');
  await filters.getByRole('combobox', { name: 'Signal type', exact: true }).selectOption('LISTING_INQUIRY');
  await filters.getByRole('combobox', { name: 'Consent status', exact: true }).selectOption('LEGITIMATE_INTEREST');
  await filters.getByRole('combobox', { name: 'Linked to', exact: true }).selectOption('DEAL');
  await filters.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('type');
  await filters.getByRole('combobox', { name: 'Direction', exact: true }).selectOption('asc');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();

  await expect(page).toHaveURL(/analyticsQ=harbour/);
  await expect(page).toHaveURL(/analyticsType=LISTING_INQUIRY/);
  await expect(page).toHaveURL(/analyticsConsent=LEGITIMATE_INTEREST/);
  await expect(page).toHaveURL(/analyticsLinked=DEAL/);
  await expect(page).toHaveURL(/analyticsSort=type/);
  await expect(page).toHaveURL(/analyticsDirection=asc/);
  await expect(page).not.toHaveURL(/analyticsPage=2/);
  await expect.poll(() => queries.at(-1)?.searchParams.get('search')).toBe('harbour');
  await expect.poll(() => queries.at(-1)?.searchParams.get('type')).toBe('LISTING_INQUIRY');
  await expect.poll(() => queries.at(-1)?.searchParams.get('consentStatus')).toBe('LEGITIMATE_INTEREST');
  await expect.poll(() => queries.at(-1)?.searchParams.get('linkedTo')).toBe('DEAL');
  await expect.poll(() => queries.at(-1)?.searchParams.get('sortBy')).toBe('type');
  await expect.poll(() => queries.at(-1)?.searchParams.get('direction')).toBe('asc');

  await page.reload();
  await expect(filters.getByLabel('Search reference, rule, or linked record')).toHaveValue('harbour');
  await expect(filters.getByRole('combobox', { name: 'Signal type', exact: true })).toHaveValue('LISTING_INQUIRY');
});

test('analytics keeps currencies separate and exposes explainable source and stage dimensions', async ({ page }) => {
  await authenticate(page);
  await mockAnalyticsApi(page, []);

  await page.goto(`/crm/analytics?workspaceId=${workspaceId}`);

  await expect(page.getByText('12', { exact: true })).toBeVisible();
  const forecastPanel = page.getByRole('region', { name: 'Currency-separated forecast' });
  await expect(forecastPanel.getByText('OMR', { exact: true })).toBeVisible();
  await expect(forecastPanel.getByText('USD', { exact: true })).toBeVisible();
  await expect(forecastPanel.getByText(/OMR\s*240,000|ر\.ع\.\s*240,000/)).toBeVisible();
  await expect(forecastPanel.getByText(/USD\s*110,000|\$110,000/)).toBeVisible();

  const sourceTable = page.getByRole('region', { name: 'Lead-source performance', exact: true }).getByRole('table');
  await expect(sourceTable.getByRole('rowheader', { name: 'Marketplace Inquiry', exact: true })).toBeVisible();
  const stageTable = page.getByRole('region', { name: 'Stage health', exact: true }).getByRole('table');
  await expect(stageTable.getByRole('rowheader', { name: 'Qualified', exact: true })).toBeVisible();
  await expect(page.getByText('Trusted portfolio', { exact: true })).toBeVisible();
  await expect(page.getByText('Budget timing', { exact: true })).toBeVisible();

  await expect(page.getByRole('link', { name: 'Harbour waterfront opportunity', exact: true })).toHaveAttribute(
    'href',
    `/crm/deals/deal-analytics-21i?workspaceId=${workspaceId}`
  );
});

test('property-scoped viewers receive Arabic RTL analytics on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, true);
  await mockAnalyticsApi(page, []);

  await page.goto(`/crm/analytics?workspaceId=${workspaceId}`);

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'تحليلات CRM ونَسَب المصدر' })).toBeVisible();
  await expect(page.getByText('النطاق العقاري مفعّل', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'توقعات مفصولة حسب العملة', exact: true })).toBeVisible();
  await expect(page.getByLabel('بحث في المرجع أو القاعدة أو السجل المرتبط')).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

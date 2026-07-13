import { expect, test, type Page } from '@playwright/test';

import { mockNotificationsApi } from './support/apiMocks';

const allPermissions = [
  'INVENTORY_VIEW',
  'INVENTORY_MANAGE',
  'TENANCY_VIEW',
  'TENANCY_MANAGE',
  'RENT_VIEW',
  'RENT_MANAGE',
  'ACCOUNTING_VIEW',
  'ACCOUNTING_MANAGE',
  'REPORTS_VIEW',
  'MAINTENANCE_VIEW',
  'MAINTENANCE_MANAGE',
  'DOCUMENTS_VIEW',
  'DOCUMENTS_MANAGE',
  'IMPORT_EXPORT',
  'STAFF_MANAGE',
  'SETTINGS_MANAGE'
];

const pmsWorkspaces = [
  {
    memberId: 'pms-member-all',
    role: 'PMS_OWNER',
    permissionKeys: allPermissions,
    propertyScope: { allProperties: true, propertyIds: [] },
    company: { id: 'company-pms-all', slug: 'company-pms-all', nameEn: 'All Properties Co', nameAr: 'شركة كل العقارات' },
    entitlement: { status: 'ACTIVE', trialEndsAt: null }
  },
  {
    memberId: 'pms-member-scoped',
    role: 'PMS_MANAGER',
    permissionKeys: allPermissions,
    propertyScope: { allProperties: false, propertyIds: ['property-scoped'] },
    company: { id: 'company-pms-scoped', slug: 'company-pms-scoped', nameEn: 'Scoped Properties Co', nameAr: 'شركة العقارات المحددة' },
    entitlement: { status: 'TRIAL', trialEndsAt: '2026-08-01T00:00:00.000Z' }
  }
];

async function authenticate(page: Page, hasPmsAccess = true) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'pms-shell-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        id: 'pms-shell-user',
        name: 'PMS Shell User',
        email: 'pms-shell@lux.test',
        role: 'USER',
        emailVerified: true,
        pmsAccess: { hasAccess: hasPmsAccess, workspaces: hasPmsAccess ? pmsWorkspaces : [] }
      }
    }
  }));
  await mockNotificationsApi(page);
}

async function mockOperationalPages(page: Page) {
  await page.route('**/api/pms/accounting/charges**', (route) => route.fulfill({ json: { charges: [], pagination: { total: 0, take: 25, skip: 0, count: 0 }, totalsByCurrency: [] } }));
  await page.route('**/api/pms/accounting/payments**', (route) => route.fulfill({ json: { payments: [], pagination: { total: 0, take: 25, skip: 0, count: 0 }, totalsByCurrency: [] } }));
  await page.route('**/api/pms/accounting/deposits**', (route) => route.fulfill({ json: { accounts: [], pagination: { total: 0, take: 25, skip: 0, count: 0 }, totalsByCurrency: [] } }));
  await page.route('**/api/pms/accounting/periods**', (route) => route.fulfill({ json: { periods: [], pagination: { total: 0, take: 25, skip: 0, count: 0 } } }));
  await page.route('**/api/pms/accounting/owner-payouts**', (route) => route.fulfill({ json: { batches: [] } }));
  await page.route('**/api/pms/accounting/vendor-invoices**', (route) => route.fulfill({ json: { invoices: [], pagination: { total: 0, take: 25, skip: 0, count: 0 }, totalsByStatus: [], totalsByCurrency: [], overdueCount: 0, vendors: [], properties: [], workOrders: [] } }));
  await page.route('**/api/pms/assets**', (route) => route.fulfill({ json: { assets: [], pagination: { take: 25, skip: 0, count: 0, total: 0 } } }));
  await page.route('**/api/pms/preventive-maintenance/plans**', (route) => route.fulfill({ json: { plans: [] } }));
  await page.route('**/api/pms/structured-inspections/runs**', (route) => route.fulfill({ json: { inspections: [] } }));
}

test.beforeEach(async ({ page }) => {
  await authenticate(page);
  await mockOperationalPages(page);
});

test('PMS renders a persistent permission-aware information architecture', async ({ page }) => {
  await page.goto('/pms/finance/overview?companyId=company-pms-all');
  const navigation = page.getByRole('navigation', { name: 'PMS workspace' });

  await expect(navigation.getByRole('link', { name: 'Properties', exact: true })).toHaveAttribute(
    'href',
    '/pms/portfolio/properties?companyId=company-pms-all'
  );
  await expect(navigation.getByRole('link', { name: 'Leases and rent schedules', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Financial overview', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(navigation.getByRole('link', { name: 'Deposits', exact: true })).toHaveAttribute(
    'href',
    '/pms/finance/deposits?companyId=company-pms-all'
  );
  await expect(navigation.getByRole('link', { name: 'Financial periods', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Reconciliation', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Owner statements', exact: true })).toHaveAttribute(
    'href',
    '/pms/finance/statements?companyId=company-pms-all'
  );
  await expect(navigation.getByRole('link', { name: 'Owner payouts', exact: true })).toHaveAttribute(
    'href',
    '/pms/finance/payouts?companyId=company-pms-all'
  );
  await expect(navigation.getByRole('link', { name: 'Vendor invoices', exact: true })).toHaveAttribute(
    'href',
    '/pms/finance/vendor-invoices?companyId=company-pms-all'
  );
  await expect(navigation.getByRole('link', { name: 'Staff and access', exact: true })).toBeVisible();
  await expect(page.getByText('Owner · All properties')).toBeVisible();
});

test('PMS company switching preserves the canonical section and updates property scope', async ({ page }) => {
  await page.goto('/pms/finance/overview?companyId=company-pms-all');
  await page.getByRole('combobox', { name: 'Switch PMS company', exact: true }).selectOption('company-pms-scoped');

  await expect(page).toHaveURL(/\/pms\/finance\/overview\?companyId=company-pms-scoped/);
  await expect(page.getByText('Manager · 1 assigned property')).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'PMS workspace' });
  await expect(navigation.getByRole('link', { name: 'Staff and access', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Import and export', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Financial overview', exact: true })).toBeVisible();
});

test('legacy PMS URLs redirect to canonical grouped routes without dropping company scope', async ({ page }) => {
  await page.goto('/pms/financial-operations?companyId=company-pms-all');
  await expect(page).toHaveURL(/\/pms\/finance\/overview\?companyId=company-pms-all/);

  await page.goto('/pms/assets-inspections?companyId=company-pms-all');
  await expect(page).toHaveURL(/\/pms\/operations\/assets-inspections\?companyId=company-pms-all/);
});

test('accounts without internal PMS entitlement are redirected before PMS record requests', async ({ page }) => {
  await authenticate(page, false);
  const requests: string[] = [];
  await page.route('**/api/pms/**', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
  });

  await page.goto('/pms/finance/overview');
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(requests).toEqual([]);
});

test('PMS navigation remains keyboard reachable on a narrow Arabic RTL layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await page.goto('/pms/finance/overview?companyId=company-pms-all');

  const navigation = page.getByRole('navigation', { name: 'مساحة عمل PMS' });
  const propertiesLink = navigation.getByRole('link', { name: 'العقارات', exact: true });
  await expect(propertiesLink).toBeVisible();
  await propertiesLink.focus();
  await expect(propertiesLink).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

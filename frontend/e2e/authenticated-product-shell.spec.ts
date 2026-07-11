import { expect, test, type Page } from '@playwright/test';

import { crmApiPattern, mockNotificationsApi } from './support/apiMocks';

const noCrmAccess = {
  hasAccess: false,
  isAdmin: false,
  personalWorkspace: { enabled: false, canView: false, canManage: false },
  companyWorkspaces: [],
  workspaces: []
};

const companyCrmAccess = {
  hasAccess: true,
  isAdmin: false,
  personalWorkspace: { enabled: false, canView: false, canManage: false },
  companyWorkspaces: [
    {
      workspaceId: 'workspace-shell',
      type: 'COMPANY',
      companyId: 'company-shell',
      memberId: 'member-shell',
      role: 'MANAGER',
      nameEn: 'Shell Company',
      nameAr: null,
      canView: true,
      canManage: true,
      canAssign: true,
      canManageWorkspace: true,
      propertyScope: { allProperties: true, propertyIds: [] }
    }
  ],
  workspaces: []
};

async function authenticate(page: Page, extra: Record<string, unknown>) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'product-shell-token'));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'shell-user',
          name: 'Shell User',
          email: 'shell@lux.test',
          role: 'USER',
          emailVerified: true,
          crmAccess: noCrmAccess,
          ...extra
        }
      }
    })
  );
  await mockNotificationsApi(page);
}

test('CRM and PMS are peer products in the authenticated shell', async ({ page }) => {
  await authenticate(page, {
    crmAccess: companyCrmAccess,
    pmsAccess: { hasAccess: true, companies: [] }
  });

  await page.goto('/profile');
  const nav = page.getByRole('navigation', { name: 'Products and workspaces' });
  await expect(nav.getByRole('link', { name: 'CRM', exact: true })).toHaveAttribute('href', '/crm');
  await expect(nav.getByRole('link', { name: 'PMS', exact: true })).toHaveAttribute(
    'href',
    '/pms/overview'
  );
  await expect(nav.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
});

test('customer CRM access is denied before any CRM record request', async ({ page }) => {
  await authenticate(page, { crmAccess: noCrmAccess });
  const crmRequests: string[] = [];
  await page.route(crmApiPattern, (route) => {
    crmRequests.push(route.request().url());
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
  });

  await page.goto('/crm');
  await expect(
    page.getByRole('heading', { name: 'CRM access is not enabled for this account.' })
  ).toBeVisible();
  expect(crmRequests).toEqual([]);
});

test('portal-only accounts see portal navigation without internal CRM or PMS links', async ({ page }) => {
  await authenticate(page, {
    crmAccess: noCrmAccess,
    ownerAccess: { hasAccess: true, accesses: [{ id: 'owner-access' }] }
  });

  await page.goto('/profile');
  const nav = page.getByRole('navigation', { name: 'Products and workspaces' });
  await expect(nav.getByRole('link', { name: 'Owner portal', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'CRM', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'PMS', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
});

test('authenticated product navigation remains usable on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page, {
    crmAccess: companyCrmAccess,
    pmsAccess: { hasAccess: true, companies: [] }
  });

  await page.goto('/profile');
  const nav = page.getByRole('navigation', { name: 'Products and workspaces' });
  await expect(nav.getByRole('link', { name: 'CRM', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'PMS', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('authenticated product navigation uses Arabic labels and RTL direction', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lux-language', 'ar'));
  await authenticate(page, {
    crmAccess: companyCrmAccess,
    pmsAccess: { hasAccess: true, companies: [] }
  });

  await page.goto('/profile');
  const nav = page.getByRole('navigation', { name: 'مساحات العمل والمنتجات' });
  await expect(nav.getByRole('link', { name: 'إدارة علاقات العملاء', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'إدارة العقارات', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

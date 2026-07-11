import { expect, test, type Page } from '@playwright/test';

const baseUser = (extra: Record<string, unknown> = {}) => ({
  id: 'stage21g-browser-user',
  name: 'Stage 21G Browser User',
  email: 'stage21g-browser@lux.test',
  role: 'USER',
  emailVerified: true,
  ...extra,
});

async function authenticate(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'stage21g-browser-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: baseUser(extra) } }));
}

const ownerAccesses = [
  {
    id: 'owner-access-a',
    canApproveQuotes: true,
    canViewMaintenanceCosts: true,
    company: { id: 'company-1', slug: 'company-1', nameEn: 'Company One', nameAr: null },
    property: { id: 'property-a', name: 'Property A', address: 'Muscat' },
  },
  {
    id: 'owner-access-b',
    canApproveQuotes: false,
    canViewMaintenanceCosts: false,
    company: { id: 'company-1', slug: 'company-1', nameEn: 'Company One', nameAr: null },
    property: { id: 'property-b', name: 'Property B', address: 'Seeb' },
  },
];

function ownerOverview(accessId: string) {
  const access = ownerAccesses.find((item) => item.id === accessId) ?? ownerAccesses[0];
  return {
    access,
    occupancy: { totalUnits: 2, occupiedUnits: 1, vacantUnits: 1, occupancyRate: 50 },
    financialSummaries: [{ currency: 'OMR', income: '100', expenses: '20', adjustments: '0', net: '80', periodStart: '2026-06-01T00:00:00.000Z', periodEnd: '2026-06-30T23:59:59.000Z' }],
    statements: [],
    maintenance: [{ id: 'work-a', title: 'HVAC service', priority: 'NORMAL', status: 'OPEN', cost: '10', currency: 'OMR', asset: { assetCode: 'HVAC-A', name: 'HVAC' } }],
    payouts: [],
    quotesAwaitingApproval: [],
  };
}

test('direct owner and vendor URLs redirect accounts without portal access and send no portal requests', async ({ page }) => {
  await authenticate(page, {
    ownerAccess: { hasAccess: false, accesses: [] },
    vendorAccess: { hasAccess: false, accesses: [] },
  });
  const portalRequests: string[] = [];
  await page.route('**/api/owner/**', (route) => {
    portalRequests.push(route.request().url());
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
  });
  await page.route('**/api/vendor/**', (route) => {
    portalRequests.push(route.request().url());
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
  });

  await page.goto('/owner');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/vendor');
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(portalRequests).toEqual([]);
});

test('owner portal stays property scoped, hides tenant identity, and switches using access ids', async ({ page }) => {
  await authenticate(page, {
    ownerAccess: { hasAccess: true, accesses: ownerAccesses },
    vendorAccess: { hasAccess: false, accesses: [] },
  });
  const requests: string[] = [];
  await page.route('**/api/owner/overview**', (route) => {
    requests.push(route.request().url());
    const accessId = new URL(route.request().url()).searchParams.get('accessId') ?? 'owner-access-a';
    return route.fulfill({ json: ownerOverview(accessId) });
  });
  await page.route('**/api/owner/documents**', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ json: { documents: [] } });
  });

  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Property A' })).toBeVisible();
  await expect(page.getByText('Private Tenant A')).toHaveCount(0);
  await expect.poll(() => requests.some((url) => new URL(url).searchParams.get('accessId') === 'owner-access-a')).toBe(true);

  await page.getByRole('combobox', { name: 'Owner property', exact: true }).selectOption('owner-access-b');
  await expect(page.getByRole('heading', { name: 'Property B' })).toBeVisible();
  await expect.poll(() => requests.some((url) => new URL(url).searchParams.get('accessId') === 'owner-access-b')).toBe(true);
  expect(requests.every((url) => !url.includes('propertyId='))).toBe(true);
});

test('vendor portal renders only explicitly assigned work and no tenant identity', async ({ page }) => {
  const vendorAccess = {
    id: 'vendor-access-1',
    company: { id: 'company-1', slug: 'company-1', nameEn: 'Company One', nameAr: null },
    vendor: { id: 'vendor-1', name: 'Assigned Vendor', trade: 'HVAC' },
  };
  await authenticate(page, {
    ownerAccess: { hasAccess: false, accesses: [] },
    vendorAccess: { hasAccess: true, accesses: [vendorAccess] },
  });
  const requests: string[] = [];
  await page.route('**/api/vendor/work-orders**', (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      json: {
        access: vendorAccess,
        workOrders: [
          {
            id: 'assigned-work',
            title: 'Assigned HVAC repair',
            description: 'Repair the assigned unit asset.',
            priority: 'NORMAL',
            status: 'OPEN',
            scheduledFor: null,
            targetDate: null,
            property: { id: 'property-a', name: 'Property A', address: 'Muscat' },
            unit: { id: 'unit-a', unitNumber: 'A-101' },
            asset: { id: 'asset-a', assetCode: 'HVAC-A', name: 'HVAC', warrantyExpiry: null },
            quotes: [],
            pmsDocuments: [],
          },
        ],
      },
    });
  });

  await page.goto('/vendor');
  await expect(page.getByRole('heading', { name: 'Assigned work orders' })).toBeVisible();
  await expect(page.getByText('Assigned HVAC repair')).toBeVisible();
  await expect(page.getByText('Unrelated work')).toHaveCount(0);
  await expect(page.getByText('Private Tenant A')).toHaveCount(0);
  await expect.poll(() => requests.some((url) => new URL(url).searchParams.get('accessId') === 'vendor-access-1')).toBe(true);
});

test('owner access does not grant vendor portal API access', async ({ page }) => {
  await authenticate(page, {
    ownerAccess: { hasAccess: true, accesses: [ownerAccesses[0]] },
    vendorAccess: { hasAccess: false, accesses: [] },
  });
  const vendorRequests: string[] = [];
  await page.route('**/api/vendor/**', (route) => {
    vendorRequests.push(route.request().url());
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
  });
  await page.goto('/vendor');
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(vendorRequests).toEqual([]);
});

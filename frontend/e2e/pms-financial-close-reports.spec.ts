import { expect, test, type Page, type Route } from '@playwright/test';

import { mockNotificationsApi } from './support/apiMocks';

const companyId = 'company-close-report';
const propertyId = 'property-close-report';
const closeId = 'close-report-r2';
const snapshotHash = 'b'.repeat(64);

const workspace = {
  company: { id: companyId, slug: 'close-report-company', nameEn: 'Close Report Company', nameAr: 'شركة تقارير الإغلاق' },
  member: {
    id: 'member-close-report', companyId, userId: 'user-close-report', role: 'PMS_OWNER', active: true,
    permissionKeys: ['ACCOUNTING_VIEW', 'REPORTS_VIEW'],
    propertyScope: { allProperties: true, propertyIds: [] },
  },
  entitlement: { id: 'entitlement-close-report', status: 'ACTIVE', trialEndsAt: null, enabledAt: '2026-01-01T00:00:00.000Z', disabledAt: null },
};

const overview = {
  workspace,
  companies: [{ memberId: workspace.member.id, role: workspace.member.role, company: { ...workspace.company, pmsEntitlement: { status: 'ACTIVE', trialEndsAt: null } } }],
  metrics: {
    totalListings: 0, approvedListings: 0, draftOrPendingListings: 0, totalProjects: 0, approvedProjects: 0, draftOrPendingProjects: 0,
    activeRentSchedules: 0, openContracts: 0, pendingRentDueItems: 0, overdueRentDueItems: 0, activeTransactions: 0,
    totalPmsProperties: 1, totalPmsUnits: 1, vacantPmsUnits: 0, occupiedPmsUnits: 1, maintenancePmsUnits: 0, totalPmsTenants: 1,
    activePmsLeases: 1, expiringPmsLeases: 0, unpaidPmsRentDueItems: 0, overduePmsRentDueItems: 0, partiallyPaidPmsRentDueItems: 0,
    paidPmsRentDueItems: 1, pmsRentDueAmount: '200', pmsRentCollectedAmount: '200', openPmsWorkOrders: 0, inProgressPmsWorkOrders: 0,
    urgentPmsWorkOrders: 0, pmsMaintenanceCostAmount: '0', scheduledPmsInspections: 0, needsActionPmsInspections: 0,
    activePmsCommunicationTemplates: 0, activePmsPolicies: 0, pmsOccupancyRate: 100,
  },
  alerts: { expiringLeases: [] },
  emptyStates: { properties: false, tenants: false, marketplaceListings: true, rentals: false, contracts: true, accounting: false, maintenance: true, settings: true },
};

const reportSummary = {
  workspace,
  accounting: {
    currencyState: { status: 'SINGLE', currencies: ['OMR'], primaryCurrency: 'OMR', message: null },
    totalsByCurrency: [{ currency: 'OMR', incomeCollected: '200', outstandingRent: '0', overdueRent: '0', expenses: '25', maintenanceCosts: '25' }],
    currency: 'OMR', incomeCollected: '200', outstandingRent: '0', overdueRent: '0', expenses: '25', maintenanceCosts: '25',
    lateFeeFoundationEnabled: false, lateFeeNote: 'Late fees are disabled.',
  },
  reports: {
    occupancy: { totalUnits: 1, occupiedUnits: 1, vacantUnits: 0, occupancyRate: 100 },
    revenue: { currencyState: { status: 'SINGLE', currencies: ['OMR'], primaryCurrency: 'OMR', message: null }, byCurrency: [{ currency: 'OMR', collected: '200', outstanding: '0', overdue: '0' }], currency: 'OMR', collected: '200', outstanding: '0', overdue: '0' },
    overdueTopList: [],
    maintenance: { open: 0, inProgress: 0, resolved: 1, urgent: 0, currencyState: { status: 'SINGLE', currencies: ['OMR'], primaryCurrency: 'OMR', message: null }, costsByCurrency: [{ currency: 'OMR', amount: '25' }], currency: 'OMR', costs: '25' },
    leaseRenewals: [], inspections: { scheduled: 0, completed: 1, needsAction: 0 }, communications: { activeTemplates: 0 }, policies: { activePolicies: 0 },
  },
};

const close = {
  id: closeId, revision: 2, snapshotHash, snapshotVersion: 1, reviewEventId: 'review-event-r2', reviewReason: 'Independent month-end review',
  closeReason: 'All July controls verified', reviewedAt: '2026-08-01T08:00:00.000Z', closedAt: '2026-08-01T09:00:00.000Z', reopenedAt: null,
  reopenReason: null, createdAt: '2026-08-01T09:00:00.000Z', reviewedBy: { id: 'reviewer', name: 'Finance Reviewer' },
  closedBy: { id: 'closer', name: 'Finance Closer' }, reopenedBy: null,
  period: { id: 'period-july', status: 'CLOSED', periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-07-31T23:59:59.999Z', currency: 'OMR', propertyId, property: { id: propertyId, name: 'Governed Residences' } },
};

const snapshot = {
  snapshotVersion: 1, generatedAt: close.closedAt,
  period: { id: close.period.id, companyId, propertyId, currency: 'OMR', periodStart: close.period.periodStart, periodEnd: close.period.periodEnd },
  review: { eventId: close.reviewEventId, reason: close.reviewReason, reviewedAt: close.reviewedAt, reviewedById: close.reviewedBy.id },
  close: { reason: close.closeReason, closedAt: close.closedAt, closedById: close.closedBy.id },
  readiness: { canClose: true, blockerTotal: 0, reconciliationExceptions: 0, pendingDepositTransactions: 0, unallocatedPayments: 0, unallocatedAmount: '0', unreconciledRentPayments: 0, unreconciledVendorPayments: 0, unreconciledOwnerPayouts: 0 },
  totals: {
    rentPayments: { count: 1, amount: '200' }, accountingLedgerByType: [{ key: 'INCOME', count: 1, amount: '200' }],
    accountingLedgerBySource: [{ key: 'RENT_PAYMENT', count: 1, amount: '200' }], paidVendorInvoices: { count: 1, amount: '25' },
    paidOwnerPayouts: { count: 1, amount: '150' }, reconciliation: [{ key: 'CREDIT:MATCHED', count: 1, amount: '200' }], postedDepositTransactions: [],
  },
  recordIds: {
    rentPaymentIds: ['payment-1'], accountingLedgerEntryIds: ['ledger-1'], vendorInvoiceIds: ['invoice-1'], ownerPayoutBatchIds: ['payout-1'],
    ownerPayoutLineIds: ['payout-line-1'], ownerPayoutReconciliationItemIds: ['payout-match-1'], reconciliationItemIds: ['reconciliation-1'], securityDepositTransactionIds: [],
  },
};

function fulfill(route: Route, json: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
}

async function authenticate(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lux_om_auth_token', 'close-report-token'));
  await page.route('**/api/auth/me', (route) => fulfill(route, {
    user: {
      id: 'user-close-report', name: 'Close Report User', email: 'close-report@lux.test', role: 'USER', emailVerified: true,
      pmsAccess: { hasAccess: true, workspaces: [{ memberId: workspace.member.id, role: workspace.member.role, permissionKeys: workspace.member.permissionKeys, propertyScope: workspace.member.propertyScope, company: workspace.company, entitlement: workspace.entitlement }] },
    },
  }));
  await mockNotificationsApi(page);
}

async function mockReports(page: Page, onExport: (url: URL) => void) {
  await page.route('**/api/pms/overview**', (route) => fulfill(route, overview));
  await page.route('**/api/pms/reports/summary**', (route) => fulfill(route, reportSummary));
  await page.route(/\/api\/pms\/accounting\/close-reports(?:\/[^?]*)?(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/export')) {
      onExport(url);
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="pms-close-report-2026-07-01-omr-governed-residences-r2.csv"',
        },
        body: 'section,key,count,amount,currency,details\r\nintegrity,status,,,OMR,VERIFIED\r\n',
      });
    }
    if (url.pathname.endsWith(`/${closeId}`)) {
      return fulfill(route, { report: { close: { ...close, snapshotHash: undefined, snapshotVersion: undefined }, period: close.period, integrity: { status: 'VERIFIED', message: 'The snapshot hash and supported evidence contract are verified.', snapshotVersion: 1, storedHash: snapshotHash, computedHash: snapshotHash }, snapshot, rawSnapshot: snapshot } });
    }
    return fulfill(route, { closes: [close], pagination: { take: 10, skip: 0, count: 1, total: 1 } });
  });
}

test('financial close reports verify immutable evidence and export the selected revision', async ({ page }) => {
  let exportUrl: URL | undefined;
  await authenticate(page);
  await mockReports(page, (url) => { exportUrl = url; });

  await page.goto(`/pms/reports?companyId=${companyId}`);
  await expect(page.getByRole('heading', { name: 'Financial close reports', exact: true })).toBeVisible();
  await expect(page.getByText('Governed Residences')).toBeVisible();
  await expect(page.getByText('Active revision', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'View report', exact: true }).click();
  const report = page.getByRole('article', { name: 'Close report revision 2', exact: true });
  await expect(report.getByText('Integrity verified', { exact: true })).toBeVisible();
  await expect(report.getByText(snapshotHash, { exact: true })).toBeVisible();
  await expect(report.getByText('Finance Reviewer', { exact: true })).toBeVisible();
  await expect(report.getByText('Owner payout reconciliation matches', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await report.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pms-close-report-2026-07-01-omr-governed-residences-r2.csv');
  expect(exportUrl?.searchParams.get('companyId')).toBe(companyId);
  expect(exportUrl?.searchParams.get('format')).toBe('csv');
});

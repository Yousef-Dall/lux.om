import { apiClient } from './client';

export type PmsMoneyRecord = { amount?: string; currency: string };
export type PmsCharge = {
  id: string;
  chargeNumber: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  currency: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  creditedAmount: string;
  balanceAmount: string;
  property?: { id: string; name: string };
  unit?: { id: string; unitNumber: string } | null;
  tenant?: { id: string; fullName: string } | null;
};
export type PmsFinancialPeriod = {
  id: string;
  status: 'OPEN' | 'REVIEWING' | 'CLOSED';
  periodStart: string;
  periodEnd: string;
  currency: string;
  property?: { id: string; name: string } | null;
};
export type PmsDepositAccount = {
  id: string;
  status: string;
  expectedAmount: string;
  liabilityBalance: string;
  currency: string;
  property: { id: string; name: string };
  unit: { id: string; unitNumber: string };
};
export type PmsOwnerPayout = {
  id: string;
  payoutNumber: string;
  status: string;
  payoutAmount: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
};
export type PmsAsset = {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  status: string;
  warrantyExpiry?: string | null;
  nextServiceDate?: string | null;
  property: { id: string; name: string };
  unit?: { id: string; unitNumber: string } | null;
};
export type PmsMaintenancePlan = {
  id: string;
  title: string;
  status: string;
  nextServiceDate: string;
  intervalDays?: number | null;
  property: { id: string; name: string };
  asset?: { id: string; assetCode: string; name: string } | null;
};
export type PmsInspectionRun = {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledFor?: string | null;
  completedAt?: string | null;
  property: { id: string; name: string };
  unit?: { id: string; unitNumber: string } | null;
  defects?: Array<{ id: string; title: string; severity: string; status: string }>;
};

function companyParams(companyId?: string) { return { companyId }; }

export async function listPmsCharges(token: string, companyId?: string) {
  return apiClient.get<{ charges: PmsCharge[] }>('/api/pms/accounting/charges', { token, params: companyParams(companyId) });
}
export async function listPmsDeposits(token: string, companyId?: string) {
  return apiClient.get<{ accounts: PmsDepositAccount[] }>('/api/pms/accounting/deposits', { token, params: companyParams(companyId) });
}
export async function listPmsFinancialPeriods(token: string, companyId?: string) {
  return apiClient.get<{ periods: PmsFinancialPeriod[] }>('/api/pms/accounting/periods', { token, params: companyParams(companyId) });
}
export async function listPmsOwnerPayouts(token: string, companyId?: string) {
  return apiClient.get<{ batches: PmsOwnerPayout[] }>('/api/pms/accounting/owner-payouts', { token, params: companyParams(companyId) });
}
export async function listPmsAssets(token: string, companyId?: string) {
  return apiClient.get<{ assets: PmsAsset[] }>('/api/pms/assets', { token, params: companyParams(companyId) });
}
export async function listPmsMaintenancePlans(token: string, companyId?: string) {
  return apiClient.get<{ plans: PmsMaintenancePlan[] }>('/api/pms/preventive-maintenance/plans', { token, params: companyParams(companyId) });
}
export async function listPmsInspectionRuns(token: string, companyId?: string) {
  return apiClient.get<{ inspections: PmsInspectionRun[] }>('/api/pms/structured-inspections/runs', { token, params: companyParams(companyId) });
}

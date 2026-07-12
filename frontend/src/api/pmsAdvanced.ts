import { apiClient } from './client';

export type PmsFinancePagination = { take: number; skip: number; count: number; total: number };
export type PmsChargeStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
export type PmsChargeCategory = 'RENT' | 'UTILITIES' | 'SERVICE_CHARGE' | 'LATE_FEE' | 'MAINTENANCE' | 'DEPOSIT_DEDUCTION' | 'DISCOUNT' | 'MANUAL_ADJUSTMENT' | 'OTHER';
export type PmsChargeAdjustmentType = 'DISCOUNT' | 'WRITE_OFF' | 'REVERSAL' | 'MANUAL';
export type PmsPaymentAdjustmentType = 'REFUND' | 'REVERSAL' | 'CHARGEBACK' | 'WRITE_OFF';
export type PmsPaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export type PmsPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD_MANUAL' | 'CHEQUE' | 'ONLINE_GATEWAY' | 'OTHER';

export type PmsChargeLine = {
  id?: string;
  category: PmsChargeCategory;
  description: string;
  quantity: string;
  unitAmount: string;
  amount: string;
  position?: number;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
};

export type PmsChargeAdjustment = {
  id: string;
  type: PmsChargeAdjustmentType;
  amount: string;
  reason: string;
  active: boolean;
  reversedAt?: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
  reversedBy?: { id: string; name: string } | null;
};

export type PmsCreditNote = {
  id: string;
  creditNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'APPLIED' | 'VOID';
  amount: string;
  remainingAmount: string;
  currency: string;
  reason: string;
  createdAt: string;
  approvedAt?: string | null;
  appliedAt?: string | null;
  voidedAt?: string | null;
};

export type PmsPaymentAllocation = {
  id: string;
  amount: string;
  currency: string;
  status: 'ACTIVE' | 'REVERSED';
  chargeId: string;
  paymentId: string;
  createdAt: string;
  reversedAt?: string | null;
  reversalReason?: string | null;
  charge?: {
    id: string;
    chargeNumber: string;
    status?: PmsChargeStatus;
    dueDate: string;
    totalAmount: string;
    balanceAmount: string;
  };
  payment?: {
    id: string;
    receiptNumber?: string | null;
    paidAt?: string | null;
    amount: string;
    method: PmsPaymentMethod;
  };
  createdBy?: { id: string; name: string } | null;
  reversedBy?: { id: string; name: string } | null;
};

export type PmsCharge = {
  id: string;
  chargeNumber: string;
  status: PmsChargeStatus;
  currency: string;
  dueDate: string;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  subtotal: string;
  adjustmentTotal: string;
  totalAmount: string;
  paidAmount: string;
  creditedAmount: string;
  balanceAmount: string;
  notes?: string | null;
  issuedAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  propertyId: string;
  property?: { id: string; name: string };
  unitId?: string | null;
  unit?: { id: string; unitNumber: string } | null;
  tenantId?: string | null;
  tenant?: { id: string; fullName: string } | null;
  leaseId?: string | null;
  lease?: { id: string; title?: string | null; currency: string } | null;
  lines?: PmsChargeLine[];
  adjustments?: PmsChargeAdjustment[];
  creditNotes?: PmsCreditNote[];
  allocations?: PmsPaymentAllocation[];
  documents?: Array<{ id: string; title: string; type: string; status: string; createdAt: string }>;
  _count?: { allocations: number; adjustments: number; creditNotes: number };
  createdAt: string;
  updatedAt: string;
};

export type PmsChargePayload = {
  companyId: string;
  propertyId: string;
  unitId?: string | null;
  leaseId?: string | null;
  tenantId?: string | null;
  currency: string;
  dueDate: string;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  notes?: string | null;
  lines: Array<{
    category: PmsChargeCategory;
    description: string;
    quantity: number;
    unitAmount: number;
    servicePeriodStart?: string | null;
    servicePeriodEnd?: string | null;
  }>;
};

export type PmsChargeTotals = {
  currency: string;
  count: number;
  totalAmount: string;
  paidAmount: string;
  creditedAmount: string;
  balanceAmount: string;
};

export type PmsPaymentAdjustment = {
  id: string;
  type: PmsPaymentAdjustmentType;
  status: 'POSTED' | 'REVERSED';
  amount: string;
  currency: string;
  reason: string;
  referenceNumber?: string | null;
  createdAt: string;
  reversedAt?: string | null;
  createdBy?: { id: string; name: string } | null;
  reversedBy?: { id: string; name: string } | null;
};

export type PmsPayment = {
  id: string;
  amount: string;
  currency: string;
  method: PmsPaymentMethod;
  status: PmsPaymentStatus;
  referenceNumber?: string | null;
  notes?: string | null;
  paidAt?: string | null;
  confirmedAt?: string | null;
  receiptNumber?: string | null;
  propertyId: string;
  property: { id: string; name: string };
  unitId: string;
  unit: { id: string; unitNumber: string };
  tenantId: string;
  tenant?: { id: string; fullName: string } | null;
  leaseId: string;
  lease?: { id: string; title?: string | null; currency?: string } | null;
  recordedBy?: { id: string; name: string; email: string } | null;
  allocations: PmsPaymentAllocation[];
  adjustments: PmsPaymentAdjustment[];
  securityDepositTransactions?: Array<Record<string, unknown>>;
  reconciliationItems?: Array<Record<string, unknown>>;
  allocatedAmount: string;
  adjustedAmount: string;
  depositAllocatedAmount: string;
  availableAmount: string;
  createdAt: string;
  updatedAt: string;
};

export type PmsPaymentBalance = {
  paymentId: string;
  receivedAmount: string;
  allocatedAmount: string;
  adjustedAmount: string;
  refundedOrChargedBackAmount: string;
  depositAllocatedAmount: string;
  availableAmount: string;
  currency: string;
};

export type PmsPaymentPayload = {
  companyId: string;
  propertyId: string;
  unitId: string;
  leaseId: string;
  tenantId: string;
  amount: number;
  currency: string;
  method: PmsPaymentMethod;
  paidAt: string;
  referenceNumber?: string | null;
  notes?: string | null;
  idempotencyKey: string;
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

export function listPmsCharges(token: string, params: {
  companyId?: string;
  propertyId?: string;
  tenantId?: string;
  status?: PmsChargeStatus;
  openOnly?: boolean;
  currency?: string;
  search?: string;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: 'dueDate' | 'createdAt' | 'updatedAt' | 'chargeNumber' | 'balanceAmount' | 'status';
  direction?: 'asc' | 'desc';
  take?: number;
  skip?: number;
  signal?: AbortSignal;
} = {}) {
  const { signal, ...query } = params;
  return apiClient.get<{ charges: PmsCharge[]; pagination: PmsFinancePagination; totalsByCurrency: PmsChargeTotals[] }>('/api/pms/accounting/charges', { token, params: query, signal });
}

export function getPmsCharge(token: string, chargeId: string, companyId?: string, signal?: AbortSignal) {
  return apiClient.get<{ charge: PmsCharge }>(`/api/pms/accounting/charges/${chargeId}`, { token, params: companyParams(companyId), signal });
}

export function createPmsCharge(token: string, payload: PmsChargePayload) {
  return apiClient.post<{ charge: PmsCharge }>('/api/pms/accounting/charges', payload, { token });
}

export function updatePmsCharge(token: string, chargeId: string, payload: PmsChargePayload) {
  return apiClient.patch<{ charge: PmsCharge }>(`/api/pms/accounting/charges/${chargeId}`, payload, { token });
}

export function issuePmsCharge(token: string, chargeId: string, companyId: string) {
  return apiClient.post<{ charge: PmsCharge }>(`/api/pms/accounting/charges/${chargeId}/issue`, { companyId }, { token });
}

export function adjustPmsCharge(token: string, chargeId: string, payload: { companyId: string; type: PmsChargeAdjustmentType; amount: number; reason: string }) {
  return apiClient.post<{ adjustment: PmsChargeAdjustment; charge: PmsCharge }>(`/api/pms/accounting/charges/${chargeId}/adjustments`, payload, { token });
}

export function voidPmsCharge(token: string, chargeId: string, companyId: string, reason: string) {
  return apiClient.post<{ charge: PmsCharge }>(`/api/pms/accounting/charges/${chargeId}/void`, { companyId, reason }, { token });
}

export function createPmsCreditNote(token: string, chargeId: string, payload: { companyId: string; amount: number; reason: string }) {
  return apiClient.post<{ creditNote: PmsCreditNote }>(`/api/pms/accounting/charges/${chargeId}/credit-notes`, payload, { token });
}

export function transitionPmsCreditNote(token: string, creditNoteId: string, payload: { companyId: string; action: 'APPROVE' | 'APPLY' | 'VOID'; reason?: string }) {
  return apiClient.post<{ creditNote: PmsCreditNote }>(`/api/pms/accounting/credit-notes/${creditNoteId}/transition`, payload, { token });
}

export function listPmsPayments(token: string, params: {
  companyId?: string;
  propertyId?: string;
  tenantId?: string;
  status?: PmsPaymentStatus;
  currency?: string;
  search?: string;
  paidFrom?: string;
  paidTo?: string;
  sortBy?: 'paidAt' | 'createdAt' | 'updatedAt' | 'amount' | 'receiptNumber' | 'status';
  direction?: 'asc' | 'desc';
  take?: number;
  skip?: number;
  signal?: AbortSignal;
} = {}) {
  const { signal, ...query } = params;
  return apiClient.get<{ payments: PmsPayment[]; pagination: PmsFinancePagination; totalsByCurrency: Array<{ currency: string; count: number; recordedAmount: string }> }>('/api/pms/accounting/payments', { token, params: query, signal });
}

export function getPmsPayment(token: string, paymentId: string, companyId?: string, signal?: AbortSignal) {
  return apiClient.get<{ payment: Omit<PmsPayment, 'allocatedAmount' | 'adjustedAmount' | 'depositAllocatedAmount' | 'availableAmount'>; balance: PmsPaymentBalance }>(`/api/pms/accounting/payments/${paymentId}`, { token, params: companyParams(companyId), signal });
}

export function createPmsPayment(token: string, payload: PmsPaymentPayload) {
  return apiClient.post<{ payment: PmsPayment; idempotent: boolean }>('/api/pms/accounting/payments', payload, { token });
}

export function allocatePmsPaymentBatch(token: string, paymentId: string, payload: { companyId: string; idempotencyKey: string; allocations: Array<{ chargeId: string; amount: number }> }) {
  return apiClient.post<{ allocations: PmsPaymentAllocation[]; idempotent: boolean }>(`/api/pms/accounting/payments/${paymentId}/allocations/batch`, payload, { token });
}

export function reversePmsPaymentAllocation(token: string, paymentId: string, allocationId: string, companyId: string, reason: string) {
  return apiClient.post<{ allocation: PmsPaymentAllocation }>(`/api/pms/accounting/payments/${paymentId}/allocations/${allocationId}/reverse`, { companyId, reason }, { token });
}

export function adjustPmsPayment(token: string, paymentId: string, payload: { companyId: string; allocationId?: string | null; type: PmsPaymentAdjustmentType; amount: number; reason: string; idempotencyKey: string; referenceNumber?: string | null }) {
  return apiClient.post<{ adjustment: PmsPaymentAdjustment; idempotent: boolean }>(`/api/pms/accounting/payments/${paymentId}/adjustments`, payload, { token });
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

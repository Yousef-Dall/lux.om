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

export type PmsFinancialPeriodStatus = 'OPEN' | 'REVIEWING' | 'CLOSED';
export type PmsFinancialPeriodEvent = {
  id: string;
  fromStatus?: PmsFinancialPeriodStatus | null;
  toStatus: PmsFinancialPeriodStatus;
  reason?: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
};
export type PmsFinancialPeriod = {
  id: string;
  status: PmsFinancialPeriodStatus;
  periodStart: string;
  periodEnd: string;
  currency: string;
  propertyId?: string | null;
  property?: { id: string; name: string } | null;
  closeReason?: string | null;
  closedAt?: string | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string } | null;
  updatedBy?: { id: string; name: string } | null;
  events?: PmsFinancialPeriodEvent[];
};
export type PmsFinancialPeriodReadiness = {
  canClose: boolean;
  reconciliationExceptions: number;
  pendingDepositTransactions: number;
};
export type PmsDepositTransactionType = 'COLLECTION' | 'DEDUCTION' | 'REFUND' | 'CONVERSION_TO_INCOME' | 'ADJUSTMENT';
export type PmsDepositTransactionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'VOID';
export type PmsDepositTransaction = {
  id: string;
  type: PmsDepositTransactionType;
  status: PmsDepositTransactionStatus;
  amount: string;
  currency: string;
  reason?: string | null;
  approvedAt?: string | null;
  postedAt?: string | null;
  voidedAt?: string | null;
  createdAt: string;
  payment?: { id: string; receiptNumber?: string | null; amount: string; currency: string; paidAt?: string | null } | null;
  charge?: { id: string; chargeNumber: string; status: PmsChargeStatus; totalAmount: string; balanceAmount: string; currency: string } | null;
  createdBy?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  documents?: Array<{ id: string; title: string; type: string; status: string; createdAt: string }>;
};
export type PmsDepositAccountStatus = 'EXPECTED' | 'HELD' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'CLOSED';
export type PmsDepositAccount = {
  id: string;
  status: PmsDepositAccountStatus;
  expectedAmount: string;
  liabilityBalance: string;
  currency: string;
  propertyId: string;
  property: { id: string; name: string };
  unitId: string;
  unit: { id: string; unitNumber: string };
  leaseId: string;
  lease?: { id: string; title?: string | null; status?: string; startDate?: string; endDate?: string } | null;
  tenantId: string;
  tenant?: { id: string; fullName: string } | null;
  transactions?: PmsDepositTransaction[];
  _count?: { transactions: number };
  createdAt: string;
  updatedAt: string;
};
export type PmsReconciliationStatus = 'UNMATCHED' | 'MATCHED' | 'DUPLICATE' | 'IGNORED';
export type PmsReconciliationSource = 'BANK' | 'PAYMENT_PROVIDER' | 'CASHBOOK' | 'MANUAL';
export type PmsReconciliationItem = {
  id: string;
  source: PmsReconciliationSource;
  status: PmsReconciliationStatus;
  externalReference: string;
  amount: string;
  currency: string;
  transactionDate: string;
  payerReference?: string | null;
  matchReason?: string | null;
  matchedAt?: string | null;
  propertyId?: string | null;
  property?: { id: string; name: string } | null;
  paymentId?: string | null;
  payment?: { id: string; amount: string; currency: string; receiptNumber?: string | null; paidAt?: string | null; status: PmsPaymentStatus } | null;
  duplicateOfId?: string | null;
  duplicateOf?: { id: string; externalReference: string } | null;
  createdBy?: { id: string; name: string } | null;
  matchedBy?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};
export type PmsOwnerPayoutStatus = 'DRAFT' | 'APPROVED' | 'PROCESSING' | 'PAID_MANUAL' | 'FAILED' | 'CANCELLED';
export type PmsOwnerPayoutDocument = {
  id: string;
  title: string;
  type: string;
  status: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  uploadedBy?: { id: string; name: string; email: string } | null;
};
export type PmsOwnerPayoutLine = {
  id: string;
  propertyId: string;
  property: { id: string; name: string; code?: string | null };
  statementId: string;
  statement: {
    id: string;
    revision: number;
    status: string;
    periodStart: string;
    periodEnd: string;
    currency: string;
    openingBalance: string;
    income: string;
    expenses: string;
    adjustments: string;
    closingBalance: string;
  };
  incomeAmount: string;
  expenseAmount: string;
  managementFeeAmount: string;
  reservedAmount: string;
  netAmount: string;
  currency: string;
  createdAt: string;
};
export type PmsOwnerPayout = {
  id: string;
  payoutNumber: string;
  status: PmsOwnerPayoutStatus;
  grossAmount: string;
  managementFeeAmount: string;
  reservedAmount: string;
  payoutAmount: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  payoutReference?: string | null;
  paymentMethodNote?: string | null;
  approvedAt?: string | null;
  processingAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  failureReason?: string | null;
  notes?: string | null;
  ownerUserId: string;
  ownerUser: { id: string; name: string; email: string };
  createdBy?: { id: string; name: string; email: string } | null;
  approvedBy?: { id: string; name: string; email: string } | null;
  paidBy?: { id: string; name: string; email: string } | null;
  cancelledBy?: { id: string; name: string; email: string } | null;
  lines: PmsOwnerPayoutLine[];
  documents: PmsOwnerPayoutDocument[];
  createdAt: string;
  updatedAt: string;
};
export type PmsOwnerPayoutAuditEvent = {
  id: string;
  action: string;
  actorId?: string | null;
  metadata?: unknown;
  beforeMetadata?: unknown;
  afterMetadata?: unknown;
  createdAt: string;
};

export type PmsVendorInvoiceStatus = 'DRAFT' | 'SUBMITTED' | 'NEEDS_REVIEW' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REJECTED' | 'VOID';
export type PmsVendorInvoiceDocument = {
  id: string;
  title: string;
  type: string;
  status: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  uploadedBy?: { id: string; name: string; email: string } | null;
};
export type PmsVendorInvoice = {
  id: string;
  invoiceNumber: string;
  externalInvoiceNumber?: string | null;
  status: PmsVendorInvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  approvedAmount?: string | null;
  paidAmount: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  processingAt?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  rejectedAt?: string | null;
  voidedAt?: string | null;
  paymentReference?: string | null;
  paymentMethodNote?: string | null;
  failureReason?: string | null;
  notes?: string | null;
  companyId: string;
  propertyId: string;
  vendorId: string;
  workOrderId: string;
  approvedQuoteId?: string | null;
  createdById?: string | null;
  submittedById?: string | null;
  reviewedById?: string | null;
  approvedById?: string | null;
  processingById?: string | null;
  paidById?: string | null;
  property: { id: string; name: string; code?: string | null };
  vendor: { id: string; name: string; trade?: string | null; email?: string | null };
  workOrder: { id: string; title: string; status: string; currency: string; cost?: string | null; approvedQuoteId?: string | null };
  approvedQuote?: { id: string; amount: string; currency: string; status: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
  submittedBy?: { id: string; name: string; email: string } | null;
  reviewedBy?: { id: string; name: string; email: string } | null;
  approvedBy?: { id: string; name: string; email: string } | null;
  processingBy?: { id: string; name: string; email: string } | null;
  paidBy?: { id: string; name: string; email: string } | null;
  rejectedBy?: { id: string; name: string; email: string } | null;
  voidedBy?: { id: string; name: string; email: string } | null;
  documents: PmsVendorInvoiceDocument[];
  ledgerEntries: Array<{ id: string; type: string; source: string; amount: string; currency: string; transactionDate: string; referenceNumber?: string | null }>;
  createdAt: string;
  updatedAt: string;
};
export type PmsVendorInvoiceWorkOrderOption = {
  id: string;
  title: string;
  status: string;
  propertyId: string;
  vendorId?: string | null;
  currency: string;
  approvedQuoteId?: string | null;
  property: { id: string; name: string; code?: string | null };
  vendor?: { id: string; name: string } | null;
  approvedQuote?: { id: string; amount: string; currency: string; status: string } | null;
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

export function listPmsDeposits(token: string, params: {
  companyId?: string;
  search?: string;
  status?: PmsDepositAccountStatus;
  currency?: string;
  propertyId?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'expectedAmount' | 'liabilityBalance' | 'status';
  direction?: 'asc' | 'desc';
  take?: number;
  skip?: number;
  signal?: AbortSignal;
} = {}) {
  const { signal, ...query } = params;
  return apiClient.get<{
    accounts: PmsDepositAccount[];
    pagination: PmsFinancePagination;
    totalsByCurrency: Array<{ currency: string; count: number; expectedAmount: string; liabilityBalance: string }>;
  }>('/api/pms/accounting/deposits', { token, params: query, signal });
}
export function getPmsDeposit(token: string, accountId: string, companyId?: string, signal?: AbortSignal) {
  return apiClient.get<{ account: PmsDepositAccount }>(`/api/pms/accounting/deposits/${accountId}`, { token, params: companyParams(companyId), signal });
}
export function createPmsDepositAccount(token: string, payload: { companyId: string; leaseId: string; expectedAmount: number }) {
  return apiClient.post<{ account: PmsDepositAccount }>('/api/pms/accounting/deposits', payload, { token });
}
export function createPmsDepositTransaction(token: string, accountId: string, payload: {
  companyId: string;
  type: PmsDepositTransactionType;
  amount: number;
  reason?: string | null;
  idempotencyKey: string;
  paymentId?: string | null;
  chargeId?: string | null;
}) {
  return apiClient.post<{ transaction: PmsDepositTransaction; idempotent: boolean }>(`/api/pms/accounting/deposits/${accountId}/transactions`, payload, { token });
}
export function transitionPmsDepositTransaction(token: string, accountId: string, transactionId: string, payload: { companyId: string; action: 'APPROVE' | 'POST' | 'VOID'; reason?: string }) {
  return apiClient.post<{ transaction: PmsDepositTransaction }>(`/api/pms/accounting/deposits/${accountId}/transactions/${transactionId}/transition`, payload, { token });
}
export function listPmsFinancialPeriods(token: string, params: {
  companyId?: string;
  status?: PmsFinancialPeriodStatus;
  currency?: string;
  propertyId?: string;
  sortBy?: 'periodStart' | 'periodEnd' | 'createdAt' | 'status';
  direction?: 'asc' | 'desc';
  take?: number;
  skip?: number;
  signal?: AbortSignal;
} = {}) {
  const { signal, ...query } = params;
  return apiClient.get<{ periods: PmsFinancialPeriod[]; pagination: PmsFinancePagination }>('/api/pms/accounting/periods', { token, params: query, signal });
}
export function getPmsFinancialPeriodReadiness(token: string, periodId: string, companyId?: string, signal?: AbortSignal) {
  return apiClient.get<{ period: PmsFinancialPeriod; readiness: PmsFinancialPeriodReadiness }>(`/api/pms/accounting/periods/${periodId}/readiness`, { token, params: companyParams(companyId), signal });
}
export function createPmsFinancialPeriod(token: string, payload: { companyId: string; propertyId?: string | null; currency: string; periodStart: string; periodEnd: string }) {
  return apiClient.post<{ period: PmsFinancialPeriod }>('/api/pms/accounting/periods', payload, { token });
}
export function transitionPmsFinancialPeriod(token: string, periodId: string, payload: { companyId: string; action: 'REVIEW' | 'CLOSE' | 'REOPEN'; reason: string }) {
  return apiClient.post<{ period: PmsFinancialPeriod }>(`/api/pms/accounting/periods/${periodId}/transition`, payload, { token });
}
export function listPmsReconciliationItems(token: string, params: {
  companyId?: string;
  search?: string;
  status?: PmsReconciliationStatus;
  source?: PmsReconciliationSource;
  currency?: string;
  propertyId?: string;
  transactionFrom?: string;
  transactionTo?: string;
  sortBy?: 'transactionDate' | 'createdAt' | 'amount' | 'status' | 'externalReference';
  direction?: 'asc' | 'desc';
  take?: number;
  skip?: number;
  signal?: AbortSignal;
} = {}) {
  const { signal, ...query } = params;
  return apiClient.get<{
    items: PmsReconciliationItem[];
    pagination: PmsFinancePagination;
    totalsByStatus: Array<{ status: PmsReconciliationStatus; count: number }>;
    totalsByCurrency: Array<{ currency: string; count: number; amount: string }>;
  }>('/api/pms/accounting/reconciliation', { token, params: query, signal });
}
export function createPmsReconciliationItem(token: string, payload: {
  companyId: string;
  source: PmsReconciliationSource;
  externalReference: string;
  amount: number;
  currency: string;
  transactionDate: string;
  propertyId?: string | null;
  payerReference?: string | null;
}) {
  return apiClient.post<{ item: PmsReconciliationItem }>('/api/pms/accounting/reconciliation', payload, { token });
}
export function matchPmsReconciliationItem(token: string, itemId: string, payload: { companyId: string; paymentId: string; reason: string }) {
  return apiClient.post<{ item: PmsReconciliationItem }>(`/api/pms/accounting/reconciliation/${itemId}/match`, payload, { token });
}
export function transitionPmsReconciliationItem(token: string, itemId: string, payload: { companyId: string; action: 'IGNORE' | 'RESTORE_UNMATCHED'; reason: string }) {
  return apiClient.post<{ item: PmsReconciliationItem }>(`/api/pms/accounting/reconciliation/${itemId}/transition`, payload, { token });
}
export async function listPmsOwnerPayouts(token: string, params: {
  companyId?: string;
  search?: string;
  status?: PmsOwnerPayoutStatus;
  currency?: string;
  propertyId?: string;
  ownerUserId?: string;
  sortBy?: 'createdAt' | 'periodEnd' | 'payoutAmount' | 'status' | 'payoutNumber';
  direction?: 'asc' | 'desc';
  take?: number;
  skip?: number;
  signal?: AbortSignal;
} = {}) {
  const { signal, ...query } = params;
  return apiClient.get<{
    batches: PmsOwnerPayout[];
    pagination: PmsFinancePagination;
    totalsByStatus: Array<{ status: PmsOwnerPayoutStatus; count: number }>;
    totalsByCurrency: Array<{ currency: string; count: number; payoutAmount: string }>;
    ownerAccesses: Array<{ id: string; propertyId: string; property: { id: string; name: string; code?: string | null }; userId: string; user: { id: string; name: string; email: string } }>;
  }>('/api/pms/accounting/owner-payouts', { token, params: query, signal });
}
export function getPmsOwnerPayout(token: string, payoutId: string, companyId?: string) {
  return apiClient.get<{ batch: PmsOwnerPayout; events: PmsOwnerPayoutAuditEvent[] }>(`/api/pms/accounting/owner-payouts/${payoutId}`, { token, params: companyParams(companyId) });
}
export function createPmsOwnerPayout(token: string, payload: {
  companyId: string;
  ownerUserId: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  notes?: string | null;
  lines: Array<{ statementId: string; managementFeeAmount?: number; reservedAmount?: number }>;
}) {
  return apiClient.post<{ batch: PmsOwnerPayout }>('/api/pms/accounting/owner-payouts', payload, { token });
}
export function transitionPmsOwnerPayout(token: string, payoutId: string, payload: {
  companyId: string;
  action: 'APPROVE' | 'SUBMIT' | 'RECORD_PAID' | 'RECORD_FAILED' | 'RETRY' | 'CANCEL';
  reason?: string;
  payoutReference?: string;
  paymentMethodNote?: string;
  evidenceDocumentId?: string;
  adapter?: 'MANUAL_BANK_EVIDENCE';
  providerConfirmed?: boolean;
}) {
  return apiClient.post<{ batch: PmsOwnerPayout }>(`/api/pms/accounting/owner-payouts/${payoutId}/transition`, payload, { token });
}
export function listPmsVendorInvoices(token: string, params: {
  companyId?: string;
  search?: string;
  status?: PmsVendorInvoiceStatus;
  currency?: string;
  propertyId?: string;
  vendorId?: string;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: 'createdAt' | 'dueDate' | 'totalAmount' | 'status' | 'invoiceNumber';
  direction?: 'asc' | 'desc';
  take?: number;
  skip?: number;
  signal?: AbortSignal;
} = {}) {
  const { signal, ...query } = params;
  return apiClient.get<{
    invoices: PmsVendorInvoice[];
    pagination: PmsFinancePagination;
    totalsByStatus: Array<{ status: PmsVendorInvoiceStatus; count: number }>;
    totalsByCurrency: Array<{ currency: string; count: number; totalAmount: string; approvedAmount: string; paidAmount: string }>;
    overdueCount: number;
    vendors: Array<{ id: string; name: string }>;
    properties: Array<{ id: string; name: string; code?: string | null }>;
    workOrders: PmsVendorInvoiceWorkOrderOption[];
  }>('/api/pms/accounting/vendor-invoices', { token, params: query, signal });
}
export function getPmsVendorInvoice(token: string, invoiceId: string, companyId?: string) {
  return apiClient.get<{ invoice: PmsVendorInvoice }>(`/api/pms/accounting/vendor-invoices/${invoiceId}`, { token, params: companyParams(companyId) });
}
export function createPmsVendorInvoice(token: string, payload: {
  companyId: string;
  propertyId: string;
  vendorId: string;
  workOrderId: string;
  approvedQuoteId?: string | null;
  invoiceNumber: string;
  externalInvoiceNumber?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
}) {
  return apiClient.post<{ invoice: PmsVendorInvoice }>('/api/pms/accounting/vendor-invoices', payload, { token });
}
export function updatePmsVendorInvoice(token: string, invoiceId: string, payload: Partial<{
  companyId: string;
  propertyId: string;
  vendorId: string;
  workOrderId: string;
  approvedQuoteId: string | null;
  invoiceNumber: string;
  externalInvoiceNumber: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
}>) {
  return apiClient.patch<{ invoice: PmsVendorInvoice }>(`/api/pms/accounting/vendor-invoices/${invoiceId}`, payload, { token });
}
export function transitionPmsVendorInvoice(token: string, invoiceId: string, payload: {
  companyId: string;
  action: 'SUBMIT' | 'REVIEW' | 'APPROVE' | 'REJECT' | 'SUBMIT_PAYMENT' | 'RECORD_PAID' | 'RECORD_FAILED' | 'RETRY' | 'VOID';
  reason?: string;
  approvedAmount?: number;
  evidenceDocumentId?: string;
  paymentReference?: string;
  paymentMethodNote?: string;
  providerConfirmed?: boolean;
  adapter?: 'MANUAL_BANK_EVIDENCE';
  paidAt?: string;
}) {
  return apiClient.post<{ invoice: PmsVendorInvoice }>(`/api/pms/accounting/vendor-invoices/${invoiceId}/transition`, payload, { token });
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

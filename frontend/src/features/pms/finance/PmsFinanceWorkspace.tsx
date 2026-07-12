import { CreditCard, Landmark, LockKeyhole, Plus, ReceiptText } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import {
  adjustPmsCharge,
  adjustPmsPayment,
  createPmsCreditNote,
  getPmsCharge,
  getPmsPayment,
  issuePmsCharge,
  listPmsCharges,
  listPmsDeposits,
  listPmsFinancialPeriods,
  listPmsOwnerPayouts,
  listPmsPayments,
  reversePmsPaymentAllocation,
  transitionPmsCreditNote,
  type PmsCharge,
  type PmsChargeStatus,
  type PmsFinancePagination,
  type PmsPayment,
  type PmsPaymentBalance,
  type PmsPaymentStatus,
  voidPmsCharge,
} from '../../../api/pmsAdvanced';
import { useAuth } from '../../../auth/AuthContext';
import { useLanguage } from '../../../i18n/LanguageContext';
import { canCollectPmsRent, canManagePmsAccounting, resolvePmsWorkspace } from '../access';
import AllocationDialog from './AllocationDialog';
import ChargeDetailDialog from './ChargeDetailDialog';
import ChargeEditorDialog from './ChargeEditorDialog';
import FinanceActionDialog from './FinanceActionDialog';
import PaymentDetailDialog from './PaymentDetailDialog';
import PaymentEditorDialog from './PaymentEditorDialog';
import {
  createFinanceIdempotencyKey,
  financeCopy,
  formatFinanceDate,
  formatFinanceEnum,
  formatFinanceMoney,
} from './copy';

export type PmsFinanceSection = 'overview' | 'charges' | 'payments';

const PAGE_SIZE = 25;
const chargeSortOptions = ['dueDate:desc', 'dueDate:asc', 'createdAt:desc', 'balanceAmount:desc'] as const;
const paymentSortOptions = ['paidAt:desc', 'paidAt:asc', 'createdAt:desc', 'amount:desc'] as const;

function normalizedSort<T extends readonly string[]>(value: string | null, options: T, fallback: T[number]) {
  return options.includes(value as T[number]) ? value as T[number] : fallback;
}

function apiMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function pageRange(pagination: PmsFinancePagination | null) {
  if (!pagination || pagination.total === 0) return { from: 0, to: 0 };
  return {
    from: pagination.skip + 1,
    to: pagination.skip + pagination.count,
  };
}

type FinanceQueryUpdates = Record<string, string | null | undefined>;

function useFinanceSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const latestSearchParamsRef = useRef(new URLSearchParams(searchParams));
  const pendingSearchParamsRef = useRef<string[]>([]);

  useEffect(() => {
    const incomingSearch = searchParams.toString();
    const pendingIndex = pendingSearchParamsRef.current.indexOf(incomingSearch);
    if (pendingIndex >= 0) {
      pendingSearchParamsRef.current = pendingSearchParamsRef.current.slice(pendingIndex + 1);
      if (pendingSearchParamsRef.current.length === 0) {
        latestSearchParamsRef.current = new URLSearchParams(searchParams);
      }
      return;
    }
    pendingSearchParamsRef.current = [];
    latestSearchParamsRef.current = new URLSearchParams(searchParams);
  }, [searchParams]);

  const replaceFinanceQuery = useCallback((updates: FinanceQueryUpdates) => {
    const current = latestSearchParamsRef.current;
    const next = new URLSearchParams(current);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    const nextSearch = next.toString();
    if (nextSearch === current.toString()) return;
    latestSearchParamsRef.current = next;
    pendingSearchParamsRef.current.push(nextSearch);
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  return { searchParams, replaceFinanceQuery };
}

function StatusBadge({ value, language }: { value: string; language: 'en' | 'ar' }) {
  return <span className={`pms-finance-status pms-finance-status--${value.toLowerCase()}`}>{formatFinanceEnum(value, language)}</span>;
}

function FinanceOverview({ token, companyId, language }: { token: string; companyId: string; language: 'en' | 'ar' }) {
  const copy = financeCopy[language];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chargeTotals, setChargeTotals] = useState<Array<{ currency: string; count: number; balanceAmount: string }>>([]);
  const [paymentTotals, setPaymentTotals] = useState<Array<{ currency: string; count: number; recordedAmount: string }>>([]);
  const [depositCount, setDepositCount] = useState(0);
  const [closedPeriods, setClosedPeriods] = useState(0);
  const [payoutCount, setPayoutCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void Promise.all([
      listPmsCharges(token, { companyId, openOnly: true, take: 1, skip: 0, signal: controller.signal }),
      listPmsPayments(token, { companyId, take: 1, skip: 0, signal: controller.signal }),
      listPmsDeposits(token, { companyId, take: 1, skip: 0 }),
      listPmsFinancialPeriods(token, { companyId, take: 100, skip: 0 }),
      listPmsOwnerPayouts(token, { companyId, take: 1, skip: 0 }),
    ]).then(([charges, payments, deposits, periods, payouts]) => {
      setChargeTotals(charges.totalsByCurrency);
      setPaymentTotals(payments.totalsByCurrency);
      setDepositCount(deposits.accounts.length);
      setClosedPeriods(periods.periods.filter((period) => period.status === 'CLOSED').length);
      setPayoutCount(payouts.batches.length);
    }).catch((loadError) => {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(apiMessage(loadError, copy.formError));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, copy.formError, token]);

  if (loading) return <div className="pms-finance-state">{copy.loading}</div>;
  if (error) return <div className="pms-finance-state pms-finance-state--error" role="alert">{error}</div>;

  return (
    <>
      <section className="pms-metric-grid" aria-label={copy.overviewTitle}>
        {chargeTotals.length ? chargeTotals.map((total) => (
          <Link className="pms-metric-card pms-metric-card--link" key={total.currency} to={`/pms/finance/charges?companyId=${encodeURIComponent(companyId)}&currency=${total.currency}`}>
            <ReceiptText aria-hidden="true" size={20} /><span>{copy.outstandingCharges} · {total.currency}</span><strong>{formatFinanceMoney(total.balanceAmount, total.currency, language)}</strong><small>{total.count} {copy.count}</small>
          </Link>
        )) : <Link className="pms-metric-card pms-metric-card--link" to={`/pms/finance/charges?companyId=${encodeURIComponent(companyId)}`}><ReceiptText aria-hidden="true" size={20} /><span>{copy.outstandingCharges}</span><strong>0</strong></Link>}
        {paymentTotals.length ? paymentTotals.map((total) => (
          <Link className="pms-metric-card pms-metric-card--link" key={total.currency} to={`/pms/finance/payments?companyId=${encodeURIComponent(companyId)}&currency=${total.currency}`}>
            <CreditCard aria-hidden="true" size={20} /><span>{copy.recordedPayments} · {total.currency}</span><strong>{formatFinanceMoney(total.recordedAmount, total.currency, language)}</strong><small>{total.count} {copy.count}</small>
          </Link>
        )) : <Link className="pms-metric-card pms-metric-card--link" to={`/pms/finance/payments?companyId=${encodeURIComponent(companyId)}`}><CreditCard aria-hidden="true" size={20} /><span>{copy.recordedPayments}</span><strong>0</strong></Link>}
        <article className="pms-metric-card"><Landmark aria-hidden="true" size={20} /><span>{copy.depositLiabilities}</span><strong>{depositCount}</strong></article>
        <article className="pms-metric-card"><LockKeyhole aria-hidden="true" size={20} /><span>{copy.closedPeriods}</span><strong>{closedPeriods}</strong></article>
        <article className="pms-metric-card"><CreditCard aria-hidden="true" size={20} /><span>{copy.payoutBatches}</span><strong>{payoutCount}</strong></article>
      </section>
      <div className="pms-finance-overview-links">
        <Link className="button-link button-link--primary" to={`/pms/finance/charges?companyId=${encodeURIComponent(companyId)}`}>{copy.charges}</Link>
        <Link className="button-link button-link--secondary" to={`/pms/finance/payments?companyId=${encodeURIComponent(companyId)}`}>{copy.payments}</Link>
        <Link className="button-link button-link--secondary" to={`/pms/finance/records?companyId=${encodeURIComponent(companyId)}`}>{copy.records}</Link>
      </div>
    </>
  );
}

function ChargeWorkspace({ token, companyId, language, canManage }: { token: string; companyId: string; language: 'en' | 'ar'; canManage: boolean }) {
  const copy = financeCopy[language];
  const { searchParams, replaceFinanceQuery } = useFinanceSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const status = (searchParams.get('status') || '') as PmsChargeStatus | '';
  const currency = searchParams.get('currency') ?? '';
  const query = searchParams.get('q') ?? '';
  const chargeSort = normalizedSort(searchParams.get('sort'), chargeSortOptions, 'dueDate:desc');
  const [chargeSortBy, chargeDirection] = chargeSort.split(':') as ['dueDate' | 'createdAt' | 'balanceAmount', 'asc' | 'desc'];
  const [searchInput, setSearchInput] = useState(query);
  const [currencyInput, setCurrencyInput] = useState(currency);
  const [charges, setCharges] = useState<PmsCharge[]>([]);
  const [pagination, setPagination] = useState<PmsFinancePagination | null>(null);
  const [totals, setTotals] = useState<Array<{ currency: string; count: number; balanceAmount: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<PmsCharge | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<PmsCharge | null>(null);
  const [actionKind, setActionKind] = useState<'ISSUE_CHARGE' | 'VOID_CHARGE' | 'CHARGE_ADJUSTMENT' | 'CREDIT_NOTE' | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const reload = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    setSearchInput(query);
    setCurrencyInput(currency);
  }, [currency, query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void listPmsCharges(token, {
      companyId,
      search: query || undefined,
      status: status || undefined,
      currency: currency || undefined,
      sortBy: chargeSortBy,
      direction: chargeDirection,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      signal: controller.signal,
    }).then((result) => {
      setCharges(result.charges);
      setPagination(result.pagination);
      setTotals(result.totalsByCurrency);
      if (page > 1 && result.charges.length === 0 && result.pagination.total > 0) {
        replaceFinanceQuery({ page: String(Math.ceil(result.pagination.total / PAGE_SIZE)) });
      }
    }).catch((loadError) => {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(apiMessage(loadError, copy.formError));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [chargeDirection, chargeSortBy, companyId, copy.formError, currency, page, query, refreshKey, replaceFinanceQuery, status, token]);

  async function openCharge(chargeId: string, reopen = true) {
    if (reopen) setDetailOpen(true);
    setSelectedCharge(null);
    try {
      const result = await getPmsCharge(token, chargeId, companyId);
      setSelectedCharge(result.charge);
    } catch (loadError) {
      setError(apiMessage(loadError, copy.formError));
      setDetailOpen(false);
    }
  }

  function submitFilters(event: FormEvent) {
    event.preventDefault();
    const normalizedCurrency = currencyInput.trim().toUpperCase();
    if (normalizedCurrency && normalizedCurrency.length !== 3) {
      setError(copy.formError);
      return;
    }
    setError('');
    replaceFinanceQuery({ q: searchInput.trim() || null, currency: normalizedCurrency || null, page: null });
  }

  async function submitAction(value: { reason?: string; amount?: number; chargeAdjustmentType?: 'DISCOUNT' | 'WRITE_OFF' | 'REVERSAL' | 'MANUAL' }) {
    if (!selectedCharge || !actionKind) return;
    setActionBusy(true);
    setActionError('');
    try {
      if (actionKind === 'ISSUE_CHARGE') await issuePmsCharge(token, selectedCharge.id, companyId);
      if (actionKind === 'VOID_CHARGE') await voidPmsCharge(token, selectedCharge.id, companyId, value.reason ?? 'Voided after review');
      if (actionKind === 'CHARGE_ADJUSTMENT') await adjustPmsCharge(token, selectedCharge.id, { companyId, type: value.chargeAdjustmentType ?? 'MANUAL', amount: value.amount ?? 0, reason: value.reason ?? '' });
      if (actionKind === 'CREDIT_NOTE') await createPmsCreditNote(token, selectedCharge.id, { companyId, amount: value.amount ?? 0, reason: value.reason ?? '' });
      setActionKind(null);
      reload();
      await openCharge(selectedCharge.id);
    } catch (submitError) {
      setActionError(apiMessage(submitError, copy.formError));
    } finally {
      setActionBusy(false);
    }
  }

  async function transitionCredit(noteId: string, action: 'APPROVE' | 'APPLY' | 'VOID') {
    if (!selectedCharge) return;
    setActionBusy(true);
    setError('');
    try {
      await transitionPmsCreditNote(token, noteId, { companyId, action, reason: action === 'VOID' ? 'Voided after review' : undefined });
      reload();
      await openCharge(selectedCharge.id);
    } catch (transitionError) {
      setError(apiMessage(transitionError, copy.formError));
    } finally {
      setActionBusy(false);
    }
  }

  const range = pageRange(pagination);
  return (
    <>
      {!canManage ? <p className="pms-finance-permission-note" role="note">{copy.permissionDenied}</p> : null}
      <div className="pms-finance-toolbar">
        <form className="pms-finance-filters" onSubmit={submitFilters}>
          <label><span className="sr-only">{copy.searchCharges}</span><input aria-label={copy.searchCharges} placeholder={copy.searchCharges} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
          <label><span className="sr-only">{copy.status}</span><select aria-label={copy.status} value={status} onChange={(event) => replaceFinanceQuery({ status: event.target.value || null, page: null })}><option value="">{copy.allStatuses}</option>{['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'].map((item) => <option key={item} value={item}>{formatFinanceEnum(item, language)}</option>)}</select></label>
          <label><span className="sr-only">{copy.currency}</span><input aria-label={copy.currency} maxLength={3} placeholder={copy.allCurrencies} pattern="[A-Za-z]{3}" value={currencyInput} onChange={(event) => setCurrencyInput(event.target.value.toUpperCase())} /></label>
          <label><span className="sr-only">{copy.sort}</span><select aria-label={copy.sort} value={chargeSort} onChange={(event) => replaceFinanceQuery({ sort: event.target.value, page: null })}><option value="dueDate:desc">{copy.chargeSortDueLatest}</option><option value="dueDate:asc">{copy.chargeSortDueEarliest}</option><option value="createdAt:desc">{copy.chargeSortCreated}</option><option value="balanceAmount:desc">{copy.chargeSortBalance}</option></select></label>
          <button className="button-link button-link--secondary" type="submit">{copy.filter}</button>
          <button className="pms-finance-text-button" onClick={() => { setSearchInput(''); setCurrencyInput(''); replaceFinanceQuery({ q: null, status: null, currency: null, sort: null, page: null }); }} type="button">{copy.reset}</button>
        </form>
        {canManage ? <button className="button-link button-link--primary" onClick={() => { setEditingCharge(null); setEditorOpen(true); }} type="button"><Plus aria-hidden="true" size={16} /> {copy.createCharge}</button> : null}
      </div>

      {totals.length ? <div className="pms-finance-currency-summary" aria-label={copy.outstandingCharges}>{totals.map((total) => <article key={total.currency}><span>{total.currency}</span><strong>{formatFinanceMoney(total.balanceAmount, total.currency, language)}</strong><small>{total.count} {copy.count}</small></article>)}</div> : null}
      {loading ? <div className="pms-finance-state">{copy.loading}</div> : error ? <div className="pms-finance-state pms-finance-state--error" role="alert">{error}</div> : charges.length === 0 ? <div className="pms-finance-state">{copy.noCharges}</div> : (
        <div className="pms-table-wrap"><table className="pms-table pms-finance-table"><caption className="sr-only">{copy.charges}</caption><thead><tr><th>{copy.charge}</th><th>{copy.property}</th><th>{copy.tenantUnit}</th><th>{copy.status}</th><th>{copy.dueDate}</th><th>{copy.total}</th><th>{copy.balance}</th><th>{copy.actions}</th></tr></thead><tbody>{charges.map((charge) => <tr key={charge.id}><td><strong>{charge.chargeNumber}</strong><small>{formatFinanceDate(charge.createdAt, language, true)}</small></td><td>{charge.property?.name ?? '—'}</td><td>{charge.tenant?.fullName ?? '—'}<small>{charge.unit?.unitNumber ?? '—'}</small></td><td><StatusBadge language={language} value={charge.status} /></td><td>{formatFinanceDate(charge.dueDate, language)}</td><td>{formatFinanceMoney(charge.totalAmount, charge.currency, language)}</td><td>{formatFinanceMoney(charge.balanceAmount, charge.currency, language)}</td><td><button className="pms-finance-text-button" onClick={() => void openCharge(charge.id)} type="button">{copy.view}</button></td></tr>)}</tbody></table></div>
      )}
      {pagination ? <div className="pms-finance-pagination"><span>{copy.pageCount(range.from, range.to, pagination.total)}</span><div><button disabled={page <= 1} onClick={() => replaceFinanceQuery({ page: String(page - 1) })} type="button">{copy.previous}</button><button disabled={pagination.skip + pagination.count >= pagination.total} onClick={() => replaceFinanceQuery({ page: String(page + 1) })} type="button">{copy.next}</button></div></div> : null}

      <ChargeEditorDialog charge={editingCharge} companyId={companyId} language={language} onClose={() => setEditorOpen(false)} onSaved={(saved) => { reload(); void openCharge(saved.id); }} open={editorOpen} token={token} />
      <ChargeDetailDialog busy={actionBusy} canManage={canManage} charge={selectedCharge} language={language} onAction={(kind) => { setDetailOpen(false); setActionError(''); setActionKind(kind); }} onClose={() => setDetailOpen(false)} onCreditTransition={(note, action) => void transitionCredit(note.id, action)} onEdit={() => { setEditingCharge(selectedCharge); setDetailOpen(false); setEditorOpen(true); }} open={detailOpen} />
      <FinanceActionDialog busy={actionBusy} error={actionError} kind={actionKind} language={language} onClose={() => setActionKind(null)} onSubmit={submitAction} open={Boolean(actionKind)} />
    </>
  );
}

function PaymentWorkspace({ token, companyId, language, canManage, canRecord }: { token: string; companyId: string; language: 'en' | 'ar'; canManage: boolean; canRecord: boolean }) {
  const copy = financeCopy[language];
  const { searchParams, replaceFinanceQuery } = useFinanceSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const status = (searchParams.get('status') || '') as PmsPaymentStatus | '';
  const currency = searchParams.get('currency') ?? '';
  const query = searchParams.get('q') ?? '';
  const paymentSort = normalizedSort(searchParams.get('sort'), paymentSortOptions, 'paidAt:desc');
  const [paymentSortBy, paymentDirection] = paymentSort.split(':') as ['paidAt' | 'createdAt' | 'amount', 'asc' | 'desc'];
  const [searchInput, setSearchInput] = useState(query);
  const [currencyInput, setCurrencyInput] = useState(currency);
  const [payments, setPayments] = useState<PmsPayment[]>([]);
  const [pagination, setPagination] = useState<PmsFinancePagination | null>(null);
  const [totals, setTotals] = useState<Array<{ currency: string; count: number; recordedAmount: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PmsPayment | null>(null);
  const [selectedBalance, setSelectedBalance] = useState<PmsPaymentBalance | null>(null);
  const [actionKind, setActionKind] = useState<'PAYMENT_ADJUSTMENT' | 'REVERSE_ALLOCATION' | null>(null);
  const [allocationToReverse, setAllocationToReverse] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const reload = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => { setSearchInput(query); setCurrencyInput(currency); }, [currency, query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void listPmsPayments(token, { companyId, search: query || undefined, status: status || undefined, currency: currency || undefined, sortBy: paymentSortBy, direction: paymentDirection, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, signal: controller.signal })
      .then((result) => { setPayments(result.payments); setPagination(result.pagination); setTotals(result.totalsByCurrency); })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(apiMessage(loadError, copy.formError));
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, copy.formError, currency, page, paymentDirection, paymentSortBy, query, refreshKey, status, token]);

  async function openPayment(paymentId: string) {
    setDetailOpen(true);
    setSelectedPayment(null);
    setSelectedBalance(null);
    try {
      const result = await getPmsPayment(token, paymentId, companyId);
      setSelectedBalance(result.balance);
      setSelectedPayment({ ...result.payment, allocatedAmount: result.balance.allocatedAmount, adjustedAmount: result.balance.refundedOrChargedBackAmount, depositAllocatedAmount: result.balance.depositAllocatedAmount, availableAmount: result.balance.availableAmount });
    } catch (loadError) {
      setError(apiMessage(loadError, copy.formError));
      setDetailOpen(false);
    }
  }

  function submitFilters(event: FormEvent) {
    event.preventDefault();
    const normalizedCurrency = currencyInput.trim().toUpperCase();
    if (normalizedCurrency && normalizedCurrency.length !== 3) {
      setError(copy.formError);
      return;
    }
    setError('');
    replaceFinanceQuery({ q: searchInput.trim() || null, currency: normalizedCurrency || null, page: null });
  }

  async function submitAction(value: { reason?: string; amount?: number; paymentAdjustmentType?: 'REFUND' | 'REVERSAL' | 'CHARGEBACK' | 'WRITE_OFF'; referenceNumber?: string }) {
    if (!selectedPayment || !actionKind) return;
    setActionBusy(true);
    setActionError('');
    try {
      if (actionKind === 'REVERSE_ALLOCATION' && allocationToReverse) {
        await reversePmsPaymentAllocation(token, selectedPayment.id, allocationToReverse, companyId, value.reason ?? 'Allocation reversed after review');
      } else if (actionKind === 'PAYMENT_ADJUSTMENT') {
        await adjustPmsPayment(token, selectedPayment.id, { companyId, type: value.paymentAdjustmentType ?? 'REFUND', amount: value.amount ?? 0, reason: value.reason ?? '', referenceNumber: value.referenceNumber ?? null, idempotencyKey: createFinanceIdempotencyKey('payment-adjustment') });
      }
      setActionKind(null);
      setAllocationToReverse(null);
      reload();
      await openPayment(selectedPayment.id);
    } catch (submitError) {
      setActionError(apiMessage(submitError, copy.formError));
    } finally {
      setActionBusy(false);
    }
  }

  const range = pageRange(pagination);
  return (
    <>
      {!canManage && !canRecord ? <p className="pms-finance-permission-note" role="note">{copy.permissionDenied}</p> : null}
      <div className="pms-finance-toolbar">
        <form className="pms-finance-filters" onSubmit={submitFilters}>
          <label><span className="sr-only">{copy.searchPayments}</span><input aria-label={copy.searchPayments} placeholder={copy.searchPayments} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
          <label><span className="sr-only">{copy.status}</span><select aria-label={copy.status} value={status} onChange={(event) => replaceFinanceQuery({ status: event.target.value || null, page: null })}><option value="">{copy.allStatuses}</option>{['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'REFUNDED'].map((item) => <option key={item} value={item}>{formatFinanceEnum(item, language)}</option>)}</select></label>
          <label><span className="sr-only">{copy.currency}</span><input aria-label={copy.currency} maxLength={3} placeholder={copy.allCurrencies} pattern="[A-Za-z]{3}" value={currencyInput} onChange={(event) => setCurrencyInput(event.target.value.toUpperCase())} /></label>
          <label><span className="sr-only">{copy.sort}</span><select aria-label={copy.sort} value={paymentSort} onChange={(event) => replaceFinanceQuery({ sort: event.target.value, page: null })}><option value="paidAt:desc">{copy.paymentSortPaidLatest}</option><option value="paidAt:asc">{copy.paymentSortPaidEarliest}</option><option value="createdAt:desc">{copy.paymentSortPosted}</option><option value="amount:desc">{copy.paymentSortAmount}</option></select></label>
          <button className="button-link button-link--secondary" type="submit">{copy.filter}</button>
          <button className="pms-finance-text-button" onClick={() => { setSearchInput(''); setCurrencyInput(''); replaceFinanceQuery({ q: null, status: null, currency: null, sort: null, page: null }); }} type="button">{copy.reset}</button>
        </form>
        {canRecord ? <button className="button-link button-link--primary" onClick={() => setEditorOpen(true)} type="button"><Plus aria-hidden="true" size={16} /> {copy.createPayment}</button> : null}
      </div>

      {totals.length ? <div className="pms-finance-currency-summary" aria-label={copy.recordedPayments}>{totals.map((total) => <article key={total.currency}><span>{total.currency}</span><strong>{formatFinanceMoney(total.recordedAmount, total.currency, language)}</strong><small>{total.count} {copy.count}</small></article>)}</div> : null}
      {loading ? <div className="pms-finance-state">{copy.loading}</div> : error ? <div className="pms-finance-state pms-finance-state--error" role="alert">{error}</div> : payments.length === 0 ? <div className="pms-finance-state">{copy.noPayments}</div> : (
        <div className="pms-table-wrap"><table className="pms-table pms-finance-table"><caption className="sr-only">{copy.payments}</caption><thead><tr><th>{copy.reference}</th><th>{copy.property}</th><th>{copy.tenantUnit}</th><th>{copy.status}</th><th>{copy.transactionDate}</th><th>{copy.postingDate}</th><th>{copy.settlementDate}</th><th>{copy.amount}</th><th>{copy.allocated}</th><th>{copy.available}</th><th>{copy.actions}</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.receiptNumber ?? payment.id}</strong><small>{payment.referenceNumber ?? '—'}</small></td><td>{payment.property.name}</td><td>{payment.tenant?.fullName ?? '—'}<small>{payment.unit.unitNumber}</small></td><td><StatusBadge language={language} value={payment.status} /></td><td>{formatFinanceDate(payment.paidAt, language)}</td><td>{formatFinanceDate(payment.createdAt, language, true)}</td><td>{formatFinanceDate(payment.confirmedAt, language, true)}</td><td>{formatFinanceMoney(payment.amount, payment.currency, language)}</td><td>{formatFinanceMoney(payment.allocatedAmount, payment.currency, language)}</td><td>{formatFinanceMoney(payment.availableAmount, payment.currency, language)}</td><td><button className="pms-finance-text-button" onClick={() => void openPayment(payment.id)} type="button">{copy.view}</button></td></tr>)}</tbody></table></div>
      )}
      {pagination ? <div className="pms-finance-pagination"><span>{copy.pageCount(range.from, range.to, pagination.total)}</span><div><button disabled={page <= 1} onClick={() => replaceFinanceQuery({ page: String(page - 1) })} type="button">{copy.previous}</button><button disabled={pagination.skip + pagination.count >= pagination.total} onClick={() => replaceFinanceQuery({ page: String(page + 1) })} type="button">{copy.next}</button></div></div> : null}

      <PaymentEditorDialog companyId={companyId} language={language} onClose={() => setEditorOpen(false)} onSaved={(saved) => { reload(); void openPayment(saved.id); }} open={editorOpen} token={token} />
      <PaymentDetailDialog balance={selectedBalance} canManage={canManage} language={language} onAdjustment={() => { setDetailOpen(false); setActionKind('PAYMENT_ADJUSTMENT'); }} onAllocate={() => { setDetailOpen(false); setAllocationOpen(true); }} onClose={() => setDetailOpen(false)} onReverseAllocation={(allocationId) => { setAllocationToReverse(allocationId); setDetailOpen(false); setActionKind('REVERSE_ALLOCATION'); }} open={detailOpen} payment={selectedPayment} />
      <AllocationDialog companyId={companyId} language={language} onClose={() => setAllocationOpen(false)} onSaved={() => { if (selectedPayment) { reload(); void openPayment(selectedPayment.id); } }} open={allocationOpen} payment={selectedPayment} token={token} />
      <FinanceActionDialog busy={actionBusy} error={actionError} kind={actionKind} language={language} onClose={() => { setActionKind(null); setAllocationToReverse(null); }} onSubmit={submitAction} open={Boolean(actionKind)} />
    </>
  );
}

export default function PmsFinanceWorkspace({ section }: { section: PmsFinanceSection }) {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const workspace = resolvePmsWorkspace(user?.pmsAccess?.workspaces ?? [], searchParams.get('companyId'));
  const copy = financeCopy[language];
  const canManage = canManagePmsAccounting(workspace);
  const canRecord = canCollectPmsRent(workspace);

  if (!token || !workspace) return <section className="pms-route-content"><div className="pms-finance-state">{copy.loading}</div></section>;
  const companyId = workspace.company.id;
  const title = section === 'charges' ? copy.chargeTitle : section === 'payments' ? copy.paymentTitle : copy.overviewTitle;
  const description = section === 'charges' ? copy.chargeDescription : section === 'payments' ? copy.paymentDescription : copy.overviewDescription;

  return (
    <section className="pms-route-content pms-finance-workspace" aria-labelledby={`pms-finance-${section}-title`}>
      <header className="pms-header">
        <div><p className="eyebrow">{copy.financeControl}</p><h1 id={`pms-finance-${section}-title`}>{title}</h1><p>{description}</p></div>
        <nav className="pms-finance-section-nav" aria-label={copy.financeControl}>
          <Link aria-current={section === 'overview' ? 'page' : undefined} to={`/pms/finance/overview?companyId=${encodeURIComponent(companyId)}`}>{copy.overview}</Link>
          <Link aria-current={section === 'charges' ? 'page' : undefined} to={`/pms/finance/charges?companyId=${encodeURIComponent(companyId)}`}>{copy.charges}</Link>
          <Link aria-current={section === 'payments' ? 'page' : undefined} to={`/pms/finance/payments?companyId=${encodeURIComponent(companyId)}`}>{copy.payments}</Link>
          <Link to={`/pms/finance/deposits?companyId=${encodeURIComponent(companyId)}`}>{copy.deposits}</Link>
          <Link to={`/pms/finance/periods?companyId=${encodeURIComponent(companyId)}`}>{copy.periods}</Link>
          <Link to={`/pms/finance/reconciliation?companyId=${encodeURIComponent(companyId)}`}>{copy.reconciliation}</Link>
          <Link to={`/pms/finance/statements?companyId=${encodeURIComponent(companyId)}`}>{copy.statements}</Link>
          <Link to={`/pms/finance/payouts?companyId=${encodeURIComponent(companyId)}`}>{copy.payouts}</Link>
          <Link to={`/pms/finance/records?companyId=${encodeURIComponent(companyId)}`}>{copy.records}</Link>
        </nav>
      </header>
      {section === 'overview' ? <FinanceOverview companyId={companyId} language={language} token={token} /> : null}
      {section === 'charges' ? <ChargeWorkspace canManage={canManage} companyId={companyId} language={language} token={token} /> : null}
      {section === 'payments' ? <PaymentWorkspace canManage={canManage} canRecord={canRecord} companyId={companyId} language={language} token={token} /> : null}
    </section>
  );
}

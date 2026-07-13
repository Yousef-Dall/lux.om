import { AlertTriangle, Plus, ShieldCheck, Upload } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../../api/client';
import { listPmsLeases, listPmsProperties, type PmsLease, type PmsProperty } from '../../../../api/pms';
import {
  commitPmsTreasuryImport,
  createPmsDepositAccount,
  createPmsDepositTransaction,
  createPmsFinancialPeriod,
  createPmsReconciliationItem,
  getPmsDeposit,
  getPmsFinancialPeriodReadiness,
  listPmsCharges,
  listPmsDeposits,
  listPmsFinancialPeriods,
  listPmsPayments,
  listPmsOwnerPayouts,
  listPmsReconciliationItems,
  listPmsVendorInvoices,
  matchPmsReconciliationItem,
  previewPmsTreasuryImport,
  transitionPmsDepositTransaction,
  transitionPmsFinancialPeriod,
  transitionPmsReconciliationItem,
  type PmsCharge,
  type PmsDepositAccount,
  type PmsDepositAccountStatus,
  type PmsDepositTransaction,
  type PmsDepositTransactionType,
  type PmsFinancePagination,
  type PmsFinancialPeriod,
  type PmsFinancialPeriodReadiness,
  type PmsOwnerPayout,
  type PmsPayment,
  type PmsReconciliationDirection,
  type PmsReconciliationItem,
  type PmsReconciliationSource,
  type PmsReconciliationStatus,
  type PmsReconciliationTargetType,
  type PmsTreasuryImportBatch,
  type PmsTreasuryImportPreview,
  type PmsVendorInvoice,
} from '../../../../api/pmsAdvanced';
import { useAuth } from '../../../../auth/AuthContext';
import AccessibleDialog from '../../../../components/AccessibleDialog';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { canManagePmsAccounting, resolvePmsWorkspace } from '../../access';
import { createFinanceIdempotencyKey, formatFinanceDate, formatFinanceMoney } from '../copy';
import { governanceCopy, governanceEnumLabel } from './copy';

export type PmsFinanceGovernanceSection = 'deposits' | 'periods' | 'reconciliation';

const PAGE_SIZE = 25;

type QueryUpdates = Record<string, string | null | undefined>;

function useGovernanceSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const latestRef = useRef(new URLSearchParams(searchParams));
  const pendingRef = useRef<string[]>([]);

  useEffect(() => {
    const incoming = searchParams.toString();
    const index = pendingRef.current.indexOf(incoming);
    if (index >= 0) pendingRef.current = pendingRef.current.slice(index + 1);
    if (pendingRef.current.length === 0) latestRef.current = new URLSearchParams(searchParams);
  }, [searchParams]);

  const replaceQuery = useCallback((updates: QueryUpdates) => {
    const next = new URLSearchParams(latestRef.current);
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
    });
    const serialized = next.toString();
    latestRef.current = next;
    pendingRef.current.push(serialized);
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  return { searchParams, replaceQuery };
}

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function pageRange(pagination: PmsFinancePagination | null) {
  if (!pagination || pagination.total === 0) return { from: 0, to: 0 };
  return { from: pagination.skip + 1, to: pagination.skip + pagination.count };
}

function GovernanceSectionNav({ companyId, section, language }: { companyId: string; section: PmsFinanceGovernanceSection; language: 'en' | 'ar' }) {
  const copy = governanceCopy[language];
  const suffix = `?companyId=${encodeURIComponent(companyId)}`;
  return (
    <nav className="pms-finance-section-nav" aria-label={copy.financeControl}>
      <Link to={`/pms/finance/overview${suffix}`}>{copy.overview}</Link>
      <Link to={`/pms/finance/charges${suffix}`}>{copy.charges}</Link>
      <Link to={`/pms/finance/payments${suffix}`}>{copy.payments}</Link>
      <Link aria-current={section === 'deposits' ? 'page' : undefined} to={`/pms/finance/deposits${suffix}`}>{copy.deposits}</Link>
      <Link aria-current={section === 'periods' ? 'page' : undefined} to={`/pms/finance/periods${suffix}`}>{copy.periods}</Link>
      <Link aria-current={section === 'reconciliation' ? 'page' : undefined} to={`/pms/finance/reconciliation${suffix}`}>{copy.reconciliation}</Link>
      <Link to={`/pms/finance/statements${suffix}`}>{copy.statements}</Link>
      <Link to={`/pms/finance/payouts${suffix}`}>{copy.payouts}</Link>
      <Link to={`/pms/finance/vendor-invoices${suffix}`}>{copy.vendorInvoices}</Link>
      <Link to={`/pms/finance/records${suffix}`}>{copy.records}</Link>
    </nav>
  );
}

function PaginationControls({ pagination, page, onPage, language }: { pagination: PmsFinancePagination | null; page: number; onPage: (page: number) => void; language: 'en' | 'ar' }) {
  const copy = governanceCopy[language];
  const range = pageRange(pagination);
  if (!pagination) return null;
  return (
    <div className="pms-finance-pagination">
      <span>{copy.pageCount(range.from, range.to, pagination.total)}</span>
      <div>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} type="button">{copy.previous}</button>
        <button disabled={pagination.skip + pagination.count >= pagination.total} onClick={() => onPage(page + 1)} type="button">{copy.next}</button>
      </div>
    </div>
  );
}

function DepositAccountDialog({ companyId, language, onClose, onSaved, open, token }: { companyId: string; language: 'en' | 'ar'; onClose: () => void; onSaved: () => void; open: boolean; token: string }) {
  const copy = governanceCopy[language];
  const firstRef = useRef<HTMLSelectElement>(null);
  const [leases, setLeases] = useState<PmsLease[]>([]);
  const [leaseId, setLeaseId] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    void listPmsLeases(token, { companyId, status: 'ACTIVE', take: 100, skip: 0 })
      .then((result) => setLeases(result.leases))
      .catch((loadError) => setError(apiMessage(loadError, copy.error)))
      .finally(() => setLoading(false));
  }, [companyId, copy.error, open, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(expectedAmount);
    if (!leaseId || !Number.isFinite(amount) || amount < 0) return setError(copy.formError);
    setBusy(true); setError('');
    try {
      await createPmsDepositAccount(token, { companyId, leaseId, expectedAmount: amount });
      onSaved(); onClose(); setLeaseId(''); setExpectedAmount('');
    } catch (submitError) { setError(apiMessage(submitError, copy.error)); }
    finally { setBusy(false); }
  }

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.depositsDescription} initialFocusRef={firstRef} onClose={onClose} open={open} title={copy.createDeposit}>
      <form className="pms-finance-form" onSubmit={submit}>
        {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
        <label>{copy.selectLease}<select disabled={loading} ref={firstRef} required value={leaseId} onChange={(event) => setLeaseId(event.target.value)}><option value="">{copy.selectLease}</option>{leases.map((lease) => <option key={lease.id} value={lease.id}>{lease.property.name} · {lease.unit.unitNumber} · {lease.tenant.fullName} · {lease.currency}</option>)}</select></label>
        <label>{copy.expectedAmount}<input min="0" required step="0.001" type="number" value={expectedAmount} onChange={(event) => setExpectedAmount(event.target.value)} /></label>
        <div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy || loading} type="submit">{copy.save}</button><button onClick={onClose} type="button">{copy.cancel}</button></div>
      </form>
    </AccessibleDialog>
  );
}

function DepositDetailDialog({ accountId, companyId, language, onClose, onSaved, open, token }: { accountId: string | null; companyId: string; language: 'en' | 'ar'; onClose: () => void; onSaved: () => void; open: boolean; token: string }) {
  const copy = governanceCopy[language];
  const amountRef = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState<PmsDepositAccount | null>(null);
  const [payments, setPayments] = useState<PmsPayment[]>([]);
  const [charges, setCharges] = useState<PmsCharge[]>([]);
  const [type, setType] = useState<PmsDepositTransactionType>('COLLECTION');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [chargeId, setChargeId] = useState('');
  const [transition, setTransition] = useState<{ transaction: PmsDepositTransaction; action: 'APPROVE' | 'POST' | 'VOID' } | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true); setError('');
    try {
      const result = await getPmsDeposit(token, accountId, companyId);
      setAccount(result.account);
      const [paymentResult, chargeResult] = await Promise.all([
        listPmsPayments(token, { companyId, propertyId: result.account.propertyId, tenantId: result.account.tenantId, status: 'CONFIRMED', currency: result.account.currency, take: 100, skip: 0 }),
        listPmsCharges(token, { companyId, propertyId: result.account.propertyId, tenantId: result.account.tenantId, currency: result.account.currency, openOnly: true, take: 100, skip: 0 }),
      ]);
      setPayments(paymentResult.payments.filter((payment) => Number(payment.availableAmount) > 0));
      setCharges(chargeResult.charges);
    } catch (loadError) { setError(apiMessage(loadError, copy.error)); }
    finally { setLoading(false); }
  }, [accountId, companyId, copy.error, token]);

  useEffect(() => { if (open) void load(); }, [load, open]);

  async function createTransaction(event: FormEvent) {
    event.preventDefault();
    if (!accountId) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !reason.trim()) return setError(copy.formError);
    if (type === 'COLLECTION' && !paymentId) return setError(copy.formError);
    if (type === 'CONVERSION_TO_INCOME' && !chargeId) return setError(copy.formError);
    setBusy(true); setError('');
    try {
      await createPmsDepositTransaction(token, accountId, { companyId, type, amount: numericAmount, reason: reason.trim(), idempotencyKey: createFinanceIdempotencyKey('deposit'), paymentId: paymentId || null, chargeId: chargeId || null });
      setAmount(''); setReason(''); setPaymentId(''); setChargeId('');
      await load(); onSaved();
    } catch (submitError) { setError(apiMessage(submitError, copy.error)); }
    finally { setBusy(false); }
  }

  async function submitTransition(event: FormEvent) {
    event.preventDefault();
    if (!accountId || !transition || transitionReason.trim().length < 3) return setError(copy.formError);
    setBusy(true); setError('');
    try {
      await transitionPmsDepositTransaction(token, accountId, transition.transaction.id, { companyId, action: transition.action, reason: transitionReason.trim() });
      setTransition(null); setTransitionReason(''); await load(); onSaved();
    } catch (submitError) { setError(apiMessage(submitError, copy.error)); }
    finally { setBusy(false); }
  }

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.depositsDescription} initialFocusRef={amountRef} onClose={onClose} open={open} size="large" title={account ? `${copy.deposits} · ${account.property.name} · ${account.unit.unitNumber}` : copy.deposits}>
      {loading && !account ? <div className="pms-finance-state">{copy.loading}</div> : null}
      {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
      {account ? <div className="pms-finance-detail">
        <div className="pms-finance-detail__summary"><div><span>{copy.tenant}</span><strong>{account.tenant?.fullName ?? '—'}</strong></div><div><span>{copy.expected}</span><strong>{formatFinanceMoney(account.expectedAmount, account.currency, language)}</strong></div><div><span>{copy.liability}</span><strong>{formatFinanceMoney(account.liabilityBalance, account.currency, language)}</strong></div><div><span>{copy.status}</span><strong>{governanceEnumLabel(account.status, language)}</strong></div></div>
        <form className="pms-finance-form pms-governance-transaction-form" onSubmit={createTransaction}>
          <h3>{copy.addTransaction}</h3>
          <label>{copy.type}<select value={type} onChange={(event) => setType(event.target.value as PmsDepositTransactionType)}>{(['COLLECTION', 'DEDUCTION', 'REFUND', 'CONVERSION_TO_INCOME', 'ADJUSTMENT'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label>
          <label>{copy.amount}<input min="0.001" ref={amountRef} required step="0.001" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          {type === 'COLLECTION' ? <label>{copy.payment}<select required value={paymentId} onChange={(event) => setPaymentId(event.target.value)}><option value="">{copy.payment}</option>{payments.map((payment) => <option key={payment.id} value={payment.id}>{payment.receiptNumber ?? payment.id} · {formatFinanceMoney(payment.availableAmount, payment.currency, language)}</option>)}</select></label> : null}
          {type === 'CONVERSION_TO_INCOME' ? <label>{copy.charge}<select required value={chargeId} onChange={(event) => setChargeId(event.target.value)}><option value="">{copy.charge}</option>{charges.map((charge) => <option key={charge.id} value={charge.id}>{charge.chargeNumber} · {formatFinanceMoney(charge.balanceAmount, charge.currency, language)}</option>)}</select></label> : null}
          <label className="pms-finance-form__wide">{copy.reason}<textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <p className="pms-finance-permission-note">{['DEDUCTION', 'REFUND', 'CONVERSION_TO_INCOME'].includes(type) ? copy.approvalRequired : copy.postedImmediately}</p>
          <div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{copy.save}</button></div>
        </form>
        <h3>{copy.transactions}</h3>
        <div className="pms-finance-history-grid">{account.transactions?.length ? account.transactions.map((transaction) => <article className="pms-finance-history-item" key={transaction.id}><div><strong>{governanceEnumLabel(transaction.type, language)}</strong><span className={`pms-finance-status pms-finance-status--${transaction.status.toLowerCase()}`}>{governanceEnumLabel(transaction.status, language)}</span></div><p>{formatFinanceMoney(transaction.amount, transaction.currency, language)} · {transaction.reason ?? '—'}</p><small>{copy.createdDate}: {formatFinanceDate(transaction.createdAt, language)} · {copy.approvalDate}: {formatFinanceDate(transaction.approvedAt, language)} · {copy.postingDate}: {formatFinanceDate(transaction.postedAt, language)}</small><small>{copy.createdBy}: {transaction.createdBy?.name ?? '—'} · {copy.approvedBy}: {transaction.approvedBy?.name ?? '—'}</small><small>{copy.supportingDocuments}: {transaction.documents?.length ?? 0}</small><div className="pms-finance-inline-actions">{transaction.status === 'PENDING_APPROVAL' ? <button onClick={() => setTransition({ transaction, action: 'APPROVE' })} type="button">{copy.approve}</button> : null}{transaction.status === 'APPROVED' ? <button onClick={() => setTransition({ transaction, action: 'POST' })} type="button">{copy.post}</button> : null}{transaction.status !== 'POSTED' && transaction.status !== 'VOID' ? <button onClick={() => setTransition({ transaction, action: 'VOID' })} type="button">{copy.void}</button> : null}</div></article>) : <p>{copy.noRecords}</p>}</div>
        {transition ? <form className="pms-finance-form pms-governance-inline-review" onSubmit={submitTransition}><p><AlertTriangle aria-hidden="true" size={18} /> {copy.destructiveWarning}</p><label className="pms-finance-form__wide">{copy.reason}<textarea autoFocus required value={transitionReason} onChange={(event) => setTransitionReason(event.target.value)} /></label><div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{governanceEnumLabel(transition.action, language)}</button><button onClick={() => { setTransition(null); setTransitionReason(''); }} type="button">{copy.cancel}</button></div></form> : null}
      </div> : null}
    </AccessibleDialog>
  );
}

function DepositWorkspace({ canManage, companyId, language, token }: { canManage: boolean; companyId: string; language: 'en' | 'ar'; token: string }) {
  const copy = governanceCopy[language];
  const { searchParams, replaceQuery } = useGovernanceSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const query = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') ?? '') as PmsDepositAccountStatus | '';
  const currency = searchParams.get('currency') ?? '';
  const [searchInput, setSearchInput] = useState(query);
  const [currencyInput, setCurrencyInput] = useState(currency);
  const [accounts, setAccounts] = useState<PmsDepositAccount[]>([]);
  const [pagination, setPagination] = useState<PmsFinancePagination | null>(null);
  const [totals, setTotals] = useState<Array<{ currency: string; count: number; expectedAmount: string; liabilityBalance: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { setSearchInput(query); setCurrencyInput(currency); }, [currency, query]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void listPmsDeposits(token, { companyId, search: query || undefined, status: status || undefined, currency: currency || undefined, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, signal: controller.signal })
      .then((result) => { setAccounts(result.accounts); setPagination(result.pagination); setTotals(result.totalsByCurrency); })
      .catch((loadError) => { if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) setError(apiMessage(loadError, copy.error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, copy.error, currency, page, query, refresh, status, token]);

  function submitFilters(event: FormEvent) { event.preventDefault(); replaceQuery({ q: searchInput.trim() || null, currency: currencyInput.trim().toUpperCase() || null, page: null }); }
  const reload = () => setRefresh((value) => value + 1);

  return <>
    <div className="pms-finance-toolbar"><form className="pms-finance-filters" onSubmit={submitFilters}><label>{copy.search}<input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label><label>{copy.status}<select value={status} onChange={(event) => replaceQuery({ status: event.target.value || null, page: null })}><option value="">{copy.all}</option>{(['EXPECTED', 'HELD', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CLOSED'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label><label>{copy.currency}<input maxLength={3} value={currencyInput} onChange={(event) => setCurrencyInput(event.target.value)} /></label><button type="submit">{copy.filter}</button></form>{canManage ? <button className="button-link button-link--primary" onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" size={17} />{copy.createDeposit}</button> : null}</div>
    {!canManage ? <p className="pms-finance-permission-note">{copy.permissionDenied}</p> : null}
    {error ? <div className="pms-finance-state pms-finance-state--error" role="alert">{error}</div> : null}
    <div className="pms-finance-currency-summary">{totals.map((total) => <article key={total.currency}><span>{copy.liability} · {total.currency}</span><strong>{formatFinanceMoney(total.liabilityBalance, total.currency, language)}</strong><small>{total.count}</small></article>)}</div>
    {loading ? <div className="pms-finance-state">{copy.loading}</div> : accounts.length ? <div className="pms-table-wrap"><table className="pms-finance-table"><caption>{copy.depositsTitle}</caption><thead><tr><th>{copy.property}</th><th>{copy.tenant}</th><th>{copy.expected}</th><th>{copy.liability}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.property.name}</strong><small>{account.unit.unitNumber}</small></td><td>{account.tenant?.fullName ?? '—'}</td><td>{formatFinanceMoney(account.expectedAmount, account.currency, language)}</td><td>{formatFinanceMoney(account.liabilityBalance, account.currency, language)}</td><td><span className={`pms-finance-status pms-finance-status--${account.status.toLowerCase()}`}>{governanceEnumLabel(account.status, language)}</span></td><td><button onClick={() => setSelectedId(account.id)} type="button">{copy.view}</button></td></tr>)}</tbody></table></div> : <div className="pms-finance-state">{copy.noRecords}</div>}
    <PaginationControls language={language} onPage={(next) => replaceQuery({ page: next === 1 ? null : String(next) })} page={page} pagination={pagination} />
    <DepositAccountDialog companyId={companyId} language={language} onClose={() => setCreateOpen(false)} onSaved={reload} open={createOpen} token={token} />
    <DepositDetailDialog accountId={selectedId} companyId={companyId} language={language} onClose={() => setSelectedId(null)} onSaved={reload} open={Boolean(selectedId)} token={token} />
  </>;
}

function PeriodCreateDialog({ allowCompanyWide, companyId, language, onClose, onSaved, open, token }: { allowCompanyWide: boolean; companyId: string; language: 'en' | 'ar'; onClose: () => void; onSaved: () => void; open: boolean; token: string }) {
  const copy = governanceCopy[language];
  const startRef = useRef<HTMLInputElement>(null);
  const [properties, setProperties] = useState<PmsProperty[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [currency, setCurrency] = useState('OMR');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) void listPmsProperties(token, { companyId, take: 100, skip: 0 }).then((result) => { setProperties(result.properties); if (!allowCompanyWide && result.properties[0]) setPropertyId((current) => current || result.properties[0]!.id); }).catch((loadError) => setError(apiMessage(loadError, copy.error))); }, [allowCompanyWide, companyId, copy.error, open, token]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!start || !end || currency.trim().length !== 3) return setError(copy.formError); setBusy(true); setError(''); try { await createPmsFinancialPeriod(token, { companyId, propertyId: propertyId || null, currency: currency.toUpperCase(), periodStart: start, periodEnd: end }); onSaved(); onClose(); } catch (submitError) { setError(apiMessage(submitError, copy.error)); } finally { setBusy(false); } }
  return <AccessibleDialog closeLabel={copy.close} description={copy.periodsDescription} initialFocusRef={startRef} onClose={onClose} open={open} title={copy.createPeriod}><form className="pms-finance-form" onSubmit={submit}>{error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}<label>{copy.periodStart}<input ref={startRef} required type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>{copy.periodEnd}<input required type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label>{copy.currency}<input maxLength={3} required value={currency} onChange={(event) => setCurrency(event.target.value)} /></label><label>{copy.scope}<select required={!allowCompanyWide} value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>{allowCompanyWide ? <option value="">{copy.companyWide}</option> : null}{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{copy.save}</button><button onClick={onClose} type="button">{copy.cancel}</button></div></form></AccessibleDialog>;
}

function PeriodDetailDialog({ companyId, language, onClose, onSaved, open, periodId, token }: { companyId: string; language: 'en' | 'ar'; onClose: () => void; onSaved: () => void; open: boolean; periodId: string | null; token: string }) {
  const copy = governanceCopy[language];
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [period, setPeriod] = useState<PmsFinancialPeriod | null>(null);
  const [readiness, setReadiness] = useState<PmsFinancialPeriodReadiness | null>(null);
  const [action, setAction] = useState<'REVIEW' | 'CLOSE' | 'REOPEN' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!periodId) return;
    setError('');
    try {
      const result = await getPmsFinancialPeriodReadiness(token, periodId, companyId);
      setPeriod(result.period);
      setReadiness(result.readiness);
    } catch (loadError) {
      setError(apiMessage(loadError, copy.error));
    }
  }, [companyId, copy.error, periodId, token]);

  useEffect(() => { if (open) void load(); }, [load, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!periodId || !action || reason.trim().length < 3) return setError(copy.formError);
    setBusy(true);
    setError('');
    try {
      await transitionPmsFinancialPeriod(token, periodId, { companyId, action, reason: reason.trim() });
      setAction(null);
      setReason('');
      await load();
      onSaved();
    } catch (submitError) {
      setError(apiMessage(submitError, copy.error));
    } finally {
      setBusy(false);
    }
  }

  const latestClose = period?.closes?.[0] ?? null;
  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.periodsDescription} initialFocusRef={action ? reasonRef : undefined} onClose={onClose} open={open} size="large" title={copy.periods}>
      {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
      {period ? (
        <div className="pms-finance-detail">
          <div className="pms-finance-detail__summary">
            <div><span>{copy.scope}</span><strong>{period.property?.name ?? copy.companyWide}</strong></div>
            <div><span>{copy.currency}</span><strong>{period.currency}</strong></div>
            <div><span>{copy.periodStart}</span><strong>{formatFinanceDate(period.periodStart, language)}</strong></div>
            <div><span>{copy.periodEnd}</span><strong>{formatFinanceDate(period.periodEnd, language)}</strong></div>
          </div>

          <section className={`pms-governance-readiness ${readiness?.canClose ? 'pms-governance-readiness--ready' : 'pms-governance-readiness--blocked'}`}>
            <h3><ShieldCheck aria-hidden="true" size={19} /> {copy.readiness}: {readiness?.canClose ? copy.ready : copy.blocked}</h3>
            <div className="pms-governance-readiness__grid">
              <p>{copy.reconciliationExceptions}<strong>{readiness?.reconciliationExceptions ?? 0}</strong></p>
              <p>{copy.pendingDeposits}<strong>{readiness?.pendingDepositTransactions ?? 0}</strong></p>
              <p>{copy.unallocatedPayments}<strong>{readiness?.unallocatedPayments ?? 0}</strong></p>
              <p>{copy.unreconciledRentPayments}<strong>{readiness?.unreconciledRentPayments ?? 0}</strong></p>
              <p>{copy.unreconciledVendorPayments}<strong>{readiness?.unreconciledVendorPayments ?? 0}</strong></p>
              <p>{copy.unreconciledOwnerPayouts}<strong>{readiness?.unreconciledOwnerPayouts ?? 0}</strong></p>
            </div>
            {(readiness?.unallocatedPayments ?? 0) > 0 ? <p>{copy.unallocatedAmount}: <strong>{formatFinanceMoney(readiness?.unallocatedAmount ?? '0', period.currency, language)}</strong></p> : null}
          </section>

          {period.status === 'REVIEWING' ? <p className="pms-finance-permission-note">{copy.independentCloseRequired}</p> : null}
          <div className="pms-finance-inline-actions">
            {period.status === 'OPEN' ? <button onClick={() => setAction('REVIEW')} type="button">{copy.review}</button> : null}
            {period.status === 'REVIEWING' ? <button disabled={!readiness?.canClose} onClick={() => setAction('CLOSE')} type="button">{copy.closePeriod}</button> : null}
            {period.status === 'CLOSED' ? <button onClick={() => setAction('REOPEN')} type="button">{copy.reopen}</button> : null}
          </div>

          {action ? (
            <form className="pms-finance-form pms-governance-inline-review" onSubmit={submit}>
              <p><AlertTriangle aria-hidden="true" size={18} /> {copy.destructiveWarning}</p>
              <label className="pms-finance-form__wide">{copy.reason}<textarea ref={reasonRef} required value={reason} onChange={(event) => setReason(event.target.value)} /></label>
              <div className="pms-finance-inline-actions">
                <button className="button-link button-link--primary" disabled={busy} type="submit">{governanceEnumLabel(action, language)}</button>
                <button onClick={() => { setAction(null); setReason(''); }} type="button">{copy.cancel}</button>
              </div>
            </form>
          ) : null}

          {latestClose ? (
            <section className="pms-governance-close-pack">
              <h3>{copy.closePack} #{latestClose.revision}</h3>
              <div className="pms-finance-detail__summary">
                <div><span>{copy.reviewedBy}</span><strong>{latestClose.reviewedBy.name}</strong></div>
                <div><span>{copy.closedBy}</span><strong>{latestClose.closedBy.name}</strong></div>
                <div><span>{copy.closedDate}</span><strong>{formatFinanceDate(latestClose.closedAt, language)}</strong></div>
                <div><span>{copy.closeStatus}</span><strong>{latestClose.reopenedAt ? copy.reopenedClose : copy.activeClose}</strong></div>
              </div>
              <p>{copy.snapshotHash}: <code>{latestClose.snapshotHash}</code></p>
              {latestClose.reopenedAt ? <p>{copy.reopenedBy}: <strong>{latestClose.reopenedBy?.name ?? '—'}</strong> · {formatFinanceDate(latestClose.reopenedAt, language)}</p> : null}
            </section>
          ) : null}

          <h3>{copy.auditTimeline}</h3>
          <div className="pms-finance-history-grid">
            {period.events?.map((event) => (
              <article className="pms-finance-history-item" key={event.id}>
                <strong>{governanceEnumLabel(event.toStatus, language)}</strong>
                <p>{event.reason ?? '—'}</p>
                <small>{formatFinanceDate(event.createdAt, language)} · {event.createdBy?.name ?? '—'}</small>
              </article>
            ))}
          </div>
        </div>
      ) : <div className="pms-finance-state">{copy.loading}</div>}
    </AccessibleDialog>
  );
}

function PeriodWorkspace({ allowCompanyWide, canManage, companyId, language, token }: { allowCompanyWide: boolean; canManage: boolean; companyId: string; language: 'en' | 'ar'; token: string }) {
  const copy = governanceCopy[language]; const { searchParams, replaceQuery } = useGovernanceSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1); const status = searchParams.get('status') ?? ''; const currency = searchParams.get('currency') ?? '';
  const [periods, setPeriods] = useState<PmsFinancialPeriod[]>([]); const [pagination, setPagination] = useState<PmsFinancePagination | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0); const [createOpen, setCreateOpen] = useState(false); const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(''); void listPmsFinancialPeriods(token, { companyId, status: status ? status as PmsFinancialPeriod['status'] : undefined, currency: currency || undefined, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, signal: controller.signal }).then((result) => { setPeriods(result.periods); setPagination(result.pagination); }).catch((loadError) => { if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) setError(apiMessage(loadError, copy.error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [companyId, copy.error, currency, page, refresh, status, token]);
  const reload = () => setRefresh((value) => value + 1);
  return <><div className="pms-finance-toolbar"><div className="pms-finance-filters"><label>{copy.status}<select value={status} onChange={(event) => replaceQuery({ status: event.target.value || null, page: null })}><option value="">{copy.all}</option>{(['OPEN', 'REVIEWING', 'CLOSED'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label><label>{copy.currency}<input maxLength={3} value={currency} onChange={(event) => replaceQuery({ currency: event.target.value.toUpperCase() || null, page: null })} /></label></div>{canManage ? <button className="button-link button-link--primary" onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" size={17} />{copy.createPeriod}</button> : null}</div>{!canManage ? <p className="pms-finance-permission-note">{copy.permissionDenied}</p> : null}{error ? <div className="pms-finance-state pms-finance-state--error" role="alert">{error}</div> : null}{loading ? <div className="pms-finance-state">{copy.loading}</div> : periods.length ? <div className="pms-table-wrap"><table className="pms-finance-table"><caption>{copy.periodsTitle}</caption><thead><tr><th>{copy.scope}</th><th>{copy.currency}</th><th>{copy.periodStart}</th><th>{copy.periodEnd}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{periods.map((period) => <tr key={period.id}><td>{period.property?.name ?? copy.companyWide}</td><td>{period.currency}</td><td>{formatFinanceDate(period.periodStart, language)}</td><td>{formatFinanceDate(period.periodEnd, language)}</td><td><span className={`pms-finance-status pms-finance-status--${period.status.toLowerCase()}`}>{governanceEnumLabel(period.status, language)}</span></td><td><button onClick={() => setSelectedId(period.id)} type="button">{copy.view}</button></td></tr>)}</tbody></table></div> : <div className="pms-finance-state">{copy.noRecords}</div>}<PaginationControls language={language} onPage={(next) => replaceQuery({ page: next === 1 ? null : String(next) })} page={page} pagination={pagination} /><PeriodCreateDialog allowCompanyWide={allowCompanyWide} companyId={companyId} language={language} onClose={() => setCreateOpen(false)} onSaved={reload} open={createOpen} token={token} /><PeriodDetailDialog companyId={companyId} language={language} onClose={() => setSelectedId(null)} onSaved={reload} open={Boolean(selectedId)} periodId={selectedId} token={token} /></>;
}

function ReconciliationCreateDialog({ allowCompanyWide, companyId, language, onClose, onSaved, open, token }: { allowCompanyWide: boolean; companyId: string; language: 'en' | 'ar'; onClose: () => void; onSaved: () => void; open: boolean; token: string }) {
  const copy = governanceCopy[language];
  const firstRef = useRef<HTMLInputElement>(null);
  const [properties, setProperties] = useState<PmsProperty[]>([]);
  const [source, setSource] = useState<PmsReconciliationSource>('BANK');
  const [direction, setDirection] = useState<PmsReconciliationDirection>('CREDIT');
  const [reference, setReference] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('OMR');
  const [date, setDate] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listPmsProperties(token, { companyId, take: 100, skip: 0 })
      .then((result) => {
        setProperties(result.properties);
        if (!allowCompanyWide && result.properties[0]) setPropertyId((current) => current || result.properties[0]!.id);
      })
      .catch((loadError) => setError(apiMessage(loadError, copy.error)));
  }, [allowCompanyWide, companyId, copy.error, open, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!reference.trim() || !date || !Number.isFinite(numericAmount) || numericAmount <= 0) return setError(copy.formError);
    setBusy(true);
    setError('');
    try {
      await createPmsReconciliationItem(token, {
        companyId,
        source,
        direction,
        externalReference: reference.trim(),
        amount: numericAmount,
        currency: currency.toUpperCase(),
        transactionDate: date,
        propertyId: propertyId || null,
        payerReference: counterparty.trim() || null,
      });
      onSaved();
      onClose();
      setReference('');
      setCounterparty('');
      setAmount('');
      setDate('');
    } catch (submitError) {
      setError(apiMessage(submitError, copy.error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.reconciliationDescription} initialFocusRef={firstRef} onClose={onClose} open={open} title={copy.createReconciliation}>
      <form className="pms-finance-form" onSubmit={submit}>
        {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
        <label>{copy.externalReference}<input ref={firstRef} required value={reference} onChange={(event) => setReference(event.target.value)} /></label>
        <label>{copy.direction}<select value={direction} onChange={(event) => setDirection(event.target.value as PmsReconciliationDirection)}><option value="CREDIT">{copy.credit}</option><option value="DEBIT">{copy.debit}</option></select></label>
        <label>{copy.source}<select value={source} onChange={(event) => setSource(event.target.value as PmsReconciliationSource)}>{(['BANK', 'PAYMENT_PROVIDER', 'CASHBOOK', 'MANUAL'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label>
        <label>{copy.amount}<input min="0.001" required step="0.001" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>{copy.currency}<input maxLength={3} required value={currency} onChange={(event) => setCurrency(event.target.value)} /></label>
        <label>{copy.transactionDate}<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>{copy.property}<select required={!allowCompanyWide} value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>{allowCompanyWide ? <option value="">{copy.companyWide}</option> : null}{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <label className="pms-finance-form__wide">{copy.counterpartyReference}<input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} /></label>
        <p className="pms-finance-permission-note">{direction === 'CREDIT' ? copy.creditHint : propertyId ? copy.vendorDebitHint : copy.ownerDebitHint}</p>
        <div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{copy.save}</button><button onClick={onClose} type="button">{copy.cancel}</button></div>
      </form>
    </AccessibleDialog>
  );
}

function ReconciliationActionDialog({ companyId, item, language, onClose, onSaved, open, token }: { companyId: string; item: PmsReconciliationItem | null; language: 'en' | 'ar'; onClose: () => void; onSaved: () => void; open: boolean; token: string }) {
  const copy = governanceCopy[language];
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [payments, setPayments] = useState<PmsPayment[]>([]);
  const [vendorInvoices, setVendorInvoices] = useState<PmsVendorInvoice[]>([]);
  const [ownerPayouts, setOwnerPayouts] = useState<PmsOwnerPayout[]>([]);
  const [targetType, setTargetType] = useState<PmsReconciliationTargetType>('RENT_PAYMENT');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'MATCH' | 'IGNORE' | 'RESTORE_UNMATCHED'>('MATCH');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setAction(item.status === 'IGNORED' ? 'RESTORE_UNMATCHED' : 'MATCH');
    setReason('');
    setTargetId('');
    setPayments([]);
    setVendorInvoices([]);
    setOwnerPayouts([]);
    setError('');

    if (item.status !== 'UNMATCHED') return;
    if (item.direction === 'CREDIT') {
      setTargetType('RENT_PAYMENT');
      void listPmsPayments(token, {
        companyId,
        propertyId: item.propertyId ?? undefined,
        status: 'CONFIRMED',
        currency: item.currency,
        take: 100,
        skip: 0,
      })
        .then((result) => setPayments(result.payments.filter((payment) => Number(payment.amount) === Number(item.amount))))
        .catch((loadError) => setError(apiMessage(loadError, copy.error)));
      return;
    }

    if (item.propertyId) {
      setTargetType('VENDOR_INVOICE');
      void listPmsVendorInvoices(token, {
        companyId,
        propertyId: item.propertyId,
        status: 'PAID',
        currency: item.currency,
        take: 100,
        skip: 0,
      })
        .then((result) => setVendorInvoices(result.invoices.filter((invoice) => Number(invoice.paidAmount) === Number(item.amount))))
        .catch((loadError) => setError(apiMessage(loadError, copy.error)));
      return;
    }

    setTargetType('OWNER_PAYOUT');
    void listPmsOwnerPayouts(token, {
      companyId,
      status: 'PAID_MANUAL',
      currency: item.currency,
      take: 100,
      skip: 0,
    })
      .then((result) => setOwnerPayouts(result.batches.filter((payout) => Number(payout.payoutAmount) === Number(item.amount))))
      .catch((loadError) => setError(apiMessage(loadError, copy.error)));
  }, [companyId, copy.error, item, open, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!item || reason.trim().length < 3) return setError(copy.formError);
    if (action === 'MATCH' && !targetId) return setError(copy.formError);
    setBusy(true);
    setError('');
    try {
      if (action === 'MATCH') {
        await matchPmsReconciliationItem(token, item.id, {
          companyId,
          targetType,
          targetId,
          reason: reason.trim(),
        });
      } else {
        await transitionPmsReconciliationItem(token, item.id, { companyId, action, reason: reason.trim() });
      }
      onSaved();
      onClose();
    } catch (submitError) {
      setError(apiMessage(submitError, copy.error));
    } finally {
      setBusy(false);
    }
  }

  const targetLabel = targetType === 'RENT_PAYMENT'
    ? copy.rentPayment
    : targetType === 'VENDOR_INVOICE'
      ? copy.vendorInvoice
      : copy.ownerPayout;

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.reconciliationDescription} initialFocusRef={reasonRef} onClose={onClose} open={open} title={action === 'MATCH' ? copy.matchTransaction : action === 'IGNORE' ? copy.ignore : copy.restore}>
      {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
      {item ? (
        <form className="pms-finance-form" onSubmit={submit}>
          <div className="pms-finance-detail__summary">
            <div><span>{copy.externalReference}</span><strong>{item.externalReference}</strong></div>
            <div><span>{copy.direction}</span><strong>{governanceEnumLabel(item.direction, language)}</strong></div>
            <div><span>{copy.amount}</span><strong>{formatFinanceMoney(item.amount, item.currency, language)}</strong></div>
          </div>
          {item.status === 'UNMATCHED' ? <label>{copy.actions}<select value={action} onChange={(event) => setAction(event.target.value as 'MATCH' | 'IGNORE')}><option value="MATCH">{copy.matchTransaction}</option><option value="IGNORE">{copy.ignore}</option></select></label> : null}
          {action === 'MATCH' ? (
            <>
              <label>{copy.targetType}<select value={targetType} onChange={(event) => { setTargetType(event.target.value as PmsReconciliationTargetType); setTargetId(''); }} disabled>
                {item.direction === 'CREDIT' ? <option value="RENT_PAYMENT">{copy.rentPayment}</option> : item.propertyId ? <option value="VENDOR_INVOICE">{copy.vendorInvoice}</option> : <option value="OWNER_PAYOUT">{copy.ownerPayout}</option>}
              </select></label>
              <label>{targetLabel}<select required value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                <option value="">{copy.selectTarget}</option>
                {payments.map((payment) => <option key={payment.id} value={payment.id}>{payment.receiptNumber ?? payment.id} · {formatFinanceDate(payment.paidAt, language)}</option>)}
                {vendorInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoice.paymentReference ?? copy.noReference}</option>)}
                {ownerPayouts.map((payout) => <option key={payout.id} value={payout.id}>{payout.payoutNumber} · {payout.payoutReference ?? copy.noReference}</option>)}
              </select></label>
            </>
          ) : null}
          <label className="pms-finance-form__wide">{copy.reason}<textarea ref={reasonRef} required value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <p className="pms-finance-permission-note"><AlertTriangle aria-hidden="true" size={17} /> {copy.destructiveWarning}</p>
          <div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{action === 'MATCH' ? copy.matchTransaction : action === 'IGNORE' ? copy.ignore : copy.restore}</button><button onClick={onClose} type="button">{copy.cancel}</button></div>
        </form>
      ) : null}
    </AccessibleDialog>
  );
}

function TreasuryImportDialog({ companyId, language, onClose, onSaved, open, token }: { companyId: string; language: 'en' | 'ar'; onClose: () => void; onSaved: () => void; open: boolean; token: string }) {
  const copy = governanceCopy[language];
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Exclude<PmsReconciliationSource, 'MANUAL'>>('BANK');
  const [accountReference, setAccountReference] = useState('');
  const [filename, setFilename] = useState('');
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<PmsTreasuryImportPreview | null>(null);
  const [batch, setBatch] = useState<PmsTreasuryImportBatch | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setBatch(null);
  }, [open]);

  function resetPreview() {
    setPreview(null);
    setBatch(null);
    setError('');
  }

  async function readFile(file: File | undefined) {
    resetPreview();
    if (!file) {
      setFilename('');
      setCsvText('');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(copy.importTooLarge);
      setFilename('');
      setCsvText('');
      return;
    }
    setFilename(file.name);
    setCsvText(await file.text());
  }

  const payload = () => ({
    companyId,
    source,
    accountReference: accountReference.trim() || null,
    filename: filename || null,
    csvText,
  });

  async function runPreview() {
    if (!csvText.trim()) return setError(copy.selectCsv);
    setBusy(true);
    setError('');
    setBatch(null);
    try {
      const result = await previewPmsTreasuryImport(token, payload());
      setPreview(result.preview);
    } catch (previewError) {
      setError(apiMessage(previewError, copy.error));
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!preview || preview.validRows.length === 0) return setError(copy.noValidImportRows);
    setBusy(true);
    setError('');
    try {
      const result = await commitPmsTreasuryImport(token, payload());
      setPreview(result.preview);
      setBatch(result.batch);
      onSaved();
    } catch (commitError) {
      setError(apiMessage(commitError, copy.error));
    } finally {
      setBusy(false);
    }
  }

  const exceptionRows = preview ? [...preview.invalidRows, ...preview.duplicateRows].slice(0, 10) : [];

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.importStatementDescription} initialFocusRef={fileRef} onClose={onClose} open={open} size="large" title={copy.importStatement}>
      <div className="pms-finance-detail">
        {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
        {batch ? <section className="pms-governance-readiness pms-governance-readiness--ready"><h3><ShieldCheck aria-hidden="true" size={19} /> {copy.importComplete}</h3><p>{copy.batch}: <strong>{batch.id}</strong> · {governanceEnumLabel(batch.status, language)}</p></section> : null}
        <div className="pms-finance-form">
          <label>{copy.source}<select value={source} onChange={(event) => { setSource(event.target.value as Exclude<PmsReconciliationSource, 'MANUAL'>); resetPreview(); }}>{(['BANK', 'PAYMENT_PROVIDER', 'CASHBOOK'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label>
          <label>{copy.accountReference}<input value={accountReference} onChange={(event) => { setAccountReference(event.target.value); resetPreview(); }} /></label>
          <label className="pms-finance-form__wide">{copy.csvFile}<input accept=".csv,text/csv" ref={fileRef} type="file" onChange={(event) => void readFile(event.target.files?.[0])} /></label>
          <p className="pms-finance-permission-note pms-finance-form__wide">{copy.importFormatHint}</p>
        </div>
        <div className="pms-finance-inline-actions">
          <button disabled={busy || !csvText} onClick={() => void runPreview()} type="button">{copy.previewImport}</button>
          <button className="button-link button-link--primary" disabled={busy || !preview || preview.validRows.length === 0 || Boolean(batch)} onClick={() => void commitImport()} type="button">{copy.commitImport}</button>
          <button onClick={onClose} type="button">{copy.cancel}</button>
        </div>
        {preview ? <>
          <div className="pms-finance-currency-summary">
            <article><span>{copy.totalRows}</span><strong>{preview.totalRows}</strong></article>
            <article><span>{copy.validRows}</span><strong>{preview.validRows.length}</strong></article>
            <article><span>{copy.duplicateRows}</span><strong>{preview.duplicateRows.length}</strong></article>
            <article><span>{copy.invalidRows}</span><strong>{preview.invalidRows.length}</strong></article>
          </div>
          {exceptionRows.length ? <div className="pms-table-wrap"><table className="pms-finance-table"><caption>{copy.importExceptions}</caption><thead><tr><th>{copy.row}</th><th>{copy.status}</th><th>{copy.externalReference}</th><th>{copy.reason}</th></tr></thead><tbody>{exceptionRows.map((row) => <tr key={`${row.rowNumber}-${row.status}`}><td>{row.rowNumber}</td><td>{governanceEnumLabel(row.status, language)}</td><td>{row.data?.externalReference ?? '—'}</td><td>{row.errors.join(' ') || (row.duplicateReason === 'EXISTING_REFERENCE' ? copy.existingReference : copy.duplicateInFile)}</td></tr>)}</tbody></table></div> : <p className="pms-finance-permission-note">{copy.noImportExceptions}</p>}
        </> : null}
      </div>
    </AccessibleDialog>
  );
}

function ReconciliationWorkspace({ allowCompanyWide, canManage, companyId, language, token }: { allowCompanyWide: boolean; canManage: boolean; companyId: string; language: 'en' | 'ar'; token: string }) {
  const copy = governanceCopy[language];
  const { searchParams, replaceQuery } = useGovernanceSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const query = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') ?? '') as PmsReconciliationStatus | '';
  const source = (searchParams.get('source') ?? '') as PmsReconciliationSource | '';
  const flow = (searchParams.get('flow') ?? '') as PmsReconciliationDirection | '';
  const currency = searchParams.get('currency') ?? '';
  const [searchInput, setSearchInput] = useState(query);
  const [items, setItems] = useState<PmsReconciliationItem[]>([]);
  const [pagination, setPagination] = useState<PmsFinancePagination | null>(null);
  const [statusTotals, setStatusTotals] = useState<Array<{ status: PmsReconciliationStatus; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<PmsReconciliationItem | null>(null);

  useEffect(() => setSearchInput(query), [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void listPmsReconciliationItems(token, {
      companyId,
      search: query || undefined,
      status: status || undefined,
      source: source || undefined,
      reconciliationDirection: flow || undefined,
      currency: currency || undefined,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      signal: controller.signal,
    })
      .then((result) => {
        setItems(result.items);
        setPagination(result.pagination);
        setStatusTotals(result.totalsByStatus);
      })
      .catch((loadError) => {
        if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) setError(apiMessage(loadError, copy.error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [companyId, copy.error, currency, flow, page, query, refresh, source, status, token]);

  const reload = () => setRefresh((value) => value + 1);
  const matchedTarget = (item: PmsReconciliationItem) => {
    if (item.payment) return `${copy.rentPayment}: ${item.payment.receiptNumber ?? item.payment.id}`;
    if (item.vendorInvoice) return `${copy.vendorInvoice}: ${item.vendorInvoice.invoiceNumber}`;
    if (item.ownerPayoutBatch) return `${copy.ownerPayout}: ${item.ownerPayoutBatch.payoutNumber}`;
    return null;
  };

  return (
    <>
      <div className="pms-finance-toolbar">
        <form className="pms-finance-filters" onSubmit={(event) => { event.preventDefault(); replaceQuery({ q: searchInput.trim() || null, page: null }); }}>
          <label>{copy.search}<input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
          <label>{copy.status}<select value={status} onChange={(event) => replaceQuery({ status: event.target.value || null, page: null })}><option value="">{copy.all}</option>{(['UNMATCHED', 'MATCHED', 'DUPLICATE', 'IGNORED'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label>
          <label>{copy.direction}<select value={flow} onChange={(event) => replaceQuery({ flow: event.target.value || null, page: null })}><option value="">{copy.all}</option><option value="CREDIT">{copy.credit}</option><option value="DEBIT">{copy.debit}</option></select></label>
          <label>{copy.source}<select value={source} onChange={(event) => replaceQuery({ source: event.target.value || null, page: null })}><option value="">{copy.all}</option>{(['BANK', 'PAYMENT_PROVIDER', 'CASHBOOK', 'MANUAL'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label>
          <button type="submit">{copy.filter}</button>
        </form>
        {canManage ? <div className="pms-finance-inline-actions">{allowCompanyWide ? <button onClick={() => setImportOpen(true)} type="button"><Upload aria-hidden="true" size={17} />{copy.importStatement}</button> : null}<button className="button-link button-link--primary" onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" size={17} />{copy.createReconciliation}</button></div> : null}
      </div>
      {!canManage ? <p className="pms-finance-permission-note">{copy.permissionDenied}</p> : null}
      <div className="pms-finance-currency-summary">{statusTotals.map((total) => <article key={total.status}><span>{governanceEnumLabel(total.status, language)}</span><strong>{total.count}</strong></article>)}</div>
      {error ? <div className="pms-finance-state pms-finance-state--error" role="alert">{error}</div> : null}
      {loading ? <div className="pms-finance-state">{copy.loading}</div> : items.length ? (
        <div className="pms-table-wrap">
          <table className="pms-finance-table">
            <caption>{copy.reconciliationTitle}</caption>
            <thead><tr><th>{copy.externalReference}</th><th>{copy.direction}</th><th>{copy.source}</th><th>{copy.amount}</th><th>{copy.transactionDate}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead>
            <tbody>
              {items.map((item) => {
                const target = matchedTarget(item);
                return (
                  <tr key={item.id}>
                    <td><strong>{item.externalReference}</strong><small>{item.payerReference ?? '—'}{item.duplicateOf ? ` · ${copy.duplicateOf}: ${item.duplicateOf.externalReference}` : ''}{item.importBatch ? ` · ${copy.batch}: ${item.importBatch.filename ?? item.importBatch.id} #${item.importRowNumber ?? '—'}` : ''}</small></td>
                    <td><span className={`pms-finance-status pms-finance-status--${item.direction.toLowerCase()}`}>{governanceEnumLabel(item.direction, language)}</span></td>
                    <td>{governanceEnumLabel(item.source, language)}</td>
                    <td>{formatFinanceMoney(item.amount, item.currency, language)}</td>
                    <td>{formatFinanceDate(item.transactionDate, language)}</td>
                    <td><span className={`pms-finance-status pms-finance-status--${item.status.toLowerCase()}`}>{governanceEnumLabel(item.status, language)}</span>{target ? <small>{target}</small> : null}</td>
                    <td>{canManage && (item.status === 'UNMATCHED' || item.status === 'IGNORED') ? <button onClick={() => setSelected(item)} type="button">{item.status === 'IGNORED' ? copy.restore : copy.actions}</button> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="pms-finance-state">{copy.noRecords}</div>}
      <PaginationControls language={language} onPage={(next) => replaceQuery({ page: next === 1 ? null : String(next) })} page={page} pagination={pagination} />
      <ReconciliationCreateDialog allowCompanyWide={allowCompanyWide} companyId={companyId} language={language} onClose={() => setCreateOpen(false)} onSaved={reload} open={createOpen} token={token} />
      <TreasuryImportDialog companyId={companyId} language={language} onClose={() => setImportOpen(false)} onSaved={reload} open={importOpen} token={token} />
      <ReconciliationActionDialog companyId={companyId} item={selected} language={language} onClose={() => setSelected(null)} onSaved={reload} open={Boolean(selected)} token={token} />
    </>
  );
}

export default function PmsFinanceGovernanceWorkspace({ section }: { section: PmsFinanceGovernanceSection }) {
  const { token, user } = useAuth(); const { language } = useLanguage(); const [searchParams] = useSearchParams(); const workspace = resolvePmsWorkspace(user?.pmsAccess?.workspaces ?? [], searchParams.get('companyId')); const copy = governanceCopy[language];
  if (!token || !workspace) return <section className="pms-route-content"><div className="pms-finance-state">{copy.loading}</div></section>;
  const companyId = workspace.company.id; const canManage = canManagePmsAccounting(workspace); const allowCompanyWide = workspace.propertyScope?.allProperties ?? false; const title = section === 'deposits' ? copy.depositsTitle : section === 'periods' ? copy.periodsTitle : copy.reconciliationTitle; const description = section === 'deposits' ? copy.depositsDescription : section === 'periods' ? copy.periodsDescription : copy.reconciliationDescription;
  return <section className="pms-route-content pms-finance-workspace pms-governance-workspace" aria-labelledby={`pms-governance-${section}-title`}><header className="pms-header"><div><p className="eyebrow">{copy.financeControl}</p><h1 id={`pms-governance-${section}-title`}>{title}</h1><p>{description}</p></div><GovernanceSectionNav companyId={companyId} language={language} section={section} /></header>{section === 'deposits' ? <DepositWorkspace canManage={canManage} companyId={companyId} language={language} token={token} /> : null}{section === 'periods' ? <PeriodWorkspace allowCompanyWide={allowCompanyWide} canManage={canManage} companyId={companyId} language={language} token={token} /> : null}{section === 'reconciliation' ? <ReconciliationWorkspace allowCompanyWide={allowCompanyWide} canManage={canManage} companyId={companyId} language={language} token={token} /> : null}</section>;
}

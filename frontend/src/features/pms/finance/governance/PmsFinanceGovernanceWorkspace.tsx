import { AlertTriangle, Plus, ShieldCheck } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../../api/client';
import { listPmsLeases, listPmsProperties, type PmsLease, type PmsProperty } from '../../../../api/pms';
import {
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
  listPmsReconciliationItems,
  matchPmsReconciliationItem,
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
  type PmsPayment,
  type PmsReconciliationItem,
  type PmsReconciliationSource,
  type PmsReconciliationStatus,
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
  const load = useCallback(async () => { if (!periodId) return; setError(''); try { const result = await getPmsFinancialPeriodReadiness(token, periodId, companyId); setPeriod(result.period); setReadiness(result.readiness); } catch (loadError) { setError(apiMessage(loadError, copy.error)); } }, [companyId, copy.error, periodId, token]);
  useEffect(() => { if (open) void load(); }, [load, open]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!periodId || !action || reason.trim().length < 3) return setError(copy.formError); setBusy(true); setError(''); try { await transitionPmsFinancialPeriod(token, periodId, { companyId, action, reason: reason.trim() }); setAction(null); setReason(''); await load(); onSaved(); } catch (submitError) { setError(apiMessage(submitError, copy.error)); } finally { setBusy(false); } }
  return <AccessibleDialog closeLabel={copy.close} description={copy.periodsDescription} initialFocusRef={action ? reasonRef : undefined} onClose={onClose} open={open} size="large" title={copy.periods}>{error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}{period ? <div className="pms-finance-detail"><div className="pms-finance-detail__summary"><div><span>{copy.scope}</span><strong>{period.property?.name ?? copy.companyWide}</strong></div><div><span>{copy.currency}</span><strong>{period.currency}</strong></div><div><span>{copy.periodStart}</span><strong>{formatFinanceDate(period.periodStart, language)}</strong></div><div><span>{copy.periodEnd}</span><strong>{formatFinanceDate(period.periodEnd, language)}</strong></div></div><section className={`pms-governance-readiness ${readiness?.canClose ? 'pms-governance-readiness--ready' : 'pms-governance-readiness--blocked'}`}><h3><ShieldCheck aria-hidden="true" size={19} /> {copy.readiness}: {readiness?.canClose ? copy.ready : copy.blocked}</h3><p>{copy.reconciliationExceptions}: <strong>{readiness?.reconciliationExceptions ?? 0}</strong> · {copy.pendingDeposits}: <strong>{readiness?.pendingDepositTransactions ?? 0}</strong></p></section><div className="pms-finance-inline-actions">{period.status === 'OPEN' ? <button onClick={() => setAction('REVIEW')} type="button">{copy.review}</button> : null}{period.status === 'REVIEWING' ? <button disabled={!readiness?.canClose} onClick={() => setAction('CLOSE')} type="button">{copy.closePeriod}</button> : null}{period.status === 'CLOSED' ? <button onClick={() => setAction('REOPEN')} type="button">{copy.reopen}</button> : null}</div>{action ? <form className="pms-finance-form pms-governance-inline-review" onSubmit={submit}><p><AlertTriangle aria-hidden="true" size={18} /> {copy.destructiveWarning}</p><label className="pms-finance-form__wide">{copy.reason}<textarea ref={reasonRef} required value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{governanceEnumLabel(action, language)}</button><button onClick={() => { setAction(null); setReason(''); }} type="button">{copy.cancel}</button></div></form> : null}<h3>{copy.auditTimeline}</h3><div className="pms-finance-history-grid">{period.events?.map((event) => <article className="pms-finance-history-item" key={event.id}><strong>{governanceEnumLabel(event.toStatus, language)}</strong><p>{event.reason ?? '—'}</p><small>{formatFinanceDate(event.createdAt, language)} · {event.createdBy?.name ?? '—'}</small></article>)}</div></div> : <div className="pms-finance-state">{copy.loading}</div>}</AccessibleDialog>;
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
  const copy = governanceCopy[language]; const firstRef = useRef<HTMLInputElement>(null); const [properties, setProperties] = useState<PmsProperty[]>([]); const [source, setSource] = useState<PmsReconciliationSource>('BANK'); const [reference, setReference] = useState(''); const [payer, setPayer] = useState(''); const [amount, setAmount] = useState(''); const [currency, setCurrency] = useState('OMR'); const [date, setDate] = useState(''); const [propertyId, setPropertyId] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) void listPmsProperties(token, { companyId, take: 100, skip: 0 }).then((result) => { setProperties(result.properties); if (!allowCompanyWide && result.properties[0]) setPropertyId((current) => current || result.properties[0]!.id); }).catch((loadError) => setError(apiMessage(loadError, copy.error))); }, [allowCompanyWide, companyId, copy.error, open, token]);
  async function submit(event: FormEvent) { event.preventDefault(); const numericAmount = Number(amount); if (!reference.trim() || !date || !Number.isFinite(numericAmount) || numericAmount <= 0) return setError(copy.formError); setBusy(true); setError(''); try { await createPmsReconciliationItem(token, { companyId, source, externalReference: reference.trim(), amount: numericAmount, currency: currency.toUpperCase(), transactionDate: date, propertyId: propertyId || null, payerReference: payer.trim() || null }); onSaved(); onClose(); } catch (submitError) { setError(apiMessage(submitError, copy.error)); } finally { setBusy(false); } }
  return <AccessibleDialog closeLabel={copy.close} description={copy.reconciliationDescription} initialFocusRef={firstRef} onClose={onClose} open={open} title={copy.createReconciliation}><form className="pms-finance-form" onSubmit={submit}>{error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}<label>{copy.externalReference}<input ref={firstRef} required value={reference} onChange={(event) => setReference(event.target.value)} /></label><label>{copy.source}<select value={source} onChange={(event) => setSource(event.target.value as PmsReconciliationSource)}>{(['BANK', 'PAYMENT_PROVIDER', 'CASHBOOK', 'MANUAL'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label><label>{copy.amount}<input min="0.001" required step="0.001" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>{copy.currency}<input maxLength={3} required value={currency} onChange={(event) => setCurrency(event.target.value)} /></label><label>{copy.transactionDate}<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>{copy.property}<select required={!allowCompanyWide} value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>{allowCompanyWide ? <option value="">{copy.companyWide}</option> : null}{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label className="pms-finance-form__wide">{copy.payerReference}<input value={payer} onChange={(event) => setPayer(event.target.value)} /></label><div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{copy.save}</button><button onClick={onClose} type="button">{copy.cancel}</button></div></form></AccessibleDialog>;
}

function ReconciliationActionDialog({ companyId, item, language, onClose, onSaved, open, token }: { companyId: string; item: PmsReconciliationItem | null; language: 'en' | 'ar'; onClose: () => void; onSaved: () => void; open: boolean; token: string }) {
  const copy = governanceCopy[language]; const reasonRef = useRef<HTMLTextAreaElement>(null); const [payments, setPayments] = useState<PmsPayment[]>([]); const [paymentId, setPaymentId] = useState(''); const [reason, setReason] = useState(''); const [action, setAction] = useState<'MATCH' | 'IGNORE' | 'RESTORE_UNMATCHED'>('MATCH'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open || !item) return; setAction(item.status === 'IGNORED' ? 'RESTORE_UNMATCHED' : item.status === 'UNMATCHED' ? 'MATCH' : 'MATCH'); setReason(''); setPaymentId(''); if (item.status === 'UNMATCHED') void listPmsPayments(token, { companyId, propertyId: item.propertyId ?? undefined, status: 'CONFIRMED', currency: item.currency, take: 100, skip: 0 }).then((result) => setPayments(result.payments.filter((payment) => payment.amount === item.amount))).catch((loadError) => setError(apiMessage(loadError, copy.error))); }, [companyId, copy.error, item, open, token]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!item || reason.trim().length < 3) return setError(copy.formError); if (action === 'MATCH' && !paymentId) return setError(copy.formError); setBusy(true); setError(''); try { if (action === 'MATCH') await matchPmsReconciliationItem(token, item.id, { companyId, paymentId, reason: reason.trim() }); else await transitionPmsReconciliationItem(token, item.id, { companyId, action, reason: reason.trim() }); onSaved(); onClose(); } catch (submitError) { setError(apiMessage(submitError, copy.error)); } finally { setBusy(false); } }
  return <AccessibleDialog closeLabel={copy.close} description={copy.reconciliationDescription} initialFocusRef={reasonRef} onClose={onClose} open={open} title={action === 'MATCH' ? copy.matchPayment : action === 'IGNORE' ? copy.ignore : copy.restore}>{error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}{item ? <form className="pms-finance-form" onSubmit={submit}><div className="pms-finance-detail__summary"><div><span>{copy.externalReference}</span><strong>{item.externalReference}</strong></div><div><span>{copy.amount}</span><strong>{formatFinanceMoney(item.amount, item.currency, language)}</strong></div></div>{item.status === 'UNMATCHED' ? <label>{copy.actions}<select value={action} onChange={(event) => setAction(event.target.value as 'MATCH' | 'IGNORE')}><option value="MATCH">{copy.matchPayment}</option><option value="IGNORE">{copy.ignore}</option></select></label> : null}{action === 'MATCH' ? <label>{copy.payment}<select required value={paymentId} onChange={(event) => setPaymentId(event.target.value)}><option value="">{copy.payment}</option>{payments.map((payment) => <option key={payment.id} value={payment.id}>{payment.receiptNumber ?? payment.id} · {formatFinanceDate(payment.paidAt, language)}</option>)}</select></label> : null}<label className="pms-finance-form__wide">{copy.reason}<textarea ref={reasonRef} required value={reason} onChange={(event) => setReason(event.target.value)} /></label><p className="pms-finance-permission-note"><AlertTriangle aria-hidden="true" size={17} /> {copy.destructiveWarning}</p><div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{action === 'MATCH' ? copy.matchPayment : action === 'IGNORE' ? copy.ignore : copy.restore}</button><button onClick={onClose} type="button">{copy.cancel}</button></div></form> : null}</AccessibleDialog>;
}

function ReconciliationWorkspace({ allowCompanyWide, canManage, companyId, language, token }: { allowCompanyWide: boolean; canManage: boolean; companyId: string; language: 'en' | 'ar'; token: string }) {
  const copy = governanceCopy[language]; const { searchParams, replaceQuery } = useGovernanceSearchParams(); const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1); const query = searchParams.get('q') ?? ''; const status = (searchParams.get('status') ?? '') as PmsReconciliationStatus | ''; const source = (searchParams.get('source') ?? '') as PmsReconciliationSource | ''; const currency = searchParams.get('currency') ?? '';
  const [searchInput, setSearchInput] = useState(query); const [items, setItems] = useState<PmsReconciliationItem[]>([]); const [pagination, setPagination] = useState<PmsFinancePagination | null>(null); const [statusTotals, setStatusTotals] = useState<Array<{ status: PmsReconciliationStatus; count: number }>>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0); const [createOpen, setCreateOpen] = useState(false); const [selected, setSelected] = useState<PmsReconciliationItem | null>(null);
  useEffect(() => setSearchInput(query), [query]); useEffect(() => { const controller = new AbortController(); setLoading(true); setError(''); void listPmsReconciliationItems(token, { companyId, search: query || undefined, status: status || undefined, source: source || undefined, currency: currency || undefined, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, signal: controller.signal }).then((result) => { setItems(result.items); setPagination(result.pagination); setStatusTotals(result.totalsByStatus); }).catch((loadError) => { if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) setError(apiMessage(loadError, copy.error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [companyId, copy.error, currency, page, query, refresh, source, status, token]); const reload = () => setRefresh((value) => value + 1);
  return <><div className="pms-finance-toolbar"><form className="pms-finance-filters" onSubmit={(event) => { event.preventDefault(); replaceQuery({ q: searchInput.trim() || null, page: null }); }}><label>{copy.search}<input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label><label>{copy.status}<select value={status} onChange={(event) => replaceQuery({ status: event.target.value || null, page: null })}><option value="">{copy.all}</option>{(['UNMATCHED', 'MATCHED', 'DUPLICATE', 'IGNORED'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label><label>{copy.source}<select value={source} onChange={(event) => replaceQuery({ source: event.target.value || null, page: null })}><option value="">{copy.all}</option>{(['BANK', 'PAYMENT_PROVIDER', 'CASHBOOK', 'MANUAL'] as const).map((value) => <option key={value} value={value}>{governanceEnumLabel(value, language)}</option>)}</select></label><button type="submit">{copy.filter}</button></form>{canManage ? <button className="button-link button-link--primary" onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" size={17} />{copy.createReconciliation}</button> : null}</div>{!canManage ? <p className="pms-finance-permission-note">{copy.permissionDenied}</p> : null}<div className="pms-finance-currency-summary">{statusTotals.map((total) => <article key={total.status}><span>{governanceEnumLabel(total.status, language)}</span><strong>{total.count}</strong></article>)}</div>{error ? <div className="pms-finance-state pms-finance-state--error" role="alert">{error}</div> : null}{loading ? <div className="pms-finance-state">{copy.loading}</div> : items.length ? <div className="pms-table-wrap"><table className="pms-finance-table"><caption>{copy.reconciliationTitle}</caption><thead><tr><th>{copy.externalReference}</th><th>{copy.source}</th><th>{copy.amount}</th><th>{copy.transactionDate}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.externalReference}</strong><small>{item.payerReference ?? '—'}{item.duplicateOf ? ` · ${copy.duplicateOf}: ${item.duplicateOf.externalReference}` : ''}</small></td><td>{governanceEnumLabel(item.source, language)}</td><td>{formatFinanceMoney(item.amount, item.currency, language)}</td><td>{formatFinanceDate(item.transactionDate, language)}</td><td><span className={`pms-finance-status pms-finance-status--${item.status.toLowerCase()}`}>{governanceEnumLabel(item.status, language)}</span>{item.payment ? <small>{copy.matchedPayment}: {item.payment.receiptNumber ?? item.payment.id}</small> : null}</td><td>{canManage && (item.status === 'UNMATCHED' || item.status === 'IGNORED') ? <button onClick={() => setSelected(item)} type="button">{item.status === 'IGNORED' ? copy.restore : copy.actions}</button> : '—'}</td></tr>)}</tbody></table></div> : <div className="pms-finance-state">{copy.noRecords}</div>}<PaginationControls language={language} onPage={(next) => replaceQuery({ page: next === 1 ? null : String(next) })} page={page} pagination={pagination} /><ReconciliationCreateDialog allowCompanyWide={allowCompanyWide} companyId={companyId} language={language} onClose={() => setCreateOpen(false)} onSaved={reload} open={createOpen} token={token} /><ReconciliationActionDialog companyId={companyId} item={selected} language={language} onClose={() => setSelected(null)} onSaved={reload} open={Boolean(selected)} token={token} /></>;
}

export default function PmsFinanceGovernanceWorkspace({ section }: { section: PmsFinanceGovernanceSection }) {
  const { token, user } = useAuth(); const { language } = useLanguage(); const [searchParams] = useSearchParams(); const workspace = resolvePmsWorkspace(user?.pmsAccess?.workspaces ?? [], searchParams.get('companyId')); const copy = governanceCopy[language];
  if (!token || !workspace) return <section className="pms-route-content"><div className="pms-finance-state">{copy.loading}</div></section>;
  const companyId = workspace.company.id; const canManage = canManagePmsAccounting(workspace); const allowCompanyWide = workspace.propertyScope?.allProperties ?? false; const title = section === 'deposits' ? copy.depositsTitle : section === 'periods' ? copy.periodsTitle : copy.reconciliationTitle; const description = section === 'deposits' ? copy.depositsDescription : section === 'periods' ? copy.periodsDescription : copy.reconciliationDescription;
  return <section className="pms-route-content pms-finance-workspace pms-governance-workspace" aria-labelledby={`pms-governance-${section}-title`}><header className="pms-header"><div><p className="eyebrow">{copy.financeControl}</p><h1 id={`pms-governance-${section}-title`}>{title}</h1><p>{description}</p></div><GovernanceSectionNav companyId={companyId} language={language} section={section} /></header>{section === 'deposits' ? <DepositWorkspace canManage={canManage} companyId={companyId} language={language} token={token} /> : null}{section === 'periods' ? <PeriodWorkspace allowCompanyWide={allowCompanyWide} canManage={canManage} companyId={companyId} language={language} token={token} /> : null}{section === 'reconciliation' ? <ReconciliationWorkspace allowCompanyWide={allowCompanyWide} canManage={canManage} companyId={companyId} language={language} token={token} /> : null}</section>;
}

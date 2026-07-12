import { AlertTriangle, FileCheck2, Plus, ShieldCheck, Upload } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../../api/client';
import {
  createPmsOwnerStatement,
  getPmsPersistedOwnerStatement,
  listPmsOwnerStatements,
  transitionPmsOwnerStatement,
  uploadPmsDocument,
  type PmsOwnerStatementAuditEvent,
  type PmsOwnerStatementStatus,
  type PmsPersistedOwnerStatement,
} from '../../../../api/pms';
import {
  createPmsOwnerPayout,
  getPmsOwnerPayout,
  listPmsOwnerPayouts,
  transitionPmsOwnerPayout,
  type PmsFinancePagination,
  type PmsOwnerPayout,
  type PmsOwnerPayoutAuditEvent,
  type PmsOwnerPayoutStatus,
} from '../../../../api/pmsAdvanced';
import { useAuth } from '../../../../auth/AuthContext';
import AccessibleDialog from '../../../../components/AccessibleDialog';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { canManagePmsAccounting, resolvePmsWorkspace } from '../../access';
import { formatFinanceDate, formatFinanceMoney } from '../copy';
import { settlementCopy, settlementEnumLabel } from './copy';

export type PmsOwnerSettlementSection = 'statements' | 'payouts';

const PAGE_SIZE = 25;
type QueryUpdates = Record<string, string | null | undefined>;
type PropertyOption = { id: string; name: string; code?: string | null };
type OwnerAccess = { id: string; propertyId: string; property: PropertyOption; userId: string; user: { id: string; name: string; email: string } };
type PayoutAction = 'APPROVE' | 'SUBMIT' | 'RECORD_PAID' | 'RECORD_FAILED' | 'RETRY' | 'CANCEL';

function useSettlementSearchParams() {
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

function statusClass(status: string) {
  return `pms-finance-status pms-finance-status--${status.toLowerCase().replaceAll('_', '-')}`;
}

function dateInputValue(value: string) {
  return value.slice(0, 10);
}

function uniqueOwners(accesses: OwnerAccess[]) {
  const owners = new Map<string, OwnerAccess['user']>();
  accesses.forEach((access) => owners.set(access.userId, access.user));
  return [...owners.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function SettlementSectionNav({ companyId, section, language }: { companyId: string; section: PmsOwnerSettlementSection; language: 'en' | 'ar' }) {
  const copy = settlementCopy[language];
  const suffix = `?companyId=${encodeURIComponent(companyId)}`;
  return (
    <nav className="pms-finance-section-nav" aria-label={copy.financeControl}>
      <Link to={`/pms/finance/overview${suffix}`}>{copy.overview}</Link>
      <Link to={`/pms/finance/charges${suffix}`}>{copy.charges}</Link>
      <Link to={`/pms/finance/payments${suffix}`}>{copy.payments}</Link>
      <Link to={`/pms/finance/deposits${suffix}`}>{copy.deposits}</Link>
      <Link to={`/pms/finance/periods${suffix}`}>{copy.periods}</Link>
      <Link to={`/pms/finance/reconciliation${suffix}`}>{copy.reconciliation}</Link>
      <Link aria-current={section === 'statements' ? 'page' : undefined} to={`/pms/finance/statements${suffix}`}>{copy.statements}</Link>
      <Link aria-current={section === 'payouts' ? 'page' : undefined} to={`/pms/finance/payouts${suffix}`}>{copy.payouts}</Link>
      <Link to={`/pms/finance/vendor-invoices${suffix}`}>{copy.vendorInvoices}</Link>
      <Link to={`/pms/finance/records${suffix}`}>{copy.records}</Link>
    </nav>
  );
}

function PaginationControls({ pagination, page, onPage, language }: { pagination: PmsFinancePagination | null; page: number; onPage: (page: number) => void; language: 'en' | 'ar' }) {
  const copy = settlementCopy[language];
  const range = pageRange(pagination);
  if (!pagination) return null;
  return (
    <div className="pms-finance-pagination">
      <span>{range.from}–{range.to} {copy.pageOf} {pagination.total}</span>
      <div>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} type="button">{copy.previous}</button>
        <button disabled={pagination.skip + pagination.count >= pagination.total} onClick={() => onPage(page + 1)} type="button">{copy.next}</button>
      </div>
    </div>
  );
}

function DocumentUploadForm({ companyId, propertyId, statementId, payoutId, language, onUploaded, token }: { companyId: string; propertyId: string; statementId?: string; payoutId?: string; language: 'en' | 'ar'; onUploaded: () => void; token: string }) {
  const copy = settlementCopy[language];
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !file) return setError(copy.formError);
    setBusy(true); setError('');
    try {
      await uploadPmsDocument(token, {
        companyId,
        propertyId,
        statementId: statementId ?? null,
        ownerPayoutBatchId: payoutId ?? null,
        type: 'OTHER',
        title: title.trim(),
        status: 'ACTIVE',
      }, file);
      setTitle(''); setFile(null); onUploaded();
    } catch (uploadError) {
      setError(apiMessage(uploadError, copy.actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pms-finance-form pms-settlement-evidence-form" onSubmit={submit}>
      {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
      <label>{copy.documentTitle}<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>{copy.file}<input accept="application/pdf,image/jpeg,image/png,image/webp" required type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <div className="pms-finance-inline-actions"><button disabled={busy} type="submit"><Upload aria-hidden="true" size={16} />{copy.upload}</button></div>
    </form>
  );
}

function StatementCreateDialog({ companyId, language, onClose, onSaved, open, properties, revisionOf, token }: { companyId: string; language: 'en' | 'ar'; onClose: () => void; onSaved: (statement: PmsPersistedOwnerStatement) => void; open: boolean; properties: PropertyOption[]; revisionOf?: PmsPersistedOwnerStatement | null; token: string }) {
  const copy = settlementCopy[language];
  const propertyRef = useRef<HTMLSelectElement>(null);
  const [propertyId, setPropertyId] = useState('');
  const [month, setMonth] = useState('');
  const [currency, setCurrency] = useState('OMR');
  const [ownerReference, setOwnerReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPropertyId(revisionOf?.propertyId ?? properties[0]?.id ?? '');
    setMonth(revisionOf ? dateInputValue(revisionOf.periodStart).slice(0, 7) : '');
    setCurrency(revisionOf?.currency ?? 'OMR');
    setOwnerReference(revisionOf?.ownerReference ?? '');
    setError('');
  }, [open, properties, revisionOf]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!propertyId || (!month && !revisionOf) || currency.trim().length !== 3) return setError(copy.formError);
    setBusy(true); setError('');
    try {
      const result = await createPmsOwnerStatement(token, {
        companyId,
        propertyId,
        ...(revisionOf
          ? { dateFrom: revisionOf.periodStart, dateTo: revisionOf.periodEnd, revisionOfId: revisionOf.id }
          : { month }),
        currency: currency.trim().toUpperCase(),
        ownerReference: ownerReference.trim() || null,
      });
      onSaved(result.statement); onClose();
    } catch (submitError) {
      setError(apiMessage(submitError, copy.actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.statementDescription} initialFocusRef={propertyRef} onClose={onClose} open={open} title={revisionOf ? copy.createRevision : copy.createStatement}>
      <form className="pms-finance-form" onSubmit={submit}>
        {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
        <label>{copy.property}<select disabled={Boolean(revisionOf)} ref={propertyRef} required value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">{copy.chooseProperty}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}{property.code ? ` · ${property.code}` : ''}</option>)}</select></label>
        {revisionOf ? <label>{copy.period}<input disabled value={`${dateInputValue(revisionOf.periodStart)} — ${dateInputValue(revisionOf.periodEnd)}`} /></label> : <label>{copy.month}<input required type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>}
        <label>{copy.currency}<input disabled={Boolean(revisionOf)} maxLength={3} required value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
        <label>{copy.ownerReference}<input value={ownerReference} onChange={(event) => setOwnerReference(event.target.value)} /></label>
        {revisionOf ? <p className="pms-finance-permission-note"><ShieldCheck aria-hidden="true" size={17} />{copy.immutable}</p> : null}
        <div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{revisionOf ? copy.createRevision : copy.createStatement}</button><button onClick={onClose} type="button">{copy.cancel}</button></div>
      </form>
    </AccessibleDialog>
  );
}

function StatementDetailDialog({ canManage, companyId, language, onClose, onCreateRevision, onSaved, open, statementId, token, userId }: { canManage: boolean; companyId: string; language: 'en' | 'ar'; onClose: () => void; onCreateRevision: (statement: PmsPersistedOwnerStatement) => void; onSaved: () => void; open: boolean; statementId: string | null; token: string; userId?: string }) {
  const copy = settlementCopy[language];
  const closeRef = useRef<HTMLButtonElement>(null);
  const [statement, setStatement] = useState<PmsPersistedOwnerStatement | null>(null);
  const [events, setEvents] = useState<PmsOwnerStatementAuditEvent[]>([]);
  const [reason, setReason] = useState('');
  const [pendingStatus, setPendingStatus] = useState<PmsOwnerStatementStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!statementId) return;
    setLoading(true); setError('');
    try {
      const result = await getPmsPersistedOwnerStatement(token, statementId);
      setStatement(result.statement); setEvents(result.events);
    } catch (loadError) {
      setError(apiMessage(loadError, copy.error));
    } finally {
      setLoading(false);
    }
  }, [copy.error, statementId, token]);

  useEffect(() => { if (open) void load(); }, [load, open]);
  useEffect(() => { if (!open) { setStatement(null); setEvents([]); setPendingStatus(null); setReason(''); } }, [open]);

  async function performTransition(status: PmsOwnerStatementStatus) {
    if (!statement) return;
    if (status === 'VOID' && !reason.trim()) return setError(copy.formError);
    setBusy(true); setError('');
    try {
      await transitionPmsOwnerStatement(token, statement.id, status, reason.trim() || undefined);
      setPendingStatus(null); setReason(''); await load(); onSaved();
    } catch (transitionError) {
      setError(apiMessage(transitionError, copy.actionError));
    } finally {
      setBusy(false);
    }
  }

  const actions = statement && canManage ? [
    statement.status === 'GENERATED' ? { status: 'NEEDS_REVIEW' as const, label: copy.submitReview, disabled: false } : null,
    statement.status === 'NEEDS_REVIEW' ? { status: 'APPROVED' as const, label: copy.approve, disabled: statement.generatedBy?.id === userId } : null,
    statement.status === 'APPROVED' ? { status: 'PUBLISHED' as const, label: copy.publish, disabled: statement.approvedBy?.id === userId || !(statement.documents?.length) } : null,
    ['GENERATED', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED'].includes(statement.status) ? { status: 'VOID' as const, label: copy.void, disabled: Boolean(statement.payoutLines?.some((line) => line.payoutBatch.status !== 'CANCELLED')) } : null,
  ].filter(Boolean) as Array<{ status: PmsOwnerStatementStatus; label: string; disabled: boolean }> : [];

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.statementDescription} initialFocusRef={closeRef} onClose={onClose} open={open} title={statement ? `${statement.property.name} · ${settlementEnumLabel(statement.status, language)}` : copy.statements}>
      {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
      {loading ? <div className="pms-finance-state">{copy.loading}</div> : null}
      {statement ? <div className="pms-settlement-detail">
        <div className="pms-settlement-detail__header"><div><span className={statusClass(statement.status)}>{settlementEnumLabel(statement.status, language)}</span><h3>{statement.ownerReference || `${statement.property.name} · ${copy.revision} ${statement.revision}`}</h3><p>{formatFinanceDate(statement.periodStart, language)} — {formatFinanceDate(statement.periodEnd, language)} · {statement.currency}</p></div><button ref={closeRef} onClick={onClose} type="button">{copy.close}</button></div>
        <div className="pms-finance-currency-summary pms-settlement-metrics">
          <article><span>{copy.opening}</span><strong>{formatFinanceMoney(statement.openingBalance, statement.currency, language)}</strong></article>
          <article><span>{copy.income}</span><strong>{formatFinanceMoney(statement.income, statement.currency, language)}</strong></article>
          <article><span>{copy.expenses}</span><strong>{formatFinanceMoney(statement.expenses, statement.currency, language)}</strong></article>
          <article><span>{copy.adjustments}</span><strong>{formatFinanceMoney(statement.adjustments, statement.currency, language)}</strong></article>
          <article><span>{copy.closing}</span><strong>{formatFinanceMoney(statement.closingBalance, statement.currency, language)}</strong></article>
        </div>
        <div className="pms-settlement-governance-notes"><p><ShieldCheck aria-hidden="true" size={18} />{copy.makerCheckerStatement}</p><p><FileCheck2 aria-hidden="true" size={18} />{copy.publishReadiness}</p></div>
        <dl className="pms-settlement-facts">
          <div><dt>{copy.createdBy}</dt><dd>{statement.generatedBy?.name ?? '—'}</dd></div><div><dt>{copy.createdDate}</dt><dd>{formatFinanceDate(statement.generatedAt, language)}</dd></div>
          <div><dt>{copy.approvedBy}</dt><dd>{statement.approvedBy?.name ?? '—'}</dd></div><div><dt>{copy.approvalDate}</dt><dd>{formatFinanceDate(statement.approvedAt, language)}</dd></div>
          <div><dt>{copy.publishedBy}</dt><dd>{statement.publishedBy?.name ?? '—'}</dd></div><div><dt>{copy.publicationDate}</dt><dd>{formatFinanceDate(statement.publishedAt, language)}</dd></div>
        </dl>
        <section><h3>{copy.documents}</h3>{statement.documents?.length ? <div className="pms-finance-history-grid">{statement.documents.map((document) => <article className="pms-finance-history-item" key={document.id}><div><strong>{document.title}</strong><span className={statusClass(document.status)}>{settlementEnumLabel(document.status, language)}</span></div><small>{document.originalFilename ?? '—'} · {formatFinanceDate(document.createdAt, language)}</small><small>{document.uploadedBy?.name ?? '—'}</small></article>)}</div> : <p>{copy.noDocuments}</p>}{canManage && statement.status !== 'VOID' ? <DocumentUploadForm companyId={companyId} language={language} onUploaded={() => { void load(); onSaved(); }} propertyId={statement.propertyId} statementId={statement.id} token={token} /> : null}</section>
        {statement.payoutLines?.length ? <section><h3>{copy.linkedPayouts}</h3><div className="pms-finance-history-grid">{statement.payoutLines.map((line) => <article className="pms-finance-history-item" key={line.id}><div><strong>{line.payoutBatch.payoutNumber}</strong><span className={statusClass(line.payoutBatch.status)}>{settlementEnumLabel(line.payoutBatch.status, language)}</span></div><p>{formatFinanceMoney(line.netAmount, line.payoutBatch.currency, language)}</p></article>)}</div></section> : null}
        <section><h3>{copy.history}</h3>{events.length ? <div className="pms-finance-history-grid">{events.map((event) => <article className="pms-finance-history-item" key={event.id}><strong>{settlementEnumLabel(event.action, language)}</strong><small>{formatFinanceDate(event.createdAt, language)}</small></article>)}</div> : <p>{copy.noHistory}</p>}</section>
        {actions.length ? <div className="pms-finance-inline-actions pms-settlement-actions">{actions.map((action) => <button disabled={action.disabled || busy} key={action.status} onClick={() => action.status === 'VOID' ? setPendingStatus('VOID') : void performTransition(action.status)} type="button">{action.label}</button>)}</div> : null}
        {statement.status === 'VOID' && canManage ? <button className="button-link button-link--primary" onClick={() => onCreateRevision(statement)} type="button"><Plus aria-hidden="true" size={16} />{copy.createRevision}</button> : null}
        {pendingStatus === 'VOID' ? <form className="pms-finance-form pms-governance-inline-review" onSubmit={(event) => { event.preventDefault(); void performTransition('VOID'); }}><p><AlertTriangle aria-hidden="true" size={18} />{copy.immutable}</p><label className="pms-finance-form__wide">{copy.reason}<textarea autoFocus required value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="pms-finance-inline-actions"><button disabled={busy} type="submit">{copy.void}</button><button onClick={() => { setPendingStatus(null); setReason(''); }} type="button">{copy.cancel}</button></div></form> : null}
      </div> : null}
    </AccessibleDialog>
  );
}

function StatementWorkspace({ canManage, companyId, language, token, userId }: { canManage: boolean; companyId: string; language: 'en' | 'ar'; token: string; userId?: string }) {
  const copy = settlementCopy[language];
  const { searchParams, replaceQuery } = useSettlementSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const query = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') ?? '') as PmsOwnerStatementStatus | '';
  const currency = searchParams.get('currency') ?? '';
  const propertyId = searchParams.get('propertyId') ?? '';
  const sortBy = (searchParams.get('sortBy') ?? 'periodEnd') as 'periodStart' | 'periodEnd' | 'createdAt' | 'updatedAt' | 'closingBalance' | 'status';
  const direction = (searchParams.get('direction') ?? 'desc') as 'asc' | 'desc';
  const [searchInput, setSearchInput] = useState(query);
  const [currencyInput, setCurrencyInput] = useState(currency);
  const [statements, setStatements] = useState<PmsPersistedOwnerStatement[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [pagination, setPagination] = useState<PmsFinancePagination | null>(null);
  const [statusTotals, setStatusTotals] = useState<Array<{ status: PmsOwnerStatementStatus; count: number }>>([]);
  const [currencyTotals, setCurrencyTotals] = useState<Array<{ currency: string; count: number; closingBalance: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revisionOf, setRevisionOf] = useState<PmsPersistedOwnerStatement | null>(null);

  useEffect(() => { setSearchInput(query); setCurrencyInput(currency); }, [currency, query]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void listPmsOwnerStatements(token, { companyId, search: query || undefined, status: status || undefined, currency: currency || undefined, propertyId: propertyId || undefined, sortBy, direction, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE })
      .then((result) => { if (!controller.signal.aborted) { setStatements(result.statements); setPagination(result.pagination); setStatusTotals(result.totalsByStatus); setCurrencyTotals(result.totalsByCurrency); setProperties(result.properties); } })
      .catch((loadError) => { if (!controller.signal.aborted) setError(apiMessage(loadError, copy.error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, copy.error, currency, direction, page, propertyId, query, refresh, sortBy, status, token]);

  const reload = () => setRefresh((value) => value + 1);
  function submitFilters(event: FormEvent) { event.preventDefault(); replaceQuery({ q: searchInput.trim() || null, currency: currencyInput.trim().toUpperCase() || null, page: null }); }

  return <>
    <div className="pms-finance-toolbar"><form className="pms-finance-filters" onSubmit={submitFilters}><label>{copy.search}<input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label><label>{copy.status}<select aria-label={copy.status} value={status} onChange={(event) => replaceQuery({ status: event.target.value || null, page: null })}><option value="">{copy.all}</option>{(['GENERATED', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED', 'VOID'] as const).map((value) => <option key={value} value={value}>{settlementEnumLabel(value, language)}</option>)}</select></label><label>{copy.property}<select value={propertyId} onChange={(event) => replaceQuery({ propertyId: event.target.value || null, page: null })}><option value="">{copy.all}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label>{copy.currency}<input maxLength={3} value={currencyInput} onChange={(event) => setCurrencyInput(event.target.value)} /></label><label>{copy.sort}<select value={`${sortBy}:${direction}`} onChange={(event) => { const [nextSort, nextDirection] = event.target.value.split(':'); replaceQuery({ sortBy: nextSort, direction: nextDirection, page: null }); }}><option value="periodEnd:desc">{copy.sortPeriodLatest}</option><option value="periodStart:asc">{copy.sortPeriodEarliest}</option><option value="closingBalance:desc">{copy.sortBalance}</option><option value="createdAt:desc">{copy.sortCreated}</option><option value="status:asc">{copy.sortStatus}</option></select></label><button type="submit">{copy.apply}</button><button onClick={() => replaceQuery({ q: null, status: null, propertyId: null, currency: null, sortBy: null, direction: null, page: null })} type="button">{copy.clear}</button></form>{canManage ? <button className="button-link button-link--primary" onClick={() => { setRevisionOf(null); setCreateOpen(true); }} type="button"><Plus aria-hidden="true" size={17} />{copy.createStatement}</button> : null}</div>
    {!canManage ? <p className="pms-finance-permission-note">{copy.permission}</p> : null}
    <div className="pms-finance-currency-summary">{currencyTotals.map((total) => <article key={total.currency}><span>{copy.closing} · {total.currency}</span><strong>{formatFinanceMoney(total.closingBalance, total.currency, language)}</strong><small>{copy.databaseTotal}: {total.count}</small></article>)}</div>
    <div className="pms-settlement-status-summary">{statusTotals.map((total) => <span key={total.status}><strong>{total.count}</strong> {settlementEnumLabel(total.status, language)}</span>)}</div>
    {error ? <div className="pms-finance-state pms-finance-state--error" role="alert">{error}</div> : null}
    {loading ? <div className="pms-finance-state">{copy.loading}</div> : statements.length ? <div className="pms-table-wrap"><table className="pms-finance-table"><caption>{copy.statements}</caption><thead><tr><th>{copy.property}</th><th>{copy.period}</th><th>{copy.revision}</th><th>{copy.closing}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{statements.map((statement) => <tr key={statement.id}><td><strong>{statement.property.name}</strong><small>{statement.ownerReference ?? statement.property.code ?? '—'}</small></td><td>{formatFinanceDate(statement.periodStart, language)}<small>{formatFinanceDate(statement.periodEnd, language)}</small></td><td>{statement.revision}</td><td>{formatFinanceMoney(statement.closingBalance, statement.currency, language)}</td><td><span className={statusClass(statement.status)}>{settlementEnumLabel(statement.status, language)}</span></td><td><button onClick={() => setSelectedId(statement.id)} type="button">{copy.view}</button></td></tr>)}</tbody></table></div> : <div className="pms-finance-state">{copy.noRecords}</div>}
    <PaginationControls language={language} onPage={(next) => replaceQuery({ page: next === 1 ? null : String(next) })} page={page} pagination={pagination} />
    <StatementCreateDialog companyId={companyId} language={language} onClose={() => { setCreateOpen(false); setRevisionOf(null); }} onSaved={(statement) => { reload(); setSelectedId(statement.id); }} open={createOpen} properties={properties} revisionOf={revisionOf} token={token} />
    <StatementDetailDialog canManage={canManage} companyId={companyId} language={language} onClose={() => setSelectedId(null)} onCreateRevision={(statement) => { setSelectedId(null); setRevisionOf(statement); setCreateOpen(true); }} onSaved={reload} open={Boolean(selectedId)} statementId={selectedId} token={token} userId={userId} />
  </>;
}

function PayoutCreateDialog({ companyId, language, onClose, onSaved, open, ownerAccesses, token }: { companyId: string; language: 'en' | 'ar'; onClose: () => void; onSaved: (batch: PmsOwnerPayout) => void; open: boolean; ownerAccesses: OwnerAccess[]; token: string }) {
  const copy = settlementCopy[language];
  const ownerRef = useRef<HTMLSelectElement>(null);
  const owners = useMemo(() => uniqueOwners(ownerAccesses), [ownerAccesses]);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [statements, setStatements] = useState<PmsPersistedOwnerStatement[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [reserves, setReserves] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setOwnerUserId(owners[0]?.id ?? ''); setSelectedIds([]); setFees({}); setReserves({}); setNotes(''); setError('');
  }, [open, owners]);

  useEffect(() => {
    if (!open || !ownerUserId) { setStatements([]); return; }
    const propertyIds = new Set(ownerAccesses.filter((access) => access.userId === ownerUserId).map((access) => access.propertyId));
    setLoading(true); setError('');
    void listPmsOwnerStatements(token, { companyId, status: 'PUBLISHED', take: 100, skip: 0, sortBy: 'periodEnd', direction: 'desc' })
      .then((result) => setStatements(result.statements.filter((statement) => propertyIds.has(statement.propertyId) && !(statement.payoutLines?.some((line) => line.payoutBatch.status !== 'CANCELLED')))))
      .catch((loadError) => setError(apiMessage(loadError, copy.error)))
      .finally(() => setLoading(false));
  }, [companyId, copy.error, open, ownerAccesses, ownerUserId, token]);

  const firstSelected = statements.find((statement) => statement.id === selectedIds[0]);
  const compatibleStatements = firstSelected ? statements.filter((statement) => statement.currency === firstSelected.currency && statement.periodStart === firstSelected.periodStart && statement.periodEnd === firstSelected.periodEnd) : statements;
  const selectedStatements = statements.filter((statement) => selectedIds.includes(statement.id));
  const payoutTotal = selectedStatements.reduce((sum, statement) => sum + Number(statement.closingBalance) - Number(fees[statement.id] || 0) - Number(reserves[statement.id] || 0), 0);

  function toggleStatement(statementId: string) {
    setSelectedIds((current) => current.includes(statementId) ? current.filter((id) => id !== statementId) : [...current, statementId]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ownerUserId || selectedStatements.length === 0 || !firstSelected) return setError(copy.formError);
    const invalid = selectedStatements.some((statement) => {
      const fee = Number(fees[statement.id] || 0); const reserve = Number(reserves[statement.id] || 0);
      return !Number.isFinite(fee) || !Number.isFinite(reserve) || fee < 0 || reserve < 0 || fee + reserve > Number(statement.closingBalance);
    });
    if (invalid) return setError(copy.formError);
    setBusy(true); setError('');
    try {
      const result = await createPmsOwnerPayout(token, {
        companyId,
        ownerUserId,
        currency: firstSelected.currency,
        periodStart: firstSelected.periodStart,
        periodEnd: firstSelected.periodEnd,
        notes: notes.trim() || null,
        lines: selectedStatements.map((statement) => ({ statementId: statement.id, managementFeeAmount: Number(fees[statement.id] || 0), reservedAmount: Number(reserves[statement.id] || 0) })),
      });
      onSaved(result.batch); onClose();
    } catch (submitError) {
      setError(apiMessage(submitError, copy.actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.payoutDescription} initialFocusRef={ownerRef} onClose={onClose} open={open} title={copy.createPayout}>
      <form className="pms-finance-form" onSubmit={submit}>
        {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
        <label>{copy.owner}<select ref={ownerRef} required value={ownerUserId} onChange={(event) => { setOwnerUserId(event.target.value); setSelectedIds([]); }}><option value="">{copy.chooseOwner}</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} · {owner.email}</option>)}</select></label>
        <div className="pms-finance-form__wide"><span className="pms-settlement-field-label">{copy.selectStatements}</span>{loading ? <p>{copy.loading}</p> : compatibleStatements.length ? <div className="pms-settlement-statement-picker">{compatibleStatements.map((statement) => <article key={statement.id}><label className="pms-settlement-check"><input checked={selectedIds.includes(statement.id)} onChange={() => toggleStatement(statement.id)} type="checkbox" /><span><strong>{statement.property.name}</strong><small>{formatFinanceDate(statement.periodStart, language)} — {formatFinanceDate(statement.periodEnd, language)} · {formatFinanceMoney(statement.closingBalance, statement.currency, language)}</small></span></label>{selectedIds.includes(statement.id) ? <div className="pms-settlement-line-costs"><label>{copy.managementFee}<input min="0" step="0.001" type="number" value={fees[statement.id] ?? ''} onChange={(event) => setFees((current) => ({ ...current, [statement.id]: event.target.value }))} /></label><label>{copy.reserve}<input min="0" step="0.001" type="number" value={reserves[statement.id] ?? ''} onChange={(event) => setReserves((current) => ({ ...current, [statement.id]: event.target.value }))} /></label></div> : null}</article>)}</div> : <p>{copy.noPublishedStatements}</p>}</div>
        <label className="pms-finance-form__wide">{copy.notes}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {firstSelected ? <p className="pms-settlement-calculated-total"><span>{copy.totalPayout}</span><strong>{formatFinanceMoney(payoutTotal, firstSelected.currency, language)}</strong><small>{selectedStatements.length} {copy.selected}</small></p> : null}
        <p className="pms-finance-permission-note"><ShieldCheck aria-hidden="true" size={17} />{copy.makerCheckerPayout}</p>
        <div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy || loading} type="submit">{copy.createPayout}</button><button onClick={onClose} type="button">{copy.cancel}</button></div>
      </form>
    </AccessibleDialog>
  );
}

function PayoutActionForm({ action, batch, companyId, language, onCancel, onSaved, token }: { action: PayoutAction; batch: PmsOwnerPayout; companyId: string; language: 'en' | 'ar'; onCancel: () => void; onSaved: () => void; token: string }) {
  const copy = settlementCopy[language];
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState(batch.payoutReference ?? '');
  const [note, setNote] = useState(batch.paymentMethodNote ?? '');
  const [evidenceDocumentId, setEvidenceDocumentId] = useState('');
  const [providerConfirmed, setProviderConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsEvidence = ['APPROVE', 'SUBMIT', 'RECORD_PAID'].includes(action);
  const needsReference = ['SUBMIT', 'RECORD_PAID'].includes(action);
  const needsReason = ['RECORD_FAILED', 'RETRY', 'CANCEL'].includes(action);
  const eligibleDocuments = batch.documents.filter((document) => action !== 'RECORD_PAID' || !batch.processingAt || new Date(document.createdAt).getTime() >= new Date(batch.processingAt).getTime());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if ((needsEvidence && !evidenceDocumentId) || (needsReference && (!reference.trim() || !note.trim())) || (needsReason && !reason.trim()) || (action === 'SUBMIT' && !providerConfirmed)) return setError(copy.formError);
    setBusy(true); setError('');
    try {
      await transitionPmsOwnerPayout(token, batch.id, {
        companyId,
        action,
        reason: reason.trim() || undefined,
        payoutReference: reference.trim() || undefined,
        paymentMethodNote: note.trim() || undefined,
        evidenceDocumentId: evidenceDocumentId || undefined,
        adapter: action === 'SUBMIT' ? 'MANUAL_BANK_EVIDENCE' : undefined,
        providerConfirmed: action === 'SUBMIT' ? providerConfirmed : undefined,
      });
      onSaved(); onCancel();
    } catch (submitError) {
      setError(apiMessage(submitError, copy.actionError));
    } finally {
      setBusy(false);
    }
  }

  return <form className="pms-finance-form pms-governance-inline-review" onSubmit={submit}>{error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}<p><AlertTriangle aria-hidden="true" size={18} />{action === 'RECORD_PAID' ? copy.paidReadiness : copy.makerCheckerPayout}</p>{needsEvidence ? <label>{copy.evidenceDocument}<select required value={evidenceDocumentId} onChange={(event) => setEvidenceDocumentId(event.target.value)}><option value="">{copy.chooseEvidence}</option>{eligibleDocuments.map((document) => <option key={document.id} value={document.id}>{document.title} · {formatFinanceDate(document.createdAt, language)}</option>)}</select></label> : null}{needsReference ? <><label>{copy.payoutReference}<input required value={reference} onChange={(event) => setReference(event.target.value)} /></label><label className="pms-finance-form__wide">{copy.evidenceNote}<textarea required value={note} onChange={(event) => setNote(event.target.value)} /></label></> : null}{action === 'SUBMIT' ? <label className="pms-settlement-confirmation"><input checked={providerConfirmed} onChange={(event) => setProviderConfirmed(event.target.checked)} type="checkbox" />{copy.providerConfirmed}</label> : null}{needsReason ? <label className="pms-finance-form__wide">{copy.reason}<textarea ref={reasonRef} required value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}<div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{settlementEnumLabel(action, language)}</button><button onClick={onCancel} type="button">{copy.cancel}</button></div></form>;
}

function PayoutDetailDialog({ batchId, canManage, companyId, language, onClose, onSaved, open, token, userId }: { batchId: string | null; canManage: boolean; companyId: string; language: 'en' | 'ar'; onClose: () => void; onSaved: () => void; open: boolean; token: string; userId?: string }) {
  const copy = settlementCopy[language];
  const closeRef = useRef<HTMLButtonElement>(null);
  const [batch, setBatch] = useState<PmsOwnerPayout | null>(null);
  const [events, setEvents] = useState<PmsOwnerPayoutAuditEvent[]>([]);
  const [action, setAction] = useState<PayoutAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!batchId) return;
    setLoading(true); setError('');
    try { const result = await getPmsOwnerPayout(token, batchId, companyId); setBatch(result.batch); setEvents(result.events); }
    catch (loadError) { setError(apiMessage(loadError, copy.error)); }
    finally { setLoading(false); }
  }, [batchId, companyId, copy.error, token]);
  useEffect(() => { if (open) void load(); }, [load, open]);
  useEffect(() => { if (!open) { setBatch(null); setEvents([]); setAction(null); } }, [open]);

  const allowedActions = batch && canManage ? [
    batch.status === 'DRAFT' ? { action: 'APPROVE' as const, disabled: batch.createdBy?.id === userId } : null,
    batch.status === 'APPROVED' ? { action: 'SUBMIT' as const, disabled: batch.approvedBy?.id === userId } : null,
    batch.status === 'PROCESSING' ? { action: 'RECORD_PAID' as const, disabled: batch.createdBy?.id === userId } : null,
    batch.status === 'PROCESSING' ? { action: 'RECORD_FAILED' as const, disabled: false } : null,
    batch.status === 'FAILED' ? { action: 'RETRY' as const, disabled: false } : null,
    ['DRAFT', 'APPROVED', 'FAILED'].includes(batch.status) ? { action: 'CANCEL' as const, disabled: false } : null,
  ].filter(Boolean) as Array<{ action: PayoutAction; disabled: boolean }> : [];

  return <AccessibleDialog closeLabel={copy.close} description={copy.payoutDescription} initialFocusRef={closeRef} onClose={onClose} open={open} title={batch ? `${batch.payoutNumber} · ${settlementEnumLabel(batch.status, language)}` : copy.payouts}>{error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}{loading ? <div className="pms-finance-state">{copy.loading}</div> : null}{batch ? <div className="pms-settlement-detail"><div className="pms-settlement-detail__header"><div><span className={statusClass(batch.status)}>{settlementEnumLabel(batch.status, language)}</span><h3>{batch.payoutNumber}</h3><p>{batch.ownerUser.name} · {formatFinanceDate(batch.periodStart, language)} — {formatFinanceDate(batch.periodEnd, language)}</p></div><button ref={closeRef} onClick={onClose} type="button">{copy.close}</button></div><div className="pms-finance-currency-summary pms-settlement-metrics"><article><span>{copy.income}</span><strong>{formatFinanceMoney(batch.grossAmount, batch.currency, language)}</strong></article><article><span>{copy.managementFee}</span><strong>{formatFinanceMoney(batch.managementFeeAmount, batch.currency, language)}</strong></article><article><span>{copy.reserve}</span><strong>{formatFinanceMoney(batch.reservedAmount, batch.currency, language)}</strong></article><article><span>{copy.totalPayout}</span><strong>{formatFinanceMoney(batch.payoutAmount, batch.currency, language)}</strong></article></div><div className="pms-settlement-governance-notes"><p><ShieldCheck aria-hidden="true" size={18} />{copy.makerCheckerPayout}</p><p><FileCheck2 aria-hidden="true" size={18} />{copy.paidReadiness}</p></div><dl className="pms-settlement-facts"><div><dt>{copy.createdBy}</dt><dd>{batch.createdBy?.name ?? '—'}</dd></div><div><dt>{copy.createdDate}</dt><dd>{formatFinanceDate(batch.createdAt, language)}</dd></div><div><dt>{copy.approvedBy}</dt><dd>{batch.approvedBy?.name ?? '—'}</dd></div><div><dt>{copy.approvalDate}</dt><dd>{formatFinanceDate(batch.approvedAt, language)}</dd></div><div><dt>{copy.payoutReference}</dt><dd>{batch.payoutReference ?? '—'}</dd></div><div><dt>{copy.submissionDate}</dt><dd>{formatFinanceDate(batch.processingAt, language)}</dd></div><div><dt>{copy.paidBy}</dt><dd>{batch.paidBy?.name ?? '—'}</dd></div><div><dt>{copy.paidDate}</dt><dd>{formatFinanceDate(batch.paidAt, language)}</dd></div></dl>{batch.failureReason ? <p className="pms-finance-form__error" role="alert">{batch.failureReason}</p> : null}<section><h3>{copy.selectStatements}</h3><div className="pms-finance-history-grid">{batch.lines.map((line) => <article className="pms-finance-history-item" key={line.id}><div><strong>{line.property.name}</strong><span>{copy.revision} {line.statement.revision}</span></div><p>{formatFinanceMoney(line.netAmount, line.currency, language)}</p><small>{copy.income}: {formatFinanceMoney(line.incomeAmount, line.currency, language)} · {copy.expenses}: {formatFinanceMoney(line.expenseAmount, line.currency, language)}</small><small>{copy.managementFee}: {formatFinanceMoney(line.managementFeeAmount, line.currency, language)} · {copy.reserve}: {formatFinanceMoney(line.reservedAmount, line.currency, language)}</small></article>)}</div></section><section><h3>{copy.documents}</h3>{batch.documents.length ? <div className="pms-finance-history-grid">{batch.documents.map((document) => <article className="pms-finance-history-item" key={document.id}><strong>{document.title}</strong><small>{document.originalFilename ?? '—'} · {formatFinanceDate(document.createdAt, language)}</small><small>{document.uploadedBy?.name ?? '—'}</small></article>)}</div> : <p>{copy.noDocuments}</p>}{canManage && !['PAID_MANUAL', 'CANCELLED'].includes(batch.status) && batch.lines[0] ? <DocumentUploadForm companyId={companyId} language={language} onUploaded={() => { void load(); onSaved(); }} payoutId={batch.id} propertyId={batch.lines[0].propertyId} token={token} /> : null}</section><section><h3>{copy.history}</h3>{events.length ? <div className="pms-finance-history-grid">{events.map((event) => <article className="pms-finance-history-item" key={event.id}><strong>{settlementEnumLabel(event.action, language)}</strong><small>{formatFinanceDate(event.createdAt, language)}</small></article>)}</div> : <p>{copy.noHistory}</p>}</section>{allowedActions.length ? <div className="pms-finance-inline-actions pms-settlement-actions">{allowedActions.map((item) => <button disabled={item.disabled} key={item.action} onClick={() => setAction(item.action)} type="button">{settlementEnumLabel(item.action, language)}</button>)}</div> : null}{action ? <PayoutActionForm action={action} batch={batch} companyId={companyId} language={language} onCancel={() => setAction(null)} onSaved={() => { void load(); onSaved(); }} token={token} /> : null}</div> : null}</AccessibleDialog>;
}

function PayoutWorkspace({ canManage, companyId, language, token, userId }: { canManage: boolean; companyId: string; language: 'en' | 'ar'; token: string; userId?: string }) {
  const copy = settlementCopy[language];
  const { searchParams, replaceQuery } = useSettlementSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const query = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') ?? '') as PmsOwnerPayoutStatus | '';
  const currency = searchParams.get('currency') ?? '';
  const propertyId = searchParams.get('propertyId') ?? '';
  const ownerUserId = searchParams.get('ownerUserId') ?? '';
  const sortBy = (searchParams.get('sortBy') ?? 'createdAt') as 'createdAt' | 'periodEnd' | 'payoutAmount' | 'status' | 'payoutNumber';
  const direction = (searchParams.get('direction') ?? 'desc') as 'asc' | 'desc';
  const [searchInput, setSearchInput] = useState(query);
  const [currencyInput, setCurrencyInput] = useState(currency);
  const [batches, setBatches] = useState<PmsOwnerPayout[]>([]);
  const [ownerAccesses, setOwnerAccesses] = useState<OwnerAccess[]>([]);
  const [pagination, setPagination] = useState<PmsFinancePagination | null>(null);
  const [currencyTotals, setCurrencyTotals] = useState<Array<{ currency: string; count: number; payoutAmount: string }>>([]);
  const [statusTotals, setStatusTotals] = useState<Array<{ status: PmsOwnerPayoutStatus; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { setSearchInput(query); setCurrencyInput(currency); }, [currency, query]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void listPmsOwnerPayouts(token, { companyId, search: query || undefined, status: status || undefined, currency: currency || undefined, propertyId: propertyId || undefined, ownerUserId: ownerUserId || undefined, sortBy, direction, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, signal: controller.signal })
      .then((result) => { setBatches(result.batches); setPagination(result.pagination); setCurrencyTotals(result.totalsByCurrency); setStatusTotals(result.totalsByStatus); setOwnerAccesses(result.ownerAccesses); })
      .catch((loadError) => { if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) setError(apiMessage(loadError, copy.error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, copy.error, currency, direction, ownerUserId, page, propertyId, query, refresh, sortBy, status, token]);

  const owners = useMemo(() => uniqueOwners(ownerAccesses), [ownerAccesses]);
  const properties = useMemo(() => [...new Map(ownerAccesses.map((access) => [access.propertyId, access.property])).values()].sort((a, b) => a.name.localeCompare(b.name)), [ownerAccesses]);
  const reload = () => setRefresh((value) => value + 1);
  function submitFilters(event: FormEvent) { event.preventDefault(); replaceQuery({ q: searchInput.trim() || null, currency: currencyInput.trim().toUpperCase() || null, page: null }); }

  return <><div className="pms-finance-toolbar"><form className="pms-finance-filters" onSubmit={submitFilters}><label>{copy.search}<input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label><label>{copy.status}<select aria-label={copy.status} value={status} onChange={(event) => replaceQuery({ status: event.target.value || null, page: null })}><option value="">{copy.all}</option>{(['DRAFT', 'APPROVED', 'PROCESSING', 'PAID_MANUAL', 'FAILED', 'CANCELLED'] as const).map((value) => <option key={value} value={value}>{settlementEnumLabel(value, language)}</option>)}</select></label><label>{copy.owner}<select value={ownerUserId} onChange={(event) => replaceQuery({ ownerUserId: event.target.value || null, page: null })}><option value="">{copy.all}</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label><label>{copy.property}<select value={propertyId} onChange={(event) => replaceQuery({ propertyId: event.target.value || null, page: null })}><option value="">{copy.all}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label>{copy.currency}<input maxLength={3} value={currencyInput} onChange={(event) => setCurrencyInput(event.target.value)} /></label><label>{copy.sort}<select value={`${sortBy}:${direction}`} onChange={(event) => { const [nextSort, nextDirection] = event.target.value.split(':'); replaceQuery({ sortBy: nextSort, direction: nextDirection, page: null }); }}><option value="createdAt:desc">{copy.sortCreated}</option><option value="periodEnd:desc">{copy.sortPeriodLatest}</option><option value="payoutAmount:desc">{copy.sortBalance}</option><option value="payoutNumber:asc">{copy.sortNumber}</option><option value="status:asc">{copy.sortStatus}</option></select></label><button type="submit">{copy.apply}</button><button onClick={() => replaceQuery({ q: null, status: null, ownerUserId: null, propertyId: null, currency: null, sortBy: null, direction: null, page: null })} type="button">{copy.clear}</button></form>{canManage ? <button className="button-link button-link--primary" onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" size={17} />{copy.createPayout}</button> : null}</div>{!canManage ? <p className="pms-finance-permission-note">{copy.permission}</p> : null}<div className="pms-finance-currency-summary">{currencyTotals.map((total) => <article key={total.currency}><span>{copy.totalPayout} · {total.currency}</span><strong>{formatFinanceMoney(total.payoutAmount, total.currency, language)}</strong><small>{copy.databaseTotal}: {total.count}</small></article>)}</div><div className="pms-settlement-status-summary">{statusTotals.map((total) => <span key={total.status}><strong>{total.count}</strong> {settlementEnumLabel(total.status, language)}</span>)}</div>{error ? <div className="pms-finance-state pms-finance-state--error" role="alert">{error}</div> : null}{loading ? <div className="pms-finance-state">{copy.loading}</div> : batches.length ? <div className="pms-table-wrap"><table className="pms-finance-table"><caption>{copy.payouts}</caption><thead><tr><th>{copy.payoutNumber}</th><th>{copy.owner}</th><th>{copy.period}</th><th>{copy.totalPayout}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td><strong>{batch.payoutNumber}</strong><small>{batch.payoutReference ?? '—'}</small></td><td>{batch.ownerUser.name}<small>{batch.ownerUser.email}</small></td><td>{formatFinanceDate(batch.periodStart, language)}<small>{formatFinanceDate(batch.periodEnd, language)}</small></td><td>{formatFinanceMoney(batch.payoutAmount, batch.currency, language)}</td><td><span className={statusClass(batch.status)}>{settlementEnumLabel(batch.status, language)}</span>{batch.failureReason ? <small>{batch.failureReason}</small> : null}</td><td><button onClick={() => setSelectedId(batch.id)} type="button">{copy.view}</button></td></tr>)}</tbody></table></div> : <div className="pms-finance-state">{copy.noRecords}</div>}<PaginationControls language={language} onPage={(next) => replaceQuery({ page: next === 1 ? null : String(next) })} page={page} pagination={pagination} /><PayoutCreateDialog companyId={companyId} language={language} onClose={() => setCreateOpen(false)} onSaved={(batch) => { reload(); setSelectedId(batch.id); }} open={createOpen} ownerAccesses={ownerAccesses} token={token} /><PayoutDetailDialog batchId={selectedId} canManage={canManage} companyId={companyId} language={language} onClose={() => setSelectedId(null)} onSaved={reload} open={Boolean(selectedId)} token={token} userId={userId} /></>;
}

export default function PmsOwnerSettlementWorkspace({ section }: { section: PmsOwnerSettlementSection }) {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const workspace = resolvePmsWorkspace(user?.pmsAccess?.workspaces ?? [], searchParams.get('companyId'));
  const copy = settlementCopy[language];
  if (!token || !workspace) return <section className="pms-route-content"><div className="pms-finance-state">{copy.loading}</div></section>;
  const companyId = workspace.company.id;
  const canManage = canManagePmsAccounting(workspace);
  const title = section === 'statements' ? copy.statements : copy.payouts;
  const description = section === 'statements' ? copy.statementDescription : copy.payoutDescription;
  return <section className="pms-route-content pms-finance-workspace pms-settlement-workspace" aria-labelledby={`pms-settlement-${section}-title`}><header className="pms-header"><div><p className="eyebrow">{copy.financeControl}</p><h1 id={`pms-settlement-${section}-title`}>{title}</h1><p>{description}</p></div><SettlementSectionNav companyId={companyId} language={language} section={section} /></header>{section === 'statements' ? <StatementWorkspace canManage={canManage} companyId={companyId} language={language} token={token} userId={user?.id} /> : <PayoutWorkspace canManage={canManage} companyId={companyId} language={language} token={token} userId={user?.id} />}</section>;
}

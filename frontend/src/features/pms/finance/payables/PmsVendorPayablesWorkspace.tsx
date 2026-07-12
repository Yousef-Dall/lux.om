import { AlertTriangle, FileCheck2, Plus, ReceiptText, ShieldCheck, Upload } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../../api/client';
import { uploadPmsDocument } from '../../../../api/pms';
import {
  createPmsVendorInvoice,
  getPmsVendorInvoice,
  listPmsVendorInvoices,
  transitionPmsVendorInvoice,
  updatePmsVendorInvoice,
  type PmsFinancePagination,
  type PmsVendorInvoice,
  type PmsVendorInvoiceStatus,
  type PmsVendorInvoiceWorkOrderOption,
} from '../../../../api/pmsAdvanced';
import { useAuth } from '../../../../auth/AuthContext';
import AccessibleDialog from '../../../../components/AccessibleDialog';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { canManagePmsAccounting, resolvePmsWorkspace } from '../../access';
import { formatFinanceDate, formatFinanceMoney } from '../copy';
import { payableStatusLabel, payablesCopy } from './copy';

export type PmsVendorPayablesSection = 'vendorInvoices';
type QueryUpdates = Record<string, string | null | undefined>;
type InvoiceAction = 'SUBMIT' | 'REVIEW' | 'APPROVE' | 'REJECT' | 'SUBMIT_PAYMENT' | 'RECORD_PAID' | 'RECORD_FAILED' | 'RETRY' | 'VOID';
const PAGE_SIZE = 25;

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function statusClass(status: string) {
  return `pms-finance-status pms-finance-status--${status.toLowerCase().replaceAll('_', '-')}`;
}

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function usePayableSearchParams() {
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
    latestRef.current = next;
    pendingRef.current.push(next.toString());
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);
  return { searchParams, replaceQuery };
}

function FinanceSectionNav({ companyId, language }: { companyId: string; language: 'en' | 'ar' }) {
  const copy = payablesCopy[language];
  const suffix = `?companyId=${encodeURIComponent(companyId)}`;
  return (
    <nav className="pms-finance-section-nav" aria-label={copy.financeControl}>
      <Link to={`/pms/finance/overview${suffix}`}>{copy.overview}</Link>
      <Link to={`/pms/finance/charges${suffix}`}>{copy.charges}</Link>
      <Link to={`/pms/finance/payments${suffix}`}>{copy.payments}</Link>
      <Link to={`/pms/finance/deposits${suffix}`}>{copy.deposits}</Link>
      <Link to={`/pms/finance/periods${suffix}`}>{copy.periods}</Link>
      <Link to={`/pms/finance/reconciliation${suffix}`}>{copy.reconciliation}</Link>
      <Link to={`/pms/finance/statements${suffix}`}>{copy.statements}</Link>
      <Link to={`/pms/finance/payouts${suffix}`}>{copy.payouts}</Link>
      <Link aria-current="page" to={`/pms/finance/vendor-invoices${suffix}`}>{copy.vendorInvoices}</Link>
      <Link to={`/pms/finance/records${suffix}`}>{copy.records}</Link>
    </nav>
  );
}

function InvoiceEditorDialog({ companyId, invoice, language, onClose, onSaved, open, token, workOrders }: {
  companyId: string;
  invoice?: PmsVendorInvoice | null;
  language: 'en' | 'ar';
  onClose: () => void;
  onSaved: (invoice: PmsVendorInvoice) => void;
  open: boolean;
  token: string;
  workOrders: PmsVendorInvoiceWorkOrderOption[];
}) {
  const copy = payablesCopy[language];
  const firstRef = useRef<HTMLSelectElement>(null);
  const [workOrderId, setWorkOrderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [externalInvoiceNumber, setExternalInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [subtotalAmount, setSubtotalAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setWorkOrderId(invoice?.workOrderId ?? workOrders[0]?.id ?? '');
    setInvoiceNumber(invoice?.invoiceNumber ?? '');
    setExternalInvoiceNumber(invoice?.externalInvoiceNumber ?? '');
    setIssueDate(dateInputValue(invoice?.issueDate));
    setDueDate(dateInputValue(invoice?.dueDate));
    setSubtotalAmount(invoice?.subtotalAmount ?? '');
    setTaxAmount(invoice?.taxAmount ?? '0');
    setTotalAmount(invoice?.totalAmount ?? '');
    setNotes(invoice?.notes ?? '');
    setError('');
  }, [invoice, open, workOrders]);

  const workOrder = workOrders.find((item) => item.id === workOrderId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const subtotal = Number(subtotalAmount);
    const tax = Number(taxAmount);
    const total = Number(totalAmount);
    if (!workOrder || !invoiceNumber.trim() || !issueDate || !dueDate || !Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(tax) || tax < 0 || !Number.isFinite(total) || total <= 0 || Math.abs(subtotal + tax - total) > 0.0005) {
      setError(copy.formError); return;
    }
    setBusy(true); setError('');
    try {
      const payload = {
        companyId,
        propertyId: workOrder.propertyId,
        vendorId: workOrder.vendorId ?? '',
        workOrderId: workOrder.id,
        approvedQuoteId: workOrder.approvedQuote?.id ?? null,
        invoiceNumber: invoiceNumber.trim(),
        externalInvoiceNumber: externalInvoiceNumber.trim() || null,
        issueDate: new Date(`${issueDate}T00:00:00.000Z`).toISOString(),
        dueDate: new Date(`${dueDate}T00:00:00.000Z`).toISOString(),
        currency: workOrder.approvedQuote?.currency ?? workOrder.currency,
        subtotalAmount: subtotal,
        taxAmount: tax,
        totalAmount: total,
        notes: notes.trim() || null,
      };
      const result = invoice
        ? await updatePmsVendorInvoice(token, invoice.id, payload)
        : await createPmsVendorInvoice(token, payload);
      onSaved(result.invoice); onClose();
    } catch (submitError) {
      setError(apiMessage(submitError, copy.actionError));
    } finally { setBusy(false); }
  }

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.description} initialFocusRef={firstRef} onClose={onClose} open={open} title={invoice ? copy.edit : copy.create}>
      <form className="pms-finance-form" onSubmit={submit}>
        {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
        <label>{copy.workOrder}<select ref={firstRef} required value={workOrderId} onChange={(event) => setWorkOrderId(event.target.value)}><option value="">{copy.chooseWorkOrder}</option>{workOrders.filter((item) => item.vendorId && item.approvedQuote?.status === 'APPROVED').map((item) => <option key={item.id} value={item.id}>{item.property.name} · {item.vendor?.name} · {item.title}</option>)}</select></label>
        {workOrder?.approvedQuote ? <p className="pms-finance-permission-note"><ShieldCheck size={17} />{copy.quoteCeiling}: {formatFinanceMoney(workOrder.approvedQuote.amount, workOrder.approvedQuote.currency, language)}</p> : null}
        <div className="pms-finance-form-grid">
          <label>{copy.invoiceNumber}<input required value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></label>
          <label>{copy.externalInvoiceNumber}<input value={externalInvoiceNumber} onChange={(event) => setExternalInvoiceNumber(event.target.value)} /></label>
          <label>{copy.issueDate}<input required type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
          <label>{copy.dueDate}<input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <label>{copy.subtotal}<input min="0" required step="0.001" type="number" value={subtotalAmount} onChange={(event) => setSubtotalAmount(event.target.value)} /></label>
          <label>{copy.tax}<input min="0" required step="0.001" type="number" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} /></label>
          <label>{copy.total}<input min="0.001" required step="0.001" type="number" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} /></label>
          <label className="pms-finance-form-grid__wide">{copy.notes}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>
        <div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{invoice ? copy.update : copy.save}</button><button onClick={onClose} type="button">{copy.cancel}</button></div>
      </form>
    </AccessibleDialog>
  );
}

function EvidenceUpload({ companyId, invoice, language, onUploaded, token }: { companyId: string; invoice: PmsVendorInvoice; language: 'en' | 'ar'; onUploaded: () => void; token: string }) {
  const copy = payablesCopy[language];
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'MAINTENANCE_INVOICE' | 'OTHER'>('OTHER');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setKind(['DRAFT', 'SUBMITTED', 'NEEDS_REVIEW'].includes(invoice.status) ? 'MAINTENANCE_INVOICE' : 'OTHER');
  }, [invoice.id, invoice.status]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !file) return setError(copy.formError);
    setBusy(true); setError('');
    try {
      await uploadPmsDocument(token, {
        companyId,
        propertyId: invoice.propertyId,
        vendorInvoiceId: invoice.id,
        type: kind,
        title: title.trim(),
        status: 'ACTIVE',
      }, file);
      setTitle(''); setFile(null); onUploaded();
    } catch (uploadError) { setError(apiMessage(uploadError, copy.actionError)); }
    finally { setBusy(false); }
  }
  return (
    <form className="pms-finance-form pms-payables-evidence-form" onSubmit={submit}>
      {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
      <label>{copy.documentTitle}<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>{copy.documentType}<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="MAINTENANCE_INVOICE">{copy.invoiceFile}</option><option value="OTHER">{copy.paymentEvidence}</option></select></label>
      <label>{copy.file}<input accept="application/pdf,image/jpeg,image/png,image/webp" required type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <div className="pms-finance-inline-actions"><button disabled={busy} type="submit"><Upload size={16} />{copy.upload}</button></div>
    </form>
  );
}

function availableActions(invoice: PmsVendorInvoice): InvoiceAction[] {
  if (invoice.status === 'DRAFT') return ['SUBMIT', 'VOID'];
  if (invoice.status === 'SUBMITTED') return ['REVIEW', 'REJECT'];
  if (invoice.status === 'NEEDS_REVIEW') return ['APPROVE', 'REJECT'];
  if (invoice.status === 'APPROVED') return ['SUBMIT_PAYMENT'];
  if (invoice.status === 'PROCESSING') return ['RECORD_PAID', 'RECORD_FAILED'];
  if (invoice.status === 'FAILED') return ['RETRY'];
  if (invoice.status === 'REJECTED') return ['VOID'];
  return [];
}

function actionLabel(action: InvoiceAction, copy: (typeof payablesCopy)[keyof typeof payablesCopy]) {
  const labels: Record<InvoiceAction, string> = { SUBMIT: copy.submit, REVIEW: copy.review, APPROVE: copy.approve, REJECT: copy.reject, SUBMIT_PAYMENT: copy.submitPayment, RECORD_PAID: copy.recordPaid, RECORD_FAILED: copy.recordFailed, RETRY: copy.retry, VOID: copy.void };
  return labels[action];
}

function eligibleEvidenceDocuments(invoice: PmsVendorInvoice, action: InvoiceAction) {
  if (['SUBMIT', 'APPROVE'].includes(action)) {
    return invoice.documents.filter((document) => document.type === 'MAINTENANCE_INVOICE');
  }
  const minimumCreatedAt = action === 'RECORD_PAID' ? invoice.processingAt : invoice.approvedAt;
  return invoice.documents.filter((document) => (
    document.type === 'OTHER'
    && (!minimumCreatedAt || new Date(document.createdAt).getTime() >= new Date(minimumCreatedAt).getTime())
  ));
}

function InvoiceDetailDialog({ canManage, companyId, invoiceId, language, onClose, onEdit, onSaved, open, token }: {
  canManage: boolean;
  companyId: string;
  invoiceId: string | null;
  language: 'en' | 'ar';
  onClose: () => void;
  onEdit: (invoice: PmsVendorInvoice) => void;
  onSaved: () => void;
  open: boolean;
  token: string;
}) {
  const copy = payablesCopy[language];
  const [invoice, setInvoice] = useState<PmsVendorInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<InvoiceAction | null>(null);
  const [reason, setReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethodNote, setPaymentMethodNote] = useState('');
  const [evidenceDocumentId, setEvidenceDocumentId] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [providerConfirmed, setProviderConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true); setError('');
    try { setInvoice((await getPmsVendorInvoice(token, invoiceId, companyId)).invoice); }
    catch (loadError) { setError(apiMessage(loadError, copy.error)); }
    finally { setLoading(false); }
  }, [companyId, copy.error, invoiceId, token]);

  useEffect(() => { if (open) void load(); }, [load, open]);
  useEffect(() => {
    setAction(null); setReason(''); setApprovedAmount(''); setPaymentReference(''); setPaymentMethodNote(''); setEvidenceDocumentId(''); setPaidAt(''); setProviderConfirmed(false);
  }, [invoiceId, open]);

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!invoice || !action) return;
    const reasonRequired = ['REJECT', 'RECORD_FAILED', 'RETRY', 'VOID'].includes(action);
    const paymentAction = ['SUBMIT_PAYMENT', 'RECORD_PAID'].includes(action);
    if ((reasonRequired && reason.trim().length < 3) || (action === 'APPROVE' && (!Number.isFinite(Number(approvedAmount)) || Number(approvedAmount) <= 0)) || (paymentAction && (!paymentReference.trim() || paymentMethodNote.trim().length < 3 || !evidenceDocumentId || !providerConfirmed))) {
      setError(copy.formError); return;
    }
    setBusy(true); setError('');
    try {
      await transitionPmsVendorInvoice(token, invoice.id, {
        companyId,
        action,
        reason: reason.trim() || undefined,
        approvedAmount: action === 'APPROVE' ? Number(approvedAmount) : undefined,
        evidenceDocumentId: evidenceDocumentId || undefined,
        paymentReference: paymentReference.trim() || undefined,
        paymentMethodNote: paymentMethodNote.trim() || undefined,
        providerConfirmed: paymentAction ? providerConfirmed : undefined,
        adapter: paymentAction ? 'MANUAL_BANK_EVIDENCE' : undefined,
        paidAt: action === 'RECORD_PAID' && paidAt ? new Date(`${paidAt}T12:00:00.000Z`).toISOString() : undefined,
      });
      setAction(null); await load(); onSaved();
    } catch (actionError) { setError(apiMessage(actionError, copy.actionError)); }
    finally { setBusy(false); }
  }

  return (
    <AccessibleDialog closeLabel={copy.close} description={copy.description} onClose={onClose} open={open} title={invoice ? `${copy.invoice} ${invoice.invoiceNumber}` : copy.invoice}>
      {loading ? <div className="pms-finance-state">{copy.loading}</div> : null}
      {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
      {invoice ? <div className="pms-payables-detail">
        <section className="pms-finance-detail-grid">
          <div><span>{copy.status}</span><strong className={statusClass(invoice.status)}>{payableStatusLabel(invoice.status, language)}</strong></div>
          <div><span>{copy.vendor}</span><strong>{invoice.vendor.name}</strong></div>
          <div><span>{copy.property}</span><strong>{invoice.property.name}</strong></div>
          <div><span>{copy.workOrder}</span><strong>{invoice.workOrder.title}</strong></div>
          <div><span>{copy.issueDate}</span><strong>{formatFinanceDate(invoice.issueDate, language)}</strong></div>
          <div><span>{copy.dueDate}</span><strong>{formatFinanceDate(invoice.dueDate, language)}</strong></div>
          <div><span>{copy.total}</span><strong>{formatFinanceMoney(invoice.totalAmount, invoice.currency, language)}</strong></div>
          <div><span>{copy.approved}</span><strong>{invoice.approvedAmount ? formatFinanceMoney(invoice.approvedAmount, invoice.currency, language) : '—'}</strong></div>
          <div><span>{copy.paid}</span><strong>{formatFinanceMoney(invoice.paidAmount, invoice.currency, language)}</strong></div>
        </section>
        <p className="pms-finance-permission-note"><ShieldCheck size={17} />{copy.makerChecker}</p>
        <p className="pms-finance-permission-note"><FileCheck2 size={17} />{copy.immutable}</p>
        <section><h3>{copy.documents}</h3>{invoice.documents.length ? <ul className="pms-finance-history-list">{invoice.documents.map((document) => <li key={document.id}><strong>{document.title}</strong><span>{document.type} · {formatFinanceDate(document.createdAt, language)}</span></li>)}</ul> : <p>{copy.noDocuments}</p>}</section>
        <section><h3>{copy.ledger}</h3>{invoice.ledgerEntries.length ? <ul className="pms-finance-history-list">{invoice.ledgerEntries.map((entry) => <li key={entry.id}><strong>{formatFinanceMoney(entry.amount, entry.currency, language)}</strong><span>{formatFinanceDate(entry.transactionDate, language)} · {entry.referenceNumber ?? '—'}</span></li>)}</ul> : <p>{copy.noLedger}</p>}</section>
        {canManage ? <EvidenceUpload companyId={companyId} invoice={invoice} language={language} onUploaded={() => void load()} token={token} /> : null}
        {canManage && invoice.status === 'DRAFT' ? <div className="pms-finance-inline-actions"><button type="button" onClick={() => onEdit(invoice)}>{copy.edit}</button></div> : null}
        {canManage && availableActions(invoice).length ? <section className="pms-payables-actions"><h3>{copy.actions}</h3><div className="pms-finance-inline-actions">{availableActions(invoice).map((item) => <button className={['REJECT', 'VOID', 'RECORD_FAILED'].includes(item) ? 'button-link button-link--danger' : 'button-link button-link--primary'} key={item} type="button" onClick={() => { setAction(item); setError(''); setApprovedAmount(invoice.totalAmount); }}>{actionLabel(item, copy)}</button>)}</div></section> : null}
        {canManage && action ? <form className="pms-finance-form pms-payables-action-form" onSubmit={submitAction}>
          <h3>{actionLabel(action, copy)}</h3>
          {['REJECT', 'RECORD_FAILED', 'RETRY', 'VOID'].includes(action) ? <label>{copy.reason}<textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}
          {action === 'APPROVE' ? <label>{copy.approvedAmount}<input min="0.001" required step="0.001" type="number" value={approvedAmount} onChange={(event) => setApprovedAmount(event.target.value)} /></label> : null}
          {['SUBMIT', 'APPROVE', 'SUBMIT_PAYMENT', 'RECORD_PAID'].includes(action) ? <label>{copy.evidenceDocument}<select required value={evidenceDocumentId} onChange={(event) => setEvidenceDocumentId(event.target.value)}><option value="">—</option>{eligibleEvidenceDocuments(invoice, action).map((document) => <option key={document.id} value={document.id}>{document.title} · {document.type}</option>)}</select></label> : null}
          {['SUBMIT_PAYMENT', 'RECORD_PAID'].includes(action) ? <>
            <label>{copy.paymentReference}<input required value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></label>
            <label>{copy.paymentMethodNote}<textarea required value={paymentMethodNote} onChange={(event) => setPaymentMethodNote(event.target.value)} /></label>
            {action === 'RECORD_PAID' ? <label>{copy.paidAt}<input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label> : null}
            <label className="pms-finance-checkbox"><input checked={providerConfirmed} type="checkbox" onChange={(event) => setProviderConfirmed(event.target.checked)} />{copy.providerConfirmed}</label>
          </> : null}
          <div className="pms-finance-inline-actions"><button className="button-link button-link--primary" disabled={busy} type="submit">{actionLabel(action, copy)}</button><button type="button" onClick={() => setAction(null)}>{copy.cancel}</button></div>
        </form> : null}
      </div> : null}
    </AccessibleDialog>
  );
}

export default function PmsVendorPayablesWorkspace() {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const { searchParams, replaceQuery } = usePayableSearchParams();
  const workspace = resolvePmsWorkspace(user?.pmsAccess?.workspaces ?? [], searchParams.get('companyId'));
  const copy = payablesCopy[language];
  const canManage = canManagePmsAccounting(workspace);
  const companyId = workspace?.company.id ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  const [statusDraft, setStatusDraft] = useState(searchParams.get('status') ?? '');
  const [currencyDraft, setCurrencyDraft] = useState(searchParams.get('currency') ?? '');
  const [propertyDraft, setPropertyDraft] = useState(searchParams.get('propertyId') ?? '');
  const [vendorDraft, setVendorDraft] = useState(searchParams.get('vendorId') ?? '');
  const [sortDraft, setSortDraft] = useState(searchParams.get('sort') ?? 'createdAt:desc');
  const [invoices, setInvoices] = useState<PmsVendorInvoice[]>([]);
  const [pagination, setPagination] = useState<PmsFinancePagination | null>(null);
  const [totalsByStatus, setTotalsByStatus] = useState<Array<{ status: PmsVendorInvoiceStatus; count: number }>>([]);
  const [totalsByCurrency, setTotalsByCurrency] = useState<Array<{ currency: string; count: number; totalAmount: string; approvedAmount: string; paidAmount: string }>>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [workOrders, setWorkOrders] = useState<PmsVendorInvoiceWorkOrderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<PmsVendorInvoice | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !companyId) return;
    setLoading(true); setError('');
    const [sortBy, direction] = (searchParams.get('sort') ?? 'createdAt:desc').split(':') as ['createdAt' | 'dueDate' | 'totalAmount' | 'status' | 'invoiceNumber', 'asc' | 'desc'];
    try {
      const result = await listPmsVendorInvoices(token, {
        companyId,
        search: searchParams.get('q') || undefined,
        status: (searchParams.get('status') || undefined) as PmsVendorInvoiceStatus | undefined,
        currency: searchParams.get('currency') || undefined,
        propertyId: searchParams.get('propertyId') || undefined,
        vendorId: searchParams.get('vendorId') || undefined,
        sortBy,
        direction,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      });
      setInvoices(result.invoices); setPagination(result.pagination); setTotalsByStatus(result.totalsByStatus); setTotalsByCurrency(result.totalsByCurrency); setOverdueCount(result.overdueCount); setVendors(result.vendors); setProperties(result.properties); setWorkOrders(result.workOrders);
    } catch (loadError) { setError(apiMessage(loadError, copy.error)); }
    finally { setLoading(false); }
  }, [companyId, copy.error, page, searchParams, token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setSearchDraft(searchParams.get('q') ?? ''); setStatusDraft(searchParams.get('status') ?? ''); setCurrencyDraft(searchParams.get('currency') ?? ''); setPropertyDraft(searchParams.get('propertyId') ?? ''); setVendorDraft(searchParams.get('vendorId') ?? ''); setSortDraft(searchParams.get('sort') ?? 'createdAt:desc');
  }, [searchParams]);

  const currencies = useMemo(() => [...new Set(totalsByCurrency.map((item) => item.currency))].sort(), [totalsByCurrency]);
  const outstandingCount = totalsByStatus.filter((item) => ['APPROVED', 'PROCESSING'].includes(item.status)).reduce((sum, item) => sum + item.count, 0);
  const range = pagination && pagination.total ? { from: pagination.skip + 1, to: pagination.skip + pagination.count } : { from: 0, to: 0 };

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    replaceQuery({ q: searchDraft.trim() || null, status: statusDraft || null, currency: currencyDraft || null, propertyId: propertyDraft || null, vendorId: vendorDraft || null, sort: sortDraft === 'createdAt:desc' ? null : sortDraft, page: null });
  }

  if (!token || !workspace) return <section className="pms-route-content"><div className="pms-finance-state">{copy.loading}</div></section>;

  return (
    <section className="pms-route-content pms-finance-workspace pms-payables-workspace" aria-labelledby="pms-vendor-invoices-title">
      <header className="pms-header"><div><p className="eyebrow">{copy.financeControl}</p><h1 id="pms-vendor-invoices-title">{copy.title}</h1><p>{copy.description}</p></div><FinanceSectionNav companyId={companyId} language={language} /></header>
      {!canManage ? <p className="pms-finance-permission-note"><ShieldCheck size={17} />{copy.permission}</p> : null}
      <section className="pms-metric-grid"><article className="pms-metric-card"><ReceiptText size={20} /><span>{copy.databaseTotal}</span><strong>{pagination?.total ?? 0}</strong></article><article className="pms-metric-card"><FileCheck2 size={20} /><span>{copy.outstanding}</span><strong>{outstandingCount}</strong></article><article className="pms-metric-card"><AlertTriangle size={20} /><span>{copy.overdue}</span><strong>{overdueCount}</strong></article></section>
      <form className="pms-finance-filters" onSubmit={applyFilters}>
        <label>{copy.search}<input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /></label>
        <label>{copy.status}<select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}><option value="">{copy.all}</option>{(['DRAFT', 'SUBMITTED', 'NEEDS_REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'VOID'] as PmsVendorInvoiceStatus[]).map((status) => <option key={status} value={status}>{payableStatusLabel(status, language)}</option>)}</select></label>
        <label>{copy.currency}<select value={currencyDraft} onChange={(event) => setCurrencyDraft(event.target.value)}><option value="">{copy.all}</option>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
        <label>{copy.property}<select value={propertyDraft} onChange={(event) => setPropertyDraft(event.target.value)}><option value="">{copy.all}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <label>{copy.vendor}<select value={vendorDraft} onChange={(event) => setVendorDraft(event.target.value)}><option value="">{copy.all}</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
        <label>{copy.sort}<select value={sortDraft} onChange={(event) => setSortDraft(event.target.value)}><option value="createdAt:desc">{copy.sortCreated}</option><option value="dueDate:asc">{copy.sortDue}</option><option value="totalAmount:desc">{copy.sortAmount}</option><option value="status:asc">{copy.sortStatus}</option><option value="invoiceNumber:asc">{copy.sortNumber}</option></select></label>
        <div className="pms-finance-inline-actions"><button type="submit">{copy.apply}</button><button type="button" onClick={() => replaceQuery({ q: null, status: null, currency: null, propertyId: null, vendorId: null, sort: null, page: null })}>{copy.clear}</button>{canManage ? <button className="button-link button-link--primary" type="button" onClick={() => { setEditingInvoice(null); setEditorOpen(true); }}><Plus size={16} />{copy.create}</button> : null}</div>
      </form>
      {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
      {loading ? <div className="pms-finance-state">{copy.loading}</div> : null}
      {!loading && invoices.length === 0 ? <div className="pms-finance-state">{copy.noRecords}</div> : null}
      {invoices.length ? <div className="pms-finance-table-wrap"><table><caption>{copy.vendorInvoices}</caption><thead><tr><th>{copy.invoice}</th><th>{copy.vendor}</th><th>{copy.property}</th><th>{copy.workOrder}</th><th>{copy.dueDate}</th><th>{copy.total}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><span>{formatFinanceDate(invoice.issueDate, language)}</span></td><td>{invoice.vendor.name}</td><td>{invoice.property.name}</td><td>{invoice.workOrder.title}</td><td>{formatFinanceDate(invoice.dueDate, language)}</td><td>{formatFinanceMoney(invoice.totalAmount, invoice.currency, language)}</td><td><span className={statusClass(invoice.status)}>{payableStatusLabel(invoice.status, language)}</span></td><td><button type="button" onClick={() => setSelectedId(invoice.id)}>{copy.view}</button></td></tr>)}</tbody></table></div> : null}
      {pagination ? <div className="pms-finance-pagination"><span>{range.from}–{range.to} {copy.pageOf} {pagination.total}</span><div><button disabled={page <= 1} type="button" onClick={() => replaceQuery({ page: String(page - 1) })}>{copy.previous}</button><button disabled={pagination.skip + pagination.count >= pagination.total} type="button" onClick={() => replaceQuery({ page: String(page + 1) })}>{copy.next}</button></div></div> : null}
      <InvoiceEditorDialog companyId={companyId} invoice={editingInvoice} language={language} onClose={() => setEditorOpen(false)} onSaved={(saved) => { setSelectedId(saved.id); void load(); }} open={editorOpen} token={token} workOrders={workOrders} />
      <InvoiceDetailDialog canManage={canManage} companyId={companyId} invoiceId={selectedId} language={language} onClose={() => setSelectedId(null)} onEdit={(invoice) => { setEditingInvoice(invoice); setEditorOpen(true); }} onSaved={() => void load()} open={Boolean(selectedId)} token={token} />
    </section>
  );
}

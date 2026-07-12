import { Building2, Download, FileText, Home, WalletCards, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ApiError } from '../api/client';
import {
  decideOwnerQuote,
  downloadOwnerPortalDocument,
  getOwnerPortalOverview,
  listOwnerPortalDocuments,
  type OwnerPortalDocument,
  type OwnerPortalOverview,
} from '../api/ownerPortal';
import { useAuth } from '../auth/AuthContext';
import { PortalEmpty, PortalError, PortalLoading, PortalNoAccess, PortalPanel } from '../features/portal/PortalState';

function money(value: string | null | undefined, currency: string) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
    : `${value ?? '0'} ${currency}`;
}

function saveDownload(filename: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function OwnerPortal() {
  const { token, user } = useAuth();
  const accesses = user?.ownerAccess?.accesses ?? [];
  const [activeAccessId, setActiveAccessId] = useState(accesses[0]?.id ?? '');
  const [overview, setOverview] = useState<OwnerPortalOverview | null>(null);
  const [documents, setDocuments] = useState<OwnerPortalDocument[]>([]);
  const [loading, setLoading] = useState(Boolean(token && accesses.length));
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');

  useEffect(() => {
    if (!activeAccessId && accesses[0]?.id) setActiveAccessId(accesses[0].id);
  }, [accesses, activeAccessId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!token || !activeAccessId) return;
      try {
        setLoading(true);
        setError('');
        const [overviewResult, documentResult] = await Promise.all([
          getOwnerPortalOverview(token, activeAccessId),
          listOwnerPortalDocuments(token, activeAccessId),
        ]);
        if (!active) return;
        setOverview(overviewResult);
        setDocuments(documentResult.documents);
      } catch (loadError) {
        if (active) setError(loadError instanceof ApiError ? loadError.message : 'Owner portal could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token, activeAccessId]);

  const statementDocuments = useMemo(
    () => overview?.statements.flatMap((statement) => statement.documents) ?? [],
    [overview],
  );

  async function handleDownload(document: OwnerPortalDocument | { id: string; title: string; originalFilename?: string | null }) {
    if (!token) return;
    try {
      setActionId(document.id);
      const response = await downloadOwnerPortalDocument(token, document.id, activeAccessId);
      saveDownload(response.filename || document.originalFilename || document.title, response.blob);
    } catch (downloadError) {
      setError(downloadError instanceof ApiError ? downloadError.message : 'Document download failed.');
    } finally {
      setActionId('');
    }
  }

  async function handleQuote(quoteId: string, decision: 'APPROVE' | 'REJECT') {
    if (!token) return;
    const comment = window.prompt(decision === 'APPROVE' ? 'Approval comment' : 'Rejection reason');
    if (!comment?.trim()) return;
    try {
      setActionId(quoteId);
      await decideOwnerQuote(token, quoteId, { accessId: activeAccessId, decision, comment: comment.trim() });
      const refreshed = await getOwnerPortalOverview(token, activeAccessId);
      setOverview(refreshed);
    } catch (quoteError) {
      setError(quoteError instanceof ApiError ? quoteError.message : 'Quote decision failed.');
    } finally {
      setActionId('');
    }
  }

  if (!user?.ownerAccess?.hasAccess || accesses.length === 0) {
    return <section className="pms-portal"><PortalNoAccess message="No property has been assigned to your owner portal account." /></section>;
  }
  if (loading) return <section className="pms-portal"><PortalLoading label="Loading owner portal…" /></section>;
  if (error && !overview) return <section className="pms-portal"><PortalError message={error} /></section>;
  if (!overview) return <section className="pms-portal"><PortalEmpty title="No owner workspace" message="Select an assigned property to continue." /></section>;

  return (
    <section className="pms-portal" aria-labelledby="owner-portal-title">
      <div className="pms-main">
        <header className="pms-header">
          <div>
            <p className="eyebrow">Private owner workspace</p>
            <h1 id="owner-portal-title">{overview.access.property.name}</h1>
            <p>Approved property operations, published statements, maintenance, and payout status. Tenant private identity data is not exposed here.</p>
          </div>
          <label className="pms-field">
            <span>Property</span>
            <select aria-label="Owner property" value={activeAccessId} onChange={(event) => setActiveAccessId(event.target.value)}>
              {accesses.map((access) => <option key={access.id} value={access.id}>{access.company.nameEn} · {access.property.name}</option>)}
            </select>
          </label>
        </header>

        {error ? <div className="pms-inline-alert" role="alert">{error}</div> : null}

        <section className="pms-metric-grid" aria-label="Owner property summary">
          <article className="pms-metric-card"><Home size={20} aria-hidden="true" /><span>Units</span><strong>{overview.occupancy.totalUnits}</strong></article>
          <article className="pms-metric-card"><Building2 size={20} aria-hidden="true" /><span>Occupancy</span><strong>{overview.occupancy.occupancyRate}%</strong></article>
          <article className="pms-metric-card"><Wrench size={20} aria-hidden="true" /><span>Maintenance records</span><strong>{overview.maintenance.length}</strong></article>
          <article className="pms-metric-card"><WalletCards size={20} aria-hidden="true" /><span>Payout records</span><strong>{overview.payouts.length}</strong></article>
        </section>

        <div className="pms-content-grid">
          <PortalPanel title="Approved financial summary">
            {overview.financialSummaries.length === 0 ? <PortalEmpty title="No approved financial activity" message="Published accounting summaries will appear here." /> : overview.financialSummaries.map((summary) => (
              <article className="pms-list-card" key={summary.currency}><div><strong>{summary.currency}</strong><span>{new Date(summary.periodStart).toLocaleDateString()} – {new Date(summary.periodEnd).toLocaleDateString()} · Income {money(summary.income, summary.currency)} · Expenses {money(summary.expenses, summary.currency)}</span></div><b>{money(summary.net, summary.currency)}</b></article>
            ))}
          </PortalPanel>

          <PortalPanel title="Published statements">
            {overview.statements.length === 0 ? <PortalEmpty title="No published statements" message="Only immutable published statements are shown." /> : overview.statements.map((statement) => (
              <article className="pms-list-card" key={statement.id}><div><strong>{new Date(statement.periodStart).toLocaleDateString()} – {new Date(statement.periodEnd).toLocaleDateString()}</strong><span>Revision {statement.revision} · {statement.currency}</span></div><b>{money(statement.closingBalance, statement.currency)}</b></article>
            ))}
            {statementDocuments.map((document) => <button key={document.id} className="button-link button-link--ghost" type="button" disabled={actionId === document.id} onClick={() => void handleDownload(document)}><Download size={16} />{document.title}</button>)}
          </PortalPanel>

          <PortalPanel title="Maintenance and approved costs">
            {overview.maintenance.length === 0 ? <PortalEmpty title="No maintenance activity" message="Property work orders will appear here without unrelated tenant details." /> : overview.maintenance.map((workOrder) => (
              <article className="pms-list-card" key={workOrder.id}><div><strong>{workOrder.title}</strong><span>{workOrder.priority} · {workOrder.status}{workOrder.asset ? ` · ${workOrder.asset.assetCode}` : ''}</span></div><b>{workOrder.cost ? money(workOrder.cost, workOrder.currency) : '—'}</b></article>
            ))}
          </PortalPanel>

          <PortalPanel title="Payout status">
            {overview.payouts.length === 0 ? <PortalEmpty title="No payout records" message="Approved payout batches will appear here. lux.om does not claim a bank transfer until evidence is recorded." /> : overview.payouts.map((payout) => (
              <article className="pms-list-card" key={payout.id}><div><strong>{payout.payoutNumber}</strong><span>{payout.status}{payout.payoutReference ? ` · ${payout.payoutReference}` : ''}{payout.failureReason ? ` · ${payout.failureReason}` : ''}</span></div><b>{money(payout.payoutAmount, payout.currency)}</b></article>
            ))}
          </PortalPanel>

          <PortalPanel title="Quotes awaiting approval">
            {overview.quotesAwaitingApproval.length === 0 ? <PortalEmpty title="No pending quotes" message="Quotes configured for owner approval will appear here." /> : overview.quotesAwaitingApproval.map((quote) => (
              <article className="pms-form-card" key={quote.id}><h3>{quote.workOrder.title}</h3><p>{quote.workOrder.vendor?.name ?? 'Assigned vendor'} · {money(quote.amount, quote.currency)}</p><div className="pms-form-actions"><button type="button" className="button-link button-link--primary" disabled={actionId === quote.id} onClick={() => void handleQuote(quote.id, 'APPROVE')}>Approve</button><button type="button" className="button-link button-link--secondary" disabled={actionId === quote.id} onClick={() => void handleQuote(quote.id, 'REJECT')}>Reject</button></div></article>
            ))}
          </PortalPanel>

          <PortalPanel title="Private property documents">
            {documents.length === 0 ? <PortalEmpty title="No documents" message="Published statements, reports, and approved property documents will appear here." /> : documents.map((document) => (
              <button key={document.id} className="pms-list-card" type="button" disabled={actionId === document.id} onClick={() => void handleDownload(document)}><div><strong>{document.title}</strong><span>{document.type}</span></div><FileText size={18} aria-hidden="true" /></button>
            ))}
          </PortalPanel>
        </div>
      </div>
    </section>
  );
}

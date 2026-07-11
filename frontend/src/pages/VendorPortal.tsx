import { CalendarClock, FileUp, Play, Send, Wrench } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import {
  listVendorWorkOrders,
  submitVendorQuote,
  updateVendorWorkOrder,
  uploadVendorFile,
  type VendorWorkOrder,
} from '../api/vendorPortal';
import { useAuth } from '../auth/AuthContext';
import { PortalEmpty, PortalError, PortalLoading, PortalNoAccess, PortalPanel } from '../features/portal/PortalState';

export default function VendorPortal() {
  const { token, user } = useAuth();
  const accesses = user?.vendorAccess?.accesses ?? [];
  const [activeAccessId, setActiveAccessId] = useState(accesses[0]?.id ?? '');
  const [workOrders, setWorkOrders] = useState<VendorWorkOrder[]>([]);
  const [loading, setLoading] = useState(Boolean(token && accesses.length));
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');

  useEffect(() => {
    if (!activeAccessId && accesses[0]?.id) setActiveAccessId(accesses[0].id);
  }, [accesses, activeAccessId]);

  async function load() {
    if (!token || !activeAccessId) return;
    try {
      setLoading(true);
      setError('');
      const result = await listVendorWorkOrders(token, activeAccessId);
      setWorkOrders(result.workOrders);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Vendor portal could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [token, activeAccessId]);

  async function progress(workOrder: VendorWorkOrder, action: 'SCHEDULE' | 'START' | 'REQUEST_COMPLETION') {
    if (!token) return;
    const comment = window.prompt('Add a progress comment');
    if (!comment?.trim()) return;
    let scheduledFor: string | undefined;
    if (action === 'SCHEDULE') {
      const value = window.prompt('Schedule date and time (YYYY-MM-DDTHH:mm)');
      if (!value) return;
      scheduledFor = new Date(value).toISOString();
    }
    try {
      setActionId(workOrder.id);
      await updateVendorWorkOrder(token, workOrder.id, { accessId: activeAccessId, action, comment: comment.trim(), scheduledFor });
      await load();
    } catch (updateError) {
      setError(updateError instanceof ApiError ? updateError.message : 'Work-order update failed.');
    } finally { setActionId(''); }
  }

  async function quote(workOrder: VendorWorkOrder) {
    if (!token) return;
    const amount = Number(window.prompt('Quote amount'));
    const currency = window.prompt('Currency', workOrder.quotes[0]?.currency ?? 'OMR')?.trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || !currency || currency.length !== 3) return;
    try {
      setActionId(workOrder.id);
      await submitVendorQuote(token, workOrder.id, { accessId: activeAccessId, amount, currency });
      await load();
    } catch (quoteError) {
      setError(quoteError instanceof ApiError ? quoteError.message : 'Quote submission failed.');
    } finally { setActionId(''); }
  }

  async function upload(event: FormEvent<HTMLFormElement>, workOrder: VendorWorkOrder) {
    event.preventDefault();
    if (!token) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('accessId', activeAccessId);
    try {
      setActionId(workOrder.id);
      await uploadVendorFile(token, workOrder.id, formData);
      form.reset();
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof ApiError ? uploadError.message : 'Private file upload failed.');
    } finally { setActionId(''); }
  }

  if (!user?.vendorAccess?.hasAccess || accesses.length === 0) {
    return <section className="pms-portal"><PortalNoAccess message="No vendor workspace has been assigned to this account." /></section>;
  }
  if (loading && workOrders.length === 0) return <section className="pms-portal"><PortalLoading label="Loading vendor portal…" /></section>;
  if (error && workOrders.length === 0) return <section className="pms-portal"><PortalError message={error} /></section>;

  return (
    <section className="pms-portal" aria-labelledby="vendor-portal-title"><div className="pms-main">
      <header className="pms-header"><div><p className="eyebrow">Private vendor workspace</p><h1 id="vendor-portal-title">Assigned work orders</h1><p>Submit quotes, schedule work, share progress, and upload evidence only for work explicitly assigned to your vendor profile.</p></div><label className="pms-field"><span>Vendor workspace</span><select aria-label="Vendor workspace" value={activeAccessId} onChange={(event) => setActiveAccessId(event.target.value)}>{accesses.map((access) => <option key={access.id} value={access.id}>{access.company.nameEn} · {access.vendor.name}</option>)}</select></label></header>
      {error ? <div className="pms-inline-alert" role="alert">{error}</div> : null}
      <section className="pms-metric-grid"><article className="pms-metric-card"><Wrench size={20} /><span>Assigned work</span><strong>{workOrders.length}</strong></article><article className="pms-metric-card"><Play size={20} /><span>In progress</span><strong>{workOrders.filter((item) => item.status === 'IN_PROGRESS').length}</strong></article><article className="pms-metric-card"><Send size={20} /><span>Completion requested</span><strong>{workOrders.filter((item) => item.status === 'COMPLETION_REQUESTED').length}</strong></article></section>
      <PortalPanel title="Work-order queue">
        {workOrders.length === 0 ? <PortalEmpty title="No assigned work" message="Only work orders explicitly assigned to this vendor are visible." /> : workOrders.map((workOrder) => (
          <article className="pms-form-card" key={workOrder.id}>
            <div className="pms-list-card"><div><strong>{workOrder.title}</strong><span>{workOrder.property.name}{workOrder.unit ? ` · ${workOrder.unit.unitNumber}` : ''}{workOrder.asset ? ` · ${workOrder.asset.assetCode}` : ''}</span></div><b>{workOrder.status}</b></div>
            {workOrder.description ? <p>{workOrder.description}</p> : null}
            <div className="pms-form-actions">
              <button type="button" className="button-link button-link--secondary" disabled={actionId === workOrder.id} onClick={() => void progress(workOrder, 'SCHEDULE')}><CalendarClock size={16} />Schedule</button>
              {workOrder.status === 'OPEN' ? <button type="button" className="button-link button-link--primary" disabled={actionId === workOrder.id} onClick={() => void progress(workOrder, 'START')}><Play size={16} />Start</button> : null}
              {workOrder.status === 'IN_PROGRESS' ? <button type="button" className="button-link button-link--primary" disabled={actionId === workOrder.id} onClick={() => void progress(workOrder, 'REQUEST_COMPLETION')}><Send size={16} />Request completion</button> : null}
              <button type="button" className="button-link button-link--ghost" disabled={actionId === workOrder.id} onClick={() => void quote(workOrder)}>Submit quote</button>
            </div>
            <form className="pms-inline-form" onSubmit={(event) => void upload(event, workOrder)}>
              <input type="hidden" name="kind" value="OTHER_DOCUMENT" />
              <label className="pms-field"><span>File title</span><input name="title" required maxLength={250} /></label>
              <label className="pms-field"><span>Private file</span><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></label>
              <button type="submit" className="button-link button-link--secondary" disabled={actionId === workOrder.id}><FileUp size={16} />Upload</button>
            </form>
            {workOrder.quotes.length ? <p>Latest quote: {workOrder.quotes[0].amount} {workOrder.quotes[0].currency} · {workOrder.quotes[0].status}</p> : null}
          </article>
        ))}
      </PortalPanel>
    </div></section>
  );
}

import { type FormEvent, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../api/client';
import type { PmsLease } from '../../../api/pms';
import { listPmsLeases } from '../../../api/pms';
import { createPmsPayment, type PmsPayment, type PmsPaymentMethod } from '../../../api/pmsAdvanced';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { createFinanceIdempotencyKey, financeCopy, formatFinanceEnum } from './copy';

const methods: PmsPaymentMethod[] = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD_MANUAL', 'ONLINE_GATEWAY', 'OTHER'];

type PaymentEditorDialogProps = {
  open: boolean;
  token: string;
  companyId: string;
  language: 'en' | 'ar';
  onClose: () => void;
  onSaved: (payment: PmsPayment) => void;
};

export default function PaymentEditorDialog({ open, token, companyId, language, onClose, onSaved }: PaymentEditorDialogProps) {
  const copy = financeCopy[language];
  const leaseRef = useRef<HTMLSelectElement>(null);
  const [leases, setLeases] = useState<PmsLease[]>([]);
  const [leaseTotal, setLeaseTotal] = useState(0);
  const [leaseId, setLeaseId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PmsPaymentMethod>('BANK_TRANSFER');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingLeases, setLoadingLeases] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLeaseId('');
    setAmount('');
    setMethod('BANK_TRANSFER');
    setPaidAt(new Date().toISOString().slice(0, 10));
    setReferenceNumber('');
    setNotes('');
    setError('');
    setLoadingLeases(true);
    let active = true;
    void listPmsLeases(token, { companyId, take: 100, skip: 0, direction: 'desc' })
      .then((result) => {
        if (!active) return;
        setLeases(result.leases);
        setLeaseTotal(result.pagination.total);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof ApiError ? loadError.message : copy.formError);
      })
      .finally(() => {
        if (active) setLoadingLeases(false);
      });
    return () => { active = false; };
  }, [companyId, copy.formError, open, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const lease = leases.find((item) => item.id === leaseId);
    if (!lease || Number(amount) <= 0 || !paidAt) {
      setError(copy.formError);
      return;
    }
    setBusy(true);
    try {
      const result = await createPmsPayment(token, {
        companyId,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        leaseId: lease.id,
        tenantId: lease.tenantId,
        amount: Number(amount),
        currency: lease.currency,
        method,
        paidAt,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        idempotencyKey: createFinanceIdempotencyKey('payment'),
      });
      onSaved(result.payment);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : copy.formError);
    } finally {
      setBusy(false);
    }
  }

  const selectedLease = leases.find((lease) => lease.id === leaseId);

  return (
    <AccessibleDialog
      closeLabel={copy.close}
      description={copy.paymentDescription}
      initialFocusRef={leaseRef}
      onClose={onClose}
      open={open}
      title={copy.createPayment}
    >
      <form className="pms-finance-form" onSubmit={submit}>
        <label className="pms-finance-form__wide">
          <span>{copy.lease}</span>
          <select ref={leaseRef} required value={leaseId} onChange={(event) => setLeaseId(event.target.value)}>
            <option value="">{loadingLeases ? copy.loading : copy.selectLease}</option>
            {leases.map((lease) => (
              <option key={lease.id} value={lease.id}>
                {lease.property.name} · {lease.unit.unitNumber} · {lease.tenant.fullName} · {lease.currency}
              </option>
            ))}
          </select>
          {leaseTotal > leases.length ? <small>{copy.firstRecordsNotice(leases.length, leaseTotal)}</small> : null}
        </label>
        <label>
          <span>{copy.amount}</span>
          <input min="0.001" required step="0.001" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label>
          <span>{copy.currency}</span>
          <input disabled value={selectedLease?.currency ?? ''} />
        </label>
        <label>
          <span>{copy.method}</span>
          <select value={method} onChange={(event) => setMethod(event.target.value as PmsPaymentMethod)}>
            {methods.map((item) => <option key={item} value={item}>{formatFinanceEnum(item, language)}</option>)}
          </select>
        </label>
        <label>
          <span>{copy.transactionDate}</span>
          <input required type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
        </label>
        <label className="pms-finance-form__wide">
          <span>{copy.reference}</span>
          <input maxLength={200} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} />
        </label>
        <label className="pms-finance-form__wide">
          <span>{copy.notes}</span>
          <textarea maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {error ? <p className="pms-finance-form__error pms-finance-form__wide" role="alert">{error}</p> : null}
        <div className="pms-finance-form__actions pms-finance-form__wide">
          <button className="button-link button-link--secondary" onClick={onClose} type="button">{copy.cancel}</button>
          <button className="button-link button-link--primary" disabled={busy} type="submit">{busy ? copy.loading : copy.createPayment}</button>
        </div>
      </form>
    </AccessibleDialog>
  );
}

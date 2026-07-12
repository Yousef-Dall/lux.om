import { Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '../../../api/client';
import type { PmsLease } from '../../../api/pms';
import { listPmsLeases } from '../../../api/pms';
import {
  createPmsCharge,
  type PmsCharge,
  type PmsChargeCategory,
  updatePmsCharge,
} from '../../../api/pmsAdvanced';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { financeCopy, formatFinanceEnum } from './copy';

type EditableLine = {
  key: string;
  category: PmsChargeCategory;
  description: string;
  quantity: string;
  unitAmount: string;
};

const categories: PmsChargeCategory[] = [
  'RENT',
  'UTILITIES',
  'SERVICE_CHARGE',
  'LATE_FEE',
  'MAINTENANCE',
  'DEPOSIT_DEDUCTION',
  'OTHER',
];

function lineKey() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyLine(): EditableLine {
  return { key: lineKey(), category: 'RENT', description: '', quantity: '1', unitAmount: '' };
}

function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

type ChargeEditorDialogProps = {
  open: boolean;
  token: string;
  companyId: string;
  language: 'en' | 'ar';
  charge?: PmsCharge | null;
  onClose: () => void;
  onSaved: (charge: PmsCharge) => void;
};

export default function ChargeEditorDialog({ open, token, companyId, language, charge, onClose, onSaved }: ChargeEditorDialogProps) {
  const copy = financeCopy[language];
  const leaseSelectRef = useRef<HTMLSelectElement>(null);
  const [leases, setLeases] = useState<PmsLease[]>([]);
  const [leaseTotal, setLeaseTotal] = useState(0);
  const [leaseId, setLeaseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [servicePeriodStart, setServicePeriodStart] = useState('');
  const [servicePeriodEnd, setServicePeriodEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([emptyLine()]);
  const [loadingLeases, setLoadingLeases] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLeaseId(charge?.leaseId ?? '');
    setDueDate(dateInput(charge?.dueDate));
    setServicePeriodStart(dateInput(charge?.servicePeriodStart));
    setServicePeriodEnd(dateInput(charge?.servicePeriodEnd));
    setNotes(charge?.notes ?? '');
    const chargeLines = charge?.lines ?? [];
    setLines(chargeLines.length > 0
      ? chargeLines.map((line) => ({
          key: line.id ?? lineKey(),
          category: line.category,
          description: line.description,
          quantity: String(line.quantity),
          unitAmount: String(line.unitAmount),
        }))
      : [emptyLine()]);
    setError('');
  }, [charge, open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoadingLeases(true);
    void listPmsLeases(token, { companyId, take: 100, skip: 0, direction: 'desc' })
      .then((result) => {
        if (controller.signal.aborted) return;
        setLeases(result.leases);
        setLeaseTotal(result.pagination.total);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError instanceof ApiError ? loadError.message : copy.formError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingLeases(false);
      });
    return () => controller.abort();
  }, [companyId, copy.formError, open, token]);

  const selectedLease = useMemo(() => leases.find((lease) => lease.id === leaseId), [leaseId, leases]);
  const currentLeaseMissing = Boolean(charge?.leaseId && !leases.some((lease) => lease.id === charge.leaseId));
  const calculatedTotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitAmount) || 0), 0);

  function updateLine(key: string, field: keyof Omit<EditableLine, 'key'>, value: string) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const lease = selectedLease;
    const scope = lease ?? (charge?.leaseId === leaseId ? {
      id: charge.leaseId,
      propertyId: charge.propertyId,
      unitId: charge.unitId,
      tenantId: charge.tenantId,
      currency: charge.currency,
    } : null);
    if (!scope?.id || !scope.propertyId || !scope.unitId || !scope.tenantId || !dueDate) {
      setError(copy.formError);
      return;
    }
    if (lines.some((line) => !line.description.trim() || Number(line.quantity) <= 0 || Number(line.unitAmount) <= 0)) {
      setError(copy.formError);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        companyId,
        propertyId: scope.propertyId,
        unitId: scope.unitId,
        leaseId: scope.id,
        tenantId: scope.tenantId,
        currency: scope.currency,
        dueDate,
        servicePeriodStart: servicePeriodStart || null,
        servicePeriodEnd: servicePeriodEnd || null,
        notes: notes.trim() || null,
        lines: lines.map((line) => ({
          category: line.category,
          description: line.description.trim(),
          quantity: Number(line.quantity),
          unitAmount: Number(line.unitAmount),
        })),
      };
      const result = charge
        ? await updatePmsCharge(token, charge.id, payload)
        : await createPmsCharge(token, payload);
      onSaved(result.charge);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : copy.formError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessibleDialog
      closeLabel={copy.close}
      description={charge ? copy.chargeDescription : copy.overviewDescription}
      initialFocusRef={leaseSelectRef}
      onClose={onClose}
      open={open}
      size="large"
      title={charge ? copy.editCharge : copy.createCharge}
    >
      <form className="pms-finance-form" onSubmit={submit}>
        <label className="pms-finance-form__wide">
          <span>{copy.lease}</span>
          <select ref={leaseSelectRef} required value={leaseId} onChange={(event) => setLeaseId(event.target.value)}>
            <option value="">{loadingLeases ? copy.loading : copy.selectLease}</option>
            {currentLeaseMissing && charge?.leaseId ? (
              <option value={charge.leaseId}>{charge.property?.name ?? copy.property} · {charge.unit?.unitNumber ?? '—'} · {charge.tenant?.fullName ?? '—'}</option>
            ) : null}
            {leases.map((lease) => (
              <option key={lease.id} value={lease.id}>
                {lease.property.name} · {lease.unit.unitNumber} · {lease.tenant.fullName} · {lease.currency}
              </option>
            ))}
          </select>
          {leaseTotal > leases.length ? <small>{copy.firstRecordsNotice(leases.length, leaseTotal)}</small> : null}
        </label>
        <label>
          <span>{copy.dueDate}</span>
          <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label>
          <span>{copy.currency}</span>
          <input disabled value={selectedLease?.currency ?? charge?.currency ?? ''} />
        </label>
        <label>
          <span>{copy.servicePeriodStart}</span>
          <input type="date" value={servicePeriodStart} onChange={(event) => setServicePeriodStart(event.target.value)} />
        </label>
        <label>
          <span>{copy.servicePeriodEnd}</span>
          <input type="date" value={servicePeriodEnd} onChange={(event) => setServicePeriodEnd(event.target.value)} />
        </label>
        <label className="pms-finance-form__wide">
          <span>{copy.notes}</span>
          <textarea maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>

        <fieldset className="pms-finance-lines pms-finance-form__wide">
          <legend>{copy.lines}</legend>
          {lines.map((line, index) => (
            <div className="pms-finance-line" key={line.key}>
              <label>
                <span>{copy.category}</span>
                <select aria-label={`${copy.category} ${index + 1}`} value={line.category} onChange={(event) => updateLine(line.key, 'category', event.target.value)}>
                  {categories.map((category) => <option key={category} value={category}>{formatFinanceEnum(category, language)}</option>)}
                </select>
              </label>
              <label className="pms-finance-line__description">
                <span>{copy.description}</span>
                <input aria-label={`${copy.description} ${index + 1}`} maxLength={300} required value={line.description} onChange={(event) => updateLine(line.key, 'description', event.target.value)} />
              </label>
              <label>
                <span>{copy.quantity}</span>
                <input aria-label={`${copy.quantity} ${index + 1}`} min="0.001" required step="0.001" type="number" value={line.quantity} onChange={(event) => updateLine(line.key, 'quantity', event.target.value)} />
              </label>
              <label>
                <span>{copy.unitAmount}</span>
                <input aria-label={`${copy.unitAmount} ${index + 1}`} min="0.001" required step="0.001" type="number" value={line.unitAmount} onChange={(event) => updateLine(line.key, 'unitAmount', event.target.value)} />
              </label>
              <button aria-label={`${copy.removeLine} ${index + 1}`} className="pms-finance-icon-button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} type="button">
                <Trash2 aria-hidden="true" size={18} />
              </button>
            </div>
          ))}
          <div className="pms-finance-lines__footer">
            <button className="button-link button-link--secondary" onClick={() => setLines((current) => [...current, emptyLine()])} type="button">
              <Plus aria-hidden="true" size={16} /> {copy.addLine}
            </button>
            <strong>{copy.total}: {calculatedTotal.toFixed(3)} {selectedLease?.currency ?? charge?.currency ?? ''}</strong>
          </div>
        </fieldset>

        {error ? <p className="pms-finance-form__error pms-finance-form__wide" role="alert">{error}</p> : null}
        <div className="pms-finance-form__actions pms-finance-form__wide">
          <button className="button-link button-link--secondary" onClick={onClose} type="button">{copy.cancel}</button>
          <button className="button-link button-link--primary" disabled={busy} type="submit">{busy ? copy.loading : charge ? copy.saveChanges : copy.saveDraft}</button>
        </div>
      </form>
    </AccessibleDialog>
  );
}

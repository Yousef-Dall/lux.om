import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '../../../api/client';
import {
  allocatePmsPaymentBatch,
  listPmsCharges,
  type PmsCharge,
  type PmsPayment,
} from '../../../api/pmsAdvanced';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { createFinanceIdempotencyKey, financeCopy, formatFinanceDate, formatFinanceMoney } from './copy';

type AllocationDialogProps = {
  open: boolean;
  token: string;
  companyId: string;
  language: 'en' | 'ar';
  payment: PmsPayment | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function AllocationDialog({ open, token, companyId, language, payment, onClose, onSaved }: AllocationDialogProps) {
  const copy = financeCopy[language];
  const firstAmountRef = useRef<HTMLInputElement>(null);
  const [charges, setCharges] = useState<PmsCharge[]>([]);
  const [totalEligible, setTotalEligible] = useState(0);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !payment) return;
    const controller = new AbortController();
    setLoading(true);
    setAmounts({});
    setError('');
    void listPmsCharges(token, {
      companyId,
      tenantId: payment.tenantId,
      currency: payment.currency,
      openOnly: true,
      sortBy: 'dueDate',
      direction: 'asc',
      take: 100,
      skip: 0,
      signal: controller.signal,
    })
      .then((result) => {
        setCharges(result.charges);
        setTotalEligible(result.pagination.total);
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof ApiError ? loadError.message : copy.formError);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, copy.formError, open, payment, token]);

  const allocationTotal = useMemo(() => Object.values(amounts).reduce((sum, value) => sum + (Number(value) || 0), 0), [amounts]);
  const availableAmount = Number(payment?.availableAmount ?? 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!payment) return;
    const allocations = Object.entries(amounts)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([chargeId, amount]) => ({ chargeId, amount: Number(amount) }));
    if (allocations.length === 0 || allocationTotal > availableAmount) {
      setError(copy.formError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await allocatePmsPaymentBatch(token, payment.id, {
        companyId,
        idempotencyKey: createFinanceIdempotencyKey('allocation-batch'),
        allocations,
      });
      onSaved();
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
      description={payment ? `${copy.available}: ${formatFinanceMoney(payment.availableAmount, payment.currency, language)}` : undefined}
      initialFocusRef={firstAmountRef}
      onClose={onClose}
      open={open}
      size="large"
      title={copy.allocatePayment}
    >
      <form className="pms-finance-form" onSubmit={submit}>
        <div className="pms-finance-allocation-summary pms-finance-form__wide">
          <span>{copy.available}</span>
          <strong>{payment ? formatFinanceMoney(payment.availableAmount, payment.currency, language) : '—'}</strong>
          <span>{copy.allocationTotal}</span>
          <strong className={allocationTotal > availableAmount ? 'pms-finance-text--danger' : ''}>
            {payment ? formatFinanceMoney(allocationTotal, payment.currency, language) : '—'}
          </strong>
        </div>
        <fieldset className="pms-finance-allocation-list pms-finance-form__wide">
          <legend>{copy.selectCharges}</legend>
          {loading ? <p>{copy.loading}</p> : charges.length === 0 ? <p>{copy.noEligibleCharges}</p> : charges.map((charge, index) => (
            <label className="pms-finance-allocation-row" key={charge.id}>
              <span>
                <strong>{charge.chargeNumber}</strong>
                <small>{charge.property?.name} · {charge.unit?.unitNumber ?? '—'} · {copy.dueDate}: {formatFinanceDate(charge.dueDate, language)}</small>
              </span>
              <b>{formatFinanceMoney(charge.balanceAmount, charge.currency, language)}</b>
              <input
                aria-label={`${copy.allocationAmount} ${charge.chargeNumber}`}
                max={Math.min(Number(charge.balanceAmount), availableAmount)}
                min="0"
                ref={index === 0 ? firstAmountRef : undefined}
                step="0.001"
                type="number"
                value={amounts[charge.id] ?? ''}
                onChange={(event) => setAmounts((current) => ({ ...current, [charge.id]: event.target.value }))}
              />
            </label>
          ))}
          {totalEligible > charges.length ? <small>{copy.incompleteOptions(charges.length, totalEligible)}</small> : null}
        </fieldset>
        {error ? <p className="pms-finance-form__error pms-finance-form__wide" role="alert">{error}</p> : null}
        <div className="pms-finance-form__actions pms-finance-form__wide">
          <button className="button-link button-link--secondary" onClick={onClose} type="button">{copy.cancel}</button>
          <button className="button-link button-link--primary" disabled={busy || allocationTotal <= 0 || allocationTotal > availableAmount} type="submit">
            {busy ? copy.loading : copy.allocatePayment}
          </button>
        </div>
      </form>
    </AccessibleDialog>
  );
}

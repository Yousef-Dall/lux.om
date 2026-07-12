import { type FormEvent, useEffect, useRef, useState } from 'react';

import AccessibleDialog from '../../../components/AccessibleDialog';
import type { PmsChargeAdjustmentType, PmsPaymentAdjustmentType } from '../../../api/pmsAdvanced';
import { financeCopy, formatFinanceEnum } from './copy';

type FinanceActionKind =
  | 'ISSUE_CHARGE'
  | 'VOID_CHARGE'
  | 'CHARGE_ADJUSTMENT'
  | 'CREDIT_NOTE'
  | 'PAYMENT_ADJUSTMENT'
  | 'REVERSE_ALLOCATION';

type FinanceActionValue = {
  reason?: string;
  amount?: number;
  chargeAdjustmentType?: PmsChargeAdjustmentType;
  paymentAdjustmentType?: PmsPaymentAdjustmentType;
  referenceNumber?: string;
};

type FinanceActionDialogProps = {
  open: boolean;
  kind: FinanceActionKind | null;
  language: 'en' | 'ar';
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (value: FinanceActionValue) => Promise<void> | void;
};

export default function FinanceActionDialog({ open, kind, language, busy, error, onClose, onSubmit }: FinanceActionDialogProps) {
  const copy = financeCopy[language];
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [chargeAdjustmentType, setChargeAdjustmentType] = useState<PmsChargeAdjustmentType>('DISCOUNT');
  const [paymentAdjustmentType, setPaymentAdjustmentType] = useState<PmsPaymentAdjustmentType>('REFUND');
  const [referenceNumber, setReferenceNumber] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
    setAmount('');
    setChargeAdjustmentType('DISCOUNT');
    setPaymentAdjustmentType('REFUND');
    setReferenceNumber('');
  }, [kind, open]);

  if (!kind) return null;

  const title = kind === 'ISSUE_CHARGE'
    ? copy.issue
    : kind === 'VOID_CHARGE'
      ? copy.voidCharge
      : kind === 'CHARGE_ADJUSTMENT'
        ? copy.addAdjustment
        : kind === 'CREDIT_NOTE'
          ? copy.createCreditNote
          : kind === 'PAYMENT_ADJUSTMENT'
            ? copy.paymentAdjustment
            : copy.reverseAllocation;
  const description = kind === 'ISSUE_CHARGE'
    ? copy.issueDescription
    : kind === 'VOID_CHARGE' || kind === 'REVERSE_ALLOCATION'
      ? copy.destructiveWarning
      : undefined;
  const needsAmount = kind === 'CHARGE_ADJUSTMENT' || kind === 'CREDIT_NOTE' || kind === 'PAYMENT_ADJUSTMENT';
  const needsReason = kind !== 'ISSUE_CHARGE';

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      reason: reason.trim() || undefined,
      amount: needsAmount ? Number(amount) : undefined,
      chargeAdjustmentType,
      paymentAdjustmentType,
      referenceNumber: referenceNumber.trim() || undefined,
    });
  }

  return (
    <AccessibleDialog
      closeLabel={copy.close}
      description={description}
      initialFocusRef={reasonRef}
      onClose={onClose}
      open={open}
      title={title}
    >
      <form className="pms-finance-form" onSubmit={submit}>
        {kind === 'CHARGE_ADJUSTMENT' ? (
          <label>
            <span>{copy.type}</span>
            <select value={chargeAdjustmentType} onChange={(event) => setChargeAdjustmentType(event.target.value as PmsChargeAdjustmentType)}>
              <option value="DISCOUNT">{formatFinanceEnum('DISCOUNT', language)}</option>
              <option value="WRITE_OFF">{formatFinanceEnum('WRITE_OFF', language)}</option>
              <option value="REVERSAL">{formatFinanceEnum('REVERSAL', language)}</option>
              <option value="MANUAL">{formatFinanceEnum('MANUAL', language)}</option>
            </select>
          </label>
        ) : null}
        {kind === 'PAYMENT_ADJUSTMENT' ? (
          <label>
            <span>{copy.type}</span>
            <select value={paymentAdjustmentType} onChange={(event) => setPaymentAdjustmentType(event.target.value as PmsPaymentAdjustmentType)}>
              <option value="REFUND">{formatFinanceEnum('REFUND', language)}</option>
              <option value="REVERSAL">{formatFinanceEnum('REVERSAL', language)}</option>
              <option value="CHARGEBACK">{formatFinanceEnum('CHARGEBACK', language)}</option>
              <option value="WRITE_OFF">{formatFinanceEnum('WRITE_OFF', language)}</option>
            </select>
          </label>
        ) : null}
        {needsAmount ? (
          <label>
            <span>{copy.amount}</span>
            <input min="0.001" required step="0.001" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
        ) : null}
        {kind === 'PAYMENT_ADJUSTMENT' ? (
          <label>
            <span>{copy.reference}</span>
            <input maxLength={200} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} />
          </label>
        ) : null}
        {needsReason ? (
          <label className="pms-finance-form__wide">
            <span>{copy.reason}</span>
            <textarea minLength={3} ref={reasonRef} required rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        ) : null}
        {error ? <p className="pms-finance-form__error" role="alert">{error}</p> : null}
        <div className="pms-finance-form__actions">
          <button className="button-link button-link--secondary" onClick={onClose} type="button">{copy.cancel}</button>
          <button className="button-link button-link--primary" disabled={busy} type="submit">{busy ? copy.loading : copy.submit}</button>
        </div>
      </form>
    </AccessibleDialog>
  );
}

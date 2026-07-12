import type { PmsPayment, PmsPaymentBalance } from '../../../api/pmsAdvanced';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { financeCopy, formatFinanceDate, formatFinanceEnum, formatFinanceMoney } from './copy';

type PaymentDetailDialogProps = {
  open: boolean;
  payment: PmsPayment | null;
  balance: PmsPaymentBalance | null;
  language: 'en' | 'ar';
  canManage: boolean;
  onClose: () => void;
  onAllocate: () => void;
  onAdjustment: () => void;
  onReverseAllocation: (allocationId: string) => void;
};

export default function PaymentDetailDialog({ open, payment, balance, language, canManage, onClose, onAllocate, onAdjustment, onReverseAllocation }: PaymentDetailDialogProps) {
  const copy = financeCopy[language];
  return (
    <AccessibleDialog closeLabel={copy.close} onClose={onClose} open={open} size="large" title={payment ? `${copy.paymentDetails} · ${payment.receiptNumber ?? payment.id}` : copy.paymentDetails}>
      {!payment || !balance ? <p>{copy.loading}</p> : (
        <div className="pms-finance-detail">
          <section className="pms-finance-detail__summary" aria-label={copy.paymentDetails}>
            <div><span>{copy.status}</span><strong className={`pms-finance-status pms-finance-status--${payment.status.toLowerCase()}`}>{formatFinanceEnum(payment.status, language)}</strong></div>
            <div><span>{copy.property}</span><strong>{payment.property.name} · {payment.unit.unitNumber}</strong></div>
            <div><span>{copy.tenantUnit}</span><strong>{payment.tenant?.fullName ?? '—'}</strong></div>
            <div><span>{copy.amount}</span><strong>{formatFinanceMoney(payment.amount, payment.currency, language)}</strong></div>
            <div><span>{copy.allocated}</span><strong>{formatFinanceMoney(balance.allocatedAmount, payment.currency, language)}</strong></div>
            <div><span>{copy.available}</span><strong>{formatFinanceMoney(balance.availableAmount, payment.currency, language)}</strong></div>
            <div><span>{copy.transactionDate}</span><strong>{formatFinanceDate(payment.paidAt, language)}</strong></div>
            <div><span>{copy.postingDate}</span><strong>{formatFinanceDate(payment.createdAt, language, true)}</strong></div>
            <div><span>{copy.settlementDate}</span><strong>{formatFinanceDate(payment.confirmedAt, language, true)}</strong></div>
            <div><span>{copy.method}</span><strong>{formatFinanceEnum(payment.method, language)}</strong></div>
            <div><span>{copy.reference}</span><strong>{payment.referenceNumber ?? '—'}</strong></div>
          </section>
          {payment.notes ? <p className="pms-finance-detail__notes">{payment.notes}</p> : null}

          <section className="pms-finance-history-grid">
            <div>
              <h3>{copy.allocationHistory}</h3>
              {payment.allocations.length ? payment.allocations.map((allocation) => (
                <article className="pms-finance-history-item" key={allocation.id}>
                  <strong>{allocation.charge?.chargeNumber ?? allocation.chargeId} · {formatFinanceEnum(allocation.status, language)}</strong>
                  <span>{formatFinanceMoney(allocation.amount, allocation.currency, language)}</span>
                  <small>{copy.settlementDate}: {formatFinanceDate(allocation.createdAt, language, true)}</small>
                  {canManage && allocation.status === 'ACTIVE' ? <button className="pms-finance-text-button" onClick={() => onReverseAllocation(allocation.id)} type="button">{copy.reverseAllocation}</button> : null}
                </article>
              )) : <p>{copy.noHistory}</p>}
            </div>
            <div>
              <h3>{copy.adjustmentHistory}</h3>
              {payment.adjustments.length ? payment.adjustments.map((adjustment) => (
                <article className="pms-finance-history-item" key={adjustment.id}>
                  <strong>{formatFinanceEnum(adjustment.type, language)} · {formatFinanceEnum(adjustment.status, language)}</strong>
                  <span>{formatFinanceMoney(adjustment.amount, adjustment.currency, language)} · {adjustment.reason}</span>
                  <small>{formatFinanceDate(adjustment.createdAt, language, true)}</small>
                </article>
              )) : <p>{copy.noHistory}</p>}
            </div>
          </section>

          {canManage ? (
            <div className="pms-finance-detail__actions">
              {payment.status === 'CONFIRMED' && Number(balance.availableAmount) > 0 ? <button className="button-link button-link--primary" onClick={onAllocate} type="button">{copy.allocatePayment}</button> : null}
              {payment.status === 'CONFIRMED' && Number(balance.availableAmount) > 0 ? <button className="button-link button-link--secondary" onClick={onAdjustment} type="button">{copy.paymentAdjustment}</button> : null}
            </div>
          ) : <p className="pms-finance-permission-note">{copy.permissionDenied}</p>}
        </div>
      )}
    </AccessibleDialog>
  );
}

import type { PmsCharge, PmsCreditNote } from '../../../api/pmsAdvanced';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { financeCopy, formatFinanceDate, formatFinanceEnum, formatFinanceMoney } from './copy';

type ChargeDetailDialogProps = {
  open: boolean;
  charge: PmsCharge | null;
  language: 'en' | 'ar';
  canManage: boolean;
  busy?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAction: (kind: 'ISSUE_CHARGE' | 'VOID_CHARGE' | 'CHARGE_ADJUSTMENT' | 'CREDIT_NOTE') => void;
  onCreditTransition: (creditNote: PmsCreditNote, action: 'APPROVE' | 'APPLY' | 'VOID') => void;
};

export default function ChargeDetailDialog({ open, charge, language, canManage, busy, onClose, onEdit, onAction, onCreditTransition }: ChargeDetailDialogProps) {
  const copy = financeCopy[language];
  const canVoid = Boolean(charge && charge.status !== 'VOID' && Number(charge.paidAmount) <= 0 && !(charge.allocations ?? []).some((allocation) => allocation.status === 'ACTIVE'));
  return (
    <AccessibleDialog closeLabel={copy.close} onClose={onClose} open={open} size="large" title={charge ? `${copy.chargeDetails} · ${charge.chargeNumber}` : copy.chargeDetails}>
      {!charge ? <p>{copy.loading}</p> : (
        <div className="pms-finance-detail">
          <section className="pms-finance-detail__summary" aria-label={copy.chargeDetails}>
            <div><span>{copy.status}</span><strong className={`pms-finance-status pms-finance-status--${charge.status.toLowerCase()}`}>{formatFinanceEnum(charge.status, language)}</strong></div>
            <div><span>{copy.property}</span><strong>{charge.property?.name ?? '—'} · {charge.unit?.unitNumber ?? '—'}</strong></div>
            <div><span>{copy.tenantUnit}</span><strong>{charge.tenant?.fullName ?? '—'}</strong></div>
            <div><span>{copy.dueDate}</span><strong>{formatFinanceDate(charge.dueDate, language)}</strong></div>
            <div><span>{copy.total}</span><strong>{formatFinanceMoney(charge.totalAmount, charge.currency, language)}</strong></div>
            <div><span>{copy.balance}</span><strong>{formatFinanceMoney(charge.balanceAmount, charge.currency, language)}</strong></div>
            <div><span>{copy.servicePeriodStart}</span><strong>{formatFinanceDate(charge.servicePeriodStart, language)}</strong></div>
            <div><span>{copy.servicePeriodEnd}</span><strong>{formatFinanceDate(charge.servicePeriodEnd, language)}</strong></div>
            <div><span>{copy.postingDate}</span><strong>{formatFinanceDate(charge.createdAt, language, true)}</strong></div>
            <div><span>{copy.issueDate}</span><strong>{formatFinanceDate(charge.issuedAt, language, true)}</strong></div>
          </section>

          {charge.notes ? <p className="pms-finance-detail__notes">{charge.notes}</p> : null}

          <section>
            <h3>{copy.lines}</h3>
            <div className="pms-table-wrap">
              <table className="pms-table">
                <caption className="sr-only">{copy.lines}</caption>
                <thead><tr><th>{copy.category}</th><th>{copy.description}</th><th>{copy.quantity}</th><th>{copy.unitAmount}</th><th>{copy.amount}</th></tr></thead>
                <tbody>{(charge.lines ?? []).map((line) => (
                  <tr key={line.id ?? `${line.position}-${line.description}`}>
                    <td>{formatFinanceEnum(line.category, language)}</td><td>{line.description}</td><td>{line.quantity}</td><td>{formatFinanceMoney(line.unitAmount, charge.currency, language)}</td><td>{formatFinanceMoney(line.amount, charge.currency, language)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <section className="pms-finance-history-grid">
            <div>
              <h3>{copy.adjustmentHistory}</h3>
              {charge.adjustments?.length ? charge.adjustments.map((adjustment) => (
                <article className="pms-finance-history-item" key={adjustment.id}>
                  <strong>{formatFinanceEnum(adjustment.type, language)} · {formatFinanceMoney(adjustment.amount, charge.currency, language)}</strong>
                  <span>{adjustment.reason}</span><small>{formatFinanceDate(adjustment.createdAt, language, true)}</small>
                </article>
              )) : <p>{copy.noHistory}</p>}
            </div>
            <div>
              <h3>{copy.creditHistory}</h3>
              {charge.creditNotes?.length ? charge.creditNotes.map((note) => (
                <article className="pms-finance-history-item" key={note.id}>
                  <strong>{note.creditNumber} · {formatFinanceEnum(note.status, language)} · {formatFinanceMoney(note.amount, note.currency, language)}</strong>
                  <span>{note.reason}</span>
                  {canManage && note.status === 'DRAFT' ? <div className="pms-finance-inline-actions"><button disabled={busy} onClick={() => onCreditTransition(note, 'APPROVE')} type="button">{copy.approve}</button><button disabled={busy} onClick={() => onCreditTransition(note, 'VOID')} type="button">{copy.void}</button></div> : null}
                  {canManage && note.status === 'APPROVED' ? <div className="pms-finance-inline-actions"><button disabled={busy} onClick={() => onCreditTransition(note, 'APPLY')} type="button">{copy.apply}</button><button disabled={busy} onClick={() => onCreditTransition(note, 'VOID')} type="button">{copy.void}</button></div> : null}
                </article>
              )) : <p>{copy.noHistory}</p>}
            </div>
            <div>
              <h3>{copy.allocationHistory}</h3>
              {charge.allocations?.length ? charge.allocations.map((allocation) => (
                <article className="pms-finance-history-item" key={allocation.id}>
                  <strong>{formatFinanceEnum(allocation.status, language)} · {formatFinanceMoney(allocation.amount, allocation.currency, language)}</strong>
                  <span>{allocation.payment?.receiptNumber ?? allocation.paymentId}</span><small>{copy.settlementDate}: {formatFinanceDate(allocation.createdAt, language, true)}</small>
                </article>
              )) : <p>{copy.noHistory}</p>}
            </div>
          </section>

          {canManage ? (
            <div className="pms-finance-detail__actions">
              {charge.status === 'DRAFT' ? <button className="button-link button-link--secondary" onClick={onEdit} type="button">{copy.editCharge}</button> : null}
              {charge.status === 'DRAFT' ? <button className="button-link button-link--primary" onClick={() => onAction('ISSUE_CHARGE')} type="button">{copy.issue}</button> : null}
              {charge.status !== 'VOID' && charge.status !== 'PAID' ? <button className="button-link button-link--secondary" onClick={() => onAction('CHARGE_ADJUSTMENT')} type="button">{copy.addAdjustment}</button> : null}
              {charge.status !== 'DRAFT' && charge.status !== 'VOID' ? <button className="button-link button-link--secondary" onClick={() => onAction('CREDIT_NOTE')} type="button">{copy.createCreditNote}</button> : null}
              {canVoid ? <button className="button-link button-link--danger" onClick={() => onAction('VOID_CHARGE')} type="button">{copy.voidCharge}</button> : null}
            </div>
          ) : <p className="pms-finance-permission-note">{copy.permissionDenied}</p>}
        </div>
      )}
    </AccessibleDialog>
  );
}

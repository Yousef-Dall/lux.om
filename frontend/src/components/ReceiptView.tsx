type ReceiptViewProps = {
  receipt?: {
    receiptNumber?: string | null;
    amount?: string | number | null;
    commission?: string | number | null;
    currency?: string | null;
    status?: string | null;
    paidAt?: string | null;
    reference?: string | null;
  } | null;
};

export default function ReceiptView({ receipt }: ReceiptViewProps) {
  if (!receipt) return null;

  return (
    <article className="receipt-view">
      <p className="eyebrow">Receipt</p>
      <h3>{receipt.receiptNumber || receipt.reference || 'Payment receipt'}</h3>
      <dl>
        <div><dt>Status</dt><dd>{receipt.status || 'Pending'}</dd></div>
        <div><dt>Amount</dt><dd>{receipt.amount ?? '-'} {receipt.currency || 'OMR'}</dd></div>
        <div><dt>Commission</dt><dd>{receipt.commission ?? '-'} {receipt.currency || 'OMR'}</dd></div>
        <div><dt>Paid at</dt><dd>{receipt.paidAt ? new Date(receipt.paidAt).toLocaleString() : '-'}</dd></div>
      </dl>
    </article>
  );
}

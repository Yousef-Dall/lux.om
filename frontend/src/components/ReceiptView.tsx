import type { ApiBookingReceipt } from '../api/bookings';

type ReceiptViewProps = {
  receipt?: ApiBookingReceipt | null;
  onClose?: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium'
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatAmount(value?: string | number | null, currency = 'OMR') {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return `— ${currency}`;

  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export default function ReceiptView({ receipt, onClose }: ReceiptViewProps) {
  if (!receipt) return null;

  return (
    <article className="receipt-view">
      <div className="receipt-view__header">
        <div>
          <p className="eyebrow">lux.om receipt</p>
          <h3>{receipt.receiptNumber || 'Payment receipt'}</h3>
          <p>
            Booking payment receipt generated from lux.om booking and payment
            records.
          </p>
        </div>

        <div className="receipt-view__actions no-print">
          <button
            className="button-link button-link--secondary"
            type="button"
            onClick={() => window.print()}
          >
            Print receipt
          </button>

          {onClose ? (
            <button
              className="button-link button-link--ghost"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className="receipt-view__status">
        <span className={`status-pill ${receipt.status === 'PAID' ? 'approved' : 'pending'}`}>
          Payment {receipt.status}
        </span>
        <strong>{formatAmount(receipt.amount, receipt.currency)}</strong>
      </div>

      <div className="receipt-view__grid">
        <section>
          <h4>Booking</h4>
          <dl>
            <div>
              <dt>Title</dt>
              <dd>{receipt.bookingTitle}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{receipt.bookingType}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{receipt.bookingLocation || '—'}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(receipt.bookingDate)}</dd>
            </div>
            <div>
              <dt>Preferred time</dt>
              <dd>{receipt.preferredTime || '—'}</dd>
            </div>
            <div>
              <dt>Guests</dt>
              <dd>{receipt.guests}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Customer</h4>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{receipt.customerName || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{receipt.customerEmail || '—'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{receipt.customerPhone || '—'}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Provider</h4>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{receipt.provider?.name || '—'}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{receipt.provider?.type || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{receipt.provider?.email || '—'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{receipt.provider?.phone || '—'}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Payment</h4>
          <dl>
            <div>
              <dt>Amount</dt>
              <dd>{formatAmount(receipt.amount, receipt.currency)}</dd>
            </div>
            <div>
              <dt>Commission</dt>
              <dd>{formatAmount(receipt.commission, receipt.currency)}</dd>
            </div>
            <div>
              <dt>Provider payout</dt>
              <dd>
                {formatAmount(receipt.providerPayoutAmount, receipt.currency)}
              </dd>
            </div>
            <div>
              <dt>Payment provider</dt>
              <dd>{receipt.providerName || '—'}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{receipt.reference || '—'}</dd>
            </div>
            <div>
              <dt>Thawani session</dt>
              <dd>{receipt.thawaniSessionId || '—'}</dd>
            </div>
            <div>
              <dt>Paid at</dt>
              <dd>{formatDateTime(receipt.paidAt)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="receipt-view__note">
        {receipt.note ||
          'This receipt does not contain or store card details. Payment status is based on backend payment records.'}
      </p>
    </article>
  );
}

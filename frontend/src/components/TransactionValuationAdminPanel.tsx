import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import {
  createMarketplaceTransaction,
  getAdminMarketplaceTransactions,
  updateAdminMarketplaceTransactionStatus,
  type JsonRecord
} from '../api/transactions';
import {
  getAdminValuations,
  updateAdminValuationReview
} from '../api/valuations';

const transactionTypes = [
  'PROPERTY_SALE',
  'PROPERTY_RENTAL',
  'ACTIVITY_BOOKING',
  'PROVIDER_PAYOUT',
  'OTHER'
];

const transactionStatuses = [
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'ARCHIVED'
];

const escrowStatuses = [
  'NOT_STARTED',
  'PENDING_DEPOSIT',
  'HELD',
  'RELEASE_REQUESTED',
  'RELEASED',
  'DISPUTED',
  'CANCELLED'
];

const valuationReviewStatuses = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'NEEDS_MORE_DATA'
];

const transactionInitialState = {
  title: '',
  type: 'PROPERTY_RENTAL',
  amount: '',
  currency: 'OMR',
  listingId: '',
  activityId: '',
  bookingId: '',
  contractDraftId: '',
  rentDueItemId: '',
  buyerId: '',
  sellerId: '',
  landlordId: '',
  tenantId: '',
  providerId: '',
  adminNotes: ''
};

const transactionReviewInitialState = {
  status: 'DRAFT',
  escrowStatus: 'NOT_STARTED',
  message: ''
};

const valuationReviewInitialState = {
  reviewStatus: 'PENDING',
  reviewNotes: ''
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getValue(record: JsonRecord | null | undefined, key: string) {
  return record?.[key];
}

function getRecords(record: JsonRecord | null | undefined, key: string) {
  const value = getValue(record, key);

  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function getText(record: JsonRecord | null | undefined, key: string, fallback = '—') {
  const value = getValue(record, key);

  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return fallback;
}

function getMoney(record: JsonRecord | null | undefined, key: string) {
  const amount = Number(getText(record, key, ''));
  const currency = getText(record, 'currency', 'OMR');

  if (!Number.isFinite(amount)) return '—';

  return `${currency} ${amount.toLocaleString(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  })}`;
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').toLowerCase();
}


function cleanStringPayload(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value !== '')
  ) as JsonRecord;
}

function buildTransactionPayload(values: typeof transactionInitialState) {
  const payload = cleanStringPayload(values);

  if (values.amount.trim()) {
    payload.amount = Number(values.amount);
  }

  payload.documentChecklist = {
    participantDetailsConfirmed: false,
    propertyOrBookingLinked: Boolean(
      values.listingId || values.activityId || values.bookingId || values.contractDraftId
    ),
    paymentLedgerReady: false,
    disputeProcessExplained: false,
    providerEscrowRequired: true
  };

  return payload;
}

function getEstimate(valuation: JsonRecord) {
  const low = getMoney(valuation, 'estimateLow');
  const high = getMoney(valuation, 'estimateHigh');

  if (low === '—' || high === '—') return 'More data needed';

  return `${low} - ${high}`;
}

export default function TransactionValuationAdminPanel({ token }: { token: string | null }) {
  const [transactions, setTransactions] = useState<JsonRecord[]>([]);
  const [valuations, setValuations] = useState<JsonRecord[]>([]);
  const [transactionForm, setTransactionForm] = useState(transactionInitialState);
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [transactionReviewForm, setTransactionReviewForm] = useState(transactionReviewInitialState);
  const [selectedValuationId, setSelectedValuationId] = useState('');
  const [valuationReviewForm, setValuationReviewForm] = useState(valuationReviewInitialState);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function load() {
      try {
        setError('');

        const [transactionResponse, valuationResponse] = await Promise.all([
          getAdminMarketplaceTransactions(token!),
          getAdminValuations(token!)
        ]);

        if (!active) return;

        setTransactions(transactionResponse.transactions ?? []);
        setValuations(valuationResponse.valuations ?? []);
      } catch (caughtError) {
        console.error(caughtError);

        if (active) setError('Could not load transaction and valuation queues.');
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  const selectedTransaction = useMemo(
    () =>
      transactions.find((transaction) => getText(transaction, 'id', '') === selectedTransactionId) ??
      null,
    [transactions, selectedTransactionId]
  );

  const selectedValuation = useMemo(
    () =>
      valuations.find((valuation) => getText(valuation, 'id', '') === selectedValuationId) ??
      null,
    [valuations, selectedValuationId]
  );

  useEffect(() => {
    if (!selectedTransaction) return;

    setTransactionReviewForm({
      status: getText(selectedTransaction, 'status', 'DRAFT'),
      escrowStatus: getText(selectedTransaction, 'escrowStatus', 'NOT_STARTED'),
      message: ''
    });
  }, [selectedTransaction]);

  useEffect(() => {
    if (!selectedValuation) return;

    setValuationReviewForm({
      reviewStatus: getText(selectedValuation, 'reviewStatus', 'PENDING'),
      reviewNotes: getText(selectedValuation, 'reviewNotes', '')
    });
  }, [selectedValuation]);

  function handleTransactionField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setTransactionForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleTransactionReviewField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setTransactionReviewForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleValuationReviewField(event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setValuationReviewForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || saving) return;

    try {
      setSaving('transaction-create');
      setMessage('');
      setError('');

      const response = await createMarketplaceTransaction(
        buildTransactionPayload(transactionForm),
        token
      );

      setTransactions((current) => [response.transaction, ...current]);
      setSelectedTransactionId(getText(response.transaction, 'id', ''));
      setTransactionForm(transactionInitialState);
      setMessage('Escrow-ready transaction workflow created for manual admin review.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not create this transaction workflow.');
    } finally {
      setSaving('');
    }
  }

  async function handleUpdateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedTransactionId || saving) return;

    try {
      setSaving('transaction-review');
      setMessage('');
      setError('');

      const response = await updateAdminMarketplaceTransactionStatus(
        selectedTransactionId,
        cleanStringPayload(transactionReviewForm),
        token
      );

      setTransactions((current) =>
        current.map((transaction) =>
          getText(transaction, 'id', '') === selectedTransactionId
            ? response.transaction
            : transaction
        )
      );
      setMessage('Transaction status updated and audit event recorded.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not update this transaction status.');
    } finally {
      setSaving('');
    }
  }

  async function handleUpdateValuation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedValuationId || saving) return;

    try {
      setSaving('valuation-review');
      setMessage('');
      setError('');

      const response = await updateAdminValuationReview(
        selectedValuationId,
        cleanStringPayload(valuationReviewForm),
        token
      );

      setValuations((current) =>
        current.map((valuation) =>
          getText(valuation, 'id', '') === selectedValuationId
            ? response.valuation
            : valuation
        )
      );
      setMessage('Valuation review updated. This remains an estimate, not a formal appraisal.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not update this valuation review.');
    } finally {
      setSaving('');
    }
  }

  if (!token || !loaded) return null;

  return (
    <div className="stage8-operations-queue transaction-valuation-admin">
      <div className="details-section-heading">
        <p className="eyebrow">8.9 / 8.11 Transactions and valuation</p>
        <h3>Escrow workflow and valuation review</h3>
        <p>
          Create manual transaction-readiness records, track escrow status, and
          review valuation estimates. This does not activate live escrow or
          official appraisal services.
        </p>
      </div>

      {message ? <div className="form-success">{message}</div> : null}
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="transaction-valuation-grid">
        <form className="stage8-tool-card contract-rent-form" onSubmit={handleCreateTransaction}>
          <div>
            <p className="eyebrow">Escrow-ready transaction</p>
            <h4>Create transaction workflow</h4>
          </div>

          <label>
            Title
            <input name="title" value={transactionForm.title} onChange={handleTransactionField} required />
          </label>

          <div className="form-grid three">
            <label>
              Type
              <select name="type" value={transactionForm.type} onChange={handleTransactionField}>
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatStatus(type)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Amount
              <input name="amount" type="number" min="0" step="0.001" value={transactionForm.amount} onChange={handleTransactionField} />
            </label>

            <label>
              Currency
              <input name="currency" value={transactionForm.currency} onChange={handleTransactionField} />
            </label>
          </div>

          <div className="form-grid three">
            <label>
              Listing ID
              <input name="listingId" value={transactionForm.listingId} onChange={handleTransactionField} />
            </label>

            <label>
              Activity ID
              <input name="activityId" value={transactionForm.activityId} onChange={handleTransactionField} />
            </label>

            <label>
              Booking ID
              <input name="bookingId" value={transactionForm.bookingId} onChange={handleTransactionField} />
            </label>

            <label>
              Contract draft ID
              <input name="contractDraftId" value={transactionForm.contractDraftId} onChange={handleTransactionField} />
            </label>

            <label>
              Rent due item ID
              <input name="rentDueItemId" value={transactionForm.rentDueItemId} onChange={handleTransactionField} />
            </label>
          </div>

          <div className="form-grid three">
            <label>
              Buyer user ID
              <input name="buyerId" value={transactionForm.buyerId} onChange={handleTransactionField} />
            </label>

            <label>
              Seller user ID
              <input name="sellerId" value={transactionForm.sellerId} onChange={handleTransactionField} />
            </label>

            <label>
              Landlord user ID
              <input name="landlordId" value={transactionForm.landlordId} onChange={handleTransactionField} />
            </label>

            <label>
              Tenant user ID
              <input name="tenantId" value={transactionForm.tenantId} onChange={handleTransactionField} />
            </label>

            <label>
              Provider user ID
              <input name="providerId" value={transactionForm.providerId} onChange={handleTransactionField} />
            </label>
          </div>

          <label>
            Admin notes
            <textarea name="adminNotes" value={transactionForm.adminNotes} onChange={handleTransactionField} />
          </label>

          <button className="button-link button-link--primary" type="submit" disabled={saving === 'transaction-create'}>
            {saving === 'transaction-create' ? 'Creating…' : 'Create transaction workflow'}
          </button>
        </form>

        <section className="stage8-tool-card">
          <div className="details-section-heading">
            <p className="eyebrow">Transaction review</p>
            <h4>Status and escrow monitor</h4>
          </div>

          <div className="stage8-operations-list">
            {transactions.slice(0, 8).map((transaction) => {
              const transactionId = getText(transaction, 'id', '');
              const status = getText(transaction, 'status', 'DRAFT');
              const escrowStatus = getText(transaction, 'escrowStatus', 'NOT_STARTED');

              return (
                <button
                  key={transactionId}
                  type="button"
                  className={`contract-registration-row ${selectedTransactionId === transactionId ? 'active' : ''}`}
                  onClick={() => setSelectedTransactionId(transactionId)}
                >
                  <strong>{getText(transaction, 'title', 'Marketplace transaction')}</strong>
                  <span>
                    {formatStatus(status)} · escrow {formatStatus(escrowStatus)}
                  </span>
                  <small>{getMoney(transaction, 'amount')}</small>
                </button>
              );
            })}
          </div>

          {selectedTransaction ? (
            <form className="contract-rent-form inline-review-form" onSubmit={handleUpdateTransaction}>
              <label>
                Transaction status
                <select name="status" value={transactionReviewForm.status} onChange={handleTransactionReviewField}>
                  {transactionStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Escrow status
                <select name="escrowStatus" value={transactionReviewForm.escrowStatus} onChange={handleTransactionReviewField}>
                  {escrowStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Audit message
                <textarea name="message" value={transactionReviewForm.message} onChange={handleTransactionReviewField} />
              </label>

              <button className="button-link button-link--secondary" type="submit" disabled={saving === 'transaction-review'}>
                {saving === 'transaction-review' ? 'Saving…' : 'Update transaction'}
              </button>

              <div className="transaction-audit-list">
                {getRecords(selectedTransaction, 'auditEvents').slice(0, 4).map((event) => (
                  <p key={getText(event, 'id')} className="trust-note">
                    {getText(event, 'type', 'EVENT')}: {getText(event, 'message', 'Transaction updated.')}
                  </p>
                ))}
              </div>
            </form>
          ) : (
            <p className="trust-note">Select a transaction workflow to update status.</p>
          )}
        </section>
      </div>

      <section className="stage8-tool-card">
        <div className="details-section-heading">
          <p className="eyebrow">Valuation review</p>
          <h4>Admin estimate review</h4>
        </div>

        <div className="transaction-valuation-grid">
          <div className="stage8-operations-list">
            {valuations.slice(0, 8).map((valuation) => {
              const valuationId = getText(valuation, 'id', '');
              const reviewStatus = getText(valuation, 'reviewStatus', 'PENDING');

              return (
                <button
                  key={valuationId}
                  type="button"
                  className={`contract-registration-row ${selectedValuationId === valuationId ? 'active' : ''}`}
                  onClick={() => setSelectedValuationId(valuationId)}
                >
                  <strong>
                    {getText(valuation, 'location', 'Location')} · {getText(valuation, 'propertyType', 'Property')}
                  </strong>
                  <span>
                    {formatStatus(reviewStatus)} · {getEstimate(valuation)}
                  </span>
                  <small>Confidence {getText(valuation, 'confidence', 'LOW_DATA')}</small>
                </button>
              );
            })}
          </div>

          {selectedValuation ? (
            <form className="contract-rent-form" onSubmit={handleUpdateValuation}>
              <p className="trust-note">
                Estimate: {getEstimate(selectedValuation)} · Confidence {getText(selectedValuation, 'confidence', 'LOW_DATA')}
              </p>

              <label>
                Review status
                <select name="reviewStatus" value={valuationReviewForm.reviewStatus} onChange={handleValuationReviewField}>
                  {valuationReviewStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Review notes
                <textarea name="reviewNotes" value={valuationReviewForm.reviewNotes} onChange={handleValuationReviewField} />
              </label>

              <button className="button-link button-link--primary" type="submit" disabled={saving === 'valuation-review'}>
                {saving === 'valuation-review' ? 'Saving…' : 'Update valuation review'}
              </button>
            </form>
          ) : (
            <p className="trust-note">Select a valuation request to review.</p>
          )}
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

import { type JsonRecord } from '../api/saved';
import { createValuation, type CreateValuationPayload } from '../api/valuations';

type TransactionValuationWorkspaceProps = {
  token: string | null;
  transactions: JsonRecord[];
  valuations: JsonRecord[];
};

const valuationInitialState = {
  location: '',
  propertyType: '',
  sqm: '',
  beds: '',
  baths: '',
  askingPrice: '',
  rentEstimate: '',
  currency: 'OMR',
  listingId: ''
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
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

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

function statusClass(status: string) {
  if (
    status.includes('APPROVED') ||
    status.includes('COMPLETED') ||
    status.includes('RELEASED') ||
    status.includes('READY')
  ) {
    return 'approved';
  }

  if (
    status.includes('REJECTED') ||
    status.includes('DISPUTED') ||
    status.includes('CANCELLED') ||
    status.includes('LOW_DATA')
  ) {
    return 'rejected';
  }

  return 'pending';
}

function getEstimate(valuation: JsonRecord) {
  const low = getMoney(valuation, 'estimateLow');
  const high = getMoney(valuation, 'estimateHigh');

  if (low === '—' || high === '—') return 'More data needed';

  return `${low} - ${high}`;
}

function toOptionalNumber(value: string) {
  if (!value.trim()) return undefined;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildValuationPayload(form: typeof valuationInitialState): CreateValuationPayload {
  return {
    location: form.location.trim(),
    propertyType: form.propertyType.trim() || undefined,
    sqm: toOptionalNumber(form.sqm),
    beds: toOptionalNumber(form.beds),
    baths: toOptionalNumber(form.baths),
    askingPrice: toOptionalNumber(form.askingPrice),
    rentEstimate: toOptionalNumber(form.rentEstimate),
    currency: form.currency.trim() || 'OMR',
    listingId: form.listingId.trim() || undefined
  };
}

export default function TransactionValuationWorkspace({
  token,
  transactions: initialTransactions,
  valuations: initialValuations
}: TransactionValuationWorkspaceProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [valuations, setValuations] = useState(initialValuations);
  const [valuationForm, setValuationForm] = useState(valuationInitialState);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  useEffect(() => {
    setValuations(initialValuations);
  }, [initialValuations]);

  function handleValuationField(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setValuationForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleCreateValuation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || saving) return;

    try {
      setSaving(true);
      setMessage('');
      setError('');

      const response = await createValuation(buildValuationPayload(valuationForm), token);

      setValuations((current) => [response.valuation, ...current]);
      setValuationForm(valuationInitialState);
      setMessage('Valuation request created. Estimates are based only on available lux.om listing data.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not create this valuation request. Check location and numeric fields.');
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <section className="stage8-dashboard-section transaction-valuation-workspace">
      <div className="details-section-heading">
        <p className="eyebrow">8.9 / 8.11 Transactions and valuation</p>
        <h3>Escrow-ready workflows and market range requests</h3>
        <p>
          These tools prepare transaction and valuation workflows. They do not
          activate live escrow, official appraisal, or external funds handling.
        </p>
      </div>

      {message ? <div className="form-success">{message}</div> : null}
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="transaction-valuation-grid">
        <form className="stage8-tool-card contract-rent-form" onSubmit={handleCreateValuation}>
          <div>
            <p className="eyebrow">Valuation request</p>
            <h4>Request estimated market range</h4>
            <p>
              Uses comparable lux.om listing data only. It is not a formal
              appraisal and should not be treated as financial advice.
            </p>
          </div>

          <label>
            Location
            <input
              name="location"
              value={valuationForm.location}
              onChange={handleValuationField}
              required
              placeholder="Al Mouj"
            />
          </label>

          <div className="form-grid three">
            <label>
              Property type
              <input
                name="propertyType"
                value={valuationForm.propertyType}
                onChange={handleValuationField}
                placeholder="Villa"
              />
            </label>

            <label>
              Size sqm
              <input
                name="sqm"
                type="number"
                min="1"
                value={valuationForm.sqm}
                onChange={handleValuationField}
              />
            </label>

            <label>
              Currency
              <input
                name="currency"
                value={valuationForm.currency}
                onChange={handleValuationField}
              />
            </label>

            <label>
              Beds
              <input
                name="beds"
                type="number"
                min="0"
                value={valuationForm.beds}
                onChange={handleValuationField}
              />
            </label>

            <label>
              Baths
              <input
                name="baths"
                type="number"
                min="0"
                value={valuationForm.baths}
                onChange={handleValuationField}
              />
            </label>

            <label>
              Asking price
              <input
                name="askingPrice"
                type="number"
                min="0"
                step="0.001"
                value={valuationForm.askingPrice}
                onChange={handleValuationField}
              />
            </label>

            <label>
              Rent estimate
              <input
                name="rentEstimate"
                type="number"
                min="0"
                step="0.001"
                value={valuationForm.rentEstimate}
                onChange={handleValuationField}
              />
            </label>

            <label>
              Optional listing ID
              <input
                name="listingId"
                value={valuationForm.listingId}
                onChange={handleValuationField}
              />
            </label>
          </div>

          <button className="button-link button-link--primary" type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create valuation request'}
          </button>
        </form>

        <section className="stage8-tool-card">
          <div className="details-section-heading">
            <p className="eyebrow">Marketplace transactions</p>
            <h4>Escrow-ready status</h4>
            <p>
              Funds handling requires an approved escrow/payment provider.
              lux.om currently stores transaction readiness, audit events, and
              manual admin status.
            </p>
          </div>

          {transactions.length ? (
            <div className="stage8-dashboard-list compact">
              {transactions.slice(0, 6).map((transaction) => {
                const status = getText(transaction, 'status', 'DRAFT');
                const escrowStatus = getText(transaction, 'escrowStatus', 'NOT_STARTED');
                const auditEvents = getRecords(transaction, 'auditEvents');

                return (
                  <article key={getText(transaction, 'id')} className="stage8-dashboard-mini-card">
                    <span className={`status-pill ${statusClass(status)}`}>{formatStatus(status)}</span>
                    <strong>{getText(transaction, 'title', 'Marketplace transaction')}</strong>
                    <p>
                      {getText(transaction, 'type', 'OTHER')} · {getMoney(transaction, 'amount')} · Escrow {formatStatus(escrowStatus)}
                    </p>
                    {auditEvents[0] ? (
                      <p className="trust-note">
                        Latest update: {getText(auditEvents[0], 'message', 'Transaction updated.')}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="trust-note">
              No transaction workflows yet. Admins can create escrow-ready
              transaction records when a deal reaches manual review.
            </p>
          )}
        </section>
      </div>

      <section className="stage8-tool-card">
        <div className="details-section-heading">
          <p className="eyebrow">Valuation history</p>
          <h4>Your market range requests</h4>
        </div>

        {valuations.length ? (
          <div className="stage8-dashboard-list compact valuation-card-grid">
            {valuations.slice(0, 8).map((valuation) => {
              const status = getText(valuation, 'status', 'REQUESTED');
              const reviewStatus = getText(valuation, 'reviewStatus', 'PENDING');
              const comparables = getValue(valuation, 'comparableSnapshots');
              const comparableCount = Array.isArray(comparables) ? comparables.length : 0;

              return (
                <article key={getText(valuation, 'id')} className="stage8-dashboard-mini-card">
                  <span className={`status-pill ${statusClass(status)}`}>{formatStatus(status)}</span>
                  <strong>
                    {getText(valuation, 'location', 'Location')} · {getText(valuation, 'propertyType', 'Property')}
                  </strong>
                  <p>
                    {getEstimate(valuation)} · Confidence {getText(valuation, 'confidence', 'LOW_DATA')}
                  </p>
                  <p className="trust-note">
                    Review: {formatStatus(reviewStatus)} · Comparables: {comparableCount}
                  </p>
                  {getText(valuation, 'disclaimer', '') ? (
                    <p className="trust-note">{getText(valuation, 'disclaimer')}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="trust-note">No valuation requests yet.</p>
        )}
      </section>
    </section>
  );
}

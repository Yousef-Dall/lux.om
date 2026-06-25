import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import {
  getAdminVerifications,
  updateAdminVerificationReview,
  type JsonRecord
} from '../api/verification';

const statuses = [
  'SUBMITTED',
  'ADMIN_VERIFIED',
  'EXTERNALLY_VERIFIED',
  'REJECTED',
  'EXPIRED'
];

function getText(record: JsonRecord | null | undefined, key: string, fallback = '—') {
  const value = record?.[key];

  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return fallback;
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').toLowerCase();
}

export default function VerificationReviewAdminPanel({ token }: { token: string | null }) {
  const [verifications, setVerifications] = useState<JsonRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({
    status: 'SUBMITTED',
    notes: '',
    expiryDate: ''
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function load() {
      try {
        const response = await getAdminVerifications(token!);

        if (active) setVerifications(response.verifications ?? []);
      } catch (caughtError) {
        console.error(caughtError);
        if (active) setError('Could not load verification queue.');
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  const selected = useMemo(
    () => verifications.find((verification) => getText(verification, 'id', '') === selectedId) ?? null,
    [selectedId, verifications]
  );

  useEffect(() => {
    if (!selected) return;

    setForm({
      status: getText(selected, 'status', 'SUBMITTED'),
      notes: getText(selected, 'notes', ''),
      expiryDate: getText(selected, 'expiryDate', '').slice(0, 10)
    });
  }, [selected]);

  function handleField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedId || saving) return;

    try {
      setSaving(true);
      setMessage('');
      setError('');

      const response = await updateAdminVerificationReview(
        selectedId,
        {
          status: form.status,
          notes: form.notes.trim() || undefined,
          expiryDate: form.expiryDate || null
        },
        token
      );

      setVerifications((current) =>
        current.map((verification) =>
          getText(verification, 'id', '') === selectedId
            ? { ...verification, ...response.verification }
            : verification
        )
      );
      setMessage('Verification status updated and submitter was notified.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not update this verification request.');
    } finally {
      setSaving(false);
    }
  }

  if (!token || !loaded) return null;

  return (
    <div className="stage8-operations-queue verification-admin-panel">
      <div className="details-section-heading">
        <p className="eyebrow">8.12 Verification queue</p>
        <h3>Admin verification review</h3>
        <p>
          Review submitted documents internally. Do not mark external verification
          unless a real official or third-party source has confirmed it.
        </p>
      </div>

      {message ? <div className="form-success">{message}</div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <div className="transaction-valuation-grid">
        <div className="stage8-operations-list">
          {verifications.slice(0, 8).map((verification) => {
            const id = getText(verification, 'id', '');
            const status = getText(verification, 'status', 'SUBMITTED');

            return (
              <button
                key={id}
                className={`contract-registration-row ${selectedId === id ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedId(id)}
              >
                <strong>
                  {getText(verification, 'targetType')} · {getText(verification, 'targetId')}
                </strong>
                <span>{formatStatus(status)}</span>
                <small>{getText(verification, 'source', 'OWNER_DOCUMENT_SUBMISSION')}</small>
              </button>
            );
          })}
        </div>

        {selected ? (
          <form className="stage8-tool-card contract-rent-form" onSubmit={handleSubmit}>
            <label>
              Status
              <select name="status" value={form.status} onChange={handleField}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Expiry date
              <input name="expiryDate" type="date" value={form.expiryDate} onChange={handleField} />
            </label>

            <label>
              Review notes
              <textarea name="notes" value={form.notes} onChange={handleField} />
            </label>

            <button className="button-link button-link--primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Update verification'}
            </button>
          </form>
        ) : (
          <p className="trust-note">Select a verification request to review.</p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import {
  getAdminReviews,
  updateAdminReviewModeration,
  type JsonRecord
} from '../api/reviews';

const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'];

function getText(record: JsonRecord | null | undefined, key: string, fallback = '—') {
  const value = record?.[key];

  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return fallback;
}

function getNestedText(record: JsonRecord | null | undefined, key: string, nestedKey: string) {
  const value = record?.[key];

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return getText(value as JsonRecord, nestedKey, '');
  }

  return '';
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').toLowerCase();
}

export default function ReviewModerationAdminPanel({ token }: { token: string | null }) {
  const [reviews, setReviews] = useState<JsonRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({
    status: 'PENDING',
    moderationNotes: ''
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
        const response = await getAdminReviews(token!);

        if (active) setReviews(response.reviews ?? []);
      } catch (caughtError) {
        console.error(caughtError);
        if (active) setError('Could not load review moderation queue.');
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
    () => reviews.find((review) => getText(review, 'id', '') === selectedId) ?? null,
    [reviews, selectedId]
  );

  useEffect(() => {
    if (!selected) return;

    setForm({
      status: getText(selected, 'status', 'PENDING'),
      moderationNotes: getText(selected, 'moderationNotes', '')
    });
  }, [selected]);

  function handleField(event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) {
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

      const response = await updateAdminReviewModeration(
        selectedId,
        {
          status: form.status,
          moderationNotes: form.moderationNotes.trim() || undefined
        },
        token
      );

      setReviews((current) =>
        current.map((review) =>
          getText(review, 'id', '') === selectedId
            ? { ...review, ...response.review }
            : review
        )
      );
      setMessage('Review moderation status updated.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not update this review.');
    } finally {
      setSaving(false);
    }
  }

  if (!token || !loaded) return null;

  return (
    <div className="stage8-operations-queue review-moderation-admin">
      <div className="details-section-heading">
        <p className="eyebrow">8.14 Review moderation</p>
        <h3>Approved-only review workflow</h3>
        <p>
          Public pages display approved reviews only. Pending or rejected reviews
          remain hidden until moderated.
        </p>
      </div>

      {message ? <div className="form-success">{message}</div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <div className="transaction-valuation-grid">
        <div className="stage8-operations-list">
          {reviews.slice(0, 8).map((review) => {
            const id = getText(review, 'id', '');
            const status = getText(review, 'status', 'PENDING');

            return (
              <button
                key={id}
                className={`contract-registration-row ${selectedId === id ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedId(id)}
              >
                <strong>
                  {getText(review, 'targetType')} · Rating {getText(review, 'rating')}
                </strong>
                <span>{formatStatus(status)}</span>
                <small>
                  {getNestedText(review, 'reviewer', 'name') ||
                    getNestedText(review, 'reviewer', 'email') ||
                    'Reviewer'}
                </small>
              </button>
            );
          })}
        </div>

        {selected ? (
          <form className="stage8-tool-card contract-rent-form" onSubmit={handleSubmit}>
            <p className="trust-note">
              {getText(selected, 'body', 'No review body provided.')}
            </p>

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
              Moderation notes
              <textarea name="moderationNotes" value={form.moderationNotes} onChange={handleField} />
            </label>

            <button className="button-link button-link--primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Update review'}
            </button>
          </form>
        ) : (
          <p className="trust-note">Select a review to moderate.</p>
        )}
      </div>
    </div>
  );
}

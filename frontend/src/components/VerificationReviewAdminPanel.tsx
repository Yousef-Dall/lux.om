import {
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  getAdminVerifications,
  updateAdminVerificationReview,
  type VerificationRecord,
  type VerificationSource,
  type VerificationStatus,
  type VerificationTargetType
} from '../api/verification';

const verificationStatuses: VerificationStatus[] = [
  'SUBMITTED',
  'ADMIN_VERIFIED',
  'EXTERNALLY_VERIFIED',
  'REJECTED',
  'EXPIRED',
  'UNVERIFIED'
];

const statusFilterOptions: Array<'ALL' | VerificationStatus> = [
  'ALL',
  ...verificationStatuses
];

const sourceFilterOptions: Array<'ALL' | VerificationSource> = [
  'ALL',
  'OWNER_DOCUMENT_SUBMISSION',
  'LUX_OM_ADMIN_REVIEW',
  'FUTURE_MOLUP_API',
  'FUTURE_MUNICIPALITY_REGISTRATION',
  'FUTURE_THIRD_PARTY_PROVIDER'
];

const targetFilterOptions: Array<'ALL' | VerificationTargetType> = [
  'ALL',
  'LISTING',
  'ACTIVITY',
  'DEVELOPER',
  'TRAVEL_AGENCY',
  'USER',
  'CONTRACT',
  'TRANSACTION'
];

function label(value: string) {
  return value
    .replace(/^FUTURE_/, 'Future ')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClass(status: VerificationStatus) {
  if (status === 'ADMIN_VERIFIED' || status === 'EXTERNALLY_VERIFIED') {
    return 'approved';
  }

  if (status === 'REJECTED' || status === 'EXPIRED') {
    return 'rejected';
  }

  return 'pending';
}

function getStatusIcon(status: VerificationStatus) {
  if (status === 'ADMIN_VERIFIED' || status === 'EXTERNALLY_VERIFIED') {
    return <CheckCircle2 size={14} aria-hidden="true" />;
  }

  if (status === 'REJECTED' || status === 'EXPIRED') {
    return <XCircle size={14} aria-hidden="true" />;
  }

  return <Clock3 size={14} aria-hidden="true" />;
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toDateInputValue(value?: string | null) {
  if (!value) return '';

  return new Date(value).toISOString().slice(0, 10);
}

function getActorLabel(actor?: { name?: string; email?: string } | null) {
  if (!actor) return '—';

  return actor.name || actor.email || '—';
}

function getChecklistEntries(value: unknown) {
  if (!value || typeof value !== 'object') return [];

  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      key: `item-${index + 1}`,
      label: `Checklist item ${index + 1}`,
      value: item
    }));
  }

  return Object.entries(value as Record<string, unknown>).map(([key, item]) => ({
    key,
    label: label(key),
    value: item
  }));
}

function stringifyChecklistValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Provided' : 'Missing';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value === null || value === undefined) return '—';

  return JSON.stringify(value);
}

function getRiskWarning(record: VerificationRecord | null, nextStatus: VerificationStatus) {
  if (!record) return '';

  if (nextStatus === 'EXTERNALLY_VERIFIED') {
    return 'Only use external verification after a real official, municipality, or approved third-party source has confirmed the record.';
  }

  if (
    nextStatus === 'ADMIN_VERIFIED' &&
    record.source !== 'OWNER_DOCUMENT_SUBMISSION' &&
    record.source !== 'LUX_OM_ADMIN_REVIEW'
  ) {
    return 'This request came from a future integration source. Confirm manually before marking it verified.';
  }

  if (nextStatus === 'REJECTED') {
    return 'Write a clear rejection note so the submitter knows what to correct.';
  }

  return '';
}

export default function VerificationReviewAdminPanel({ token }: { token: string | null }) {
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VerificationStatus>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | VerificationSource>('ALL');
  const [targetFilter, setTargetFilter] = useState<'ALL' | VerificationTargetType>('ALL');
  const [search, setSearch] = useState('');

  const [reviewStatus, setReviewStatus] = useState<VerificationStatus>('SUBMITTED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyingId, setCopyingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadVerifications() {
    if (!token) return;

    try {
      setLoading(true);
      setError('');

      const response = await getAdminVerifications(token);
      setVerifications(response.verifications ?? []);

      if (!selectedId && response.verifications?.[0]) {
        setSelectedId(response.verifications[0].id);
      }
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not load verification queue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVerifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredVerifications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return verifications.filter((verification) => {
      if (statusFilter !== 'ALL' && verification.status !== statusFilter) {
        return false;
      }

      if (sourceFilter !== 'ALL' && verification.source !== sourceFilter) {
        return false;
      }

      if (targetFilter !== 'ALL' && verification.targetType !== targetFilter) {
        return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        verification.id,
        verification.targetType,
        verification.targetId,
        verification.status,
        verification.source,
        verification.notes,
        verification.submittedBy?.name,
        verification.submittedBy?.email,
        verification.reviewedBy?.name,
        verification.reviewedBy?.email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [search, sourceFilter, statusFilter, targetFilter, verifications]);

  const selected = useMemo(
    () =>
      verifications.find((verification) => verification.id === selectedId) ??
      filteredVerifications[0] ??
      null,
    [filteredVerifications, selectedId, verifications]
  );

  const summary = useMemo(() => {
    return verifications.reduce(
      (accumulator, verification) => {
        accumulator.total += 1;

        if (verification.status === 'SUBMITTED') accumulator.pending += 1;
        if (
          verification.status === 'ADMIN_VERIFIED' ||
          verification.status === 'EXTERNALLY_VERIFIED'
        ) {
          accumulator.verified += 1;
        }

        if (verification.status === 'REJECTED') accumulator.rejected += 1;
        if (verification.status === 'EXPIRED') accumulator.expired += 1;

        return accumulator;
      },
      {
        total: 0,
        pending: 0,
        verified: 0,
        rejected: 0,
        expired: 0
      }
    );
  }, [verifications]);

  const checklistEntries = useMemo(
    () => getChecklistEntries(selected?.documentChecklist),
    [selected?.documentChecklist]
  );

  useEffect(() => {
    if (!selected) return;

    setSelectedId(selected.id);
    setReviewStatus(selected.status);
    setReviewNotes(selected.notes ?? '');
    setExpiryDate(toDateInputValue(selected.expiryDate));
    setMessage('');
    setError('');
  }, [selected]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (filteredVerifications[0]) {
      setSelectedId(filteredVerifications[0].id);
    }
  }

  async function handleCopyTargetId(targetId: string) {
    try {
      setCopyingId(targetId);
      await navigator.clipboard.writeText(targetId);
      setMessage('Target ID copied.');
    } catch {
      setError('Could not copy target ID.');
    } finally {
      setCopyingId('');
    }
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected || !token) return;

    if (
      (reviewStatus === 'REJECTED' || reviewStatus === 'EXTERNALLY_VERIFIED') &&
      reviewNotes.trim().length < 12
    ) {
      setError('Add a clear note before saving this verification decision.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const payload: {
        status: VerificationStatus;
        notes?: string;
        expiryDate?: string;
      } = {
        status: reviewStatus,
        notes: reviewNotes.trim() || undefined
      };

      if (expiryDate) {
        payload.expiryDate = new Date(`${expiryDate}T00:00:00.000Z`).toISOString();
      }

      await updateAdminVerificationReview(selected.id, payload, token);

      await loadVerifications();
      setMessage('Verification status updated and submitter was notified.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not update this verification request.');
    } finally {
      setSaving(false);
    }
  }

  const riskWarning = getRiskWarning(selected, reviewStatus);

  return (
    <div className="stage8-operations-queue verification-admin-panel verification-admin-panel--polished">
      <div className="verification-admin-panel__heading">
        <div>
          <p className="eyebrow">8.12 Verification queue</p>
          <h3>Admin verification review</h3>
          <p>
            Review submitted documents internally. Do not mark external verification
            unless a real official or third-party source has confirmed it.
          </p>
        </div>

        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void loadVerifications()}
          disabled={loading}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="verification-admin-summary">
        <article>
          <span>Total</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <span>Submitted</span>
          <strong>{summary.pending}</strong>
        </article>
        <article>
          <span>Verified</span>
          <strong>{summary.verified}</strong>
        </article>
        <article>
          <span>Rejected</span>
          <strong>{summary.rejected}</strong>
        </article>
        <article>
          <span>Expired</span>
          <strong>{summary.expired}</strong>
        </article>
      </div>

      <form className="verification-admin-filters" onSubmit={handleFilterSubmit}>
        <label className="verification-admin-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search ID, target, submitter, or notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          <Filter size={15} aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | VerificationStatus)}
          >
            {statusFilterOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All statuses' : label(option)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <select
            value={targetFilter}
            onChange={(event) => setTargetFilter(event.target.value as 'ALL' | VerificationTargetType)}
          >
            {targetFilterOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All targets' : label(option)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as 'ALL' | VerificationSource)}
          >
            {sourceFilterOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All sources' : label(option)}
              </option>
            ))}
          </select>
        </label>
      </form>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}

      <div className="verification-admin-layout">
        <div className="verification-admin-list" aria-label="Verification requests">
          {loading ? (
            <p className="trust-note">Loading verification queue...</p>
          ) : filteredVerifications.length === 0 ? (
            <p className="trust-note">No verification requests match these filters.</p>
          ) : (
            filteredVerifications.slice(0, 40).map((verification) => (
              <button
                className={`verification-admin-card ${
                  verification.id === selected?.id ? 'verification-admin-card--active' : ''
                }`}
                type="button"
                key={verification.id}
                onClick={() => setSelectedId(verification.id)}
              >
                <span className={`status-pill ${getStatusClass(verification.status)}`}>
                  {getStatusIcon(verification.status)}
                  {label(verification.status)}
                </span>

                <strong>
                  {label(verification.targetType)} · {verification.targetId}
                </strong>

                <small>{label(verification.source)}</small>

                <span>
                  Submitted by {getActorLabel(verification.submittedBy)} ·{' '}
                  {formatDate(verification.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="verification-admin-detail">
          {!selected ? (
            <p className="trust-note">Select a verification request to review.</p>
          ) : (
            <>
              <div className="verification-admin-detail__header">
                <div>
                  <p className="eyebrow">{label(selected.targetType)} verification</p>
                  <h4>{selected.targetId}</h4>
                  <p>
                    Submitted {formatDate(selected.createdAt)} by{' '}
                    {getActorLabel(selected.submittedBy)}
                  </p>
                </div>

                <span className={`status-pill ${getStatusClass(selected.status)}`}>
                  {getStatusIcon(selected.status)}
                  {label(selected.status)}
                </span>
              </div>

              <div className="verification-admin-meta-grid">
                <article>
                  <ShieldCheck size={17} aria-hidden="true" />
                  <span>Source</span>
                  <strong>{label(selected.source)}</strong>
                </article>

                <article>
                  <FileText size={17} aria-hidden="true" />
                  <span>Record ID</span>
                  <strong>{selected.id}</strong>
                </article>

                <article>
                  <Clock3 size={17} aria-hidden="true" />
                  <span>Reviewed</span>
                  <strong>{formatDate(selected.verificationDate)}</strong>
                </article>

                <article>
                  <ShieldAlert size={17} aria-hidden="true" />
                  <span>Expiry</span>
                  <strong>{formatDate(selected.expiryDate)}</strong>
                </article>
              </div>

              <div className="verification-admin-target">
                <div>
                  <span>Target ID</span>
                  <strong>{selected.targetId}</strong>
                </div>

                <button
                  className="button-link button-link--ghost"
                  type="button"
                  onClick={() => void handleCopyTargetId(selected.targetId)}
                  disabled={copyingId === selected.targetId}
                >
                  <Copy size={15} aria-hidden="true" />
                  Copy ID
                </button>
              </div>

              <div className="verification-admin-review-note">
                <h4>Current notes</h4>
                <p>{selected.notes || 'No notes were stored for this request.'}</p>
              </div>

              <div className="verification-admin-checklist">
                <h4>Document checklist</h4>

                {checklistEntries.length === 0 ? (
                  <p className="trust-note">
                    No structured checklist was submitted with this request.
                  </p>
                ) : (
                  <ul>
                    {checklistEntries.map((item) => (
                      <li key={item.key}>
                        <FileCheck2 size={15} aria-hidden="true" />
                        <span>{item.label}</span>
                        <strong>{stringifyChecklistValue(item.value)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selected.reviewedBy ? (
                <p className="trust-note">
                  Last reviewed by {getActorLabel(selected.reviewedBy)} ·{' '}
                  {formatDate(selected.updatedAt)}
                </p>
              ) : null}

              <form className="verification-admin-review-form" onSubmit={handleReviewSubmit}>
                <label>
                  Decision
                  <select
                    value={reviewStatus}
                    onChange={(event) => setReviewStatus(event.target.value as VerificationStatus)}
                  >
                    {verificationStatuses.map((status) => (
                      <option key={status} value={status}>
                        {label(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Expiry date
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(event) => setExpiryDate(event.target.value)}
                  />
                </label>

                <label className="verification-admin-notes">
                  Review notes
                  <textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    rows={5}
                    placeholder="Summarize what was checked, what is missing, or why this decision is safe."
                  />
                </label>

                {riskWarning ? (
                  <p className="verification-admin-risk">
                    <ShieldAlert size={16} aria-hidden="true" />
                    {riskWarning}
                  </p>
                ) : null}

                <button className="button-link button-link--primary" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Update verification'}
                </button>

                <a
                  className="button-link button-link--secondary"
                  href={`/admin/users?query=${encodeURIComponent(selected.submittedBy?.email ?? '')}`}
                >
                  <ExternalLink size={15} aria-hidden="true" />
                  Open submitter in user management
                </a>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getAdminContractDrafts, type JsonRecord } from '../api/contracts';
import { getMarketInsights, refreshMarketInsightSnapshots } from '../api/marketInsights';
import {
  getAdminMediaQualityQueue,
  updateAdminMediaQualityItem,
  type AdminMediaQualityItem,
  type AdminMediaQualityStatus,
  type UpdateAdminMediaQualityPayload
} from '../api/mediaQuality';
import {
  getAdminReports,
  updateAdminReportStatus,
  type ModerationStatus
} from '../api/reports';
import { getAdminReviews } from '../api/reviews';
import { getAdminMarketplaceTransactions } from '../api/transactions';
import { getAdminValuations } from '../api/valuations';
import { getAdminVerifications } from '../api/verification';
import ContractRegistrationAdminPanel from './ContractRegistrationAdminPanel';
import TransactionValuationAdminPanel from './TransactionValuationAdminPanel';
import VerificationReviewAdminPanel from './VerificationReviewAdminPanel';
import ReviewModerationAdminPanel from './ReviewModerationAdminPanel';

function count(value?: JsonRecord[] | null) {
  return value?.length ?? 0;
}

function getText(record: JsonRecord, key: string, fallback = '—') {
  const value = record[key];

  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return String(value);

  return fallback;
}

function getDate(record: JsonRecord, key: string) {
  const value = record[key];

  if (typeof value !== 'string') return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

const activeMediaQueueStatuses = new Set<AdminMediaQualityStatus>([
  'NOT_CHECKED',
  'NEEDS_REVIEW',
  'BLOCKED'
]);

const mediaQualityStatusOptions: AdminMediaQualityStatus[] = [
  'NOT_CHECKED',
  'NEEDS_REVIEW',
  'ACCEPTABLE',
  'EXCELLENT',
  'BLOCKED'
];

function isActiveMediaQueueItem(item: AdminMediaQualityItem) {
  return activeMediaQueueStatuses.has(item.mediaQualityStatus);
}

function getMediaQueueKey(item: AdminMediaQualityItem) {
  return `${item.itemType}-${item.id}`;
}

function getMediaItemPath(item: AdminMediaQualityItem) {
  return item.publicPath || (item.itemType === 'ACTIVITY' ? `/activities/${item.slug}` : `/listings/${item.slug}`);
}

function formatMediaStatus(value: string) {
  return value.replace(/_/g, ' ').toLowerCase();
}

function getReportPriority(status: string) {
  if (status === 'PENDING') return 0;
  if (status === 'UNDER_REVIEW') return 1;

  return 2;
}

export default function Stage8AdminCommandCenter({
  token
}: {
  token: string | null;
}) {
  const [summary, setSummary] = useState({
    contracts: 0,
    verifications: 0,
    reports: 0,
    reviews: 0,
    transactions: 0,
    valuations: 0,
    mediaQuality: 0,
    insights: 0
  });
  const [reports, setReports] = useState<JsonRecord[]>([]);
  const [mediaQueue, setMediaQueue] = useState<AdminMediaQualityItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [updatingReportId, setUpdatingReportId] = useState('');
  const [updatingMediaItemId, setUpdatingMediaItemId] = useState('');
  const [mediaNotesById, setMediaNotesById] = useState<Record<string, string>>({});
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [insightsMessage, setInsightsMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function load() {
      try {
        setLoadError('');

          const [
            contracts,
            verifications,
            reportResponse,
            reviews,
            transactions,
            valuations,
            insights,
            mediaQualityResponse
          ] = await Promise.all([
            getAdminContractDrafts(token!),
            getAdminVerifications(token!),
            getAdminReports(token!),
            getAdminReviews(token!),
            getAdminMarketplaceTransactions(token!),
            getAdminValuations(token!),
            getMarketInsights(),
            getAdminMediaQualityQueue(token!, { take: 12 })
          ]);

        if (!active) return;

          const mediaItems = mediaQualityResponse.items ?? [];
          const mediaNotes = Object.fromEntries(
            mediaItems.map((item) => [getMediaQueueKey(item), item.mediaQualityNotes ?? ''])
          );

        setReports(reportResponse.reports ?? []);
        setMediaQueue(mediaItems.slice(0, 8));
          setMediaNotesById(mediaNotes);
        setSummary({
          contracts: count(contracts.contracts),
          verifications: count(verifications.verifications),
          reports: count(reportResponse.reports),
          reviews: count(reviews.reviews),
          transactions: count(transactions.transactions),
          valuations: count(valuations.valuations),
            mediaQuality: mediaQualityResponse.total ?? mediaItems.length,
          insights: count(insights.insights)
        });
      } catch (error) {
        console.error(error);

        if (!active) return;
        setLoadError('Could not load the Stage 8 operations queues.');
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  const activeReports = useMemo(
    () =>
      [...reports]
        .sort((first, second) => {
          const firstStatus = getText(first, 'status', 'PENDING');
          const secondStatus = getText(second, 'status', 'PENDING');

          return getReportPriority(firstStatus) - getReportPriority(secondStatus);
        })
        .filter((report) => {
          const status = getText(report, 'status', 'PENDING');

          return status === 'PENDING' || status === 'UNDER_REVIEW';
        })
        .slice(0, 5),
    [reports]
  );

  async function handleReportStatus(reportId: string, status: ModerationStatus) {
    if (!token || updatingReportId) return;

    try {
      setUpdatingReportId(reportId);

      const response = await updateAdminReportStatus(
        reportId,
        {
          status
        },
        token
      );

      setReports((currentReports) =>
        currentReports.map((report) =>
          getText(report, 'id') === reportId ? response.report : report
        )
      );
    } catch (error) {
      console.error(error);
      setLoadError('Could not update this report status.');
    } finally {
      setUpdatingReportId('');
    }
  }


  async function handleUpdateMediaQuality(
    item: AdminMediaQualityItem,
    payload: UpdateAdminMediaQualityPayload
  ) {
    if (!token || updatingMediaItemId) return;

    const itemKey = getMediaQueueKey(item);

    try {
      setUpdatingMediaItemId(itemKey);
      setLoadError('');

      const response = await updateAdminMediaQualityItem(
        token,
        item.itemType,
        item.id,
        payload
      );
      const nextItem = response.item;
      const nextItemKey = getMediaQueueKey(nextItem);
      const shouldRemoveFromActiveQueue = !isActiveMediaQueueItem(nextItem);

      setMediaQueue((currentItems) => {
        if (shouldRemoveFromActiveQueue) {
          return currentItems.filter(
            (currentItem) => getMediaQueueKey(currentItem) !== itemKey
          );
        }

        return currentItems.map((currentItem) =>
          getMediaQueueKey(currentItem) === itemKey ? nextItem : currentItem
        );
      });

      if (shouldRemoveFromActiveQueue) {
        setSummary((current) => ({
          ...current,
          mediaQuality: Math.max(0, current.mediaQuality - 1)
        }));
      }

      setMediaNotesById((currentNotes) => ({
        ...currentNotes,
        [nextItemKey]: nextItem.mediaQualityNotes ?? ''
      }));
    } catch (error) {
      console.error(error);
      setLoadError('Could not update this media quality item.');
    } finally {
      setUpdatingMediaItemId('');
    }
  }

  async function handleRefreshMarketInsights() {
    if (!token || refreshingInsights) return;

    try {
      setRefreshingInsights(true);
      setInsightsMessage('');
      setLoadError('');

      const response = await refreshMarketInsightSnapshots(token);

      setSummary((current) => ({
        ...current,
        insights: response.count ?? count(response.snapshots)
      }));
      setInsightsMessage(
        `Market insight snapshots refreshed: ${response.count ?? count(response.snapshots)} locations.`
      );
    } catch (error) {
      console.error(error);
      setLoadError('Could not refresh market insight snapshots.');
    } finally {
      setRefreshingInsights(false);
    }
  }

  if (!token || !loaded) return null;

  const items = [
    ['Contract drafts', summary.contracts],
    ['Verification queue', summary.verifications],
    ['Reports/moderation', summary.reports],
    ['Review moderation', summary.reviews],
    ['Transactions', summary.transactions],
    ['Valuation review', summary.valuations],
      ['Media quality operations', summary.mediaQuality],
    ['Market insight locations', summary.insights]
  ] as const;

  return (
    <section
      className="stage8-operations-panel stage8-operations-panel--admin"
      aria-labelledby="stage8-admin-title"
    >
      <div>
        <p className="eyebrow">Operations command center</p>
        <h2 id="stage8-admin-title">
          Verification, safety, contracts, reviews, and transactions
        </h2>
        <p>
          Monitor marketplace operations, review queues, and integration-ready
          workflows. Government, escrow, AI, and external verification services
          require approved provider access before activation.
        </p>
      </div>

      {loadError ? (
        <div className="form-error" role="alert">
          {loadError}
        </div>
      ) : null}

      <div className="stage8-operations-grid">
        {items.map(([label, value]) => (
          <article key={label} className="stage8-operations-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="stage8-insight-refresh-card">
        <div>
          <p className="eyebrow">8.10 Market insights</p>
          <h3>Refresh market insight snapshots</h3>
          <p>
            Rebuilds conservative asking-price and rental-yield snapshots from
            approved lux.om listing data. These remain internal market signals,
            not formal valuations.
          </p>
          {insightsMessage ? (
            <p className="form-success" role="status" aria-live="polite">
              {insightsMessage}
            </p>
          ) : null}
        </div>

        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void handleRefreshMarketInsights()}
          disabled={refreshingInsights}
        >
          {refreshingInsights ? 'Refreshing…' : 'Refresh insights'}
        </button>
      </div>

      <div className="stage8-operations-queue media-quality-admin-queue">
        <div className="details-section-heading">
          <p className="eyebrow">8.3 Media quality</p>
          <h3>Media quality operations queue</h3>
          <p>
            Review and update listing/activity media readiness using the real
            admin media-quality workflow.
          </p>
        </div>

        {mediaQueue.length ? (
            <div className="stage8-operations-list">
              {mediaQueue.map((item) => {
                const itemKey = getMediaQueueKey(item);
                const path = getMediaItemPath(item);
                const notes = mediaNotesById[itemKey] ?? item.mediaQualityNotes ?? '';
                const isUpdating = updatingMediaItemId === itemKey;

                return (
                  <article key={itemKey} className="stage8-operations-row">
                    <div>
                      <strong>
                        {item.itemType} · {item.title}
                      </strong>
                      <span>
                        Quality: {formatMediaStatus(item.mediaQualityStatus)} · Enhancement: {formatMediaStatus(item.enhancementStatus)}
                      </span>
                      <p>
                        {item.imageCount} image{item.imageCount === 1 ? '' : 's'} · Main image: {item.hasMainImage ? 'yes' : 'missing'} · Video/tour: {item.hasVideoOrTour ? 'yes' : 'missing'}
                        {item.itemType === 'LISTING' ? (
                          <> · Floor plan: {item.hasFloorPlan ? 'yes' : 'missing'}</>
                        ) : null}
                      </p>
                      {item.owner ? (
                        <small>
                          Owner: {item.owner.name || 'Unknown owner'} · {item.owner.email}
                        </small>
                      ) : null}
                    </div>

                    <div className="stage8-operations-actions">
                      <label>
                        Media status
                        <select
                          value={item.mediaQualityStatus}
                          onChange={(event) =>
                            void handleUpdateMediaQuality(item, {
                              mediaQualityStatus: event.target.value as AdminMediaQualityStatus
                            })
                          }
                          disabled={isUpdating}
                        >
                          {mediaQualityStatusOptions.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>
                              {formatMediaStatus(statusOption)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Admin notes
                        <textarea
                          rows={3}
                          value={notes}
                          onChange={(event) =>
                            setMediaNotesById((currentNotes) => ({
                              ...currentNotes,
                              [itemKey]: event.target.value
                            }))
                          }
                          disabled={isUpdating}
                          placeholder="Add a short media review note"
                        />
                      </label>

                      <div className="stage8-operations-actions-row">
                        <button
                          className="button-link button-link--secondary"
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            void handleUpdateMediaQuality(item, {
                              mediaQualityNotes: notes.trim() || null
                            })
                          }
                        >
                          Save notes
                        </button>
                        <button
                          className="button-link button-link--secondary"
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            void handleUpdateMediaQuality(item, {
                              mediaQualityStatus: 'EXCELLENT',
                              mediaQualityNotes: notes.trim() || item.mediaQualityNotes || null
                            })
                          }
                        >
                          Mark excellent
                        </button>
                        <button
                          className="button-link button-link--secondary"
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            void handleUpdateMediaQuality(item, {
                              mediaQualityStatus: 'BLOCKED',
                              mediaQualityNotes: notes.trim() || 'Blocked pending better media.'
                            })
                          }
                        >
                          Block media
                        </button>
                        {path ? (
                          <Link className="button-link button-link--secondary" to={path}>
                            Open item
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="trust-note">
              No public items currently need media quality review.
            </p>
          )}
        </div>

      <ContractRegistrationAdminPanel token={token} />

      <TransactionValuationAdminPanel token={token} />

      <VerificationReviewAdminPanel token={token} />

      <ReviewModerationAdminPanel token={token} />

      <div className="stage8-operations-queue">
        <div className="details-section-heading">
          <p className="eyebrow">Trust & safety</p>
          <h3>Active report queue</h3>
          <p>
            Reports are reviewed manually. Actions here only update internal
            moderation status and do not claim external verification.
          </p>
        </div>

        {activeReports.length ? (
          <div className="stage8-operations-list">
            {activeReports.map((report) => {
              const reportId = getText(report, 'id');
              const status = getText(report, 'status', 'PENDING');

              return (
                <article key={reportId} className="stage8-operations-row">
                  <div>
                    <strong>
                      {getText(report, 'targetType')} ·{' '}
                      {getText(report, 'reason')}
                    </strong>
                    <span>
                      Status: {status} · Submitted {getDate(report, 'createdAt')}
                    </span>
                    {getText(report, 'message', '') ? (
                      <p>{getText(report, 'message', '')}</p>
                    ) : null}
                  </div>

                  <div className="stage8-operations-actions">
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={updatingReportId === reportId}
                      onClick={() =>
                        void handleReportStatus(reportId, 'UNDER_REVIEW')
                      }
                    >
                      Review
                    </button>

                    <button
                      className="button-link button-link--primary"
                      type="button"
                      disabled={updatingReportId === reportId}
                      onClick={() =>
                        void handleReportStatus(reportId, 'RESOLVED')
                      }
                    >
                      Resolve
                    </button>

                    <button
                      className="button-link button-link--ghost"
                      type="button"
                      disabled={updatingReportId === reportId}
                      onClick={() =>
                        void handleReportStatus(reportId, 'DISMISSED')
                      }
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="trust-note">
            No active reports are waiting for moderation.
          </p>
        )}
      </div>
    </section>
  );
}

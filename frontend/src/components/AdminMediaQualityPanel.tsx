import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Image, RefreshCw, ShieldAlert } from 'lucide-react';

import {
  getAdminMediaQualityQueue,
  updateAdminMediaQualityItem,
  type AdminMediaQualityItem,
  type AdminMediaQualityItemType,
  type AdminMediaQualityStatus,
  type AdminMediaQualityWarning,
  type UpdateAdminMediaQualityPayload
} from '../api/mediaQuality';
import { resolveAssetUrl } from '../api/assets';

const itemTypeOptions: Array<AdminMediaQualityItemType | 'ALL'> = [
  'ALL',
  'LISTING',
  'ACTIVITY',
  'PROJECT'
];

const publishStatusOptions = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const;

const mediaQualityStatusOptions: Array<AdminMediaQualityStatus | 'ALL'> = [
  'ALL',
  'NOT_CHECKED',
  'NEEDS_REVIEW',
  'ACCEPTABLE',
  'EXCELLENT',
  'BLOCKED'
];

const warningOptions: Array<AdminMediaQualityWarning | 'ALL'> = [
  'ALL',
  'MISSING_HERO',
  'WEAK_IMAGE_COUNT',
  'MISSING_VIDEO_TOUR',
  'MISSING_FLOOR_PLAN'
];

const warningLabels: Record<AdminMediaQualityWarning, string> = {
  MISSING_HERO: 'Missing hero image',
  WEAK_IMAGE_COUNT: 'Weak image count',
  MISSING_VIDEO_TOUR: 'No video or 360 tour',
  MISSING_FLOOR_PLAN: 'No floor plan / masterplan'
};

function formatLabel(value: string) {
  if (value === 'ALL') return 'All';

  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

function getItemLabel(itemType: AdminMediaQualityItemType) {
  if (itemType === 'PROJECT') return 'Developer project';
  return formatLabel(itemType);
}

function getMediaQueueKey(item: AdminMediaQualityItem) {
  return `${item.itemType}-${item.id}`;
}

function getMediaItemPath(item: AdminMediaQualityItem) {
  if (item.publicPath) return item.publicPath;
  if (item.itemType === 'ACTIVITY') return `/activities/${item.slug}`;
  if (item.itemType === 'PROJECT') return `/developer-projects/${item.slug}`;

  return `/listings/${item.slug}`;
}

function getSuggestedRequestNote(item: AdminMediaQualityItem) {
  const warnings = item.warnings.map((warning) => warningLabels[warning]).join(', ');

  return warnings
    ? `Request better media before premium placement: ${warnings}.`
    : 'Request better media before premium placement.';
}

function getQualityTone(status: AdminMediaQualityStatus) {
  if (status === 'EXCELLENT') return 'approved';
  if (status === 'ACCEPTABLE') return 'pending';
  if (status === 'BLOCKED') return 'rejected';

  return 'pending';
}

export default function AdminMediaQualityPanel({ token }: { token: string | null }) {
  const [itemType, setItemType] = useState<AdminMediaQualityItemType | 'ALL'>('ALL');
  const [publishStatus, setPublishStatus] = useState<(typeof publishStatusOptions)[number]>('ALL');
  const [qualityStatus, setQualityStatus] = useState<AdminMediaQualityStatus | 'ALL'>('ALL');
  const [warning, setWarning] = useState<AdminMediaQualityWarning | 'ALL'>('ALL');
  const [items, setItems] = useState<AdminMediaQualityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingItemKey, setUpdatingItemKey] = useState('');
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const counts = useMemo(
    () => ({
      missingHero: items.filter((item) => item.warnings.includes('MISSING_HERO')).length,
      weakImages: items.filter((item) => item.warnings.includes('WEAK_IMAGE_COUNT')).length,
      videoTour: items.filter((item) => item.warnings.includes('MISSING_VIDEO_TOUR')).length,
      blocked: items.filter((item) => item.mediaQualityStatus === 'BLOCKED').length
    }),
    [items]
  );

  async function loadQueue() {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      setMessage('');

      const response = await getAdminMediaQualityQueue(token, {
        itemType: itemType === 'ALL' ? undefined : itemType,
        status: publishStatus === 'ALL' ? undefined : publishStatus,
        mediaQualityStatus: qualityStatus === 'ALL' ? undefined : qualityStatus,
        warning: warning === 'ALL' ? undefined : warning,
        take: 40
      });

      setItems(response.items ?? []);
      setTotal(response.total ?? response.items?.length ?? 0);
      setNotesById(
        Object.fromEntries(
          (response.items ?? []).map((item) => [
            getMediaQueueKey(item),
            item.mediaQualityNotes ?? ''
          ])
        )
      );
    } catch (loadError) {
      console.error(loadError);
      setError('Could not load media quality queue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, itemType, publishStatus, qualityStatus, warning]);

  function itemMatchesCurrentFilters(item: AdminMediaQualityItem) {
    const activeQueueStatuses = new Set<AdminMediaQualityStatus>([
      'NOT_CHECKED',
      'NEEDS_REVIEW',
      'BLOCKED'
    ]);

    if (itemType !== 'ALL' && item.itemType !== itemType) return false;
    if (publishStatus !== 'ALL' && item.status !== publishStatus) return false;
    if (qualityStatus !== 'ALL' && item.mediaQualityStatus !== qualityStatus) return false;
    if (qualityStatus === 'ALL' && !activeQueueStatuses.has(item.mediaQualityStatus)) return false;
    if (warning !== 'ALL' && !item.warnings.includes(warning)) return false;

    return true;
  }

  async function updateItem(
    item: AdminMediaQualityItem,
    payload: UpdateAdminMediaQualityPayload,
    successMessage: string
  ) {
    if (!token || updatingItemKey) return;

    const itemKey = getMediaQueueKey(item);

    try {
      setUpdatingItemKey(itemKey);
      setError('');
      setMessage('');

      const response = await updateAdminMediaQualityItem(
        token,
        item.itemType,
        item.id,
        payload
      );
      const nextItem = response.item;
      const nextItemKey = getMediaQueueKey(nextItem);

      const shouldKeepItem = itemMatchesCurrentFilters(nextItem);

      setItems((currentItems) => {
        if (!shouldKeepItem) {
          return currentItems.filter(
            (currentItem) => getMediaQueueKey(currentItem) !== itemKey
          );
        }

        return currentItems.map((currentItem) =>
          getMediaQueueKey(currentItem) === itemKey ? nextItem : currentItem
        );
      });
      if (!shouldKeepItem) {
        setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      }
      setNotesById((currentNotes) => ({
        ...currentNotes,
        [nextItemKey]: nextItem.mediaQualityNotes ?? ''
      }));
      setMessage(successMessage);
    } catch (updateError) {
      console.error(updateError);
      setError('Could not update this media quality item.');
    } finally {
      setUpdatingItemKey('');
    }
  }

  return (
    <section className="stage8-operations-queue media-quality-admin-queue admin-media-quality-panel">
      <div className="details-section-heading media-quality-admin-panel__heading">
        <div>
          <p className="eyebrow">Media quality operations</p>
          <h3>Premium media readiness queue</h3>
          <p>
            Review listing, activity, and developer project media before an item is treated as
            premium-ready. These statuses are internal workflow signals, not public verification claims.
          </p>
        </div>

        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void loadQueue()}
          disabled={loading}
        >
          <RefreshCw size={15} aria-hidden="true" />
          {loading ? 'Refreshing…' : 'Refresh queue'}
        </button>
      </div>

      <div className="admin-media-quality-summary" aria-label="Media quality queue summary">
        <article>
          <Image size={17} aria-hidden="true" />
          <span>Queue results</span>
          <strong>{total}</strong>
        </article>
        <article className={counts.missingHero > 0 ? 'is-urgent' : ''}>
          <AlertTriangle size={17} aria-hidden="true" />
          <span>Missing hero</span>
          <strong>{counts.missingHero}</strong>
        </article>
        <article className={counts.weakImages > 0 ? 'is-attention' : ''}>
          <Image size={17} aria-hidden="true" />
          <span>Weak image count</span>
          <strong>{counts.weakImages}</strong>
        </article>
        <article className={counts.blocked > 0 ? 'is-urgent' : ''}>
          <ShieldAlert size={17} aria-hidden="true" />
          <span>Blocked premium</span>
          <strong>{counts.blocked}</strong>
        </article>
      </div>

      <div className="admin-media-quality-filters" aria-label="Media quality filters">
        <label htmlFor="media-quality-item-type">
          Item type
          <select
            id="media-quality-item-type"
            name="mediaQualityItemType"
            value={itemType}
            onChange={(event) => setItemType(event.target.value as AdminMediaQualityItemType | 'ALL')}
          >
            {itemTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'PROJECT' ? 'Developer projects' : formatLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="media-quality-publish-status">
          Publish status
          <select
            id="media-quality-publish-status"
            name="mediaQualityPublishStatus"
            value={publishStatus}
            onChange={(event) => setPublishStatus(event.target.value as (typeof publishStatusOptions)[number])}
          >
            {publishStatusOptions.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="media-quality-status-filter">
          Media status
          <select
            id="media-quality-status-filter"
            name="mediaQualityStatusFilter"
            value={qualityStatus}
            onChange={(event) => setQualityStatus(event.target.value as AdminMediaQualityStatus | 'ALL')}
          >
            {mediaQualityStatusOptions.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="media-quality-warning-filter">
          Warning
          <select
            id="media-quality-warning-filter"
            name="mediaQualityWarningFilter"
            value={warning}
            onChange={(event) => setWarning(event.target.value as AdminMediaQualityWarning | 'ALL')}
          >
            {warningOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All warnings' : warningLabels[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status" aria-live="polite">{message}</p> : null}

      {loading ? <p className="trust-note">Loading media quality queue…</p> : null}

      {!loading && items.length ? (
        <div className="admin-media-quality-list">
          {items.map((item) => {
            const itemKey = getMediaQueueKey(item);
            const notes = notesById[itemKey] ?? item.mediaQualityNotes ?? '';
            const isUpdating = updatingItemKey === itemKey;
            const thumbnailUrl = item.thumbnailUrl ? resolveAssetUrl(item.thumbnailUrl) : '';

            return (
              <article key={itemKey} className="admin-media-quality-card">
                <div className="admin-media-quality-card__media">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt="" loading="lazy" />
                  ) : (
                    <span>
                      <Image size={22} aria-hidden="true" />
                      No hero
                    </span>
                  )}
                </div>

                <div className="admin-media-quality-card__body">
                  <div className="admin-media-quality-card__title">
                    <div>
                      <span className={`status-pill ${getQualityTone(item.mediaQualityStatus)}`}>
                        {formatLabel(item.mediaQualityStatus)}
                      </span>
                      <h4>{item.title}</h4>
                      <p>
                        {getItemLabel(item.itemType)} · Publish status: {formatLabel(item.status)} · Enhancement: {formatLabel(item.enhancementStatus)}
                      </p>
                    </div>

                    <Link className="button-link button-link--ghost" to={getMediaItemPath(item)}>
                      Open item
                    </Link>
                  </div>

                  <div className="admin-media-quality-checks">
                    <span className={item.hasMainImage ? 'is-ok' : 'is-warning'}>
                      Hero: {item.hasMainImage ? 'ready' : 'missing'}
                    </span>
                    <span className={item.imageCount >= 4 ? 'is-ok' : 'is-warning'}>
                      Images: {item.imageCount}
                    </span>
                    <span className={item.hasVideoOrTour ? 'is-ok' : 'is-warning'}>
                      Video / 360: {item.hasVideoOrTour ? 'ready' : 'missing'}
                    </span>
                    {item.itemType !== 'ACTIVITY' ? (
                      <span className={item.hasFloorPlan ? 'is-ok' : 'is-warning'}>
                        Plan: {item.hasFloorPlan ? 'ready' : 'missing'}
                      </span>
                    ) : null}
                  </div>

                  {item.warnings.length ? (
                    <div className="admin-media-quality-warnings" aria-label="Media warnings">
                      {item.warnings.map((itemWarning) => (
                        <span key={itemWarning}>{warningLabels[itemWarning]}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="trust-note">No automatic media warnings on this item.</p>
                  )}

                  {item.owner ? (
                    <p className="admin-media-quality-owner">
                      Owner/provider: {item.owner.name || 'Unknown'} · {item.owner.email}
                    </p>
                  ) : null}

                  <label className="admin-media-quality-notes" htmlFor={`media-notes-${itemKey}`}>
                    Admin notes
                    <textarea
                      id={`media-notes-${itemKey}`}
                      name={`mediaNotes-${itemKey}`}
                      rows={3}
                      value={notes}
                      onChange={(event) =>
                        setNotesById((currentNotes) => ({
                          ...currentNotes,
                          [itemKey]: event.target.value
                        }))
                      }
                      disabled={isUpdating}
                      placeholder="Add an internal media quality note"
                    />
                  </label>

                  <div className="admin-media-quality-actions">
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        void updateItem(
                          item,
                          {
                            mediaQualityNotes: notes.trim() || null
                          },
                          'Media notes saved.'
                        )
                      }
                    >
                      Save notes
                    </button>
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        void updateItem(
                          item,
                          {
                            mediaQualityStatus: 'NEEDS_REVIEW',
                            mediaQualityNotes: notes.trim() || getSuggestedRequestNote(item)
                          },
                          'Better media request recorded.'
                        )
                      }
                    >
                      Request better media
                    </button>
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        void updateItem(
                          item,
                          {
                            mediaQualityStatus: 'ACCEPTABLE',
                            mediaQualityNotes: notes.trim() || 'Acceptable for standard placement; premium media can still improve.'
                          },
                          'Marked acceptable.'
                        )
                      }
                    >
                      Mark acceptable
                    </button>
                    <button
                      className="button-link button-link--primary"
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        void updateItem(
                          item,
                          {
                            mediaQualityStatus: 'EXCELLENT',
                            mediaQualityNotes: notes.trim() || 'Media approved for premium placement.'
                          },
                          'Marked excellent.'
                        )
                      }
                    >
                      Mark excellent
                    </button>
                    <button
                      className="button-link button-link--ghost"
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        void updateItem(
                          item,
                          {
                            mediaQualityStatus: 'BLOCKED',
                            mediaQualityNotes: notes.trim() || 'Blocked from premium placement pending better media.'
                          },
                          'Blocked from premium placement.'
                        )
                      }
                    >
                      Block from premium
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && !items.length ? (
        <div className="empty-state empty-state--premium admin-media-quality-empty">
          <CheckCircle2 size={32} aria-hidden="true" />
          <h3>No media items match these filters.</h3>
          <p>Try a broader status or warning filter. Excellent/acceptable items are hidden from the default queue unless selected.</p>
        </div>
      ) : null}
    </section>
  );
}

import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  getAdminDeveloperProjects,
  updateAdminActivityStatus,
  updateAdminDeveloperProjectStatus,
  updateAdminListingStatus
} from '../api/admin';
import { ApiError } from '../api/client';
import type {
  ActivityStatus,
  ApiActivity,
  ApiDeveloperProject,
  ApiListing,
  DeveloperProjectStatus,
  ListingStatus,
  Language
} from '../types';

type ApprovalItemType = 'ALL' | 'LISTING' | 'ACTIVITY' | 'PROJECT';
type ApprovalStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type ReadinessFilter = 'ALL' | 'READY' | 'ATTENTION';
type ApprovalStatus = ListingStatus | ActivityStatus | DeveloperProjectStatus;

type ReadinessCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  blocker?: boolean;
};

type ApprovalQueueItem = {
  id: string;
  type: Exclude<ApprovalItemType, 'ALL'>;
  title: string;
  subtitle: string;
  ownerLabel: string;
  status: ApprovalStatus;
  rejectedReason?: string | null;
  publicPath: string;
  thumbnailUrl?: string | null;
  updatedAt?: string | null;
  searchText: string;
  readinessChecks: ReadinessCheck[];
};

type Props = {
  token: string | null;
  language: Language;
  listings: ApiListing[];
  activities: ApiActivity[];
  initialReviewType?: string | null;
  initialStatus?: string | null;
  initialTargetId?: string | null;
  onListingUpdated: (listing: ApiListing) => void;
  onActivityUpdated: (activity: ApiActivity) => void;
};

const typeFilters: ApprovalItemType[] = ['ALL', 'LISTING', 'ACTIVITY', 'PROJECT'];
const statusFilters: ApprovalStatusFilter[] = ['PENDING', 'ALL', 'APPROVED', 'REJECTED'];
const readinessFilters: ReadinessFilter[] = ['ALL', 'READY', 'ATTENTION'];

function normalizeReviewType(value?: string | null): ApprovalItemType {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'listing' || normalized === 'listings') return 'LISTING';
  if (normalized === 'activity' || normalized === 'activities') return 'ACTIVITY';
  if (
    normalized === 'project' ||
    normalized === 'developer-project' ||
    normalized === 'developer_project' ||
    normalized === 'developer-projects'
  ) {
    return 'PROJECT';
  }

  return 'ALL';
}

function normalizeStatus(value?: string | null): ApprovalStatusFilter {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'ALL' || normalized === 'APPROVED' || normalized === 'REJECTED') {
    return normalized;
  }

  return 'PENDING';
}

function getTypeLabel(type: ApprovalItemType) {
  if (type === 'ALL') return 'All content';
  if (type === 'LISTING') return 'Listings';
  if (type === 'ACTIVITY') return 'Activities';

  return 'Developer projects';
}

function getStatusLabel(status: ApprovalStatusFilter) {
  if (status === 'ALL') return 'All statuses';

  return status.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function getReadinessLabel(filter: ReadinessFilter) {
  if (filter === 'READY') return 'Ready only';
  if (filter === 'ATTENTION') return 'Needs attention';

  return 'All readiness';
}

function isPublishedReadyStatus(status?: string | null) {
  return status === 'ADMIN_VERIFIED' || status === 'EXTERNALLY_VERIFIED';
}

function isMediaReady(status?: string | null) {
  return status === 'ACCEPTABLE' || status === 'EXCELLENT';
}

function hasPricing(amount?: string | number | null, qualifier?: string | null) {
  return Boolean(amount) || qualifier === 'ON_REQUEST';
}

function formatDate(value?: string | null) {
  if (!value) return 'Recently updated';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Recently updated';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function getListingTitle(listing: ApiListing, language: Language) {
  return language === 'ar'
    ? listing.titleAr || listing.titleEn || listing.title
    : listing.titleEn || listing.titleAr || listing.title;
}

function getListingLocation(listing: ApiListing, language: Language) {
  return language === 'ar'
    ? listing.locationAr || listing.locationEn || listing.location
    : listing.locationEn || listing.locationAr || listing.location;
}

function getListingType(listing: ApiListing, language: Language) {
  return language === 'ar'
    ? listing.typeAr || listing.typeEn || listing.type
    : listing.typeEn || listing.typeAr || listing.type;
}

function getListingOwner(listing: ApiListing, language: Language) {
  if (listing.developer) {
    return language === 'ar'
      ? listing.developer.nameAr || listing.developer.nameEn
      : listing.developer.nameEn || listing.developer.nameAr;
  }

  return language === 'ar'
    ? listing.developerNameAr || listing.developerNameEn || listing.owner?.name || listing.owner?.email || 'Private owner'
    : listing.developerNameEn || listing.developerNameAr || listing.owner?.name || listing.owner?.email || 'Private owner';
}

function getActivityTitle(activity: ApiActivity, language: Language) {
  return language === 'ar'
    ? activity.titleAr || activity.titleEn
    : activity.titleEn || activity.titleAr || 'Untitled activity';
}

function getActivityLocation(activity: ApiActivity, language: Language) {
  return language === 'ar'
    ? activity.locationAr || activity.locationEn
    : activity.locationEn || activity.locationAr || 'Location not set';
}

function getActivityCategory(activity: ApiActivity, language: Language) {
  return language === 'ar'
    ? activity.categoryAr || activity.categoryEn
    : activity.categoryEn || activity.categoryAr || 'Activity';
}

function getActivityProvider(activity: ApiActivity, language: Language) {
  const agencyName =
    language === 'ar'
      ? activity.travelAgency?.nameAr || activity.travelAgency?.nameEn
      : activity.travelAgency?.nameEn || activity.travelAgency?.nameAr;

  const providerName =
    language === 'ar'
      ? activity.providerAr || activity.providerEn
      : activity.providerEn || activity.providerAr;

  return agencyName || providerName || activity.owner?.name || activity.owner?.email || 'Activity provider';
}

function getProjectTitle(project: ApiDeveloperProject, language: Language) {
  return language === 'ar'
    ? project.nameAr || project.nameEn
    : project.nameEn || project.nameAr || 'Untitled project';
}

function getProjectLocation(project: ApiDeveloperProject, language: Language) {
  return language === 'ar'
    ? project.locationAr || project.locationEn
    : project.locationEn || project.locationAr || 'Location not set';
}

function getProjectDeveloper(project: ApiDeveloperProject, language: Language) {
  return language === 'ar'
    ? project.developer?.nameAr || project.developer?.nameEn || project.owner?.name || project.owner?.email || 'Developer company'
    : project.developer?.nameEn || project.developer?.nameAr || project.owner?.name || project.owner?.email || 'Developer company';
}

function getReadinessScore(checks: ReadinessCheck[]) {
  if (!checks.length) return 0;

  const passed = checks.filter((check) => check.passed).length;

  return Math.round((passed / checks.length) * 100);
}

function hasBlocker(checks: ReadinessCheck[]) {
  return checks.some((check) => !check.passed && check.blocker);
}

function getPrimaryReadinessWarning(checks: ReadinessCheck[]) {
  return checks.find((check) => !check.passed)?.detail ?? 'Ready for admin publishing decision.';
}

function getStatusClass(status: ApprovalStatus) {
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';

  return 'pending';
}

function createListingItem(listing: ApiListing, language: Language): ApprovalQueueItem {
  const title = getListingTitle(listing, language);
  const location = getListingLocation(listing, language);
  const type = getListingType(listing, language);
  const ownerLabel = getListingOwner(listing, language) || 'Private owner';
  const imageCount = listing.images?.length ?? 0;
  const hasHero = Boolean(listing.image || listing.images?.[0]?.url);
  const checks: ReadinessCheck[] = [
    {
      key: 'pricing',
      label: 'Pricing',
      passed: hasPricing(listing.priceAmount, listing.priceQualifier),
      detail: 'Add structured pricing or mark the listing price as on request.',
      blocker: true
    },
    {
      key: 'media',
      label: 'Media',
      passed: isMediaReady(listing.mediaQualityStatus),
      detail: 'Media quality should be acceptable or excellent before premium publishing.',
      blocker: listing.mediaQualityStatus === 'BLOCKED'
    },
    {
      key: 'hero',
      label: 'Hero image',
      passed: hasHero,
      detail: 'Add a clear hero image for the public card.',
      blocker: true
    },
    {
      key: 'gallery',
      label: 'Gallery depth',
      passed: imageCount >= 3,
      detail: 'Add at least three supporting images for buyer confidence.'
    },
    {
      key: 'verification',
      label: 'Verification',
      passed: isPublishedReadyStatus(listing.verificationStatus),
      detail: 'Owner/listing verification is not yet complete.'
    }
  ];

  return {
    id: listing.id,
    type: 'LISTING',
    title,
    subtitle: `${location} · ${type}`,
    ownerLabel,
    status: listing.status ?? 'PENDING',
    rejectedReason: listing.rejectedReason,
    publicPath: `/listings/${listing.slug}`,
    thumbnailUrl: listing.image || listing.images?.[0]?.url,
    updatedAt: listing.updatedAt,
    readinessChecks: checks,
    searchText: [title, location, type, ownerLabel, listing.status, listing.mediaQualityStatus, listing.verificationStatus]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  };
}

function createActivityItem(activity: ApiActivity, language: Language): ApprovalQueueItem {
  const title = getActivityTitle(activity, language);
  const location = getActivityLocation(activity, language);
  const category = getActivityCategory(activity, language);
  const ownerLabel = getActivityProvider(activity, language);
  const hasHero = Boolean(activity.images?.[0]?.url || activity.premiumMedia?.[0]?.url);
  const checks: ReadinessCheck[] = [
    {
      key: 'pricing',
      label: 'Pricing',
      passed: hasPricing(activity.priceAmount, activity.priceQualifier),
      detail: 'Add structured activity/package pricing or mark it as on request.',
      blocker: true
    },
    {
      key: 'media',
      label: 'Media',
      passed: isMediaReady(activity.mediaQualityStatus),
      detail: 'Media quality should be acceptable or excellent before public promotion.',
      blocker: activity.mediaQualityStatus === 'BLOCKED'
    },
    {
      key: 'hero',
      label: 'Hero image',
      passed: hasHero,
      detail: 'Add at least one strong activity image.',
      blocker: true
    },
    {
      key: 'availability',
      label: 'Availability',
      passed: Boolean(activity.availabilityDays?.length || activity.availableTravelDates),
      detail: 'Add operating days or available travel dates.'
    },
    {
      key: 'verification',
      label: 'Provider trust',
      passed: isPublishedReadyStatus(activity.verificationStatus) || activity.travelAgency?.verified === true,
      detail: 'Provider or travel agency trust is not verified yet.'
    }
  ];

  return {
    id: activity.id,
    type: 'ACTIVITY',
    title,
    subtitle: `${location} · ${category}`,
    ownerLabel,
    status: activity.status ?? 'PENDING',
    rejectedReason: activity.rejectedReason,
    publicPath: `/activities/${activity.slug}`,
    thumbnailUrl: activity.images?.[0]?.url || activity.premiumMedia?.[0]?.url,
    updatedAt: activity.updatedAt,
    readinessChecks: checks,
    searchText: [title, location, category, ownerLabel, activity.status, activity.mediaQualityStatus, activity.verificationStatus]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  };
}

function createProjectItem(project: ApiDeveloperProject, language: Language): ApprovalQueueItem {
  const title = getProjectTitle(project, language);
  const location = getProjectLocation(project, language);
  const ownerLabel = getProjectDeveloper(project, language);
  const unitCount = project._count?.listings ?? project.listings?.length ?? 0;
  const checks: ReadinessCheck[] = [
    {
      key: 'pricing',
      label: 'Starting price',
      passed: hasPricing(project.startingPriceAmount, project.priceQualifier),
      detail: 'Add a starting price or mark the project price as on request.',
      blocker: true
    },
    {
      key: 'media',
      label: 'Media',
      passed: isMediaReady(project.mediaQualityStatus),
      detail: 'Project media should be acceptable or excellent before public launch.',
      blocker: project.mediaQualityStatus === 'BLOCKED'
    },
    {
      key: 'hero',
      label: 'Hero image',
      passed: Boolean(project.image || project.images?.[0]?.url),
      detail: 'Add a project hero image.',
      blocker: true
    },
    {
      key: 'inventory',
      label: 'Linked units',
      passed: unitCount > 0,
      detail: 'Link at least one unit/listing to make the project commercially useful.'
    },
    {
      key: 'developer',
      label: 'Developer trust',
      passed: project.developer?.verified === true,
      detail: 'Developer company is not marked verified.'
    }
  ];

  return {
    id: project.id,
    type: 'PROJECT',
    title,
    subtitle: `${location} · ${unitCount} linked unit${unitCount === 1 ? '' : 's'}`,
    ownerLabel,
    status: project.status ?? 'PENDING',
    rejectedReason: project.rejectedReason,
    publicPath: `/developer-projects/${project.slug}`,
    thumbnailUrl: project.image || project.images?.[0]?.url,
    updatedAt: project.updatedAt,
    readinessChecks: checks,
    searchText: [title, location, ownerLabel, project.status, project.mediaQualityStatus, project.developer?.verificationStatus]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  };
}

export default function AdminPublishingApprovalCockpit({
  token,
  language,
  listings,
  activities,
  initialReviewType,
  initialStatus,
  initialTargetId,
  onListingUpdated,
  onActivityUpdated
}: Props) {
  const [projects, setProjects] = useState<ApiDeveloperProject[]>([]);
  const [itemTypeFilter, setItemTypeFilter] = useState<ApprovalItemType>(() =>
    normalizeReviewType(initialReviewType)
  );
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>(() =>
    normalizeStatus(initialStatus)
  );
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('ALL');
  const [search, setSearch] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  async function loadProjects() {
    if (!token) return;

    try {
      setLoadingProjects(true);
      setError('');

      const response = await getAdminDeveloperProjects(token, {
        status: 'ALL',
        take: 100
      });

      setProjects(response.projects ?? []);
    } catch (caughtError) {
      console.error(caughtError);
      setError(caughtError instanceof ApiError || caughtError instanceof Error ? caughtError.message : 'Could not load developer project approvals.');
    } finally {
      setLoadingProjects(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const nextType = normalizeReviewType(initialReviewType);
    const nextStatus = normalizeStatus(initialStatus);

    if (nextType !== 'ALL') setItemTypeFilter(nextType);
    setStatusFilter(nextStatus);
  }, [initialReviewType, initialStatus]);

  const items = useMemo(() => {
    const listingItems = listings.map((listing) => createListingItem(listing, language));
    const activityItems = activities.map((activity) => createActivityItem(activity, language));
    const projectItems = projects.map((project) => createProjectItem(project, language));

    return [...listingItems, ...activityItems, ...projectItems].sort((first, second) => {
      if (first.id === initialTargetId) return -1;
      if (second.id === initialTargetId) return 1;

      const statusPriority = (status: ApprovalStatus) => {
        if (status === 'PENDING') return 0;
        if (status === 'REJECTED') return 1;
        return 2;
      };

      const readinessPriority = (item: ApprovalQueueItem) => (hasBlocker(item.readinessChecks) ? 0 : 1);

      return (
        statusPriority(first.status) - statusPriority(second.status) ||
        readinessPriority(first) - readinessPriority(second) ||
        new Date(second.updatedAt ?? 0).getTime() - new Date(first.updatedAt ?? 0).getTime()
      );
    });
  }, [activities, initialTargetId, language, listings, projects]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      if (itemTypeFilter !== 'ALL' && item.type !== itemTypeFilter) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      const ready = !hasBlocker(item.readinessChecks) && getReadinessScore(item.readinessChecks) >= 80;

      if (readinessFilter === 'READY' && !ready) return false;
      if (readinessFilter === 'ATTENTION' && ready) return false;
      if (normalizedSearch && !item.searchText.includes(normalizedSearch)) return false;

      return true;
    });
  }, [itemTypeFilter, items, readinessFilter, search, statusFilter]);

  const summary = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        accumulator.total += 1;
        if (item.status === 'PENDING') accumulator.pending += 1;
        if (item.status === 'APPROVED') accumulator.approved += 1;
        if (item.status === 'REJECTED') accumulator.rejected += 1;
        if (hasBlocker(item.readinessChecks)) accumulator.blocked += 1;
        if (item.type === 'LISTING') accumulator.listings += 1;
        if (item.type === 'ACTIVITY') accumulator.activities += 1;
        if (item.type === 'PROJECT') accumulator.projects += 1;

        return accumulator;
      },
      {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        blocked: 0,
        listings: 0,
        activities: 0,
        projects: 0
      }
    );
  }, [items]);

  async function updateItemStatus(item: ApprovalQueueItem, status: ApprovalStatus) {
    if (!token) return;

    const rejectedReason =
      status === 'REJECTED'
        ? window.prompt('What should the partner change before this can go public?')?.trim()
        : undefined;

    if (status === 'REJECTED' && !rejectedReason) return;

    const approvalWarning =
      status === 'APPROVED' && hasBlocker(item.readinessChecks)
        ? window.confirm(
            'This item still has readiness warnings. Approve only if an admin has manually checked and accepted the risk. Continue?'
          )
        : true;

    if (!approvalWarning) return;

    try {
      setUpdatingId(item.id);
      setError('');
      setMessage('');

      if (item.type === 'LISTING') {
        const response = await updateAdminListingStatus(
          item.id,
          {
            status: status as ListingStatus,
            rejectedReason
          },
          token
        );

        onListingUpdated(response.listing);
      }

      if (item.type === 'ACTIVITY') {
        const response = await updateAdminActivityStatus(
          item.id,
          {
            status: status as ActivityStatus,
            rejectedReason
          },
          token
        );

        onActivityUpdated(response.activity);
      }

      if (item.type === 'PROJECT') {
        const response = await updateAdminDeveloperProjectStatus(
          item.id,
          {
            status: status as DeveloperProjectStatus,
            rejectedReason
          },
          token
        );

        setProjects((current) =>
          current.map((project) => (project.id === item.id ? response.project : project))
        );
      }

      setMessage(`${item.title} moved to ${status.toLowerCase()}.`);
    } catch (caughtError) {
      console.error(caughtError);
      setError(caughtError instanceof ApiError || caughtError instanceof Error ? caughtError.message : 'Could not update approval status.');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <section
      className="publishing-approval-cockpit publishing-approval-cockpit--unified"
      id="admin-approvals"
      tabIndex={-1}
      aria-labelledby="publishing-approval-title"
    >
      <div className="publishing-approval-cockpit__header">
        <div>
          <p className="eyebrow">Publishing approvals</p>
          <h2 id="publishing-approval-title">Approval cockpit</h2>
          <p>
            Review listings, activities, and developer projects in one operational queue. Each decision shows media,
            pricing, trust, and inventory readiness before anything becomes public.
          </p>
        </div>

        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void loadProjects()}
          disabled={loadingProjects}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh projects
        </button>
      </div>

      <div className="publishing-approval-metrics publishing-approval-metrics--unified">
        <article className={summary.pending > 0 ? 'is-urgent' : ''}>
          <Clock3 size={18} aria-hidden="true" />
          <span>Pending decisions</span>
          <strong>{summary.pending}</strong>
        </article>
        <article>
          <AlertCircle size={18} aria-hidden="true" />
          <span>Readiness warnings</span>
          <strong>{summary.blocked}</strong>
        </article>
        <article>
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>Approved public items</span>
          <strong>{summary.approved}</strong>
        </article>
        <article>
          <XCircle size={18} aria-hidden="true" />
          <span>Requested changes</span>
          <strong>{summary.rejected}</strong>
        </article>
      </div>

      <div className="approval-cockpit-breakdown" aria-label="Approval queue content mix">
        <span><Building2 size={15} aria-hidden="true" /> {summary.listings} listings</span>
        <span><CalendarDays size={15} aria-hidden="true" /> {summary.activities} activities</span>
        <span><Sparkles size={15} aria-hidden="true" /> {summary.projects} projects</span>
      </div>

      <div className="approval-cockpit-toolbar">
        <label className="approval-cockpit-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search approval queue</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, owner, location, status..."
          />
        </label>

        <div className="approval-cockpit-filter-group" aria-label="Approval type filter">
          <Filter size={15} aria-hidden="true" />
          {typeFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={itemTypeFilter === filter ? 'is-active' : ''}
              onClick={() => setItemTypeFilter(filter)}
            >
              {getTypeLabel(filter)}
            </button>
          ))}
        </div>

        <div className="approval-cockpit-filter-group" aria-label="Approval status filter">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={statusFilter === filter ? 'is-active' : ''}
              onClick={() => setStatusFilter(filter)}
            >
              {getStatusLabel(filter)}
            </button>
          ))}
        </div>

        <div className="approval-cockpit-filter-group" aria-label="Approval readiness filter">
          {readinessFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={readinessFilter === filter ? 'is-active' : ''}
              onClick={() => setReadinessFilter(filter)}
            >
              {getReadinessLabel(filter)}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}
      {loadingProjects ? <p className="trust-note">Loading developer projects...</p> : null}

      <div className="approval-cockpit-list" aria-live="polite">
        {filteredItems.map((item) => {
          const score = getReadinessScore(item.readinessChecks);
          const blocked = hasBlocker(item.readinessChecks);
          const isFocused = item.id === initialTargetId;

          return (
            <article
              key={`${item.type}-${item.id}`}
              className={
                'approval-cockpit-item' +
                (blocked ? ' approval-cockpit-item--attention' : '') +
                (isFocused ? ' approval-cockpit-item--focused' : '')
              }
            >
              <div className="approval-cockpit-item__media">
                {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" /> : <ShieldCheck size={28} aria-hidden="true" />}
              </div>

              <div className="approval-cockpit-item__main">
                <div className="approval-cockpit-item__title">
                  <div>
                    <span className="approval-cockpit-item__type">{getTypeLabel(item.type)}</span>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                  </div>

                  <span className={'status-pill status-pill--' + getStatusClass(item.status)}>
                    {item.status.toLowerCase()}
                  </span>
                </div>

                <div className="approval-cockpit-item__meta">
                  <span>Owner/provider: {item.ownerLabel}</span>
                  <span>Updated: {formatDate(item.updatedAt)}</span>
                  <span className={blocked ? 'is-warning' : 'is-ready'}>
                    Readiness {score}% · {blocked ? getPrimaryReadinessWarning(item.readinessChecks) : 'No blocking warnings'}
                  </span>
                </div>

                <div className="approval-cockpit-checks">
                  {item.readinessChecks.map((check) => (
                    <span
                      key={check.key}
                      className={
                        check.passed
                          ? 'approval-cockpit-check approval-cockpit-check--passed'
                          : 'approval-cockpit-check approval-cockpit-check--missing'
                      }
                      title={check.passed ? 'Ready' : check.detail}
                    >
                      {check.passed ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertCircle size={13} aria-hidden="true" />}
                      {check.label}
                    </span>
                  ))}
                </div>

                {item.rejectedReason ? (
                  <p className="approval-cockpit-rejection">Last request: {item.rejectedReason}</p>
                ) : null}
              </div>

              <div className="approval-cockpit-item__actions">
                <Link className="button-link button-link--ghost" to={item.publicPath}>
                  <Eye size={15} aria-hidden="true" />
                  Open
                </Link>
                {item.status !== 'APPROVED' ? (
                  <button
                    type="button"
                    className="button-link"
                    disabled={updatingId === item.id}
                    onClick={() => void updateItemStatus(item, 'APPROVED')}
                  >
                    Approve
                  </button>
                ) : null}
                {item.status !== 'REJECTED' ? (
                  <button
                    type="button"
                    className="button-link button-link--secondary"
                    disabled={updatingId === item.id}
                    onClick={() => void updateItemStatus(item, 'REJECTED')}
                  >
                    Request changes
                  </button>
                ) : null}
                {item.status !== 'PENDING' ? (
                  <button
                    type="button"
                    className="button-link button-link--secondary"
                    disabled={updatingId === item.id}
                    onClick={() => void updateItemStatus(item, 'PENDING')}
                  >
                    Return to review
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {!filteredItems.length ? (
        <div className="empty-state empty-state--premium approval-cockpit-empty">
          <ShieldCheck size={34} aria-hidden="true" />
          <h3>No items match this approval queue.</h3>
          <p>Change filters or search terms to inspect another approval state.</p>
        </div>
      ) : null}
    </section>
  );
}

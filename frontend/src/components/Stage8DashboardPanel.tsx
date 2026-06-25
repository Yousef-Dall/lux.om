import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getMyContractDrafts } from '../api/contracts';
import { getMyRentSchedules } from '../api/rentPayments';
import { getSavedDashboard, type JsonRecord } from '../api/saved';
import { getMyMarketplaceTransactions } from '../api/transactions';
import { getMyValuations } from '../api/valuations';

type DashboardCollections = {
  savedListings: JsonRecord[];
  savedActivities: JsonRecord[];
  savedSearches: JsonRecord[];
  watchlist: JsonRecord[];
  contracts: JsonRecord[];
  rentSchedules: JsonRecord[];
  transactions: JsonRecord[];
  valuations: JsonRecord[];
};

const emptyCollections: DashboardCollections = {
  savedListings: [],
  savedActivities: [],
  savedSearches: [],
  watchlist: [],
  contracts: [],
  rentSchedules: [],
  transactions: [],
  valuations: []
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getValue(record: JsonRecord | null | undefined, key: string) {
  return record?.[key];
}

function getRecord(record: JsonRecord | null | undefined, key: string) {
  const value = getValue(record, key);

  return isRecord(value) ? value : null;
}

function getRecords(record: JsonRecord | null | undefined, key: string) {
  const value = getValue(record, key);

  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function getText(
  record: JsonRecord | null | undefined,
  keys: string | string[],
  fallback = '—'
) {
  const keyList = Array.isArray(keys) ? keys : [keys];

  for (const key of keyList) {
    const value = getValue(record, key);

    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  }

  return fallback;
}

function getDate(record: JsonRecord | null | undefined, keys: string | string[]) {
  const raw = getText(record, keys, '');

  if (!raw) return '—';

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium'
  }).format(date);
}

function getMoney(
  record: JsonRecord | null | undefined,
  amountKeys: string | string[],
  currencyKeys: string | string[] = ['currency', 'priceCurrency']
) {
  const rawAmount = getText(record, amountKeys, '');
  const amount = Number(rawAmount);
  const currency = getText(record, currencyKeys, 'OMR');

  if (!Number.isFinite(amount)) return '—';

  return `${currency} ${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').toLowerCase();
}

function getStatusClass(value: string) {
  if (
    value.includes('APPROVED') ||
    value.includes('READY') ||
    value.includes('PAID') ||
    value.includes('COMPLETED')
  ) {
    return 'approved';
  }

  if (
    value.includes('REJECTED') ||
    value.includes('FAILED') ||
    value.includes('CANCELLED') ||
    value.includes('DISPUTED') ||
    value.includes('EXPIRED')
  ) {
    return 'rejected';
  }

  return 'pending';
}

function getListingFromSaved(item: JsonRecord) {
  return getRecord(item, 'listing') ?? item;
}

function getActivityFromSaved(item: JsonRecord) {
  return getRecord(item, 'activity') ?? item;
}

function getListingTitle(listing: JsonRecord) {
  return getText(listing, ['titleEn', 'titleAr', 'title'], 'Saved listing');
}

function getListingLocation(listing: JsonRecord) {
  return getText(listing, ['locationEn', 'locationAr', 'location'], '—');
}

function getActivityTitle(activity: JsonRecord) {
  return getText(activity, ['titleEn', 'titleAr'], 'Saved activity');
}

function getActivityLocation(activity: JsonRecord) {
  return getText(activity, ['locationEn', 'locationAr'], '—');
}

function getListingPath(listing: JsonRecord) {
  const slug = getText(listing, 'slug', '');

  return slug ? `/listings/${slug}` : '/listings';
}

function getActivityPath(activity: JsonRecord) {
  const slug = getText(activity, 'slug', '');

  return slug ? `/activities/${slug}` : '/activities';
}

function getFiltersPreview(record: JsonRecord) {
  const filters = getValue(record, 'filters');

  if (!filters) return 'No advanced filters saved.';

  try {
    const text = JSON.stringify(filters);

    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  } catch {
    return 'Saved dashboard filters';
  }
}

function getSavedSearchPath(search: JsonRecord) {
  const params = new URLSearchParams();
  const query = getText(search, 'query', '');
  const filters = getValue(search, 'filters');

  if (query) params.set('q', query);

  if (isRecord(filters)) {
    Object.entries(filters).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        params.set(key, value);
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        params.set(key, String(value));
      }

      if (typeof value === 'boolean' && value) {
        params.set(key, 'true');
      }

      if (Array.isArray(value)) {
        const joined = value
          .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
          .join(',');

        if (joined) params.set(key, joined);
      }
    });
  }

  const queryString = params.toString();

  return queryString ? `/listings?${queryString}` : '/listings';
}

function count(value?: JsonRecord[] | null) {
  return value?.length ?? 0;
}

function DashboardMiniCard({
  eyebrow,
  title,
  meta,
  status,
  actionTo,
  actionLabel
}: {
  eyebrow: string;
  title: string;
  meta?: string;
  status?: string;
  actionTo?: string;
  actionLabel?: string;
}) {
  const normalizedStatus = status ? status.toUpperCase() : '';

  return (
    <article className="stage8-dashboard-card">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h4>{title}</h4>
        {meta ? <p>{meta}</p> : null}
      </div>

      <div className="stage8-dashboard-card__footer">
        {status ? (
          <span className={`status-pill ${getStatusClass(normalizedStatus)}`}>
            {formatStatus(status)}
          </span>
        ) : null}

        {actionTo && actionLabel ? (
          <Link className="button-link button-link--secondary" to={actionTo}>
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function Stage8DashboardPanel({
  token
}: {
  token: string | null;
}) {
  const [collections, setCollections] =
    useState<DashboardCollections>(emptyCollections);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function load() {
      try {
        setLoadError('');

        const [saved, contracts, rents, transactions, valuations] =
          await Promise.all([
            getSavedDashboard(token!),
            getMyContractDrafts(token!),
            getMyRentSchedules(token!),
            getMyMarketplaceTransactions(token!),
            getMyValuations(token!)
          ]);

        if (!active) return;

        setCollections({
          savedListings: saved.listings ?? [],
          savedActivities: saved.activities ?? [],
          savedSearches: saved.searches ?? [],
          watchlist: saved.watchlist ?? [],
          contracts: contracts.contracts ?? [],
          rentSchedules: rents.schedules ?? [],
          transactions: transactions.transactions ?? [],
          valuations: valuations.valuations ?? []
        });
      } catch (error) {
        console.error(error);

        if (!active) return;
        setLoadError('Could not load the full Stage 8 dashboard workspace.');
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  const summary = useMemo(
    () => ({
      savedListings: count(collections.savedListings),
      savedActivities: count(collections.savedActivities),
      savedSearches: count(collections.savedSearches),
      watchlist: count(collections.watchlist),
      contracts: count(collections.contracts),
      rentSchedules: count(collections.rentSchedules),
      transactions: count(collections.transactions),
      valuations: count(collections.valuations)
    }),
    [collections]
  );

  if (!token || !loaded) return null;

  const items = [
    ['Saved listings', summary.savedListings],
    ['Saved activities', summary.savedActivities],
    ['Saved searches', summary.savedSearches],
    ['Investor watchlist', summary.watchlist],
    ['Contract drafts', summary.contracts],
    ['Rent schedules', summary.rentSchedules],
    ['Transactions', summary.transactions],
    ['Valuation requests', summary.valuations]
  ] as const;

  return (
    <section
      className="stage8-operations-panel stage8-dashboard-workspace"
      aria-labelledby="stage8-dashboard-title"
    >
      <div>
        <p className="eyebrow">Owner workspace</p>
        <h2 id="stage8-dashboard-title">
          Saved items, contracts, payments, and transactions
        </h2>
        <p>
          Track saved marketplace items, investor alerts, contract drafts, rent
          schedules, transaction-readiness workflows, and valuation requests.
          External notifications and official services require approved provider
          access before activation.
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

      <div className="stage8-dashboard-sections">
        <section className="stage8-dashboard-section">
          <div className="details-section-heading">
            <p className="eyebrow">Saved marketplace</p>
            <h3>Listings and activities</h3>
            <p>
              Saved items stay in your dashboard. External alerts are only sent
              when a notification provider is configured.
            </p>
          </div>

          <div className="stage8-dashboard-list">
            {collections.savedListings.slice(0, 3).map((item) => {
              const listing = getListingFromSaved(item);

              return (
                <DashboardMiniCard
                  key={getText(item, 'id')}
                  eyebrow="Saved listing"
                  title={getListingTitle(listing)}
                  meta={`${getListingLocation(listing)} · ${getMoney(
                    listing,
                    ['priceAmount']
                  )}`}
                  actionTo={getListingPath(listing)}
                  actionLabel="Open listing"
                />
              );
            })}

            {collections.savedActivities.slice(0, 3).map((item) => {
              const activity = getActivityFromSaved(item);

              return (
                <DashboardMiniCard
                  key={getText(item, 'id')}
                  eyebrow="Saved activity"
                  title={getActivityTitle(activity)}
                  meta={`${getActivityLocation(activity)} · ${getMoney(
                    activity,
                    ['priceAmount']
                  )}`}
                  actionTo={getActivityPath(activity)}
                  actionLabel="Open activity"
                />
              );
            })}

            {!collections.savedListings.length &&
            !collections.savedActivities.length ? (
              <p className="trust-note">
                No saved listings or activities yet.
              </p>
            ) : null}
          </div>
        </section>

        <section className="stage8-dashboard-section">
          <div className="details-section-heading">
            <p className="eyebrow">Investor alerts</p>
            <h3>Saved searches and watchlist</h3>
            <p>
              Watchlist and alert preferences are stored in your dashboard.
              Email, SMS, or WhatsApp alerts require configured providers.
            </p>
          </div>

          <div className="stage8-dashboard-list">
            {collections.savedSearches.slice(0, 4).map((search) => (
              <DashboardMiniCard
                key={getText(search, 'id')}
                eyebrow="Saved search"
                title={getText(search, 'name', 'Saved search')}
                meta={`${getText(search, 'category', 'Marketplace')} · ${getText(
                  search,
                  'alertFrequency',
                  'DASHBOARD_ONLY'
                )} · ${getFiltersPreview(search)}`}
                status={
                  getText(search, 'alertsEnabled', 'Yes') === 'Yes'
                    ? 'DASHBOARD_ONLY'
                    : 'NONE'
                }
                actionTo={getSavedSearchPath(search)}
                actionLabel="Run search"
              />
            ))}

            {collections.watchlist.slice(0, 4).map((item) => {
              const listing = getRecord(item, 'listing');
              const valuation = getRecord(item, 'valuationRequest');
              const title = listing
                ? getListingTitle(listing)
                : `${getText(valuation, 'location', 'Valuation request')} · ${getText(
                    valuation,
                    'propertyType',
                    'Property'
                  )}`;

              return (
                <DashboardMiniCard
                  key={getText(item, 'id')}
                  eyebrow="Investor watchlist"
                  title={title}
                  meta={`Target ${getMoney(item, 'targetPrice')} · ${getText(
                    item,
                    'notes',
                    'No notes'
                  )}`}
                  actionTo={listing ? getListingPath(listing) : undefined}
                  actionLabel={listing ? 'Open listing' : undefined}
                />
              );
            })}

            {!collections.savedSearches.length && !collections.watchlist.length ? (
              <p className="trust-note">
                No saved searches or investor watchlist items yet.
              </p>
            ) : null}
          </div>
        </section>

        <section className="stage8-dashboard-section">
          <div className="details-section-heading">
            <p className="eyebrow">Contracts and rent</p>
            <h3>Drafts and payment schedules</h3>
            <p>
              Contract and registration tools prepare records for review. They
              do not replace official registration or legal review.
            </p>
          </div>

          <div className="stage8-dashboard-list">
            {collections.contracts.slice(0, 4).map((contract) => (
              <DashboardMiniCard
                key={getText(contract, 'id')}
                eyebrow="Contract draft"
                title={getText(contract, ['title', 'propertyTitle'], 'Rental contract draft')}
                meta={`${getText(contract, 'propertyAddress', '—')} · ${getMoney(
                  contract,
                  'rentAmount'
                )}`}
                status={getText(contract, 'registrationStatus', 'NOT_STARTED')}
              />
            ))}

            {collections.rentSchedules.slice(0, 4).map((schedule) => {
              const dueItems = getRecords(schedule, 'dueItems');
              const nextDue =
                dueItems.find((item) => getText(item, 'status') !== 'PAID') ??
                dueItems[0];

              return (
                <DashboardMiniCard
                  key={getText(schedule, 'id')}
                  eyebrow="Rent schedule"
                  title={getText(schedule, 'title', 'Rent payment schedule')}
                  meta={`${getText(schedule, 'frequency', 'MONTHLY')} · ${getMoney(
                    schedule,
                    'amount'
                  )} · Next due ${getDate(nextDue, 'dueDate')}`}
                  status={getText(nextDue, 'status', 'PENDING')}
                />
              );
            })}

            {!collections.contracts.length &&
            !collections.rentSchedules.length ? (
              <p className="trust-note">
                No contract drafts or rent schedules yet.
              </p>
            ) : null}
          </div>
        </section>

        <section className="stage8-dashboard-section">
          <div className="details-section-heading">
            <p className="eyebrow">Transactions and valuation</p>
            <h3>Transaction-readiness and market estimates</h3>
            <p>
              Escrow-ready workflows and valuation estimates are internal
              readiness tools. Funds handling, external verification, and formal
              appraisal require approved providers.
            </p>
          </div>

          <div className="stage8-dashboard-list">
            {collections.transactions.slice(0, 4).map((transaction) => (
              <DashboardMiniCard
                key={getText(transaction, 'id')}
                eyebrow="Marketplace transaction"
                title={getText(transaction, 'title', 'Marketplace transaction')}
                meta={`${getText(transaction, 'type', 'OTHER')} · ${getMoney(
                  transaction,
                  'amount'
                )} · Escrow ${formatStatus(
                  getText(transaction, 'escrowStatus', 'NOT_STARTED')
                )}`}
                status={getText(transaction, 'status', 'DRAFT')}
              />
            ))}

            {collections.valuations.slice(0, 4).map((valuation) => {
              const estimateLow = getMoney(valuation, 'estimateLow');
              const estimateHigh = getMoney(valuation, 'estimateHigh');
              const estimate =
                estimateLow === '—' || estimateHigh === '—'
                  ? 'More data needed'
                  : `${estimateLow} - ${estimateHigh}`;

              return (
                <DashboardMiniCard
                  key={getText(valuation, 'id')}
                  eyebrow="Valuation request"
                  title={`${getText(valuation, 'location', 'Location')} · ${getText(
                    valuation,
                    'propertyType',
                    'Property'
                  )}`}
                  meta={`${estimate} · ${getText(
                    valuation,
                    'confidence',
                    'LOW_DATA'
                  )}`}
                  status={getText(valuation, 'status', 'REQUESTED')}
                />
              );
            })}

            {!collections.transactions.length && !collections.valuations.length ? (
              <p className="trust-note">
                No marketplace transactions or valuation requests yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

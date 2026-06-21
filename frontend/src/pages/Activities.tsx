import {
  CalendarDays,
  Clock,
  Lock,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  getActivitiesPage,
  getLandmarks,
  type MarketplacePagination
} from '../api/marketplace';
import ButtonLink from '../components/ButtonLink';
import { ActivityCard } from '../components/Cards';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity, Landmark } from '../types';

const categoryFilters = [
  'All',
  'Desert',
  'Sea',
  'Culture',
  'Adventure',
  'Mountain',
  'Nature'
] as const;

const durationFilters = ['All', 'Short', 'Half day', 'Full day', 'Overnight'] as const;

const activityTypeFilters = ['All', 'Private', 'Group', 'Both'] as const;

const activitySortOptions = [
  {
    value: 'recommended',
    en: 'Recommended',
    ar: 'موصى به'
  },
  {
    value: 'newest',
    en: 'Newest',
    ar: 'الأحدث'
  },
  {
    value: 'price_asc',
    en: 'Price low to high',
    ar: 'السعر من الأقل إلى الأعلى'
  },
  {
    value: 'price_desc',
    en: 'Price high to low',
    ar: 'السعر من الأعلى إلى الأقل'
  }
] as const;

type ActivitySort =
  (typeof activitySortOptions)[number]['value'];

const ACTIVITIES_PAGE_SIZE = 12;

const initialPagination: MarketplacePagination = {
  take: ACTIVITIES_PAGE_SIZE,
  skip: 0,
  count: 0,
  page: 1,
  pageSize: ACTIVITIES_PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false
};

function getDayName(dateString: string) {
  if (!dateString) return null;

  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long'
  });
}

function convertTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export default function Activities() {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  useDocumentTitle('Activities');

  const nearParam = searchParams.get('near') ?? '';
  const travelAgencyIdParam = searchParams.get('travelAgencyId') ?? '';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] =
    useState<MarketplacePagination>(initialPagination);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categoryFilters)[number]>('All');
  const [location, setLocation] = useState('');
  const [nearLandmark, setNearLandmark] = useState(nearParam);

  const [selectedDate, setSelectedDate] = useState('');
  const [freeFrom, setFreeFrom] = useState('');
  const [freeUntil, setFreeUntil] = useState('');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [durationType, setDurationType] = useState<(typeof durationFilters)[number]>('All');
  const [activityType, setActivityType] = useState<(typeof activityTypeFilters)[number]>('All');

  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [includesTransfer, setIncludesTransfer] = useState(false);
  const [mealIncluded, setMealIncluded] = useState(false);
  const [outdoor, setOutdoor] = useState(false);

  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] =
    useState<ActivitySort>('recommended');

  const debouncedQuery = useDebouncedValue(query);
  const debouncedLocation = useDebouncedValue(location);
  const debouncedMinPrice = useDebouncedValue(minPrice);
  const debouncedMaxPrice = useDebouncedValue(maxPrice);

  const hasTimeError =
    Boolean(freeFrom) &&
    Boolean(freeUntil) &&
    convertTimeToMinutes(freeFrom) >= convertTimeToMinutes(freeUntil);


  const activityCopy = t.activities ?? t.experiences;

  const copy =
    language === 'ar'
      ? {
          showingNear: 'يتم عرض الأنشطة بالقرب من',
          showingAgency: 'يتم عرض أنشطة الوكالة',
          clear: 'مسح',
          landmark: 'المعلم / المنطقة',
          allAreas: 'كل المناطق',
          resultsNear: 'بالقرب من',
          resultsAgency: 'حسب وكالة السفر',
          activityType: 'نوع النشاط',
          activeFilters: 'الفلاتر النشطة',
          loading: 'جاري تحميل الأنشطة...',
          error: 'تعذر تحميل الأنشطة. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.',
          sortBy: 'ترتيب حسب',
          previous: 'السابق',
          next: 'التالي',
          page: 'الصفحة',
          of: 'من'
        }
      : {
          showingNear: 'Showing activities near',
          showingAgency: 'Showing activities by',
          clear: 'Clear',
          landmark: 'Landmark / area',
          allAreas: 'All areas',
          resultsNear: 'Near',
          resultsAgency: 'By travel agency',
          activityType: 'Activity type',
          activeFilters: 'Active filters',
          loading: 'Loading activities...',
          error: 'Could not load activities. Make sure the backend is running and try again.',
          sortBy: 'Sort by',
          previous: 'Previous',
          next: 'Next',
          page: 'Page',
          of: 'of'
        };

  useEffect(() => {
    setNearLandmark(nearParam);
  }, [nearParam]);

  useEffect(() => {
    let isMounted = true;

    async function loadLandmarks() {
      try {
        const apiLandmarks = await getLandmarks(language, {
          take: 100
        });

        if (!isMounted) return;

        setLandmarks(apiLandmarks);
      } catch (error) {
        if (!isMounted) return;

        console.error(error);
        setLoadError(copy.error);
      }
    }

    void loadLandmarks();

    return () => {
      isMounted = false;
    };
  }, [language, copy.error]);

  useEffect(() => {
    setPage(1);
  }, [
    language,
    debouncedQuery,
    category,
    debouncedLocation,
    nearLandmark,
    travelAgencyIdParam,
    selectedDate,
    freeFrom,
    freeUntil,
    durationType,
    activityType,
    familyFriendly,
    includesTransfer,
    mealIncluded,
    outdoor,
    debouncedMinPrice,
    debouncedMaxPrice,
    sortBy
  ]);

  useEffect(() => {
    let isMounted = true;

    const selectedLandmarkId = nearLandmark
      ? landmarks.find((landmark) => landmark.slug === nearLandmark)?.id
      : undefined;

    if (nearLandmark && !selectedLandmarkId) {
      return () => {
        isMounted = false;
      };
    }

    if (hasTimeError) {
      setActivities([]);
      setPagination(initialPagination);
      setLoading(false);

      return () => {
        isMounted = false;
      };
    }

    async function loadActivities() {
      try {
        setLoading(true);
        setLoadError('');

        const selectedDay = getDayName(selectedDate);

        const result = await getActivitiesPage(language, {
          search: debouncedQuery.trim() || undefined,
          sort: sortBy,
          category: category !== 'All' ? category : undefined,
          location: debouncedLocation.trim() || undefined,
          nearestLandmarkId: selectedLandmarkId,
          travelAgencyId: travelAgencyIdParam || undefined,

          availableDay: selectedDay || undefined,
          availableFrom: freeFrom || undefined,
          availableUntil: freeUntil || undefined,

          durationType:
            durationType !== 'All' ? durationType : undefined,
          activityType:
            activityType !== 'All' ? activityType : undefined,

          familyFriendly: familyFriendly || undefined,
          includesTransfer: includesTransfer || undefined,
          mealIncluded: mealIncluded || undefined,
          outdoor: outdoor || undefined,

          minPrice: debouncedMinPrice.trim()
            ? Number(debouncedMinPrice)
            : undefined,
          maxPrice: debouncedMaxPrice.trim()
            ? Number(debouncedMaxPrice)
            : undefined,
          page,
          pageSize: ACTIVITIES_PAGE_SIZE
        });

        if (!isMounted) return;

        setActivities(result.items);
        setPagination(result.pagination);
      } catch (error) {
        if (!isMounted) return;

        console.error(error);
        setLoadError(copy.error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadActivities();

    return () => {
      isMounted = false;
    };
  }, [
    language,
    debouncedQuery,
    category,
    debouncedLocation,
    nearLandmark,
    landmarks,
    travelAgencyIdParam,
    selectedDate,
    freeFrom,
    freeUntil,
    durationType,
    activityType,
    familyFriendly,
    includesTransfer,
    mealIncluded,
    outdoor,
    debouncedMinPrice,
    debouncedMaxPrice,
    hasTimeError,
    sortBy,
    page,
    copy.error
  ]);

  const selectedLandmark = useMemo(() => {
    return landmarks.find((landmark) => landmark.slug === nearLandmark);
  }, [landmarks, nearLandmark]);

  const selectedAgencyName = useMemo(() => {
    if (!travelAgencyIdParam) return '';

    return (
      activities.find((activity) => activity.travelAgencyId === travelAgencyIdParam)?.travelAgency
        ?.name ||
      activities.find((activity) => activity.travelAgencyId === travelAgencyIdParam)?.provider ||
      ''
    );
  }, [activities, travelAgencyIdParam]);

  const activeFilterCount = useMemo(() => {
    return [
      query,
      location,
      selectedDate,
      freeFrom,
      freeUntil,
      nearLandmark,
      travelAgencyIdParam,
      category !== 'All' ? category : '',
      durationType !== 'All' ? durationType : '',
      activityType !== 'All' ? activityType : '',
      familyFriendly ? 'family' : '',
      includesTransfer ? 'transfer' : '',
      mealIncluded ? 'meal' : '',
      outdoor ? 'outdoor' : '',
      minPrice,
      maxPrice
    ].filter(Boolean).length;
  }, [
    query,
    location,
    selectedDate,
    freeFrom,
    freeUntil,
    nearLandmark,
    travelAgencyIdParam,
    category,
    durationType,
    activityType,
    familyFriendly,
    includesTransfer,
    mealIncluded,
    outdoor,
    minPrice,
    maxPrice
  ]);

  const filteredActivities = hasTimeError ? [] : activities;
  const resultTotal = hasTimeError ? 0 : pagination.total;

  function resetFilters() {
    setQuery('');
    setCategory('All');
    setLocation('');
    setNearLandmark('');
    setSelectedDate('');
    setFreeFrom('');
    setFreeUntil('');
    setDurationType('All');
    setActivityType('All');
    setFamilyFriendly(false);
    setIncludesTransfer(false);
    setMealIncluded(false);
    setOutdoor(false);
    setMinPrice('');
    setMaxPrice('');
    setSortBy('recommended');
    setPage(1);
    setSearchParams({});
  }

  function handleLandmarkChange(value: string) {
    setNearLandmark(value);

    const nextParams = new URLSearchParams(searchParams);

    if (value) {
      nextParams.set('near', value);
    } else {
      nextParams.delete('near');
    }

    setSearchParams(nextParams, { replace: true });
  }

  function clearTravelAgencyFilter() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('travelAgencyId');
    setSearchParams(nextParams, { replace: true });
  }

  return (
  <section className="page-section container activities-page">
      <SectionHeader
        eyebrow={activityCopy.eyebrow}
        title={activityCopy.title}
        description={activityCopy.description}
        actions={
          <ButtonLink to="/add-activity" variant="soft">
            {t.common.listActivity}
          </ButtonLink>
        }
      />

      <div className="filters-shell filters-shell--premium">
        <div className="filters-header">
          <div>
            <p className="eyebrow">{activityCopy.normalFilters}</p>
            <h2>{activityCopy.quickSearch}</h2>
          </div>

          <div className="filters-header__actions">
            {activeFilterCount > 0 ? (
              <span className="active-filter-count">
                <SlidersHorizontal size={15} aria-hidden="true" />
                {activeFilterCount}
              </span>
            ) : null}

            <button className="reset-filter-button" type="button" onClick={resetFilters}>
              <RotateCcw size={16} aria-hidden="true" />
              {t.common.resetFilters}
            </button>
          </div>
        </div>

        {travelAgencyIdParam ? (
          <div className="active-nearby-banner">
            <Sparkles size={17} aria-hidden="true" />
            <span>
              {copy.showingAgency}{' '}
              <strong>{selectedAgencyName || travelAgencyIdParam}</strong>
            </span>

            <button type="button" onClick={clearTravelAgencyFilter}>
              {copy.clear}
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {selectedLandmark ? (
          <div className="active-nearby-banner">
            <MapPin size={17} aria-hidden="true" />
            <span>
              {copy.showingNear} <strong>{selectedLandmark.name}</strong>
            </span>

            <button type="button" onClick={() => handleLandmarkChange('')}>
              {copy.clear}
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="normal-filters normal-filters--activities">
          <label className="search-input">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">{activityCopy.quickSearch}</span>
            <input
              type="search"
              placeholder={activityCopy.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label>
            {activityCopy.category}
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as (typeof categoryFilters)[number])
              }
            >
              {categoryFilters.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            {copy.landmark}
            <select
              value={nearLandmark}
              onChange={(event) => handleLandmarkChange(event.target.value)}
            >
              <option value="">{copy.allAreas}</option>
              {landmarks.map((landmark) => (
                <option key={landmark.id} value={landmark.slug}>
                  {landmark.name} · {landmark.city}
                </option>
              ))}
            </select>
          </label>

          <label>
            {activityCopy.location}
            <div className="input-with-icon">
              <MapPin size={16} aria-hidden="true" />
              <input
                placeholder={activityCopy.locationPlaceholder}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
          </label>

          <label>
            {activityCopy.date}
            <div className="input-with-icon">
              <CalendarDays size={16} aria-hidden="true" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>
          </label>

          <label>
            {activityCopy.freeFrom}
            <div className="input-with-icon">
              <Clock size={16} aria-hidden="true" />
              <input
                type="time"
                value={freeFrom}
                onChange={(event) => setFreeFrom(event.target.value)}
              />
            </div>
          </label>

          <label>
            {activityCopy.freeUntil}
            <div className="input-with-icon">
              <Clock size={16} aria-hidden="true" />
              <input
                type="time"
                value={freeUntil}
                onChange={(event) => setFreeUntil(event.target.value)}
              />
            </div>
          </label>
        </div>

        {hasTimeError ? <p className="form-error">{activityCopy.timeError}</p> : null}

        <div className="advanced-filter-card">
          <button
            className="advanced-filter-toggle"
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((value) => !value)}
          >
            <span>
              <Sparkles size={18} aria-hidden="true" />
              {activityCopy.advancedFilters}
              <small>{activityCopy.advancedSubtitle}</small>
            </span>

            <strong>{showAdvanced ? t.common.hide : t.common.show}</strong>
          </button>

          {showAdvanced ? (
            <div className="advanced-filters">
              <div className="premium-note">
                <Lock size={18} aria-hidden="true" />
                <span>{activityCopy.premiumNote}</span>
              </div>

              <div className="advanced-filter-grid">
                <label>
                  {activityCopy.durationType}
                  <select
                    value={durationType}
                    onChange={(event) =>
                      setDurationType(event.target.value as (typeof durationFilters)[number])
                    }
                  >
                    {durationFilters.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  {activityCopy.activityType ?? copy.activityType}
                  <select
                    value={activityType}
                    onChange={(event) =>
                      setActivityType(event.target.value as (typeof activityTypeFilters)[number])
                    }
                  >
                    {activityTypeFilters.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  {language === 'ar' ? 'أقل سعر' : 'Min price'}
                  <input
                    type="number"
                    min="0"
                    placeholder={t.common.any}
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                  />
                </label>

                <label>
                  {language === 'ar' ? 'أعلى سعر' : 'Max price'}
                  <input
                    type="number"
                    min="0"
                    placeholder={t.common.any}
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                  />
                </label>
              </div>

              <div className="toggle-filter-grid" aria-label={copy.activeFilters}>
                <button
                  type="button"
                  className={familyFriendly ? 'active' : ''}
                  onClick={() => setFamilyFriendly((value) => !value)}
                >
                  {activityCopy.familyFriendly}
                </button>

                <button
                  type="button"
                  className={includesTransfer ? 'active' : ''}
                  onClick={() => setIncludesTransfer((value) => !value)}
                >
                  {activityCopy.includesTransfer}
                </button>

                <button
                  type="button"
                  className={mealIncluded ? 'active' : ''}
                  onClick={() => setMealIncluded((value) => !value)}
                >
                  {activityCopy.mealIncluded}
                </button>

                <button
                  type="button"
                  className={outdoor ? 'active' : ''}
                  onClick={() => setOutdoor((value) => !value)}
                >
                  {activityCopy.outdoor}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="listing-results-header listing-results-header--enhanced">
        <p>
          <strong>{resultTotal}</strong>{' '}
          {resultTotal === 1
            ? activityCopy.resultFound
            : activityCopy.resultsFound}
        </p>

        <div className="results-toolbar">
          <label>
            {copy.sortBy}
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as ActivitySort)
              }
            >
              {activitySortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {language === 'ar' ? option.ar : option.en}
                </option>
              ))}
            </select>
          </label>

          <span>
            <Sparkles size={16} aria-hidden="true" />
            {travelAgencyIdParam
              ? `${copy.resultsAgency}${selectedAgencyName ? ` · ${selectedAgencyName}` : ''}`
              : selectedLandmark
                ? `${copy.resultsNear} ${selectedLandmark.name}`
                : activityCopy.normalAdvanced}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="empty-state empty-state--premium">
          <Sparkles size={34} aria-hidden="true" />
          <h2>{copy.loading}</h2>
        </div>
      ) : null}

      {!loading && loadError ? (
        <div className="empty-state empty-state--premium">
          <Sparkles size={34} aria-hidden="true" />
          <h2>{copy.error}</h2>
        </div>
      ) : null}

      {!loading && !loadError && filteredActivities.length > 0 ? (
        <>
          <div className="activity-grid activities-page__grid">
            {filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
              />
            ))}
          </div>

          {pagination.totalPages > 1 ? (
            <nav
              className="marketplace-pagination"
              aria-label={copy.page}
            >
              <button
                type="button"
                disabled={!pagination.hasPreviousPage}
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
              >
                {copy.previous}
              </button>

              <span aria-live="polite">
                {copy.page} {pagination.page} {copy.of}{' '}
                {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() =>
                  setPage((current) => current + 1)
                }
              >
                {copy.next}
              </button>
            </nav>
          ) : null}
        </>
      ) : null}

      {!loading && !loadError && filteredActivities.length === 0 ? (
        <div className="empty-state empty-state--premium">
          <Sparkles size={34} aria-hidden="true" />
          <h2>{activityCopy.noResultsTitle}</h2>
          <p>{activityCopy.noResultsText}</p>

          <button className="button-link button-link--secondary" type="button" onClick={resetFilters}>
            {t.common.resetFilters}
          </button>
        </div>
      ) : null}
    </section>
  );
}
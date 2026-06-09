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

import { getActivities, getLandmarks } from '../api/marketplace';
import ButtonLink from '../components/ButtonLink';
import { ActivityCard } from '../components/Cards';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
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

  const [activities, setActivities] = useState<Activity[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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

  const [priceKeyword, setPriceKeyword] = useState('');

  const activityCopy = t.activities ?? t.experiences;

  const copy =
    language === 'ar'
      ? {
          showingNear: 'يتم عرض الأنشطة بالقرب من',
          clear: 'مسح',
          landmark: 'المعلم / المنطقة',
          allAreas: 'كل المناطق',
          resultsNear: 'بالقرب من',
          activityType: 'نوع النشاط',
          activeFilters: 'الفلاتر النشطة',
          loading: 'جاري تحميل الأنشطة...',
          error: 'تعذر تحميل الأنشطة. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.'
        }
      : {
          showingNear: 'Showing activities near',
          clear: 'Clear',
          landmark: 'Landmark / area',
          allAreas: 'All areas',
          resultsNear: 'Near',
          activityType: 'Activity type',
          activeFilters: 'Active filters',
          loading: 'Loading activities...',
          error: 'Could not load activities. Make sure the backend is running and try again.'
        };

  useEffect(() => {
    setNearLandmark(nearParam);
  }, [nearParam]);

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      try {
        setLoading(true);
        setLoadError('');

        const [apiActivities, apiLandmarks] = await Promise.all([
          getActivities(language, { take: 100 }),
          getLandmarks(language, { take: 100 })
        ]);

        if (!isMounted) return;

        setActivities(apiActivities);
        setLandmarks(apiLandmarks);
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

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, [language, copy.error]);

  const selectedLandmark = useMemo(() => {
    return landmarks.find((landmark) => landmark.slug === nearLandmark);
  }, [landmarks, nearLandmark]);

  const hasTimeError =
    Boolean(freeFrom) &&
    Boolean(freeUntil) &&
    convertTimeToMinutes(freeFrom) >= convertTimeToMinutes(freeUntil);

  const activeFilterCount = useMemo(() => {
    return [
      query,
      location,
      selectedDate,
      freeFrom,
      freeUntil,
      nearLandmark,
      category !== 'All' ? category : '',
      durationType !== 'All' ? durationType : '',
      activityType !== 'All' ? activityType : '',
      familyFriendly ? 'family' : '',
      includesTransfer ? 'transfer' : '',
      mealIncluded ? 'meal' : '',
      outdoor ? 'outdoor' : '',
      priceKeyword
    ].filter(Boolean).length;
  }, [
    query,
    location,
    selectedDate,
    freeFrom,
    freeUntil,
    nearLandmark,
    category,
    durationType,
    activityType,
    familyFriendly,
    includesTransfer,
    mealIncluded,
    outdoor,
    priceKeyword
  ]);

  const filteredActivities = useMemo(() => {
    if (hasTimeError) {
      return [];
    }

    const selectedDay = getDayName(selectedDate);
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedLocation = location.trim().toLowerCase();
    const normalizedPriceKeyword = priceKeyword.trim().toLowerCase();
    const normalizedCategory = category.toLowerCase();

    return activities.filter((activity) => {
      const searchableText = [
        activity.title,
        activity.location,
        activity.category,
        activity.description,
        activity.provider,
        activity.groupSize,
        activity.difficulty,
        activity.language,
        activity.nearestLandmarkName,
        ...activity.highlights
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);

      const matchesCategory =
        category === 'All' || activity.category.toLowerCase().includes(normalizedCategory);

      const matchesLocation =
        !normalizedLocation ||
        activity.location.toLowerCase().includes(normalizedLocation) ||
        activity.nearestLandmarkName?.toLowerCase().includes(normalizedLocation);

      const matchesLandmark =
        !selectedLandmark || activity.nearestLandmarkId === selectedLandmark.id;

      const matchesDate =
        !selectedDay ||
        activity.availability.days.includes(
          selectedDay as (typeof activity.availability.days)[number]
        );

      const activityStart = convertTimeToMinutes(activity.availability.startTime);
      const activityEnd = convertTimeToMinutes(activity.availability.endTime);

      const userStart = freeFrom ? convertTimeToMinutes(freeFrom) : null;
      const userEnd = freeUntil ? convertTimeToMinutes(freeUntil) : null;

      const matchesTime =
        (userStart === null || activityStart >= userStart) &&
        (userEnd === null || activityEnd <= userEnd);

      const matchesDuration =
        durationType === 'All' || activity.specs.durationType === durationType;

      const matchesActivityType =
        activityType === 'All' ||
        activity.specs.experienceType === activityType ||
        activity.specs.experienceType === 'Both';

      const matchesFamily = !familyFriendly || activity.specs.familyFriendly;
      const matchesTransfer = !includesTransfer || activity.specs.includesTransfer;
      const matchesMeal = !mealIncluded || activity.specs.mealIncluded;
      const matchesOutdoor = !outdoor || activity.specs.outdoor;

      const matchesPrice =
        !normalizedPriceKeyword || activity.price.toLowerCase().includes(normalizedPriceKeyword);

      return (
        matchesQuery &&
        matchesCategory &&
        matchesLocation &&
        matchesLandmark &&
        matchesDate &&
        matchesTime &&
        matchesDuration &&
        matchesActivityType &&
        matchesFamily &&
        matchesTransfer &&
        matchesMeal &&
        matchesOutdoor &&
        matchesPrice
      );
    });
  }, [
    activities,
    query,
    category,
    location,
    selectedDate,
    freeFrom,
    freeUntil,
    selectedLandmark,
    durationType,
    activityType,
    familyFriendly,
    includesTransfer,
    mealIncluded,
    outdoor,
    priceKeyword,
    hasTimeError
  ]);

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
    setPriceKeyword('');
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

  return (
    <section className="page-section container">
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
                  {activityCopy.maxPriceKeyword}
                  <input
                    placeholder="OMR 40, OMR 100..."
                    value={priceKeyword}
                    onChange={(event) => setPriceKeyword(event.target.value)}
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

      <div className="listing-results-header">
        <p>
          <strong>{filteredActivities.length}</strong>{' '}
          {filteredActivities.length === 1
            ? activityCopy.resultFound
            : activityCopy.resultsFound}
        </p>

        <span>
          <Sparkles size={16} aria-hidden="true" />
          {selectedLandmark
            ? `${copy.resultsNear} ${selectedLandmark.name}`
            : activityCopy.normalAdvanced}
        </span>
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

      {!loading && !loadError ? (
        <div className="activity-grid">
          {filteredActivities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
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
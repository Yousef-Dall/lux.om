import {
  Bath,
  BedDouble,
  Filter,
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

import { getDevelopers, getLandmarks, getListings } from '../api/marketplace';
import { ListingCard } from '../components/Cards';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { DevelopmentCompany, Landmark, Listing, ListingTransaction } from '../types';

const transactionFilters = ['All', 'Sale', 'Rent', 'Short stay'] as const;

const typeFilters = [
  'All',
  'Villa',
  'Apartment',
  'Chalet',
  'Penthouse',
  'Resort apartment',
  'Land'
] as const;

const furnishingFilters = ['All', 'Furnished', 'Semi-furnished', 'Unfurnished'] as const;

const viewFilters = [
  'All',
  'Sea view',
  'Mountain view',
  'City view',
  'Garden view',
  'Golf view'
] as const;

const amenityFilters = [
  'Private pool',
  'Sea view',
  'Parking',
  'Garden',
  'Terrace',
  'Pool access',
  'Furnished',
  'Gym access',
  'Family friendly',
  'Security',
  'Kitchen',
  'Housekeeping'
];

const sortOptions = [
  'Recommended',
  'Newest',
  'Price low to high',
  'Price high to low',
  'Largest area'
] as const;

type TransactionFilter = (typeof transactionFilters)[number];
type SortOption = (typeof sortOptions)[number];

type ActiveChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

function getPriceValue(price: string) {
  const match = price.replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function isTransactionFilter(value: string | null): value is ListingTransaction {
  return value === 'Sale' || value === 'Rent' || value === 'Short stay';
}

export default function Listings() {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  useDocumentTitle('Listings');

  const initialNear = searchParams.get('near') ?? '';
  const initialType = searchParams.get('type');
  const initialDeveloper = searchParams.get('developer') ?? '';

  const [listings, setListings] = useState<Listing[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [developmentCompanies, setDevelopmentCompanies] = useState<DevelopmentCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [query, setQuery] = useState('');
  const [transaction, setTransaction] = useState<TransactionFilter>(
    isTransactionFilter(initialType) ? initialType : 'All'
  );
  const [propertyType, setPropertyType] = useState<(typeof typeFilters)[number]>('All');
  const [location, setLocation] = useState('');
  const [selectedLandmarkSlug, setSelectedLandmarkSlug] = useState(initialNear);
  const [selectedDeveloperSlug, setSelectedDeveloperSlug] = useState(initialDeveloper);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minBeds, setMinBeds] = useState('');
  const [minBaths, setMinBaths] = useState('');
  const [minSqm, setMinSqm] = useState('');
  const [minGuests, setMinGuests] = useState('');
  const [minParking, setMinParking] = useState('');
  const [priceKeyword, setPriceKeyword] = useState('');
  const [furnishing, setFurnishing] = useState<(typeof furnishingFilters)[number]>('All');
  const [view, setView] = useState<(typeof viewFilters)[number]>('All');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('Recommended');

  const copy =
    language === 'ar'
      ? {
          landmark: 'المعلم أو المنطقة',
          allLandmarks: 'كل المعالم والمناطق',
          developer: 'المطور العقاري',
          allDevelopers: 'كل المطورين',
          showingNear: 'يتم عرض العقارات بالقرب من',
          showingDeveloper: 'يتم عرض العقارات من',
          clear: 'مسح',
          maxGuests: 'الحد الأدنى للضيوف',
          parking: 'مواقف السيارات',
          furnishing: 'التأثيث',
          view: 'الإطلالة',
          sortBy: 'ترتيب حسب',
          quickFilters: 'فلاتر سريعة للغرف والحمامات',
          activeFilters: 'الفلاتر النشطة',
          loading: 'جاري تحميل العقارات...',
          error: 'تعذر تحميل العقارات. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.'
        }
      : {
          landmark: 'Landmark or area',
          allLandmarks: 'All landmarks and areas',
          developer: 'Developer',
          allDevelopers: 'All developers',
          showingNear: 'Showing properties near',
          showingDeveloper: 'Showing properties by',
          clear: 'Clear',
          maxGuests: 'Minimum guests',
          parking: 'Parking spaces',
          furnishing: 'Furnishing',
          view: 'View',
          sortBy: 'Sort by',
          quickFilters: 'Quick bedroom and bathroom filters',
          activeFilters: 'Active filters',
          loading: 'Loading listings...',
          error: 'Could not load listings. Make sure the backend is running and try again.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      try {
        setLoading(true);
        setLoadError('');

        const [apiListings, apiLandmarks, apiDevelopers] = await Promise.all([
          getListings(language, { take: 100 }),
          getLandmarks(language, { take: 100 }),
          getDevelopers(language, { take: 100 })
        ]);

        if (!isMounted) return;

        setListings(apiListings);
        setLandmarks(apiLandmarks);
        setDevelopmentCompanies(apiDevelopers);
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

  const selectedLandmark = useMemo(
    () => landmarks.find((landmark) => landmark.slug === selectedLandmarkSlug),
    [landmarks, selectedLandmarkSlug]
  );

  const selectedDeveloper = useMemo(
    () => developmentCompanies.find((developer) => developer.slug === selectedDeveloperSlug),
    [developmentCompanies, selectedDeveloperSlug]
  );

  useEffect(() => {
    const nextNear = searchParams.get('near') ?? '';
    const nextType = searchParams.get('type');
    const nextDeveloper = searchParams.get('developer') ?? '';

    setSelectedLandmarkSlug(nextNear);
    setSelectedDeveloperSlug(nextDeveloper);
    setTransaction(isTransactionFilter(nextType) ? nextType : 'All');
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedLandmarkSlug) {
      params.set('near', selectedLandmarkSlug);
    }

    if (transaction !== 'All') {
      params.set('type', transaction);
    }

    if (selectedDeveloperSlug) {
      params.set('developer', selectedDeveloperSlug);
    }

    setSearchParams(params, { replace: true });
  }, [selectedLandmarkSlug, selectedDeveloperSlug, transaction, setSearchParams]);

  const activeChips = useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];

    if (query.trim()) {
      chips.push({ key: 'query', label: `Search: ${query}`, onRemove: () => setQuery('') });
    }

    if (location.trim()) {
      chips.push({
        key: 'location',
        label: `Location: ${location}`,
        onRemove: () => setLocation('')
      });
    }

    if (selectedLandmark) {
      chips.push({
        key: 'landmark',
        label: `Near: ${selectedLandmark.name}`,
        onRemove: () => setSelectedLandmarkSlug('')
      });
    }

    if (selectedDeveloper) {
      chips.push({
        key: 'developer',
        label: `Developer: ${selectedDeveloper.name}`,
        onRemove: () => setSelectedDeveloperSlug('')
      });
    }

    if (transaction !== 'All') {
      chips.push({ key: 'transaction', label: transaction, onRemove: () => setTransaction('All') });
    }

    if (propertyType !== 'All') {
      chips.push({
        key: 'propertyType',
        label: propertyType,
        onRemove: () => setPropertyType('All')
      });
    }

    if (minBeds) chips.push({ key: 'minBeds', label: `${minBeds}+ beds`, onRemove: () => setMinBeds('') });
    if (minBaths) chips.push({ key: 'minBaths', label: `${minBaths}+ baths`, onRemove: () => setMinBaths('') });
    if (minSqm) chips.push({ key: 'minSqm', label: `${minSqm}+ sqm`, onRemove: () => setMinSqm('') });
    if (minGuests) chips.push({ key: 'minGuests', label: `${minGuests}+ guests`, onRemove: () => setMinGuests('') });
    if (minParking) chips.push({ key: 'minParking', label: `${minParking}+ parking`, onRemove: () => setMinParking('') });

    if (priceKeyword.trim()) {
      chips.push({
        key: 'priceKeyword',
        label: `Price: ${priceKeyword}`,
        onRemove: () => setPriceKeyword('')
      });
    }

    if (furnishing !== 'All') {
      chips.push({ key: 'furnishing', label: furnishing, onRemove: () => setFurnishing('All') });
    }

    if (view !== 'All') {
      chips.push({ key: 'view', label: view, onRemove: () => setView('All') });
    }

    selectedAmenities.forEach((amenity) => {
      chips.push({
        key: `amenity-${amenity}`,
        label: amenity,
        onRemove: () =>
          setSelectedAmenities((current) => current.filter((item) => item !== amenity))
      });
    });

    return chips;
  }, [
    query,
    location,
    selectedLandmark,
    selectedDeveloper,
    transaction,
    propertyType,
    minBeds,
    minBaths,
    minSqm,
    minGuests,
    minParking,
    priceKeyword,
    furnishing,
    view,
    selectedAmenities
  ]);

  const activeFilterCount = activeChips.length;

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedLocation = location.trim().toLowerCase();
    const normalizedPriceKeyword = priceKeyword.trim().toLowerCase();

    const filtered = listings.filter((listing) => {
      const searchableListingText = [
        listing.title,
        listing.location,
        listing.type,
        listing.description,
        listing.price,
        listing.developer?.name,
        listing.nearestLandmarkName,
        ...listing.amenities
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesQuery = !normalizedQuery || searchableListingText.includes(normalizedQuery);
      const matchesTransaction = transaction === 'All' || listing.transaction === transaction;
      const matchesType = propertyType === 'All' || listing.type === propertyType;

      const matchesLocation =
        !normalizedLocation || listing.location.toLowerCase().includes(normalizedLocation);

      const matchesLandmark =
        !selectedLandmark || listing.nearestLandmarkId === selectedLandmark.id;

      const matchesDeveloper =
        !selectedDeveloper || listing.developerId === selectedDeveloper.id;

      const matchesBeds = !minBeds || listing.beds >= Number(minBeds);
      const matchesBaths = !minBaths || listing.baths >= Number(minBaths);
      const matchesSqm = !minSqm || listing.sqm >= Number(minSqm);
      const matchesGuests = !minGuests || (listing.maxGuests ?? 0) >= Number(minGuests);
      const matchesParking = !minParking || (listing.parkingSpaces ?? 0) >= Number(minParking);

      const matchesPriceKeyword =
        !normalizedPriceKeyword || listing.price.toLowerCase().includes(normalizedPriceKeyword);

      const matchesFurnishing = furnishing === 'All' || listing.furnishing === furnishing;
      const matchesView = view === 'All' || listing.view === view;

      const matchesAmenities =
        selectedAmenities.length === 0 ||
        selectedAmenities.every((amenity) => listing.amenities.includes(amenity));

      return (
        matchesQuery &&
        matchesTransaction &&
        matchesType &&
        matchesLocation &&
        matchesLandmark &&
        matchesDeveloper &&
        matchesBeds &&
        matchesBaths &&
        matchesSqm &&
        matchesGuests &&
        matchesParking &&
        matchesPriceKeyword &&
        matchesFurnishing &&
        matchesView &&
        matchesAmenities
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'Price low to high') return getPriceValue(a.price) - getPriceValue(b.price);
      if (sortBy === 'Price high to low') return getPriceValue(b.price) - getPriceValue(a.price);
      if (sortBy === 'Largest area') return b.sqm - a.sqm;
      if (sortBy === 'Newest') return b.id.localeCompare(a.id);

      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });
  }, [
    listings,
    query,
    transaction,
    propertyType,
    location,
    selectedLandmark,
    selectedDeveloper,
    minBeds,
    minBaths,
    minSqm,
    minGuests,
    minParking,
    priceKeyword,
    furnishing,
    view,
    selectedAmenities,
    sortBy
  ]);

  function toggleAmenity(amenity: string) {
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity]
    );
  }

  function clearLandmarkFilter() {
    setSelectedLandmarkSlug('');
  }

  function clearDeveloperFilter() {
    setSelectedDeveloperSlug('');
  }

  function resetFilters() {
    setQuery('');
    setTransaction('All');
    setPropertyType('All');
    setLocation('');
    setSelectedLandmarkSlug('');
    setSelectedDeveloperSlug('');
    setMinBeds('');
    setMinBaths('');
    setMinSqm('');
    setMinGuests('');
    setMinParking('');
    setPriceKeyword('');
    setFurnishing('All');
    setView('All');
    setSelectedAmenities([]);
    setSortBy('Recommended');
  }

  return (
    <section className="page-section container">
      <SectionHeader
        eyebrow={t.listings.eyebrow}
        title={t.listings.title}
        description={t.listings.description}
      />

      {selectedLandmark ? (
        <div className="filter-context-banner">
          <MapPin size={18} aria-hidden="true" />
          <span>
            {copy.showingNear} <strong>{selectedLandmark.name}</strong>
          </span>
          <button type="button" onClick={clearLandmarkFilter}>
            {copy.clear}
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {selectedDeveloper ? (
        <div className="filter-context-banner">
          <Sparkles size={18} aria-hidden="true" />
          <span>
            {copy.showingDeveloper} <strong>{selectedDeveloper.name}</strong>
          </span>
          <button type="button" onClick={clearDeveloperFilter}>
            {copy.clear}
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="filters-shell filters-shell--premium">
        <div className="filters-header">
          <div>
            <p className="eyebrow">{t.listings.normalFilters}</p>
            <h2>{t.listings.quickSearch}</h2>
          </div>

          <div className="filters-header__actions">
            {activeFilterCount > 0 ? (
              <span className="active-filter-count">
                <Filter size={15} aria-hidden="true" />
                {activeFilterCount}
              </span>
            ) : null}

            <button className="reset-filter-button" type="button" onClick={resetFilters}>
              <RotateCcw size={16} aria-hidden="true" />
              {t.common.resetFilters}
            </button>
          </div>
        </div>

        <div className="normal-filters">
          <label className="search-input">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">{t.listings.quickSearch}</span>
            <input
              type="search"
              placeholder={t.listings.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label>
            {t.listings.transaction}
            <select
              value={transaction}
              onChange={(event) => setTransaction(event.target.value as TransactionFilter)}
            >
              {transactionFilters.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            {t.listings.propertyType}
            <select
              value={propertyType}
              onChange={(event) =>
                setPropertyType(event.target.value as (typeof typeFilters)[number])
              }
            >
              {typeFilters.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            {t.listings.location}
            <div className="input-with-icon">
              <MapPin size={16} aria-hidden="true" />
              <input
                placeholder={t.listings.locationPlaceholder}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
          </label>

          <label>
            {copy.landmark}
            <select
              value={selectedLandmarkSlug}
              onChange={(event) => setSelectedLandmarkSlug(event.target.value)}
            >
              <option value="">{copy.allLandmarks}</option>
              {landmarks.map((landmark) => (
                <option key={landmark.id} value={landmark.slug}>
                  {landmark.name} · {landmark.city}
                </option>
              ))}
            </select>
          </label>

          <label>
            {copy.developer}
            <select
              value={selectedDeveloperSlug}
              onChange={(event) => setSelectedDeveloperSlug(event.target.value)}
            >
              <option value="">{copy.allDevelopers}</option>
              {developmentCompanies.map((developer) => (
                <option key={developer.id} value={developer.slug}>
                  {developer.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="quick-filter-row" aria-label={copy.quickFilters}>
          <button
            type="button"
            onClick={() => setMinBeds((current) => (current === '2' ? '' : '2'))}
            className={minBeds === '2' ? 'active' : ''}
          >
            <BedDouble size={15} aria-hidden="true" />
            2+ beds
          </button>

          <button
            type="button"
            onClick={() => setMinBeds((current) => (current === '3' ? '' : '3'))}
            className={minBeds === '3' ? 'active' : ''}
          >
            <BedDouble size={15} aria-hidden="true" />
            3+ beds
          </button>

          <button
            type="button"
            onClick={() => setMinBaths((current) => (current === '2' ? '' : '2'))}
            className={minBaths === '2' ? 'active' : ''}
          >
            <Bath size={15} aria-hidden="true" />
            2+ baths
          </button>

          <button
            type="button"
            onClick={() => toggleAmenity('Sea view')}
            className={selectedAmenities.includes('Sea view') ? 'active' : ''}
          >
            Sea view
          </button>

          <button
            type="button"
            onClick={() => toggleAmenity('Private pool')}
            className={selectedAmenities.includes('Private pool') ? 'active' : ''}
          >
            Private pool
          </button>
        </div>

        {activeChips.length > 0 ? (
          <div className="active-chip-row" aria-label={copy.activeFilters}>
            {activeChips.map((chip) => (
              <button key={chip.key} type="button" onClick={chip.onRemove}>
                {chip.label}
                <X size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="advanced-filter-card advanced-filter-card--drawer">
          <button
            className="advanced-filter-toggle"
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((value) => !value)}
          >
            <span>
              <Sparkles size={18} aria-hidden="true" />
              {t.listings.advancedFilters}
              <small>{t.listings.advancedSubtitle}</small>
            </span>

            <strong>{showAdvanced ? t.common.hide : t.common.show}</strong>
          </button>

          {showAdvanced ? (
            <div className="advanced-filters">
              <div className="premium-note">
                <Lock size={18} aria-hidden="true" />
                <span>{t.listings.premiumNote}</span>
              </div>

              <div className="advanced-filter-grid">
                <label>
                  {t.listings.minBedrooms}
                  <input
                    type="number"
                    min="0"
                    placeholder={t.common.any}
                    value={minBeds}
                    onChange={(event) => setMinBeds(event.target.value)}
                  />
                </label>

                <label>
                  {t.listings.minBathrooms}
                  <input
                    type="number"
                    min="0"
                    placeholder={t.common.any}
                    value={minBaths}
                    onChange={(event) => setMinBaths(event.target.value)}
                  />
                </label>

                <label>
                  {t.listings.minArea}
                  <input
                    type="number"
                    min="0"
                    placeholder="sqm"
                    value={minSqm}
                    onChange={(event) => setMinSqm(event.target.value)}
                  />
                </label>

                <label>
                  {copy.maxGuests}
                  <input
                    type="number"
                    min="0"
                    placeholder={t.common.any}
                    value={minGuests}
                    onChange={(event) => setMinGuests(event.target.value)}
                  />
                </label>

                <label>
                  {copy.parking}
                  <input
                    type="number"
                    min="0"
                    placeholder={t.common.any}
                    value={minParking}
                    onChange={(event) => setMinParking(event.target.value)}
                  />
                </label>

                <label>
                  {t.listings.priceKeyword}
                  <input
                    placeholder="OMR 500, /night, /mo..."
                    value={priceKeyword}
                    onChange={(event) => setPriceKeyword(event.target.value)}
                  />
                </label>

                <label>
                  {copy.furnishing}
                  <select
                    value={furnishing}
                    onChange={(event) =>
                      setFurnishing(event.target.value as (typeof furnishingFilters)[number])
                    }
                  >
                    {furnishingFilters.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  {copy.view}
                  <select
                    value={view}
                    onChange={(event) =>
                      setView(event.target.value as (typeof viewFilters)[number])
                    }
                  >
                    {viewFilters.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="amenity-filter-group">
                <p>{t.listings.amenities}</p>

                <div className="amenity-filter-list">
                  {amenityFilters.map((amenity) => (
                    <button
                      key={amenity}
                      type="button"
                      className={selectedAmenities.includes(amenity) ? 'active' : ''}
                      onClick={() => toggleAmenity(amenity)}
                    >
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="listing-results-header listing-results-header--enhanced">
        <p>
          <strong>{filteredListings.length}</strong>{' '}
          {filteredListings.length === 1 ? t.listings.result : t.listings.results}
        </p>

        <div className="results-toolbar">
          <label>
            {copy.sortBy}
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
            >
              {sortOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <span>
            <SlidersHorizontal size={16} aria-hidden="true" />
            {t.listings.normalAdvanced}
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

      {!loading && !loadError ? (
        <div className="listing-grid">
          {filteredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : null}

      {!loading && !loadError && filteredListings.length === 0 ? (
        <div className="empty-state empty-state--premium">
          <Sparkles size={34} aria-hidden="true" />
          <h2>{t.listings.noResultsTitle}</h2>
          <p>{t.listings.noResultsText}</p>
          <button className="button-link button-link--secondary" type="button" onClick={resetFilters}>
            {t.common.resetFilters}
          </button>
        </div>
      ) : null}
    </section>
  );
}
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

import {
  getDevelopers,
  getLandmarks,
  getListingsPage,
  type MarketplacePagination
} from '../api/marketplace';
import { ListingCard } from '../components/Cards';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useLanguage } from '../i18n/LanguageContext';
import {
  formatListingBuyerEligibility,
  listingBuyerEligibilityOptions
} from '../utils/listingEligibility';
import type {
  DevelopmentCompany,
  Landmark,
  Listing,
  ListingBuyerEligibility
} from '../types';

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

const buyerEligibilityFilters = ['All', ...listingBuyerEligibilityOptions] as const;

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
type BuyerEligibilityFilter = 'All' | ListingBuyerEligibility;
type SortOption = (typeof sortOptions)[number];

type ListingSort =
  | 'recommended'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'area_desc';

const LISTINGS_PAGE_SIZE = 12;

const initialPagination: MarketplacePagination = {
  take: LISTINGS_PAGE_SIZE,
  skip: 0,
  count: 0,
  page: 1,
  pageSize: LISTINGS_PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false
};

function getListingSort(sortBy: SortOption): ListingSort {
  switch (sortBy) {
    case 'Newest':
      return 'newest';
    case 'Price low to high':
      return 'price_asc';
    case 'Price high to low':
      return 'price_desc';
    case 'Largest area':
      return 'area_desc';
    default:
      return 'recommended';
  }
}

type ActiveChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

function toOptionalNumber(value: string) {
  const normalized = value.trim();

  if (!normalized) return undefined;

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function getFilterParam<T extends readonly string[]>(
  value: string | null,
  options: T,
  fallback: T[number]
) {
  return value && options.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function getNonNegativeNumberParam(value: string | null) {
  if (!value) return '';

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? value : '';
}

function getAmenitiesParam(value: string | null) {
  if (!value) return [];

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => amenityFilters.includes(item));
}

export default function Listings() {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  useDocumentTitle('Listings');

  const initialNear = searchParams.get('near') ?? '';
  const initialTransaction = searchParams.get('transaction') ?? searchParams.get('type');
  const initialDeveloper = searchParams.get('developer') ?? '';
  const initialPropertyType = getFilterParam(
    searchParams.get('propertyType'),
    typeFilters,
    'All'
  );
  const initialBuyerEligibility = getFilterParam(
    searchParams.get('buyerEligibility'),
    buyerEligibilityFilters,
    'All'
  ) as BuyerEligibilityFilter;
  const initialFurnishing = getFilterParam(
    searchParams.get('furnishing'),
    furnishingFilters,
    'All'
  );
  const initialView = getFilterParam(searchParams.get('view'), viewFilters, 'All');
  const initialSortBy = getFilterParam(searchParams.get('sortBy'), sortOptions, 'Recommended');

  const [listings, setListings] = useState<Listing[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [developmentCompanies, setDevelopmentCompanies] = useState<DevelopmentCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] =
    useState<MarketplacePagination>(initialPagination);

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [transaction, setTransaction] = useState<TransactionFilter>(
    getFilterParam(initialTransaction, transactionFilters, 'All')
  );
  const [propertyType, setPropertyType] = useState<(typeof typeFilters)[number]>(initialPropertyType);
  const [buyerEligibility, setBuyerEligibility] = useState<BuyerEligibilityFilter>(initialBuyerEligibility);
  const [location, setLocation] = useState(searchParams.get('location') ?? '');
  const [selectedLandmarkSlug, setSelectedLandmarkSlug] = useState(initialNear);
  const [selectedDeveloperSlug, setSelectedDeveloperSlug] = useState(initialDeveloper);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minBeds, setMinBeds] = useState(getNonNegativeNumberParam(searchParams.get('minBeds')));
  const [minBaths, setMinBaths] = useState(getNonNegativeNumberParam(searchParams.get('minBaths')));
  const [minSqm, setMinSqm] = useState(getNonNegativeNumberParam(searchParams.get('minSqm')));
  const [minGuests, setMinGuests] = useState(getNonNegativeNumberParam(searchParams.get('minGuests')));
  const [minParking, setMinParking] = useState(getNonNegativeNumberParam(searchParams.get('minParking')));
  const [minPrice, setMinPrice] = useState(getNonNegativeNumberParam(searchParams.get('minPrice')));
  const [maxPrice, setMaxPrice] = useState(getNonNegativeNumberParam(searchParams.get('maxPrice')));
  const [furnishing, setFurnishing] = useState<(typeof furnishingFilters)[number]>(initialFurnishing);
  const [view, setView] = useState<(typeof viewFilters)[number]>(initialView);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    getAmenitiesParam(searchParams.get('amenities'))
  );
  const [sortBy, setSortBy] = useState<SortOption>(initialSortBy);

  const debouncedQuery = useDebouncedValue(query);
  const debouncedLocation = useDebouncedValue(location);
  const debouncedMinPrice = useDebouncedValue(minPrice);
  const debouncedMaxPrice = useDebouncedValue(maxPrice);

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
          buyerEligibility: 'أهلية الشراء',
          allBuyerEligibility: 'كل فئات المشترين',
          sortBy: 'ترتيب حسب',
          quickFilters: 'فلاتر سريعة للغرف والحمامات',
          activeFilters: 'الفلاتر النشطة',
          loading: 'جاري تحميل العقارات...',
          error: 'تعذر تحميل العقارات. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.',
          previous: 'السابق',
          next: 'التالي',
          page: 'الصفحة',
          of: 'من'
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
          buyerEligibility: 'Buyer eligibility',
          allBuyerEligibility: 'All buyer groups',
          sortBy: 'Sort by',
          quickFilters: 'Quick bedroom and bathroom filters',
          activeFilters: 'Active filters',
          loading: 'Loading listings...',
          error: 'Could not load listings. Make sure the backend is running and try again.',
          previous: 'Previous',
          next: 'Next',
          page: 'Page',
          of: 'of'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadFilterData() {
      try {
        const [apiLandmarks, apiDevelopers] = await Promise.all([
          getLandmarks(language, { take: 100 }),
          getDevelopers(language, { take: 100 })
        ]);

        if (!isMounted) return;

        setLandmarks(apiLandmarks);
        setDevelopmentCompanies(apiDevelopers);
      } catch (error) {
        if (!isMounted) return;

        console.error(error);
        setLoadError(copy.error);
      }
    }

    void loadFilterData();

    return () => {
      isMounted = false;
    };
  }, [language, copy.error]);

  useEffect(() => {
    setPage(1);
  }, [
    language,
    debouncedQuery,
    transaction,
    propertyType,
    buyerEligibility,
    debouncedLocation,
    selectedLandmarkSlug,
    selectedDeveloperSlug,
    minBeds,
    minBaths,
    minSqm,
    minGuests,
    minParking,
    debouncedMinPrice,
    debouncedMaxPrice,
    furnishing,
    view,
    selectedAmenities,
    sortBy
  ]);

  useEffect(() => {
    let isMounted = true;

    const selectedLandmarkId = selectedLandmarkSlug
      ? landmarks.find((landmark) => landmark.slug === selectedLandmarkSlug)?.id
      : undefined;

    const selectedDeveloperId = selectedDeveloperSlug
      ? developmentCompanies.find(
          (developer) => developer.slug === selectedDeveloperSlug
        )?.id
      : undefined;

    if (selectedLandmarkSlug && !selectedLandmarkId) {
      return () => {
        isMounted = false;
      };
    }

    if (selectedDeveloperSlug && !selectedDeveloperId) {
      return () => {
        isMounted = false;
      };
    }

    async function loadListings() {
      try {
        setLoading(true);
        setLoadError('');

        const result = await getListingsPage(language, {
          search: debouncedQuery.trim() || undefined,
          sort: getListingSort(sortBy),
          transaction:
            transaction !== 'All' ? transaction : undefined,
          buyerEligibility:
            buyerEligibility !== 'All' ? buyerEligibility : undefined,
          type:
            propertyType !== 'All' ? propertyType : undefined,
          location: debouncedLocation.trim() || undefined,
          nearestLandmarkId: selectedLandmarkId,
          developerId: selectedDeveloperId,
          minBeds: toOptionalNumber(minBeds),
          minBaths: toOptionalNumber(minBaths),
          minSqm: toOptionalNumber(minSqm),
          minGuests: toOptionalNumber(minGuests),
          minParking: toOptionalNumber(minParking),
          minPrice: debouncedMinPrice.trim()
            ? Number(debouncedMinPrice)
            : undefined,
          maxPrice: debouncedMaxPrice.trim()
            ? Number(debouncedMaxPrice)
            : undefined,
          furnishing:
            furnishing !== 'All' ? furnishing : undefined,
          view: view !== 'All' ? view : undefined,
          amenities:
            selectedAmenities.length > 0
              ? selectedAmenities.join(',')
              : undefined,
          page,
          pageSize: LISTINGS_PAGE_SIZE
        });

        if (!isMounted) return;

        setListings(result.items);
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

    void loadListings();

    return () => {
      isMounted = false;
    };
  }, [
    language,
    debouncedQuery,
    transaction,
    propertyType,
    buyerEligibility,
    debouncedLocation,
    selectedLandmarkSlug,
    selectedDeveloperSlug,
    landmarks,
    developmentCompanies,
    minBeds,
    minBaths,
    minSqm,
    minGuests,
    minParking,
    debouncedMinPrice,
    debouncedMaxPrice,
    furnishing,
    view,
    selectedAmenities,
    sortBy,
    page,
    copy.error
  ]);

  const selectedLandmark = useMemo(
    () => landmarks.find((landmark) => landmark.slug === selectedLandmarkSlug),
    [landmarks, selectedLandmarkSlug]
  );

  const selectedDeveloper = useMemo(
    () => developmentCompanies.find((developer) => developer.slug === selectedDeveloperSlug),
    [developmentCompanies, selectedDeveloperSlug]
  );

  useEffect(() => {
    const nextTransaction = searchParams.get('transaction') ?? searchParams.get('type');

    setQuery(searchParams.get('q') ?? '');
    setSelectedLandmarkSlug(searchParams.get('near') ?? '');
    setSelectedDeveloperSlug(searchParams.get('developer') ?? '');
    setTransaction(getFilterParam(nextTransaction, transactionFilters, 'All'));
    setPropertyType(getFilterParam(searchParams.get('propertyType'), typeFilters, 'All'));
    setBuyerEligibility(
      getFilterParam(searchParams.get('buyerEligibility'), buyerEligibilityFilters, 'All') as BuyerEligibilityFilter
    );
    setLocation(searchParams.get('location') ?? '');
    setMinBeds(getNonNegativeNumberParam(searchParams.get('minBeds')));
    setMinBaths(getNonNegativeNumberParam(searchParams.get('minBaths')));
    setMinSqm(getNonNegativeNumberParam(searchParams.get('minSqm')));
    setMinGuests(getNonNegativeNumberParam(searchParams.get('minGuests')));
    setMinParking(getNonNegativeNumberParam(searchParams.get('minParking')));
    setMinPrice(getNonNegativeNumberParam(searchParams.get('minPrice')));
    setMaxPrice(getNonNegativeNumberParam(searchParams.get('maxPrice')));
    setFurnishing(getFilterParam(searchParams.get('furnishing'), furnishingFilters, 'All'));
    setView(getFilterParam(searchParams.get('view'), viewFilters, 'All'));
    setSelectedAmenities(getAmenitiesParam(searchParams.get('amenities')));
    setSortBy(getFilterParam(searchParams.get('sortBy'), sortOptions, 'Recommended'));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (query.trim()) params.set('q', query.trim());
    if (selectedLandmarkSlug) params.set('near', selectedLandmarkSlug);
    if (selectedDeveloperSlug) params.set('developer', selectedDeveloperSlug);
    if (transaction !== 'All') params.set('transaction', transaction);
    if (propertyType !== 'All') params.set('propertyType', propertyType);
    if (buyerEligibility !== 'All') params.set('buyerEligibility', buyerEligibility);
    if (location.trim()) params.set('location', location.trim());
    if (minBeds) params.set('minBeds', minBeds);
    if (minBaths) params.set('minBaths', minBaths);
    if (minSqm) params.set('minSqm', minSqm);
    if (minGuests) params.set('minGuests', minGuests);
    if (minParking) params.set('minParking', minParking);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (furnishing !== 'All') params.set('furnishing', furnishing);
    if (view !== 'All') params.set('view', view);
    if (selectedAmenities.length > 0) params.set('amenities', selectedAmenities.join(','));
    if (sortBy !== 'Recommended') params.set('sortBy', sortBy);

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    query,
    selectedLandmarkSlug,
    selectedDeveloperSlug,
    transaction,
    propertyType,
    buyerEligibility,
    location,
    minBeds,
    minBaths,
    minSqm,
    minGuests,
    minParking,
    minPrice,
    maxPrice,
    furnishing,
    view,
    selectedAmenities,
    sortBy,
    searchParams,
    setSearchParams
  ]);

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

    if (buyerEligibility !== 'All') {
      chips.push({
        key: 'buyerEligibility',
        label: formatListingBuyerEligibility(buyerEligibility, language),
        onRemove: () => setBuyerEligibility('All')
      });
    }

    if (minBeds) chips.push({ key: 'minBeds', label: `${minBeds}+ beds`, onRemove: () => setMinBeds('') });
    if (minBaths) chips.push({ key: 'minBaths', label: `${minBaths}+ baths`, onRemove: () => setMinBaths('') });
    if (minSqm) chips.push({ key: 'minSqm', label: `${minSqm}+ sqm`, onRemove: () => setMinSqm('') });
    if (minGuests) chips.push({ key: 'minGuests', label: `${minGuests}+ guests`, onRemove: () => setMinGuests('') });
    if (minParking) chips.push({ key: 'minParking', label: `${minParking}+ parking`, onRemove: () => setMinParking('') });

    if (minPrice.trim()) {
      chips.push({
        key: 'minPrice',
        label: `${language === 'ar' ? 'السعر من' : 'Price from'}: OMR ${minPrice}`,
        onRemove: () => setMinPrice('')
      });
    }

    if (maxPrice.trim()) {
      chips.push({
        key: 'maxPrice',
        label: `${language === 'ar' ? 'السعر حتى' : 'Price up to'}: OMR ${maxPrice}`,
        onRemove: () => setMaxPrice('')
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
    buyerEligibility,
    minBeds,
    minBaths,
    minSqm,
    minGuests,
    minParking,
    minPrice,
    maxPrice,
    language,
    furnishing,
    view,
    selectedAmenities
  ]);

  const activeFilterCount = activeChips.length;

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
    setBuyerEligibility('All');
    setLocation('');
    setSelectedLandmarkSlug('');
    setSelectedDeveloperSlug('');
    setMinBeds('');
    setMinBaths('');
    setMinSqm('');
    setMinGuests('');
    setMinParking('');
    setMinPrice('');
    setMaxPrice('');
    setFurnishing('All');
    setView('All');
    setSelectedAmenities([]);
    setSortBy('Recommended');
    setPage(1);
  }

return (
  <section className="page-section container listings-page">
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
            {copy.buyerEligibility}
            <select
              value={buyerEligibility}
              onChange={(event) =>
                setBuyerEligibility(event.target.value as BuyerEligibilityFilter)
              }
            >
              {buyerEligibilityFilters.map((item) => (
                <option key={item} value={item}>
                  {item === 'All'
                    ? copy.allBuyerEligibility
                    : formatListingBuyerEligibility(item, language)}
                </option>
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
          <strong>{pagination.total}</strong>{' '}
          {pagination.total === 1
            ? t.listings.result
            : t.listings.results}
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

      {!loading && !loadError && listings.length > 0 ? (
        <>
          <div className="listing-grid listings-page__grid">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
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

      {!loading && !loadError && listings.length === 0 ? (
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
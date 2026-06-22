import {
CalendarDays,
Clock,
Globe2,
Lock,
MapPin,
Plane,
RotateCcw,
Search,
ShieldCheck,
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
import type { Activity, ActivityTravelRegion, Landmark } from '../types';

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

const travelRegionFilters = [
'All',
'INSIDE_OMAN',
'OUTSIDE_OMAN'
] as const;

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

function getBooleanParam(value: string | null) {
return value === '1' || value === 'true';
}

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
const initialCategory = getFilterParam(searchParams.get('category'), categoryFilters, 'All');
const initialDurationType = getFilterParam(
searchParams.get('durationType'),
durationFilters,
'All'
);
const initialActivityType = getFilterParam(
searchParams.get('activityType'),
activityTypeFilters,
'All'
);
const initialTravelRegion = getFilterParam(
searchParams.get('travelRegion'),
travelRegionFilters,
'All'
);
const initialSortBy = getFilterParam(
searchParams.get('sortBy'),
activitySortOptions.map((option) => option.value),
'recommended'
) as ActivitySort;

const [activities, setActivities] = useState<Activity[]>([]);
const [landmarks, setLandmarks] = useState<Landmark[]>([]);
const [loading, setLoading] = useState(true);
const [loadError, setLoadError] = useState('');
const [page, setPage] = useState(1);
const [pagination, setPagination] =
useState<MarketplacePagination>(initialPagination);

const [query, setQuery] = useState(searchParams.get('q') ?? '');
const [category, setCategory] = useState<(typeof categoryFilters)[number]>(initialCategory);
const [location, setLocation] = useState(searchParams.get('location') ?? '');
const [nearLandmark, setNearLandmark] = useState(nearParam);

const [selectedDate, setSelectedDate] = useState(searchParams.get('date') ?? '');
const [freeFrom, setFreeFrom] = useState(searchParams.get('from') ?? '');
const [freeUntil, setFreeUntil] = useState(searchParams.get('until') ?? '');

const [showAdvanced, setShowAdvanced] = useState(false);
const [durationType, setDurationType] = useState<(typeof durationFilters)[number]>(initialDurationType);
const [activityType, setActivityType] = useState<(typeof activityTypeFilters)[number]>(initialActivityType);
const [travelRegion, setTravelRegion] =
useState<(typeof travelRegionFilters)[number]>(initialTravelRegion);

const [familyFriendly, setFamilyFriendly] = useState(getBooleanParam(searchParams.get('familyFriendly')));
const [includesTransfer, setIncludesTransfer] = useState(getBooleanParam(searchParams.get('includesTransfer')));
const [mealIncluded, setMealIncluded] = useState(getBooleanParam(searchParams.get('mealIncluded')));
const [outdoor, setOutdoor] = useState(getBooleanParam(searchParams.get('outdoor')));

const [minPrice, setMinPrice] = useState(getNonNegativeNumberParam(searchParams.get('minPrice')));
const [maxPrice, setMaxPrice] = useState(getNonNegativeNumberParam(searchParams.get('maxPrice')));
const [sortBy, setSortBy] =
useState<ActivitySort>(initialSortBy);

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
travelRegion: 'نطاق النشاط',
allRegions: 'كل النطاقات',
insideOman: 'داخل عُمان',
outsideOman: 'خارج عُمان',
allActivities: 'كل الأنشطة',
allActivitiesDescription: 'اعرض الأنشطة المحلية وباقات السفر معاً.',
insideOmanDescription: 'تجارب وجولات وأنشطة داخل السلطنة.',
outsideOmanDescription: 'باقات سفر خارج عُمان مع وجهة وفندق وخدمات سفر.',
outsideOmanPackages: 'باقات السفر خارج عُمان',
localActivities: 'أنشطة داخل عُمان',
destinationSearchPlaceholder: 'ابحثي عن دبي، تركيا، جورجيا، فندق، طيران...',
pickupLocation: 'موقع أو نقطة تجمع',
packageModeTitle: 'أنتِ تستعرضين باقات السفر خارج عُمان',
packageModeText: 'استخدمي البحث للوجهات مثل دبي أو إسطنبول أو جورجيا، أو للبحث عن الفندق وشركة الطيران.',
localModeTitle: 'أنتِ تستعرضين الأنشطة داخل عُمان',
localModeText: 'استخدمي المنطقة أو أقرب معلم لتصفية الأنشطة المحلية داخل عُمان.',
allModeTitle: 'استكشفي الأنشطة وباقات السفر',
allModeText: 'يمكنك التبديل بين داخل عُمان وخارج عُمان بسرعة حسب نوع التجربة.',
packagesOnPage: 'باقات في هذه الصفحة',
localsOnPage: 'أنشطة محلية في هذه الصفحة',
activeFilters: 'الفلاتر النشطة',
loading: 'جاري تحميل الأنشطة...',
error: 'تعذر تحميل الأنشطة. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.',
noOutsideTitle: 'لا توجد باقات سفر مطابقة حالياً.',
noOutsideText: 'جرّبي تغيير الوجهة أو السعر أو إزالة بعض الفلاتر.',
noInsideTitle: 'لا توجد أنشطة محلية مطابقة حالياً.',
noInsideText: 'جرّبي تغيير المنطقة أو التاريخ أو إزالة بعض الفلاتر.',
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
travelRegion: 'Activity region',
allRegions: 'All regions',
insideOman: 'Inside Oman',
outsideOman: 'Outside Oman',
allActivities: 'All activities',
allActivitiesDescription: 'Show local activities and travel packages together.',
insideOmanDescription: 'Tours, trips, and experiences inside Oman.',
outsideOmanDescription: 'Travel packages outside Oman with destination, hotel, and travel services.',
outsideOmanPackages: 'Outside-Oman packages',
localActivities: 'Inside-Oman activities',
destinationSearchPlaceholder: 'Search Dubai, Turkey, Georgia, hotel, airline...',
pickupLocation: 'Location or pickup area',
packageModeTitle: 'You are browsing outside-Oman travel packages',
packageModeText: 'Use search for destinations like Dubai, Istanbul, or Georgia, or search by hotel and airline details.',
localModeTitle: 'You are browsing inside-Oman activities',
localModeText: 'Use area and landmark filters to narrow local activities inside Oman.',
allModeTitle: 'Explore activities and travel packages',
allModeText: 'Switch quickly between inside-Oman activities and outside-Oman travel packages.',
packagesOnPage: 'packages on this page',
localsOnPage: 'local activities on this page',
activeFilters: 'Active filters',
loading: 'Loading activities...',
error: 'Could not load activities. Make sure the backend is running and try again.',
noOutsideTitle: 'No matching travel packages yet.',
noOutsideText: 'Try another destination, price range, or remove a few filters.',
noInsideTitle: 'No matching local activities yet.',
noInsideText: 'Try another area, date, or remove a few filters.',
sortBy: 'Sort by',
previous: 'Previous',
next: 'Next',
page: 'Page',
of: 'of'
};

useEffect(() => {
setQuery(searchParams.get('q') ?? '');
setCategory(getFilterParam(searchParams.get('category'), categoryFilters, 'All'));
setLocation(searchParams.get('location') ?? '');
setNearLandmark(searchParams.get('near') ?? '');
setSelectedDate(searchParams.get('date') ?? '');
setFreeFrom(searchParams.get('from') ?? '');
setFreeUntil(searchParams.get('until') ?? '');
setDurationType(getFilterParam(searchParams.get('durationType'), durationFilters, 'All'));
setActivityType(getFilterParam(searchParams.get('activityType'), activityTypeFilters, 'All'));
setTravelRegion(getFilterParam(searchParams.get('travelRegion'), travelRegionFilters, 'All'));
setFamilyFriendly(getBooleanParam(searchParams.get('familyFriendly')));
setIncludesTransfer(getBooleanParam(searchParams.get('includesTransfer')));
setMealIncluded(getBooleanParam(searchParams.get('mealIncluded')));
setOutdoor(getBooleanParam(searchParams.get('outdoor')));
setMinPrice(getNonNegativeNumberParam(searchParams.get('minPrice')));
setMaxPrice(getNonNegativeNumberParam(searchParams.get('maxPrice')));
setSortBy(
getFilterParam(
searchParams.get('sortBy'),
activitySortOptions.map((option) => option.value),
'recommended'
) as ActivitySort
);
}, [searchParams]);

useEffect(() => {
const params = new URLSearchParams();


if (query.trim()) params.set('q', query.trim());
if (category !== 'All') params.set('category', category);
if (location.trim()) params.set('location', location.trim());
if (nearLandmark) params.set('near', nearLandmark);
if (travelAgencyIdParam) params.set('travelAgencyId', travelAgencyIdParam);
if (selectedDate) params.set('date', selectedDate);
if (freeFrom) params.set('from', freeFrom);
if (freeUntil) params.set('until', freeUntil);
if (durationType !== 'All') params.set('durationType', durationType);
if (activityType !== 'All') params.set('activityType', activityType);
if (travelRegion !== 'All') params.set('travelRegion', travelRegion);
if (familyFriendly) params.set('familyFriendly', '1');
if (includesTransfer) params.set('includesTransfer', '1');
if (mealIncluded) params.set('mealIncluded', '1');
if (outdoor) params.set('outdoor', '1');
if (minPrice) params.set('minPrice', minPrice);
if (maxPrice) params.set('maxPrice', maxPrice);
if (sortBy !== 'recommended') params.set('sortBy', sortBy);

if (params.toString() !== searchParams.toString()) {
  setSearchParams(params, { replace: true });
}


}, [
query,
category,
location,
nearLandmark,
travelAgencyIdParam,
selectedDate,
freeFrom,
freeUntil,
durationType,
activityType,
travelRegion,
familyFriendly,
includesTransfer,
mealIncluded,
outdoor,
minPrice,
maxPrice,
sortBy,
searchParams,
setSearchParams
]);

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
travelRegion,
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
      travelRegion:
        travelRegion !== 'All'
          ? (travelRegion as ActivityTravelRegion)
          : undefined,

      familyFriendly: familyFriendly || undefined,
      includesTransfer: includesTransfer || undefined,
      mealIncluded: mealIncluded || undefined,
      outdoor: outdoor || undefined,

      minPrice: toOptionalNumber(debouncedMinPrice),
      maxPrice: toOptionalNumber(debouncedMaxPrice),
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
travelRegion,
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

const activeChips = useMemo<ActiveChip[]>(() => {
const chips: ActiveChip[] = [];


if (query.trim()) {
  chips.push({
    key: 'query',
    label: `${language === 'ar' ? 'بحث' : 'Search'}: ${query}`,
    onRemove: () => setQuery('')
  });
}

if (location.trim()) {
  chips.push({
    key: 'location',
    label: `${language === 'ar' ? 'الموقع' : 'Location'}: ${location}`,
    onRemove: () => setLocation('')
  });
}

if (selectedDate) {
  chips.push({
    key: 'date',
    label: `${activityCopy.date}: ${selectedDate}`,
    onRemove: () => setSelectedDate('')
  });
}

if (freeFrom) {
  chips.push({
    key: 'freeFrom',
    label: `${activityCopy.freeFrom}: ${freeFrom}`,
    onRemove: () => setFreeFrom('')
  });
}

if (freeUntil) {
  chips.push({
    key: 'freeUntil',
    label: `${activityCopy.freeUntil}: ${freeUntil}`,
    onRemove: () => setFreeUntil('')
  });
}

if (selectedLandmark) {
  chips.push({
    key: 'nearLandmark',
    label: `${copy.resultsNear}: ${selectedLandmark.name}`,
    onRemove: () => handleLandmarkChange('')
  });
}

if (travelAgencyIdParam) {
  chips.push({
    key: 'travelAgency',
    label: `${copy.resultsAgency}: ${selectedAgencyName || travelAgencyIdParam}`,
    onRemove: clearTravelAgencyFilter
  });
}

if (category !== 'All') {
  chips.push({
    key: 'category',
    label: category,
    onRemove: () => setCategory('All')
  });
}

if (durationType !== 'All') {
  chips.push({
    key: 'durationType',
    label: durationType,
    onRemove: () => setDurationType('All')
  });
}

if (activityType !== 'All') {
  chips.push({
    key: 'activityType',
    label: activityType,
    onRemove: () => setActivityType('All')
  });
}

if (travelRegion !== 'All') {
  chips.push({
    key: 'travelRegion',
    label: travelRegion === 'INSIDE_OMAN' ? copy.insideOman : copy.outsideOman,
    onRemove: () => handleTravelRegionChange('All')
  });
}

if (familyFriendly) {
  chips.push({
    key: 'familyFriendly',
    label: activityCopy.familyFriendly,
    onRemove: () => setFamilyFriendly(false)
  });
}

if (includesTransfer) {
  chips.push({
    key: 'includesTransfer',
    label: activityCopy.includesTransfer,
    onRemove: () => setIncludesTransfer(false)
  });
}

if (mealIncluded) {
  chips.push({
    key: 'mealIncluded',
    label: activityCopy.mealIncluded,
    onRemove: () => setMealIncluded(false)
  });
}

if (outdoor) {
  chips.push({
    key: 'outdoor',
    label: activityCopy.outdoor,
    onRemove: () => setOutdoor(false)
  });
}

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

return chips;


}, [
query,
location,
selectedDate,
freeFrom,
freeUntil,
selectedLandmark,
travelAgencyIdParam,
selectedAgencyName,
category,
durationType,
activityType,
travelRegion,
familyFriendly,
includesTransfer,
mealIncluded,
outdoor,
minPrice,
maxPrice,
language,
activityCopy.date,
activityCopy.freeFrom,
activityCopy.freeUntil,
activityCopy.familyFriendly,
activityCopy.includesTransfer,
activityCopy.mealIncluded,
activityCopy.outdoor,
copy.resultsNear,
copy.resultsAgency,
copy.insideOman,
copy.outsideOman
]);

const activeFilterCount = activeChips.length;

const filteredActivities = hasTimeError ? [] : activities;
const resultTotal = hasTimeError ? 0 : pagination.total;

const outsidePackagesOnPage = filteredActivities.filter(
(activity) => activity.travelRegion === 'OUTSIDE_OMAN'
).length;
const localActivitiesOnPage = filteredActivities.filter(
(activity) => activity.travelRegion !== 'OUTSIDE_OMAN'
).length;

const regionContext =
travelRegion === 'OUTSIDE_OMAN'
? {
icon: Plane,
title: copy.packageModeTitle,
text: copy.packageModeText
}
: travelRegion === 'INSIDE_OMAN'
? {
icon: MapPin,
title: copy.localModeTitle,
text: copy.localModeText
}
: {
icon: Globe2,
title: copy.allModeTitle,
text: copy.allModeText
};

const RegionContextIcon = regionContext.icon;

const emptyTitle =
travelRegion === 'OUTSIDE_OMAN'
? copy.noOutsideTitle
: travelRegion === 'INSIDE_OMAN'
? copy.noInsideTitle
: activityCopy.noResultsTitle;

const emptyText =
travelRegion === 'OUTSIDE_OMAN'
? copy.noOutsideText
: travelRegion === 'INSIDE_OMAN'
? copy.noInsideText
: activityCopy.noResultsText;

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
setTravelRegion('All');
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

function handleTravelRegionChange(value: (typeof travelRegionFilters)[number]) {
  setTravelRegion(value);

  const nextParams = new URLSearchParams(searchParams);

  if (value === 'OUTSIDE_OMAN') {
    setNearLandmark('');
    nextParams.delete('near');
  }

  if (value === 'All') {
    nextParams.delete('travelRegion');
  } else {
    nextParams.set('travelRegion', value);
  }

  setSearchParams(nextParams, { replace: true });
}

function clearTravelAgencyFilter() {
const nextParams = new URLSearchParams(searchParams);
nextParams.delete('travelAgencyId');
setSearchParams(nextParams, { replace: true });
}

return ( <section className="page-section container activities-page">
<SectionHeader
eyebrow={activityCopy.eyebrow}
title={activityCopy.title}
description={activityCopy.description}
actions={ <ButtonLink to="/add-activity" variant="soft">
{t.common.listActivity} </ButtonLink>
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

    <div className="activity-region-switcher" aria-label={copy.travelRegion}>
      {travelRegionFilters.map((region) => {
        const active = travelRegion === region;
        const isAll = region === 'All';
        const isOutside = region === 'OUTSIDE_OMAN';

        const Icon = isAll ? Globe2 : isOutside ? Plane : MapPin;
        const title = isAll
          ? copy.allActivities
          : isOutside
            ? copy.outsideOman
            : copy.insideOman;
        const description = isAll
          ? copy.allActivitiesDescription
          : isOutside
            ? copy.outsideOmanDescription
            : copy.insideOmanDescription;

        return (
          <button
            key={region}
            type="button"
            className={`activity-region-option ${active ? 'is-active' : ''}`}
            onClick={() => handleTravelRegionChange(region)}
            aria-pressed={active}
          >
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
          </button>
        );
      })}
    </div>

    <div className="activity-discovery-context">
      <RegionContextIcon size={19} aria-hidden="true" />
      <div>
        <strong>{regionContext.title}</strong>
        <p>{regionContext.text}</p>
      </div>
    </div>

    <div className="normal-filters normal-filters--activities normal-filters--activities-enhanced">
      <label className="search-input">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">{activityCopy.quickSearch}</span>
        <input
          type="search"
          placeholder={
            travelRegion === 'OUTSIDE_OMAN'
              ? copy.destinationSearchPlaceholder
              : activityCopy.searchPlaceholder
          }
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

      {travelRegion !== 'OUTSIDE_OMAN' ? (
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
      ) : null}

      <label>
        {travelRegion === 'OUTSIDE_OMAN'
          ? copy.pickupLocation
          : activityCopy.location}
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
              {copy.travelRegion}
              <select
                value={travelRegion}
                onChange={(event) =>
                  handleTravelRegionChange(
                    event.target.value as (typeof travelRegionFilters)[number]
                  )
                }
              >
                {travelRegionFilters.map((region) => (
                  <option key={region} value={region}>
                    {region === 'All'
                      ? copy.allRegions
                      : region === 'INSIDE_OMAN'
                        ? copy.insideOman
                        : copy.outsideOman}
                  </option>
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

    {activeChips.length > 0 ? (
      <div className="active-chip-row activity-active-chip-row" aria-label={copy.activeFilters}>
        {activeChips.map((chip) => (
          <button key={chip.key} type="button" onClick={chip.onRemove}>
            {chip.label}
            <X size={13} aria-hidden="true" />
          </button>
        ))}
      </div>
    ) : null}
  </div>

  <div className="activity-result-context">
    <div>
      <span>
        <ShieldCheck size={15} aria-hidden="true" />
        {localActivitiesOnPage} {copy.localsOnPage}
      </span>

      <span>
        <Plane size={15} aria-hidden="true" />
        {outsidePackagesOnPage} {copy.packagesOnPage}
      </span>
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
            : travelRegion === 'OUTSIDE_OMAN'
              ? copy.outsideOmanPackages
              : travelRegion === 'INSIDE_OMAN'
                ? copy.localActivities
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
      <h2>{emptyTitle}</h2>
      <p>{emptyText}</p>

      <button className="button-link button-link--secondary" type="button" onClick={resetFilters}>
        {t.common.resetFilters}
      </button>
    </div>
  ) : null}
</section>


);
}

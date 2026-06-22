import {
CalendarDays,
CheckCircle2,
Clock,
FileText,
Globe2,
Hotel,
Image,
Link as LinkIcon,
MapPin,
Plane,
ShieldCheck,
Sparkles,
Tags,
UploadCloud,
Users,
X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { ApiError } from '../api/client';
import { createActivity } from '../api/activities';
import {
ACCEPTED_IMAGE_INPUT_TYPES,
MAX_IMAGE_UPLOAD_COUNT,
getImageUploadValidationError,
uploadImage
} from '../api/uploads';
import { getLandmarks, getTravelAgencies } from '../api/marketplace';
import { useAuth } from '../auth/AuthContext';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type {
ActivityTravelRegion,
DayName,
Landmark,
PriceQualifier,
PriceUnit,
TravelAgency
} from '../types';

type ImageMode = 'upload' | 'url';

const dayOptions = [
'Sunday',
'Monday',
'Tuesday',
'Wednesday',
'Thursday',
'Friday',
'Saturday'
] as const;

const categoryOptions = [
'Adventure',
'Culture',
'Desert',
'Family',
'Food & Dining',
'Luxury',
'Mountain',
'Nature',
'Sea',
'Water Sports',
'Wellness'
];

const durationTypeOptions = ['Short', 'Half day', 'Full day', 'Overnight'];

const activityTypeOptions = ['Private', 'Group', 'Both'];

const difficultyOptions = ['Easy', 'Moderate', 'Challenging'];

const travelRegionOptions: ActivityTravelRegion[] = [
'INSIDE_OMAN',
'OUTSIDE_OMAN'
];

const priceQualifierOptions: PriceQualifier[] = [
'FIXED',
'FROM',
'ON_REQUEST'
];

const activityPriceUnitOptions: PriceUnit[] = [
'PERSON',
'GROUP',
'ACTIVITY',
'HOUR',
'DAY',
'NIGHT'
];

const currencyOptions = [
'OMR',
'USD',
'EUR',
'GBP',
'AED',
'SAR',
'QAR',
'BHD',
'KWD'
];

const suggestedHighlights = [
'Private guide',
'Dinner setup',
'Dune transfer',
'Boat included',
'Snorkeling',
'Refreshments',
'Local guide',
'Family friendly',
'Sunset view',
'Hotel pickup'
];

type OrganizerMode = 'none' | 'existing' | 'manual';

const initialForm = {
title: '',
category: 'Desert',
travelRegion: 'INSIDE_OMAN' as ActivityTravelRegion,
location: '',
nearestLandmarkId: '',
distanceFromLandmark: '',
organizerMode: 'none' as OrganizerMode,
travelAgencyId: '',
provider: '',
groupSize: '',
capacity: '',
difficulty: 'Easy',
language: 'Arabic / English',
priceAmount: '',
priceCurrency: 'OMR',
priceQualifier: 'FROM' as PriceQualifier,
priceUnit: 'PERSON' as PriceUnit,
duration: '',
durationMinutes: '',
image: '',
description: '',
startTime: '09:00',
endTime: '17:00',
durationType: 'Half day',
activityType: 'Private',
highlights: '',
familyFriendly: false,
includesTransfer: false,
mealIncluded: false,
outdoor: true,

destinationCountry: '',
destinationCity: '',
departureCity: 'Muscat',
tripDurationDays: '',
tripDurationNights: '',

flightIncluded: false,
airline: '',
flightNotes: '',

hotelIncluded: false,
hotelName: '',
hotelRating: '',
roomType: '',
mealPlan: '',

visaSupportIncluded: false,
travelInsuranceIncluded: false,
airportTransferIncluded: false,

packageItinerary: '',
requiredDocuments: '',
cancellationPolicy: '',
availableTravelDates: '',
minimumGroupSize: '',
packageInclusions: '',
packageExclusions: '',
videoWalkthroughUrl: '',
tour360Url: '',
virtualTourUrl: ''
};

function optionalText(value: string) {
const trimmed = value.trim();
return trimmed || undefined;
}

function optionalNumber(value: string) {
const trimmed = value.trim();

if (!trimmed) {
return undefined;
}

const numberValue = Number(trimmed);

return Number.isFinite(numberValue) ? numberValue : undefined;
}

export default function AddActivity() {
const { t, language } = useLanguage();
const { token } = useAuth();

useDocumentTitle('Add activity');

const [form, setForm] = useState(initialForm);
const [selectedDays, setSelectedDays] = useState<DayName[]>([
'Thursday',
'Friday',
'Saturday'
]);
const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);
const [imageMode, setImageMode] = useState<ImageMode>('upload');
const [imageFiles, setImageFiles] = useState<File[]>([]);
const [uploadedImagePreviews, setUploadedImagePreviews] = useState<string[]>([]);
const [submitted, setSubmitted] = useState(false);
const [submitting, setSubmitting] = useState(false);
const [submitError, setSubmitError] = useState('');
const [loadingOptions, setLoadingOptions] = useState(true);
const [landmarks, setLandmarks] = useState<Landmark[]>([]);
const [travelAgencies, setTravelAgencies] = useState<TravelAgency[]>([]);

const isOutsideOman = form.travelRegion === 'OUTSIDE_OMAN';
const isInsideOman = form.travelRegion === 'INSIDE_OMAN';

const addActivityCopy = t.addActivity ?? t.addExperience;

const pricingCopy =
language === 'ar'
? {
priceType: 'نوع السعر',
fixedPrice: 'سعر ثابت',
startingFrom: 'ابتداءً من',
priceOnRequest: 'السعر عند الطلب',
priceAmount: 'المبلغ',
priceAmountPlaceholder: '٤٥',
priceCurrency: 'العملة',
priceUnit: 'وحدة التسعير',
perPerson: 'لكل شخص',
perGroup: 'لكل مجموعة',
perActivity: 'لكل نشاط',
perHour: 'لكل ساعة',
perDay: 'لكل يوم',
perNight: 'لكل ليلة'
}
: {
priceType: 'Price type',
fixedPrice: 'Fixed price',
startingFrom: 'Starting from',
priceOnRequest: 'Price on request',
priceAmount: 'Amount',
priceAmountPlaceholder: '45',
priceCurrency: 'Currency',
priceUnit: 'Pricing unit',
perPerson: 'Per person',
perGroup: 'Per group',
perActivity: 'Per activity',
perHour: 'Per hour',
perDay: 'Per day',
perNight: 'Per night'
};

const priceQualifierLabels: Record<PriceQualifier, string> = {
FIXED: pricingCopy.fixedPrice,
FROM: pricingCopy.startingFrom,
ON_REQUEST: pricingCopy.priceOnRequest
};

const activityPriceUnitLabels: Partial<Record<PriceUnit, string>> = {
PERSON: pricingCopy.perPerson,
GROUP: pricingCopy.perGroup,
ACTIVITY: pricingCopy.perActivity,
HOUR: pricingCopy.perHour,
DAY: pricingCopy.perDay,
NIGHT: pricingCopy.perNight
};

const copy =
language === 'ar'
? {
addActivityTitle: 'أضف نشاطاً',
addActivityDescription: 'أضف نشاطاً منظماً إلى lux.om ليتم مراجعته قبل النشر.',
activityDetails: 'تفاصيل النشاط',
activityTitle: 'عنوان النشاط',
activityType: 'نوع النشاط',
travelRegion: 'نطاق النشاط',
chooseTravelRegion: 'اختر نوع النشاط أولاً',
chooseTravelRegionHint:
'اختيار النطاق يحدد البيانات المطلوبة. أنشطة داخل عُمان تختلف عن باقات السفر خارج عُمان.',
insideOman: 'داخل عُمان',
insideOmanTitle: 'نشاط داخل عُمان',
insideOmanDescription:
'جولات، رحلات، تجارب، أنشطة بحرية أو صحراوية داخل السلطنة.',
outsideOman: 'خارج عُمان',
outsideOmanTitle: 'باقة سفر خارج عُمان',
outsideOmanDescription:
'باقة سفر تشمل وجهة خارج عُمان مع تفاصيل الرحلة والفندق والخدمات.',
localOmanDetails: 'تفاصيل الموقع داخل عُمان',
travelPackageDetails: 'تفاصيل باقة السفر',
travelPackageSubtitle:
'أضف معلومات الوجهة والرحلة والفندق والخدمات حتى تظهر الباقة بشكل احترافي.',
destinationCountry: 'دولة الوجهة',
destinationCountryPlaceholder: 'مثال: الإمارات العربية المتحدة',
destinationCity: 'مدينة الوجهة',
destinationCityPlaceholder: 'مثال: دبي',
departureCity: 'مدينة المغادرة',
departureCityPlaceholder: 'مثال: مسقط',
tripDurationDays: 'عدد الأيام',
tripDurationNights: 'عدد الليالي',
flights: 'تفاصيل الطيران',
flightIncluded: 'الطيران مشمول',
airline: 'شركة الطيران',
airlinePlaceholder: 'مثال: Oman Air',
flightNotes: 'ملاحظات الطيران',
flightNotesPlaceholder: 'مثال: مواعيد الطيران حسب التوفر',
hotel: 'تفاصيل الفندق',
hotelIncluded: 'الفندق مشمول',
hotelName: 'اسم الفندق',
hotelNamePlaceholder: 'مثال: Downtown Dubai Hotel',
hotelRating: 'تصنيف الفندق',
roomType: 'نوع الغرفة',
roomTypePlaceholder: 'مثال: غرفة مزدوجة',
mealPlan: 'خطة الوجبات',
mealPlanPlaceholder: 'مثال: إفطار',
packageServices: 'الخدمات والوثائق',
visaSupportIncluded: 'دعم التأشيرة مشمول',
travelInsuranceIncluded: 'تأمين السفر مشمول',
airportTransferIncluded: 'مواصلات المطار مشمولة',
packageItinerary: 'برنامج الرحلة',
packageItineraryPlaceholder: 'مثال: اليوم الأول وصول، اليوم الثاني جولة، اليوم الثالث وقت حر...',
requiredDocuments: 'الوثائق المطلوبة',
requiredDocumentsPlaceholder: 'مثال: نسخة جواز السفر، بطاقة الإقامة...',
cancellationPolicy: 'سياسة الإلغاء',
cancellationPolicyPlaceholder: 'اشرح شروط الإلغاء والتعديل',
availableTravelDates: 'تواريخ السفر المتاحة',
availableTravelDatesPlaceholder: 'مثال: عطلات نهاية الأسبوع والعطل الرسمية',
minimumGroupSize: 'الحد الأدنى للمجموعة',
packageInclusions: 'المشمول في الباقة',
packageInclusionsPlaceholder: 'مثال: الطيران، الفندق، الإفطار، المواصلات',
packageExclusions: 'غير المشمول في الباقة',
packageExclusionsPlaceholder: 'مثال: المصاريف الشخصية والجولات الاختيارية',
packageDisclaimer:
'ملاحظة: تفاصيل التأشيرة والطيران والفندق يجب تأكيدها من المنظم قبل الحجز.',
activityImage: 'صورة النشاط',
activityPreview: 'معاينة صورة النشاط',
providerInfo: 'معلومات المنظم',
providerDetails: 'اربط النشاط بوكالة سفر وأضف تفاصيل تجربة الضيوف',
organizerMode: 'طريقة إضافة المنظم',
travelAgency: 'وكالة السفر',
noTravelAgency: 'بدون وكالة أو منظم',
existingTravelAgency: 'وكالة سفر مسجلة',
manualOrganizer: 'منظم آخر غير مسجل',
selectTravelAgency: 'اختر وكالة السفر',
providerName: 'اسم المنظم',
providerPlaceholder: 'مثال: Muscat Coast Activities',
groupSize: 'حجم المجموعة',
groupSizePlaceholder: 'مثال: 2-8 ضيوف',
capacity: 'السعة القصوى',
capacityPlaceholder: 'مثال: 12',
difficulty: 'الصعوبة',
language: 'اللغة',
nearestLandmark: 'أقرب معلم أو منطقة',
noLandmark: 'بدون معلم محدد',
distance: 'المسافة من المعلم',
distancePlaceholder: 'مثال: 20 دقيقة من مول عُمان',
imageSource: 'مصدر الصورة',
removeImage: 'إزالة الصورة',
invalidImageType: 'يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP أو GIF.',
imageTooLarge: 'حجم الصورة كبير جداً. الحد الأقصى 5MB.',
imagesSelected: 'صور مختارة',
maxImages: 'يمكنك رفع حتى 8 صور.',
submitted: 'تم إرسال النشاط للمراجعة.',
reviewHint: 'تتم مراجعة الأنشطة قبل نشرها على lux.om.',
submitting: 'جاري الإرسال...',
authError: 'يجب تسجيل الدخول قبل إضافة نشاط.',
optionsError: 'تعذر تحميل وكالات السفر والمعالم من الخادم.',
submitError: 'تعذر إرسال النشاط للمراجعة. حاولي مرة أخرى.',
premiumMediaEyebrow: 'وسائط مميزة',
premiumActivityMediaTitle: 'وسائط النشاط المميزة',
premiumActivityMediaHint:
'أضف روابط اختيارية للفيديو أو الجولات الافتراضية. سيتم عرض الروابط الآمنة فقط في صفحة النشاط.'
}
: {
addActivityTitle: 'Add activity',
addActivityDescription:
'Submit a curated activity or travel package to lux.om for review before it goes live.',
activityDetails: 'Activity details',
activityTitle: 'Activity title',
activityType: 'Activity type',
travelRegion: 'Activity region',
chooseTravelRegion: 'Choose the activity region first',
chooseTravelRegionHint:
'This controls the form. Inside-Oman activities use local fields, while outside-Oman travel packages need destination, flight, hotel, and package details.',
insideOman: 'Inside Oman',
insideOmanTitle: 'Inside-Oman activity',
insideOmanDescription:
'Tours, activities, sea trips, desert trips, wellness, and local experiences inside Oman.',
outsideOman: 'Outside Oman',
outsideOmanTitle: 'Outside-Oman travel package',
outsideOmanDescription:
'Travel packages outside Oman with destination, flight, hotel, documents, and package details.',
localOmanDetails: 'Local Oman location details',
travelPackageDetails: 'Travel package details',
travelPackageSubtitle:
'Add destination, flight, hotel, documents, and inclusions so the package is clear before review.',
destinationCountry: 'Destination country',
destinationCountryPlaceholder: 'Example: United Arab Emirates',
destinationCity: 'Destination city',
destinationCityPlaceholder: 'Example: Dubai',
departureCity: 'Departure city',
departureCityPlaceholder: 'Example: Muscat',
tripDurationDays: 'Trip duration days',
tripDurationNights: 'Trip duration nights',
flights: 'Flight details',
flightIncluded: 'Flight included',
airline: 'Airline',
airlinePlaceholder: 'Example: Oman Air',
flightNotes: 'Flight notes',
flightNotesPlaceholder: 'Example: Flight times depend on availability',
hotel: 'Hotel details',
hotelIncluded: 'Hotel included',
hotelName: 'Hotel name',
hotelNamePlaceholder: 'Example: Downtown Dubai Hotel',
hotelRating: 'Hotel rating',
roomType: 'Room type',
roomTypePlaceholder: 'Example: Double room',
mealPlan: 'Meal plan',
mealPlanPlaceholder: 'Example: Breakfast',
packageServices: 'Services and documents',
visaSupportIncluded: 'Visa support included',
travelInsuranceIncluded: 'Travel insurance included',
airportTransferIncluded: 'Airport transfer included',
packageItinerary: 'Package itinerary',
packageItineraryPlaceholder: 'Example: Day 1 arrival, Day 2 city tour, Day 3 free day...',
requiredDocuments: 'Required documents',
requiredDocumentsPlaceholder: 'Example: Passport copy, residence card...',
cancellationPolicy: 'Cancellation policy',
cancellationPolicyPlaceholder: 'Explain cancellation and change terms',
availableTravelDates: 'Available travel dates',
availableTravelDatesPlaceholder: 'Example: Selected weekends and public holidays',
minimumGroupSize: 'Minimum group size',
packageInclusions: 'Package inclusions',
packageInclusionsPlaceholder: 'Example: Flights, hotel, breakfast, airport transfers',
packageExclusions: 'Package exclusions',
packageExclusionsPlaceholder: 'Example: Personal expenses and optional tours',
packageDisclaimer:
'Note: visa, flight, and hotel details should be confirmed with the organizer before booking.',
activityImage: 'Activity image',
activityPreview: 'Activity preview',
providerInfo: 'Organizer information',
providerDetails: 'Connect this activity to a travel agency and add guest details',
organizerMode: 'Organizer option',
travelAgency: 'Travel agency',
noTravelAgency: 'No organizer',
existingTravelAgency: 'Existing travel agency',
manualOrganizer: 'Other / not listed',
selectTravelAgency: 'Select travel agency',
providerName: 'Organizer name',
providerPlaceholder: 'Example: Muscat Coast Activities',
groupSize: 'Group size',
groupSizePlaceholder: 'Example: 2-8 guests',
capacity: 'Capacity',
capacityPlaceholder: 'Example: 12',
difficulty: 'Difficulty',
language: 'Language',
nearestLandmark: 'Nearest landmark or area',
noLandmark: 'No landmark selected',
distance: 'Distance from landmark',
distancePlaceholder: 'Example: 20 minutes from Mall of Oman',
imageSource: 'Image source',
removeImage: 'Remove image',
invalidImageType: 'Please choose a JPG, PNG, WEBP, or GIF image.',
imageTooLarge: 'Image is too large. Maximum size is 5MB.',
imagesSelected: 'images selected',
maxImages: 'You can upload up to 8 images.',
submitted: 'Activity submitted for review.',
reviewHint: 'Activities are reviewed before going public on lux.om.',
submitting: 'Submitting...',
authError: 'You must be logged in before adding an activity.',
optionsError: 'Could not load travel agencies and landmarks from the server.',
submitError: 'Could not submit this activity for review. Please try again.',
premiumMediaEyebrow: 'Premium media',
premiumActivityMediaTitle: 'Premium activity media',
premiumActivityMediaHint:
'Add optional video walkthroughs, 360 tours, or virtual tour links. Only safe supported links are displayed on the public activity page.'
};

useEffect(() => {
let isMounted = true;


async function loadOptions() {
  try {
    setLoadingOptions(true);
    setSubmitError('');

    const [apiLandmarks, apiTravelAgencies] = await Promise.all([
      getLandmarks(language, { take: 100 }),
      getTravelAgencies(language, { take: 100 })
    ]);

    if (!isMounted) return;

    setLandmarks(apiLandmarks);
    setTravelAgencies(apiTravelAgencies);
  } catch (error) {
    console.error(error);

    if (isMounted) {
      setSubmitError(copy.optionsError);
    }
  } finally {
    if (isMounted) {
      setLoadingOptions(false);
    }
  }
}

void loadOptions();

return () => {
  isMounted = false;
};


}, [language, copy.optionsError]);

useEffect(() => {
if (imageFiles.length === 0) {
setUploadedImagePreviews([]);
return;
}


const objectUrls = imageFiles.map((file) => URL.createObjectURL(file));
setUploadedImagePreviews(objectUrls);

return () => {
  objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
};


}, [imageFiles]);

const imagePreviews =
imageMode === 'upload'
? uploadedImagePreviews
: form.image.trim()
? [form.image.trim()]
: [];

const completedRequiredFields = useMemo(() => {
const baseRequiredValues = [
form.title,
form.category,
form.location,
form.priceQualifier === 'ON_REQUEST'
? 'price'
: form.priceAmount.trim(),
form.duration,
form.durationMinutes,
form.description,
form.startTime,
form.endTime,
selectedDays.length > 0 ? 'days' : '',
imageMode === 'upload' ? (imageFiles.length > 0 ? 'images' : '') : form.image
];


const outsideOmanRequiredValues = isOutsideOman
  ? [
      form.destinationCountry,
      form.destinationCity,
      form.tripDurationDays
    ]
  : [];

return [...baseRequiredValues, ...outsideOmanRequiredValues].filter(Boolean).length;


}, [form, selectedDays, imageMode, imageFiles, isOutsideOman]);

const requiredFieldCount = isOutsideOman ? 14 : 11;
const formCompletion = Math.round((completedRequiredFields / requiredFieldCount) * 100);

function updateForm<K extends keyof typeof initialForm>(field: K, value: (typeof initialForm)[K]) {
setSubmitted(false);
setSubmitError('');
setForm((current) => ({ ...current, [field]: value }));
}

function updateTravelRegion(travelRegion: ActivityTravelRegion) {
setSubmitted(false);
setSubmitError('');


setForm((current) => ({
  ...current,
  travelRegion,
  nearestLandmarkId:
    travelRegion === 'INSIDE_OMAN' ? current.nearestLandmarkId : '',
  distanceFromLandmark:
    travelRegion === 'INSIDE_OMAN' ? current.distanceFromLandmark : '',
  destinationCountry:
    travelRegion === 'OUTSIDE_OMAN' ? current.destinationCountry : '',
  destinationCity:
    travelRegion === 'OUTSIDE_OMAN' ? current.destinationCity : '',
  departureCity:
    travelRegion === 'OUTSIDE_OMAN'
      ? current.departureCity || 'Muscat'
      : ''
}));


}

function toggleDay(day: DayName) {
setSubmitted(false);
setSubmitError('');
setSelectedDays((current) =>
current.includes(day) ? current.filter((item) => item !== day) : [...current, day]
);
}

function toggleHighlight(highlight: string) {
setSubmitted(false);
setSubmitError('');
setSelectedHighlights((current) =>
current.includes(highlight)
? current.filter((item) => item !== highlight)
: [...current, highlight]
);
}

function clearUploadedImage(indexToRemove?: number) {
setImageFiles((current) =>
typeof indexToRemove === 'number'
? current.filter((_, index) => index !== indexToRemove)
: []
);
setSubmitError('');
}

function handleImageFileChange(files: FileList | null) {
setSubmitted(false);
setSubmitError('');


const selectedFiles = Array.from(files ?? []);

if (selectedFiles.length === 0) {
  setImageFiles([]);
  return;
}

if (selectedFiles.length > MAX_IMAGE_UPLOAD_COUNT) {
  setImageFiles([]);
  setSubmitError(copy.maxImages);
  return;
}

const validationError = selectedFiles
  .map((file) =>
    getImageUploadValidationError(file, {
      invalidType: copy.invalidImageType,
      tooLarge: copy.imageTooLarge
    })
  )
  .find(Boolean);

if (validationError) {
  setImageFiles([]);
  setSubmitError(validationError);
  return;
}

setImageFiles(selectedFiles);

}

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();


if (!token) {
  setSubmitError(copy.authError);
  return;
}

if (selectedDays.length === 0) {
  alert(addActivityCopy.selectAtLeastOneDay);
  return;
}

if (imageMode === 'upload' && imageFiles.length === 0) {
  alert(addActivityCopy.uploadRequired);
  return;
}

if (imageMode === 'url' && !form.image.trim()) {
  alert(addActivityCopy.urlRequired);
  return;
}

try {
  setSubmitting(true);
  setSubmitted(false);
  setSubmitError('');

  const imageUrls =
    imageMode === 'upload'
      ? await Promise.all(imageFiles.map((file) => uploadImage(file, token)))
      : [form.image.trim()];

  const highlightTexts = [
    ...selectedHighlights,
    ...form.highlights
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  ];

  await createActivity(
    {
      titleEn: form.title,
      descriptionEn: form.description,
      locationEn: form.location,
      categoryEn: form.category,
      travelAgencyId:
        form.organizerMode === 'existing' ? optionalText(form.travelAgencyId) : undefined,
      providerEn:
        form.organizerMode === 'manual' && language === 'en'
          ? optionalText(form.provider)
          : undefined,
      providerAr:
        form.organizerMode === 'manual' && language === 'ar'
          ? optionalText(form.provider)
          : undefined,
      priceAmount:
        form.priceQualifier === 'ON_REQUEST'
          ? undefined
          : form.priceAmount,
      priceCurrency:
        form.priceQualifier === 'ON_REQUEST'
          ? undefined
          : form.priceCurrency,
      priceQualifier: form.priceQualifier,
      priceUnit:
        form.priceQualifier === 'ON_REQUEST'
          ? undefined
          : form.priceUnit,
      durationMinutes: Number(form.durationMinutes),
      durationLabelEn: form.duration,
      durationType: optionalText(form.durationType),
      groupSize: optionalText(form.groupSize),
      capacity: optionalNumber(form.capacity),
      language: optionalText(form.language),
      difficulty: optionalText(form.difficulty),
      activityType: optionalText(form.activityType),
      travelRegion: form.travelRegion,

      destinationCountry: isOutsideOman
        ? optionalText(form.destinationCountry)
        : undefined,
      destinationCity: isOutsideOman
        ? optionalText(form.destinationCity)
        : undefined,
      departureCity: isOutsideOman
        ? optionalText(form.departureCity)
        : undefined,
      tripDurationDays: isOutsideOman
        ? optionalNumber(form.tripDurationDays)
        : undefined,
      tripDurationNights: isOutsideOman
        ? optionalNumber(form.tripDurationNights)
        : undefined,
      flightIncluded: isOutsideOman
        ? form.flightIncluded
        : undefined,
      airline: isOutsideOman
        ? optionalText(form.airline)
        : undefined,
      flightNotes: isOutsideOman
        ? optionalText(form.flightNotes)
        : undefined,
      hotelIncluded: isOutsideOman
        ? form.hotelIncluded
        : undefined,
      hotelName: isOutsideOman
        ? optionalText(form.hotelName)
        : undefined,
      hotelRating: isOutsideOman
        ? optionalNumber(form.hotelRating)
        : undefined,
      roomType: isOutsideOman
        ? optionalText(form.roomType)
        : undefined,
      mealPlan: isOutsideOman
        ? optionalText(form.mealPlan)
        : undefined,
      visaSupportIncluded: isOutsideOman
        ? form.visaSupportIncluded
        : undefined,
      travelInsuranceIncluded: isOutsideOman
        ? form.travelInsuranceIncluded
        : undefined,
      airportTransferIncluded: isOutsideOman
        ? form.airportTransferIncluded
        : undefined,
      packageItinerary: isOutsideOman
        ? optionalText(form.packageItinerary)
        : undefined,
      requiredDocuments: isOutsideOman
        ? optionalText(form.requiredDocuments)
        : undefined,
      cancellationPolicy: isOutsideOman
        ? optionalText(form.cancellationPolicy)
        : undefined,
      availableTravelDates: isOutsideOman
        ? optionalText(form.availableTravelDates)
        : undefined,
      minimumGroupSize: isOutsideOman
        ? optionalNumber(form.minimumGroupSize)
        : undefined,
      packageInclusions: isOutsideOman
        ? optionalText(form.packageInclusions)
        : undefined,
      packageExclusions: isOutsideOman
        ? optionalText(form.packageExclusions)
        : undefined,

      availabilityDays: selectedDays,
      availabilityStartTime: form.startTime,
      availabilityEndTime: form.endTime,
      familyFriendly: form.familyFriendly,
      includesTransfer: form.includesTransfer,
      mealIncluded: form.mealIncluded,
      outdoor: form.outdoor,
      videoWalkthroughUrl: optionalText(form.videoWalkthroughUrl),
      tour360Url: optionalText(form.tour360Url),
      virtualTourUrl: optionalText(form.virtualTourUrl),
      nearestLandmarkId: isInsideOman
        ? optionalText(form.nearestLandmarkId)
        : undefined,
      distanceFromLandmarkEn: isInsideOman
        ? optionalText(form.distanceFromLandmark)
        : undefined,
      images: imageUrls.map((url, imageIndex) => ({
        url,
        altEn: form.title,
        sortOrder: imageIndex
      })),
      highlights: highlightTexts.map((highlight) => ({
        textEn: highlight
      }))
    },
    token
  );

  setSubmitted(true);
  setForm(initialForm);
  setSelectedDays(['Thursday', 'Friday', 'Saturday']);
  setSelectedHighlights([]);
  setImageMode('upload');
  setImageFiles([]);
} catch (error) {
  console.error(error);

  if (error instanceof ApiError) {
    setSubmitError(error.message);
  } else if (error instanceof Error) {
    setSubmitError(error.message);
  } else {
    setSubmitError(copy.submitError);
  }
} finally {
  setSubmitting(false);
}


}

return ( <section className="page-section container add-listing-page add-activity-page">
<SectionHeader
eyebrow={addActivityCopy.eyebrow}
title={addActivityCopy.title ?? copy.addActivityTitle}
description={addActivityCopy.description ?? copy.addActivityDescription}
/>


  <form className="form-card form-card--wide listing-form activity-form" onSubmit={handleSubmit}>
    <div className="form-status-card">
      <div>
        <p className="eyebrow">{addActivityCopy.qualityEyebrow}</p>
        <h2>
          {formCompletion}% {addActivityCopy.ready}
        </h2>
        <p>{addActivityCopy.qualityText}</p>
      </div>

      <div className="form-progress" aria-label={`Form completion ${formCompletion}%`}>
        <span style={{ width: `${formCompletion}%` }} />
      </div>
    </div>

    {submitError ? (
      <p className="form-error" role="alert">
        {submitError}
      </p>
    ) : null}

    <section className="form-section-card">
      <div className="form-group-heading">
        <span className="form-section-icon">
          <Globe2 size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{copy.travelRegion}</p>
          <h2>{copy.chooseTravelRegion}</h2>
          <p>{copy.chooseTravelRegionHint}</p>
        </div>
      </div>

      <div className="region-selector-grid">
        {travelRegionOptions.map((region) => {
          const selected = form.travelRegion === region;
          const inside = region === 'INSIDE_OMAN';

          return (
            <button
              key={region}
              type="button"
              className={`region-selector-card ${selected ? 'is-selected' : ''}`}
              onClick={() => updateTravelRegion(region)}
              aria-pressed={selected}
            >
              <span className="region-selector-icon">
                {inside ? (
                  <MapPin size={22} aria-hidden="true" />
                ) : (
                  <Plane size={22} aria-hidden="true" />
                )}
              </span>
              <span>
                <strong>
                  {inside ? copy.insideOmanTitle : copy.outsideOmanTitle}
                </strong>
                <small>
                  {inside ? copy.insideOmanDescription : copy.outsideOmanDescription}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </section>

    <section className="form-section-card">
      <div className="form-group-heading">
        <span className="form-section-icon">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{addActivityCopy.basicInfo}</p>
          <h2>{addActivityCopy.activityDetails ?? copy.activityDetails}</h2>
        </div>
      </div>

      <div className="form-grid">
        <label>
          {addActivityCopy.activityTitle ?? copy.activityTitle}
          <input
            required
            value={form.title}
            onChange={(event) => updateForm('title', event.target.value)}
            placeholder={addActivityCopy.titlePlaceholder}
          />
        </label>

        <label>
          {addActivityCopy.category}
          <select
            value={form.category}
            onChange={(event) => updateForm('category', event.target.value)}
          >
            {categoryOptions.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label>
          {addActivityCopy.location}
          <input
            required
            value={form.location}
            onChange={(event) => updateForm('location', event.target.value)}
            placeholder={
              isOutsideOman
                ? copy.destinationCityPlaceholder
                : addActivityCopy.locationPlaceholder
            }
          />
        </label>

        {isInsideOman ? (
          <>
            <label>
              {copy.nearestLandmark}
              <select
                value={form.nearestLandmarkId}
                disabled={loadingOptions}
                onChange={(event) => updateForm('nearestLandmarkId', event.target.value)}
              >
                <option value="">{copy.noLandmark}</option>
                {landmarks.map((landmark) => (
                  <option key={landmark.id} value={landmark.id}>
                    {landmark.name} · {landmark.city}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {copy.distance}
              <input
                value={form.distanceFromLandmark}
                onChange={(event) => updateForm('distanceFromLandmark', event.target.value)}
                placeholder={copy.distancePlaceholder}
              />
            </label>
          </>
        ) : null}

        <fieldset className="pricing-fieldset">
          <legend>{addActivityCopy.price}</legend>

          <div className="pricing-grid">
            <label>
              {pricingCopy.priceType}
              <select
                value={form.priceQualifier}
                onChange={(event) =>
                  updateForm(
                    'priceQualifier',
                    event.target.value as PriceQualifier
                  )
                }
              >
                {priceQualifierOptions.map((qualifier) => (
                  <option key={qualifier} value={qualifier}>
                    {priceQualifierLabels[qualifier]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {pricingCopy.priceAmount}
              <input
                required={
                  form.priceQualifier !== 'ON_REQUEST'
                }
                disabled={
                  form.priceQualifier === 'ON_REQUEST'
                }
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                placeholder={
                  pricingCopy.priceAmountPlaceholder
                }
                value={form.priceAmount}
                onChange={(event) =>
                  updateForm(
                    'priceAmount',
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              {pricingCopy.priceCurrency}
              <select
                disabled={
                  form.priceQualifier === 'ON_REQUEST'
                }
                value={form.priceCurrency}
                onChange={(event) =>
                  updateForm(
                    'priceCurrency',
                    event.target.value
                  )
                }
              >
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {pricingCopy.priceUnit}
              <select
                disabled={
                  form.priceQualifier === 'ON_REQUEST'
                }
                value={form.priceUnit}
                onChange={(event) =>
                  updateForm(
                    'priceUnit',
                    event.target.value as PriceUnit
                  )
                }
              >
                {activityPriceUnitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {activityPriceUnitLabels[unit] ?? unit}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <label>
          {addActivityCopy.duration}
          <input
            required
            value={form.duration}
            onChange={(event) => updateForm('duration', event.target.value)}
            placeholder={addActivityCopy.durationPlaceholder}
          />
        </label>

        <label>
          {addActivityCopy.durationMinutes}
          <input
            required
            type="number"
            min="1"
            value={form.durationMinutes}
            onChange={(event) => updateForm('durationMinutes', event.target.value)}
            placeholder="240"
          />
        </label>
      </div>
    </section>

    {isOutsideOman ? (
      <section className="form-section-card travel-package-section">
        <div className="form-group-heading">
          <span className="form-section-icon">
            <Plane size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">{copy.outsideOman}</p>
            <h2>{copy.travelPackageDetails}</h2>
            <p>{copy.travelPackageSubtitle}</p>
          </div>
        </div>

        <div className="form-grid">
          <label>
            {copy.destinationCountry}
            <input
              required={isOutsideOman}
              value={form.destinationCountry}
              onChange={(event) => updateForm('destinationCountry', event.target.value)}
              placeholder={copy.destinationCountryPlaceholder}
            />
          </label>

          <label>
            {copy.destinationCity}
            <input
              required={isOutsideOman}
              value={form.destinationCity}
              onChange={(event) => updateForm('destinationCity', event.target.value)}
              placeholder={copy.destinationCityPlaceholder}
            />
          </label>

          <label>
            {copy.departureCity}
            <input
              value={form.departureCity}
              onChange={(event) => updateForm('departureCity', event.target.value)}
              placeholder={copy.departureCityPlaceholder}
            />
          </label>

          <label>
            {copy.tripDurationDays}
            <input
              required={isOutsideOman}
              type="number"
              min="1"
              value={form.tripDurationDays}
              onChange={(event) => updateForm('tripDurationDays', event.target.value)}
              placeholder="4"
            />
          </label>

          <label>
            {copy.tripDurationNights}
            <input
              type="number"
              min="1"
              value={form.tripDurationNights}
              onChange={(event) => updateForm('tripDurationNights', event.target.value)}
              placeholder="3"
            />
          </label>

          <label>
            {copy.minimumGroupSize}
            <input
              type="number"
              min="1"
              value={form.minimumGroupSize}
              onChange={(event) => updateForm('minimumGroupSize', event.target.value)}
              placeholder="2"
            />
          </label>
        </div>

        <div className="travel-package-grid">
          <div className="travel-package-card">
            <div className="travel-package-card-heading">
              <Plane size={18} aria-hidden="true" />
              <h3>{copy.flights}</h3>
            </div>

            <div className="toggle-filter-grid activity-toggle-grid">
              <button
                type="button"
                className={form.flightIncluded ? 'active' : ''}
                onClick={() => updateForm('flightIncluded', !form.flightIncluded)}
              >
                {copy.flightIncluded}
              </button>
            </div>

            <div className="form-grid">
              <label>
                {copy.airline}
                <input
                  value={form.airline}
                  onChange={(event) => updateForm('airline', event.target.value)}
                  placeholder={copy.airlinePlaceholder}
                />
              </label>

              <label>
                {copy.flightNotes}
                <textarea
                  rows={4}
                  value={form.flightNotes}
                  onChange={(event) => updateForm('flightNotes', event.target.value)}
                  placeholder={copy.flightNotesPlaceholder}
                />
              </label>
            </div>
          </div>

          <div className="travel-package-card">
            <div className="travel-package-card-heading">
              <Hotel size={18} aria-hidden="true" />
              <h3>{copy.hotel}</h3>
            </div>

            <div className="toggle-filter-grid activity-toggle-grid">
              <button
                type="button"
                className={form.hotelIncluded ? 'active' : ''}
                onClick={() => updateForm('hotelIncluded', !form.hotelIncluded)}
              >
                {copy.hotelIncluded}
              </button>
            </div>

            <div className="form-grid">
              <label>
                {copy.hotelName}
                <input
                  value={form.hotelName}
                  onChange={(event) => updateForm('hotelName', event.target.value)}
                  placeholder={copy.hotelNamePlaceholder}
                />
              </label>

              <label>
                {copy.hotelRating}
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={form.hotelRating}
                  onChange={(event) => updateForm('hotelRating', event.target.value)}
                  placeholder="5"
                />
              </label>

              <label>
                {copy.roomType}
                <input
                  value={form.roomType}
                  onChange={(event) => updateForm('roomType', event.target.value)}
                  placeholder={copy.roomTypePlaceholder}
                />
              </label>

              <label>
                {copy.mealPlan}
                <input
                  value={form.mealPlan}
                  onChange={(event) => updateForm('mealPlan', event.target.value)}
                  placeholder={copy.mealPlanPlaceholder}
                />
              </label>
            </div>
          </div>

          <div className="travel-package-card">
            <div className="travel-package-card-heading">
              <ShieldCheck size={18} aria-hidden="true" />
              <h3>{copy.packageServices}</h3>
            </div>

            <div className="toggle-filter-grid activity-toggle-grid">
              <button
                type="button"
                className={form.visaSupportIncluded ? 'active' : ''}
                onClick={() =>
                  updateForm('visaSupportIncluded', !form.visaSupportIncluded)
                }
              >
                {copy.visaSupportIncluded}
              </button>

              <button
                type="button"
                className={form.travelInsuranceIncluded ? 'active' : ''}
                onClick={() =>
                  updateForm('travelInsuranceIncluded', !form.travelInsuranceIncluded)
                }
              >
                {copy.travelInsuranceIncluded}
              </button>

              <button
                type="button"
                className={form.airportTransferIncluded ? 'active' : ''}
                onClick={() =>
                  updateForm('airportTransferIncluded', !form.airportTransferIncluded)
                }
              >
                {copy.airportTransferIncluded}
              </button>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <label>
            {copy.availableTravelDates}
            <textarea
              rows={3}
              value={form.availableTravelDates}
              onChange={(event) => updateForm('availableTravelDates', event.target.value)}
              placeholder={copy.availableTravelDatesPlaceholder}
            />
          </label>

          <label>
            {copy.packageItinerary}
            <textarea
              rows={5}
              value={form.packageItinerary}
              onChange={(event) => updateForm('packageItinerary', event.target.value)}
              placeholder={copy.packageItineraryPlaceholder}
            />
          </label>

          <label>
            {copy.requiredDocuments}
            <textarea
              rows={4}
              value={form.requiredDocuments}
              onChange={(event) => updateForm('requiredDocuments', event.target.value)}
              placeholder={copy.requiredDocumentsPlaceholder}
            />
          </label>

          <label>
            {copy.cancellationPolicy}
            <textarea
              rows={4}
              value={form.cancellationPolicy}
              onChange={(event) => updateForm('cancellationPolicy', event.target.value)}
              placeholder={copy.cancellationPolicyPlaceholder}
            />
          </label>

          <label>
            {copy.packageInclusions}
            <textarea
              rows={4}
              value={form.packageInclusions}
              onChange={(event) => updateForm('packageInclusions', event.target.value)}
              placeholder={copy.packageInclusionsPlaceholder}
            />
          </label>

          <label>
            {copy.packageExclusions}
            <textarea
              rows={4}
              value={form.packageExclusions}
              onChange={(event) => updateForm('packageExclusions', event.target.value)}
              placeholder={copy.packageExclusionsPlaceholder}
            />
          </label>
        </div>

        <p className="package-notice">
          <FileText size={16} aria-hidden="true" />
          {copy.packageDisclaimer}
        </p>
      </section>
    ) : null}

    <section className="form-section-card">
      <div className="form-group-heading">
        <span className="form-section-icon">
          <Users size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{copy.providerInfo}</p>
          <h2>{copy.providerDetails}</h2>
        </div>
      </div>

      <div className="form-grid">
        <label>
          {copy.organizerMode}
          <select
            value={form.organizerMode}
            onChange={(event) => {
              const organizerMode = event.target.value as OrganizerMode;

              setSubmitted(false);
              setSubmitError('');
              setForm((current) => ({
                ...current,
                organizerMode,
                travelAgencyId: '',
                provider: ''
              }));
            }}
          >
            <option value="none">{copy.noTravelAgency}</option>
            <option value="existing">{copy.existingTravelAgency}</option>
            <option value="manual">{copy.manualOrganizer}</option>
          </select>
        </label>

        {form.organizerMode === 'existing' ? (
          <label>
            {copy.travelAgency}
            <select
              required
              value={form.travelAgencyId}
              disabled={loadingOptions}
              onChange={(event) => updateForm('travelAgencyId', event.target.value)}
            >
              <option value="">{copy.selectTravelAgency}</option>
              {travelAgencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                  {agency.verified ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {form.organizerMode === 'manual' ? (
          <label>
            {copy.providerName}
            <input
              required
              value={form.provider}
              onChange={(event) => updateForm('provider', event.target.value)}
              placeholder={copy.providerPlaceholder}
              maxLength={120}
            />
          </label>
        ) : null}

        <label>
          {copy.groupSize}
          <input
            value={form.groupSize}
            onChange={(event) => updateForm('groupSize', event.target.value)}
            placeholder={copy.groupSizePlaceholder}
          />
        </label>

        <label className="form-field">
          {copy.capacity}
          <input
            type="number"
            min="1"
            value={form.capacity}
            onChange={(event) => updateForm('capacity', event.target.value)}
            placeholder={copy.capacityPlaceholder}
          />
        </label>

        <label>
          {copy.difficulty}
          <select
            value={form.difficulty}
            onChange={(event) => updateForm('difficulty', event.target.value)}
          >
            {difficultyOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <label>
          {copy.language}
          <input
            value={form.language}
            onChange={(event) => updateForm('language', event.target.value)}
            placeholder="Arabic / English"
          />
        </label>
      </div>
    </section>

    <section className="form-section-card">
      <div className="form-group-heading">
        <span className="form-section-icon">
          <CalendarDays size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{addActivityCopy.availability}</p>
          <h2>{addActivityCopy.whenAvailable}</h2>
        </div>
      </div>

      <div className="day-picker">
        {dayOptions.map((day) => (
          <button
            key={day}
            type="button"
            className={selectedDays.includes(day) ? 'active' : ''}
            onClick={() => toggleDay(day)}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <label>
          {addActivityCopy.startTime}
          <div className="input-with-icon">
            <Clock size={16} aria-hidden="true" />
            <input
              required
              type="time"
              value={form.startTime}
              onChange={(event) => updateForm('startTime', event.target.value)}
            />
          </div>
        </label>

        <label>
          {addActivityCopy.endTime}
          <div className="input-with-icon">
            <Clock size={16} aria-hidden="true" />
            <input
              required
              type="time"
              value={form.endTime}
              onChange={(event) => updateForm('endTime', event.target.value)}
            />
          </div>
        </label>
      </div>
    </section>

    <section className="form-section-card">
      <div className="form-group-heading">
        <span className="form-section-icon">
          <Users size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{addActivityCopy.advancedData}</p>
          <h2>{addActivityCopy.searchableSpecs}</h2>
        </div>
      </div>

      <div className="form-grid">
        <label>
          {addActivityCopy.durationType}
          <select
            value={form.durationType}
            onChange={(event) => updateForm('durationType', event.target.value)}
          >
            {durationTypeOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <label>
          {addActivityCopy.activityType ?? copy.activityType}
          <select
            value={form.activityType}
            onChange={(event) => updateForm('activityType', event.target.value)}
          >
            {activityTypeOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="toggle-filter-grid activity-toggle-grid">
        <button
          type="button"
          className={form.familyFriendly ? 'active' : ''}
          onClick={() => updateForm('familyFriendly', !form.familyFriendly)}
        >
          {addActivityCopy.familyFriendly}
        </button>

        <button
          type="button"
          className={form.includesTransfer ? 'active' : ''}
          onClick={() => updateForm('includesTransfer', !form.includesTransfer)}
        >
          {addActivityCopy.includesTransfer}
        </button>

        <button
          type="button"
          className={form.mealIncluded ? 'active' : ''}
          onClick={() => updateForm('mealIncluded', !form.mealIncluded)}
        >
          {addActivityCopy.mealIncluded}
        </button>

        <button
          type="button"
          className={form.outdoor ? 'active' : ''}
          onClick={() => updateForm('outdoor', !form.outdoor)}
        >
          {addActivityCopy.outdoor}
        </button>
      </div>
    </section>

    <section className="form-section-card">
      <div className="form-group-heading">
        <span className="form-section-icon">
          <Tags size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{addActivityCopy.highlights}</p>
          <h2>{addActivityCopy.whatIncluded}</h2>
        </div>
      </div>

      <div className="amenity-filter-list">
        {suggestedHighlights.map((highlight) => (
          <button
            key={highlight}
            type="button"
            className={selectedHighlights.includes(highlight) ? 'active' : ''}
            onClick={() => toggleHighlight(highlight)}
          >
            {highlight}
          </button>
        ))}
      </div>

      <label>
        {addActivityCopy.otherHighlights}
        <input
          value={form.highlights}
          onChange={(event) => updateForm('highlights', event.target.value)}
          placeholder={addActivityCopy.otherHighlightsPlaceholder}
        />
      </label>
    </section>

    <section className="form-section-card">
      <div className="form-group-heading">
        <span className="form-section-icon">
          <Image size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{addActivityCopy.media}</p>
          <h2>{addActivityCopy.activityImage ?? copy.activityImage}</h2>
        </div>
      </div>

      <fieldset className="image-fieldset">
        <legend>{addActivityCopy.activityImage ?? copy.activityImage}</legend>

        <div className="image-mode-toggle" aria-label={copy.imageSource}>
          <button
            type="button"
            className={imageMode === 'upload' ? 'active' : ''}
            onClick={() => {
              setImageMode('upload');
              setSubmitted(false);
              setSubmitError('');
            }}
          >
            <UploadCloud size={16} aria-hidden="true" />
            {addActivityCopy.uploadImage}
          </button>

          <button
            type="button"
            className={imageMode === 'url' ? 'active' : ''}
            onClick={() => {
              setImageMode('url');
              setSubmitted(false);
              setSubmitError('');
            }}
          >
            <LinkIcon size={16} aria-hidden="true" />
            {addActivityCopy.useImageUrl}
          </button>
        </div>

        {imageMode === 'upload' ? (
          <label className="upload-box">
            <input
              multiple
              type="file"
              accept={ACCEPTED_IMAGE_INPUT_TYPES}
              onChange={(event) => {
                handleImageFileChange(event.target.files);
              }}
            />
            <UploadCloud size={28} aria-hidden="true" />
            <span>
              {imageFiles.length > 0
                ? `${imageFiles.length} ${copy.imagesSelected}`
                : addActivityCopy.chooseImage}
            </span>
            <small>
              {addActivityCopy.imageHint} {copy.maxImages}
            </small>
          </label>
        ) : (
          <label>
            {addActivityCopy.imageUrl}
            <input
              required={imageMode === 'url'}
              type="url"
              value={form.image}
              onChange={(event) => updateForm('image', event.target.value)}
              placeholder={addActivityCopy.imageUrlPlaceholder}
            />
          </label>
        )}

        {imagePreviews.length > 0 ? (
          <div className="image-preview-grid">
            {imagePreviews.map((preview, imageIndex) => (
              <div className="image-preview" key={`${preview}-${imageIndex}`}>
                <img src={preview} alt={`${copy.activityPreview} ${imageIndex + 1}`} />

                {imageMode === 'upload' ? (
                  <button
                    type="button"
                    onClick={() => clearUploadedImage(imageIndex)}
                    aria-label={copy.removeImage}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </fieldset>
    </section>

    <section className="form-section-card">
      <div className="form-group-heading">
        <span className="form-section-icon">
          <LinkIcon size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{copy.premiumMediaEyebrow}</p>
          <h2>{copy.premiumActivityMediaTitle}</h2>
          <p className="form-section-hint">{copy.premiumActivityMediaHint}</p>
        </div>
      </div>

      <div className="form-grid">
        <label>
          Video walkthrough URL
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={form.videoWalkthroughUrl}
            onChange={(event) => updateForm('videoWalkthroughUrl', event.target.value)}
          />
        </label>

        <label>
          360 tour URL
          <input
            type="url"
            placeholder="https://kuula.co/share/..."
            value={form.tour360Url}
            onChange={(event) => updateForm('tour360Url', event.target.value)}
          />
        </label>

        <label>
          Virtual tour URL
          <input
            type="url"
            placeholder="https://vimeo.com/..."
            value={form.virtualTourUrl}
            onChange={(event) => updateForm('virtualTourUrl', event.target.value)}
          />
        </label>
      </div>
    </section>

    <section className="form-section-card">
      <div className="form-group-heading">
        <span className="form-section-icon">
          <MapPin size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{addActivityCopy.finalDetails}</p>
          <h2>{addActivityCopy.descriptionLabel}</h2>
        </div>
      </div>

      <label>
        {addActivityCopy.descriptionLabel}
        <textarea
          required
          rows={6}
          minLength={20}
          value={form.description}
          onChange={(event) => updateForm('description', event.target.value)}
          placeholder={addActivityCopy.descriptionPlaceholder}
        />
      </label>
    </section>

    <div className="form-submit-bar">
      <div>
        <strong>
          {formCompletion}% {addActivityCopy.ready}
        </strong>
        <span>{addActivityCopy.reviewHint ?? copy.reviewHint}</span>
      </div>

      <button className="button-link button-link--primary" type="submit" disabled={submitting}>
        {submitting ? copy.submitting : t.common.submitForReview}
      </button>
    </div>

    {submitted ? (
      <p className="success-message success-message--floating" role="status">
        <CheckCircle2 size={18} aria-hidden="true" />
        {addActivityCopy.submitted ?? copy.submitted}
      </p>
    ) : null}
  </form>
</section>


);
}

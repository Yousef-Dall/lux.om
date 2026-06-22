import {
  CheckCircle2,
  Home,
  Image,
  Link as LinkIcon,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { ApiError } from '../api/client';
import { createListing, type CreateListingPayload } from '../api/listings';
import {
  ACCEPTED_IMAGE_INPUT_TYPES,
  MAX_IMAGE_UPLOAD_COUNT,
  getImageUploadValidationError,
  uploadImage
} from '../api/uploads';
import { getDevelopers, getLandmarks } from '../api/marketplace';
import { useAuth } from '../auth/AuthContext';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import {
  formatListingBuyerEligibility,
  listingBuyerEligibilityOptions
} from '../utils/listingEligibility';
import type {
  DevelopmentCompany,
  Landmark,
  ListingBuyerEligibility,
  PriceQualifier,
  PriceUnit
} from '../types';

const amenityOptions = [
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
  'Maid room',
  'Driver room',
  'Balcony',
  'Beach nearby',
  'Kitchen',
  'Housekeeping'
];

const propertyTypes = ['Villa', 'Apartment', 'Chalet', 'Penthouse', 'Resort apartment', 'Land'];

const transactionTypes = ['Rent', 'Sale', 'Short stay'];

const priceQualifierOptions: PriceQualifier[] = [
  'FIXED',
  'FROM',
  'ON_REQUEST'
];

const listingPriceUnitOptions: PriceUnit[] = [
  'TOTAL',
  'NIGHT',
  'MONTH',
  'YEAR'
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

const defaultListingPriceUnit: Record<
  CreateListingPayload['transaction'],
  PriceUnit
> = {
  Sale: 'TOTAL',
  Rent: 'MONTH',
  'Short stay': 'NIGHT'
};

const furnishingOptions = ['Not specified', 'Furnished', 'Semi-furnished', 'Unfurnished'];

const viewOptions = [
  'Not specified',
  'Sea view',
  'Mountain view',
  'City view',
  'Garden view',
  'Golf view'
];

type DeveloperMode = 'none' | 'existing' | 'manual';

const initialForm = {
  title: '',
  type: 'Villa',
  transaction: 'Rent',
  buyerEligibility: [] as ListingBuyerEligibility[],
  location: '',
  priceAmount: '',
  priceCurrency: 'OMR',
  priceQualifier: 'FIXED' as PriceQualifier,
  priceUnit: 'MONTH' as PriceUnit,
  beds: '3',
  baths: '3',
  sqm: '',
  image: '',
  description: '',
  amenities: '',
  developerMode: 'none' as DeveloperMode,
  developerId: '',
  developerName: '',
  nearestLandmarkId: '',
  distanceFromLandmark: '',
  minStayNights: '',
  maxGuests: '',
  parkingSpaces: '',
  floorNumber: '',
  furnishing: 'Not specified',
  view: 'Not specified',
  videoWalkthroughUrl: '',
  tour360Url: '',
  virtualTourUrl: '',
  floorPlanUrl: '',
  eligibilityNotes: '',
  eligibilityDisclaimer: '',
  investorHighlights: ''
};

type ImageMode = 'upload' | 'url';


function optionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return undefined;

  const numberValue = Number(trimmed);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function optionalText(value: string) {
  const trimmed = value.trim();

  return trimmed || undefined;
}

export default function AddListing() {
  const { t, language } = useLanguage();
  const { token } = useAuth();

  useDocumentTitle('Add listing');

  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [developers, setDevelopers] = useState<DevelopmentCompany[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  const [imageMode, setImageMode] = useState<ImageMode>('upload');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadedImagePreviews, setUploadedImagePreviews] = useState<
    string[]
  >([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const copy =
    language === 'ar'
      ? {
          qualityEyebrow: 'جودة الإعلان',
          ready: 'جاهز',
          qualityText: 'أكمل التفاصيل الأساسية ليسهل مراجعة العقار وظهوره في البحث.',
          media: 'الصور',
          finalDetails: 'التفاصيل النهائية',
          submittedReview: 'تتم مراجعة العقارات قبل نشرها.',
          imageSource: 'مصدر الصورة',
          removeImage: 'إزالة الصورة',
          invalidImageType: 'يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP أو GIF.',
          imageTooLarge: 'حجم الصورة كبير جداً. الحد الأقصى 5MB.',
          imagesSelected: 'صور مختارة',
          maxImages: 'يمكنك رفع حتى 8 صور.',
          previewAlt: 'معاينة صورة العقار',
          developerAndLocation: 'المطور والموقع',
          marketplaceContext: 'ربط العقار بالمطور والمعلم القريب',
          developer: 'المطور العقاري',
          developerMode: 'طريقة إضافة المطور',
          noDeveloper: 'بدون مطور',
          existingDeveloper: 'مطور مسجل',
          manualDeveloper: 'مطور آخر غير مسجل',
          selectDeveloper: 'اختر المطور',
          manualDeveloperName: 'اسم المطور',
          manualDeveloperPlaceholder: 'مثال: شركة مسقط للتطوير',
          landmark: 'أقرب معلم أو منطقة',
          noLandmark: 'بدون معلم محدد',
          distance: 'المسافة من المعلم',
          distancePlaceholder: 'مثال: 5 دقائق بالسيارة، داخل المنطقة',
          submitting: 'جاري الإرسال...',
          submitError: 'تعذر إرسال العقار للمراجعة. حاولي مرة أخرى.',
          authError: 'يجب تسجيل الدخول قبل إضافة عقار.',
          optionsError: 'تعذر تحميل المطورين والمعالم من الخادم.',
          priceType: 'نوع السعر',
          fixedPrice: 'سعر ثابت',
          startingFrom: 'ابتداءً من',
          priceOnRequest: 'السعر عند الطلب',
          priceAmount: 'المبلغ',
          priceAmountPlaceholder: '٩٠٠',
          priceCurrency: 'العملة',
          priceUnit: 'وحدة التسعير',
          buyerEligibility: 'أهلية الشراء',
          buyerEligibilityHint: 'تظهر فقط لعقارات البيع وتوضح من يمكنه شراء العقار.',
          totalPrice: 'السعر الإجمالي',
          perNight: 'لكل ليلة',
          perMonth: 'لكل شهر',
          perYear: 'لكل سنة'
        }
      : {
          qualityEyebrow: 'Listing quality',
          ready: 'ready',
          qualityText: 'Complete the key details to make your listing easier to approve and discover.',
          media: 'Media',
          finalDetails: 'Final details',
          submittedReview: 'Listings are reviewed before going public.',
          imageSource: 'Image source',
          removeImage: 'Remove image',
          invalidImageType: 'Please choose a JPG, PNG, WEBP, or GIF image.',
          imageTooLarge: 'Image is too large. Maximum size is 5MB.',
          imagesSelected: 'images selected',
          maxImages: 'You can upload up to 8 images.',
          previewAlt: 'Property preview',
          developerAndLocation: 'Developer and location context',
          marketplaceContext: 'Connect this property to a developer and nearby landmark',
          developer: 'Development company',
          developerMode: 'Developer option',
          noDeveloper: 'No developer',
          existingDeveloper: 'Existing developer',
          manualDeveloper: 'Other / not listed',
          selectDeveloper: 'Select developer',
          manualDeveloperName: 'Developer name',
          manualDeveloperPlaceholder: 'Example: Muscat Development Company',
          landmark: 'Nearest landmark or area',
          noLandmark: 'No landmark selected',
          distance: 'Distance from landmark',
          distancePlaceholder: 'Example: 5 min drive, inside district',
          submitting: 'Submitting...',
          submitError: 'Could not submit this listing for review. Please try again.',
          authError: 'You must be logged in before adding a listing.',
          optionsError: 'Could not load developers and landmarks from the server.',
          priceType: 'Price type',
          fixedPrice: 'Fixed price',
          startingFrom: 'Starting from',
          priceOnRequest: 'Price on request',
          priceAmount: 'Amount',
          priceAmountPlaceholder: '900',
          priceCurrency: 'Currency',
          priceUnit: 'Pricing unit',
          buyerEligibility: 'Buyer eligibility',
          buyerEligibilityHint: 'Shown only for sale listings to clarify who can buy this property.',
          totalPrice: 'Total price',
          perNight: 'Per night',
          perMonth: 'Per month',
          perYear: 'Per year'
        };

  const priceQualifierLabels: Record<
    PriceQualifier,
    string
  > = {
    FIXED: copy.fixedPrice,
    FROM: copy.startingFrom,
    ON_REQUEST: copy.priceOnRequest
  };

  const listingPriceUnitLabels: Partial<
    Record<PriceUnit, string>
  > = {
    TOTAL: copy.totalPrice,
    NIGHT: copy.perNight,
    MONTH: copy.perMonth,
    YEAR: copy.perYear
  };

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      try {
        setLoadingOptions(true);

        const [apiDevelopers, apiLandmarks] = await Promise.all([
          getDevelopers(language, { take: 100 }),
          getLandmarks(language, { take: 100 })
        ]);

        if (!isMounted) return;

        setDevelopers(apiDevelopers);
        setLandmarks(apiLandmarks);
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
  }, [language]);

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
    const requiredValues = [
      form.title,
      form.location,
      form.priceQualifier === 'ON_REQUEST'
        ? 'price'
        : form.priceAmount.trim(),
      form.beds,
      form.baths,
      form.sqm,
      form.description,
      imageMode === 'upload' ? (imageFiles.length > 0 ? 'images' : '') : form.image
    ];

    return requiredValues.filter(Boolean).length;
  }, [form, imageMode, imageFiles]);

  const formCompletion = Math.round((completedRequiredFields / 8) * 100);

  function updateForm<K extends keyof typeof initialForm>(
    field: K,
    value: (typeof initialForm)[K]
  ) {
    setSubmitted(false);
    setSubmitError('');
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function toggleAmenity(amenity: string) {
    setSubmitted(false);
    setSubmitError('');
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity]
    );
  }

  function toggleBuyerEligibility(value: ListingBuyerEligibility) {
    setSubmitted(false);
    setSubmitError('');
    setForm((current) => ({
      ...current,
      buyerEligibility: current.buyerEligibility.includes(value)
        ? current.buyerEligibility.filter((item) => item !== value)
        : [...current.buyerEligibility, value]
    }));
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

    if (imageMode === 'upload' && imageFiles.length === 0) {
      alert(t.addListing.uploadRequired);
      return;
    }

    if (imageMode === 'url' && !form.image.trim()) {
      alert(t.addListing.urlRequired);
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
      const imageUrl = imageUrls[0] ?? '';

      const amenities = [
        ...selectedAmenities,
        ...form.amenities
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      ];

      await createListing(
  {
    title: form.title,
    type: form.type,
    transaction: form.transaction as CreateListingPayload['transaction'],
    buyerEligibility:
      form.transaction === 'Sale' ? form.buyerEligibility : undefined,
    location: form.location,
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
    beds: Number(form.beds),
    baths: Number(form.baths),
    sqm: Number(form.sqm),
    image: imageUrl,
    images: imageUrls.map((url, imageIndex) => ({
      url,
      altEn: form.title,
      sortOrder: imageIndex
    })),
    description: form.description,
    amenities,
    developerId:
      form.developerMode === 'existing' ? optionalText(form.developerId) : undefined,
    developerNameEn:
      form.developerMode === 'manual' && language === 'en'
        ? optionalText(form.developerName)
        : undefined,
    developerNameAr:
      form.developerMode === 'manual' && language === 'ar'
        ? optionalText(form.developerName)
        : undefined,
    nearestLandmarkId: optionalText(form.nearestLandmarkId),
    distanceFromLandmark: optionalText(form.distanceFromLandmark),
    minStayNights: optionalNumber(form.minStayNights),
    maxGuests: optionalNumber(form.maxGuests),
    parkingSpaces: optionalNumber(form.parkingSpaces),
    floorNumber: optionalNumber(form.floorNumber),
    furnishing:
      form.furnishing === 'Not specified'
        ? undefined
        : (optionalText(form.furnishing) as CreateListingPayload['furnishing']),
    view:
      form.view === 'Not specified'
        ? undefined
        : (optionalText(form.view) as CreateListingPayload['view']),
    videoWalkthroughUrl: optionalText(form.videoWalkthroughUrl),
    tour360Url: optionalText(form.tour360Url),
    virtualTourUrl: optionalText(form.virtualTourUrl),
    floorPlanUrl: optionalText(form.floorPlanUrl),
    eligibilityNotes:
      form.transaction === 'Sale' ? optionalText(form.eligibilityNotes) : undefined,
    eligibilityDisclaimer:
      form.transaction === 'Sale' ? optionalText(form.eligibilityDisclaimer) : undefined,
    investorHighlights:
      form.transaction === 'Sale'
        ? form.investorHighlights
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined
  },
  token
);

      setSubmitted(true);
      setForm(initialForm);
      setImageFiles([]);
      setImageMode('upload');
      setSelectedAmenities([]);
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

  return (
  <section className="page-section container add-listing-page">
      <SectionHeader
        eyebrow={t.addListing.eyebrow}
        title={t.addListing.title}
        description={t.addListing.description}
      />

      <form className="form-card form-card--wide listing-form" onSubmit={handleSubmit}>
        <div className="form-status-card">
          <div>
            <p className="eyebrow">{copy.qualityEyebrow}</p>
            <h2>
              {formCompletion}% {copy.ready}
            </h2>
            <p>{copy.qualityText}</p>
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
              <Home size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">{t.addListing.basicInfo}</p>
              <h2>{t.addListing.propertyDetails}</h2>
            </div>
          </div>

          <div className="form-grid">
            <label>
              {t.addListing.propertyTitle}
              <input
                required
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
              />
            </label>

            <label>
              {t.addListing.type}
              <select value={form.type} onChange={(event) => updateForm('type', event.target.value)}>
                {propertyTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              {t.addListing.transaction}
              <select
                value={form.transaction}
                onChange={(event) => {
                  const transaction =
                    event.target.value as CreateListingPayload['transaction'];

                  setSubmitted(false);
                  setSubmitError('');
                  setForm((current) => ({
                    ...current,
                    transaction,
                    buyerEligibility:
                      transaction === 'Sale' ? current.buyerEligibility : [],
                    priceUnit:
                      defaultListingPriceUnit[transaction]
                  }));
                }}
              >
                {transactionTypes.map((transaction) => (
                  <option key={transaction}>{transaction}</option>
                ))}
              </select>
            </label>

            {form.transaction === 'Sale' ? (
              <div className="amenity-picker">
                <p>{copy.buyerEligibility}</p>
                <small>{copy.buyerEligibilityHint}</small>

                <div className="amenity-filter-list">
                  {listingBuyerEligibilityOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={form.buyerEligibility.includes(option) ? 'active' : ''}
                      onClick={() => toggleBuyerEligibility(option)}
                    >
                      {formatListingBuyerEligibility(option, language)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label>
              {t.addListing.location}
              <input
                required
                placeholder={t.addListing.locationPlaceholder}
                value={form.location}
                onChange={(event) => updateForm('location', event.target.value)}
              />
            </label>

            <fieldset className="pricing-fieldset">
              <legend>{t.addListing.price}</legend>

              <div className="pricing-grid">
                <label>
                  {copy.priceType}
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
                  {copy.priceAmount}
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
                    placeholder={copy.priceAmountPlaceholder}
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
                  {copy.priceCurrency}
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
                  {copy.priceUnit}
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
                    {listingPriceUnitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {listingPriceUnitLabels[unit] ?? unit}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>

            <label>
              {t.addListing.bedrooms}
              <input
                required
                type="number"
                min="0"
                value={form.beds}
                onChange={(event) => updateForm('beds', event.target.value)}
              />
            </label>

            <label>
              {t.addListing.bathrooms}
              <input
                required
                type="number"
                min="0"
                value={form.baths}
                onChange={(event) => updateForm('baths', event.target.value)}
              />
            </label>

            <label>
              {t.addListing.area}
              <input
                required
                type="number"
                min="1"
                value={form.sqm}
                onChange={(event) => updateForm('sqm', event.target.value)}
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
              <p className="eyebrow">{copy.developerAndLocation}</p>
              <h2>{copy.marketplaceContext}</h2>
            </div>
          </div>

          <div className="form-grid">
            <label>
              {copy.developerMode}
              <select
                value={form.developerMode}
                onChange={(event) => {
                  const developerMode = event.target.value as DeveloperMode;

                  setSubmitted(false);
                  setSubmitError('');
                  setForm((current) => ({
                    ...current,
                    developerMode,
                    developerId: '',
                    developerName: ''
                  }));
                }}
              >
                <option value="none">{copy.noDeveloper}</option>
                <option value="existing">{copy.existingDeveloper}</option>
                <option value="manual">{copy.manualDeveloper}</option>
              </select>
            </label>

            {form.developerMode === 'existing' ? (
              <label>
                {copy.developer}
                <select
                  required
                  value={form.developerId}
                  disabled={loadingOptions}
                  onChange={(event) => updateForm('developerId', event.target.value)}
                >
                  <option value="">{copy.selectDeveloper}</option>
                  {developers.map((developer) => (
                    <option key={developer.id} value={developer.id}>
                      {developer.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {form.developerMode === 'manual' ? (
              <label>
                {copy.manualDeveloperName}
                <input
                  required
                  value={form.developerName}
                  onChange={(event) => updateForm('developerName', event.target.value)}
                  placeholder={copy.manualDeveloperPlaceholder}
                  maxLength={120}
                />
              </label>
            ) : null}

            <label>
              {copy.landmark}
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
                placeholder={copy.distancePlaceholder}
                value={form.distanceFromLandmark}
                onChange={(event) => updateForm('distanceFromLandmark', event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="form-section-card">
          <div className="form-group-heading">
            <span className="form-section-icon">
              <SlidersHorizontal size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">{t.addListing.advancedData}</p>
              <h2>{t.addListing.searchableSpecs}</h2>
            </div>
          </div>

          <div className="form-grid">
            <label>
              {t.addListing.maxGuests}
              <input
                type="number"
                min="1"
                placeholder={t.addListing.maxGuestsPlaceholder}
                value={form.maxGuests}
                onChange={(event) => updateForm('maxGuests', event.target.value)}
              />
            </label>

            <label>
              {t.addListing.minStay}
              <input
                type="number"
                min="1"
                placeholder={t.addListing.minStayPlaceholder}
                value={form.minStayNights}
                onChange={(event) => updateForm('minStayNights', event.target.value)}
              />
            </label>

            <label>
              {t.addListing.parkingSpaces}
              <input
                type="number"
                min="0"
                value={form.parkingSpaces}
                onChange={(event) => updateForm('parkingSpaces', event.target.value)}
              />
            </label>

            <label>
              {t.addListing.floorNumber}
              <input
                type="number"
                placeholder={t.addListing.floorNumberPlaceholder}
                value={form.floorNumber}
                onChange={(event) => updateForm('floorNumber', event.target.value)}
              />
            </label>

            <label>
              {t.addListing.furnishing}
              <select
                value={form.furnishing}
                onChange={(event) => updateForm('furnishing', event.target.value)}
              >
                {furnishingOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>

            <label>
              {t.addListing.view}
              <select value={form.view} onChange={(event) => updateForm('view', event.target.value)}>
                {viewOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="amenity-picker">
            <p>{t.addListing.amenities}</p>

            <div className="amenity-filter-list">
              {amenityOptions.map((amenity) => (
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

          <label>
            {t.addListing.otherAmenities}
            <input
              placeholder={t.addListing.otherAmenitiesPlaceholder}
              value={form.amenities}
              onChange={(event) => updateForm('amenities', event.target.value)}
            />
          </label>
        </section>

        <section className="form-section-card">
          <div className="form-group-heading">
            <span className="form-section-icon">
              <Image size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">{copy.media}</p>
              <h2>{t.addListing.propertyImage}</h2>
            </div>
          </div>

          <fieldset className="image-fieldset">
            <legend>{t.addListing.propertyImage}</legend>

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
                {t.addListing.uploadImage}
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
                {t.addListing.useImageUrl}
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
                    : t.addListing.chooseImage}
                </span>
                <small>
                  {t.addListing.imageHint} {copy.maxImages}
                </small>
              </label>
            ) : (
              <label>
                {t.addListing.imageUrl}
                <input
                  required={imageMode === 'url'}
                  type="url"
                  placeholder={t.addListing.imageUrlPlaceholder}
                  value={form.image}
                  onChange={(event) => updateForm('image', event.target.value)}
                />
              </label>
            )}

            {imagePreviews.length > 0 ? (
              <div className="image-preview-grid">
                {imagePreviews.map((preview, imageIndex) => (
                  <div className="image-preview" key={`${preview}-${imageIndex}`}>
                    <img src={preview} alt={`${copy.previewAlt} ${imageIndex + 1}`} />

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
              <p className="eyebrow">Premium media</p>
              <h2>Premium media and investor eligibility notes</h2>
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
                placeholder="https://my.matterport.com/show/?m=..."
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

            <label>
              Floor plan URL
              <input
                type="url"
                placeholder="/uploads/floor-plan.pdf or https://..."
                value={form.floorPlanUrl}
                onChange={(event) => updateForm('floorPlanUrl', event.target.value)}
              />
            </label>
          </div>

          {form.transaction === 'Sale' ? (
            <div className="form-grid">
              <label>
                Eligibility notes
                <textarea
                  rows={3}
                  value={form.eligibilityNotes}
                  onChange={(event) => updateForm('eligibilityNotes', event.target.value)}
                />
              </label>

              <label>
                Eligibility disclaimer
                <textarea
                  rows={3}
                  value={form.eligibilityDisclaimer}
                  onChange={(event) => updateForm('eligibilityDisclaimer', event.target.value)}
                />
              </label>

              <label>
                Investor highlights
                <input
                  placeholder="ITC, Golden Visa review, freehold title..."
                  value={form.investorHighlights}
                  onChange={(event) => updateForm('investorHighlights', event.target.value)}
                />
              </label>
            </div>
          ) : null}
        </section>

        <section className="form-section-card">
          <div className="form-group-heading">
            <span className="form-section-icon">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">{copy.finalDetails}</p>
              <h2>{t.addListing.descriptionLabel}</h2>
            </div>
          </div>

          <label>
            {t.addListing.descriptionLabel}
            <textarea
              required
              rows={6}
              minLength={20}
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
            />
          </label>
        </section>

        <div className="form-submit-bar">
          <div>
            <strong>
              {formCompletion}% {copy.ready}
            </strong>
            <span>{copy.submittedReview}</span>
          </div>

          <button className="button-link button-link--primary" type="submit" disabled={submitting}>
            {submitting ? copy.submitting : t.common.submitForReview}
          </button>
        </div>

        {submitted ? (
          <p className="success-message success-message--floating" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            {t.addListing.submitted}
          </p>
        ) : null}
      </form>
    </section>
  );
}
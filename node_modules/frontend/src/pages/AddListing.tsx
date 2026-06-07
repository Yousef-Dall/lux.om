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

import SectionHeader from '../components/SectionHeader';
import { developmentCompanies, landmarks } from '../data/mockData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

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

const paymentFrequencies = [
  'Not specified',
  'Per night',
  'Per month',
  'Per year',
  'Total sale price'
];

const furnishingOptions = ['Not specified', 'Furnished', 'Semi-furnished', 'Unfurnished'];

const viewOptions = [
  'Not specified',
  'Sea view',
  'Mountain view',
  'City view',
  'Garden view',
  'Golf view'
];

const initialForm = {
  title: '',
  type: 'Villa',
  transaction: 'Rent',
  location: '',
  price: '',
  beds: '3',
  baths: '3',
  sqm: '',
  image: '',
  description: '',
  amenities: '',
  developerId: '',
  nearestLandmarkId: '',
  distanceFromLandmark: '',
  minStayNights: '',
  maxGuests: '',
  parkingSpaces: '',
  floorNumber: '',
  furnishing: 'Not specified',
  view: 'Not specified',
  paymentFrequency: 'Not specified'
};

type ImageMode = 'upload' | 'url';

export default function AddListing() {
  const { t, language } = useLanguage();

  useDocumentTitle('Add listing');

  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [imageMode, setImageMode] = useState<ImageMode>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState('');
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
          previewAlt: 'معاينة صورة العقار',
          developerAndLocation: 'المطور والموقع',
          marketplaceContext: 'ربط العقار بالمطور والمعلم القريب',
          developer: 'المطور العقاري',
          noDeveloper: 'بدون مطور محدد',
          landmark: 'أقرب معلم أو منطقة',
          noLandmark: 'بدون معلم محدد',
          distance: 'المسافة من المعلم',
          distancePlaceholder: 'مثال: 5 دقائق بالسيارة، داخل المنطقة'
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
          previewAlt: 'Property preview',
          developerAndLocation: 'Developer and location context',
          marketplaceContext: 'Connect this property to a developer and nearby landmark',
          developer: 'Development company',
          noDeveloper: 'No developer selected',
          landmark: 'Nearest landmark or area',
          noLandmark: 'No landmark selected',
          distance: 'Distance from landmark',
          distancePlaceholder: 'Example: 5 min drive, inside district'
        };

  useEffect(() => {
    if (!imageFile) {
      setUploadedImagePreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setUploadedImagePreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const imagePreview = imageMode === 'upload' ? uploadedImagePreview : form.image.trim();

  const completedRequiredFields = useMemo(() => {
    const requiredValues = [
      form.title,
      form.location,
      form.price,
      form.beds,
      form.baths,
      form.sqm,
      form.description,
      imageMode === 'upload' ? imageFile?.name : form.image
    ];

    return requiredValues.filter(Boolean).length;
  }, [form, imageMode, imageFile]);

  const formCompletion = Math.round((completedRequiredFields / 8) * 100);

  function updateForm(field: keyof typeof initialForm, value: string) {
    setSubmitted(false);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleAmenity(amenity: string) {
    setSubmitted(false);
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity]
    );
  }

  function clearUploadedImage() {
    setImageFile(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (imageMode === 'upload' && !imageFile) {
      alert(t.addListing.uploadRequired);
      return;
    }

    if (imageMode === 'url' && !form.image.trim()) {
      alert(t.addListing.urlRequired);
      return;
    }

    const selectedDeveloper = developmentCompanies.find((developer) => developer.id === form.developerId);
    const selectedLandmark = landmarks.find((landmark) => landmark.id === form.nearestLandmarkId);

    const listingPayload = {
      ...form,
      status: 'PENDING',
      amenities: [
        ...selectedAmenities,
        ...form.amenities
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      ],
      developerId: selectedDeveloper?.id || undefined,
      developerName: selectedDeveloper?.name || undefined,
      nearestLandmarkId: selectedLandmark?.id || undefined,
      nearestLandmarkName: selectedLandmark?.name || undefined,
      imageSource: imageMode,
      imageFileName: imageFile?.name ?? null
    };

    console.log('Listing submitted:', listingPayload);

    setSubmitted(true);
    setForm(initialForm);
    setImageFile(null);
    setImageMode('upload');
    setSelectedAmenities([]);
  }

  return (
    <section className="page-section container">
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
                onChange={(event) => updateForm('transaction', event.target.value)}
              >
                {transactionTypes.map((transaction) => (
                  <option key={transaction}>{transaction}</option>
                ))}
              </select>
            </label>

            <label>
              {t.addListing.location}
              <input
                required
                placeholder={t.addListing.locationPlaceholder}
                value={form.location}
                onChange={(event) => updateForm('location', event.target.value)}
              />
            </label>

            <label>
              {t.addListing.price}
              <input
                required
                placeholder={t.addListing.pricePlaceholder}
                value={form.price}
                onChange={(event) => updateForm('price', event.target.value)}
              />
            </label>

            <label>
              {t.addListing.paymentFrequency}
              <select
                value={form.paymentFrequency}
                onChange={(event) => updateForm('paymentFrequency', event.target.value)}
              >
                {paymentFrequencies.map((frequency) => (
                  <option key={frequency}>{frequency}</option>
                ))}
              </select>
            </label>

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
              {copy.developer}
              <select
                value={form.developerId}
                onChange={(event) => updateForm('developerId', event.target.value)}
              >
                <option value="">{copy.noDeveloper}</option>
                {developmentCompanies.map((developer) => (
                  <option key={developer.id} value={developer.id}>
                    {developer.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {copy.landmark}
              <select
                value={form.nearestLandmarkId}
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
                }}
              >
                <LinkIcon size={16} aria-hidden="true" />
                {t.addListing.useImageUrl}
              </button>
            </div>

            {imageMode === 'upload' ? (
              <label className="upload-box">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImageFile(file);
                    setSubmitted(false);
                  }}
                />
                <UploadCloud size={28} aria-hidden="true" />
                <span>{imageFile ? imageFile.name : t.addListing.chooseImage}</span>
                <small>{t.addListing.imageHint}</small>
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

            {imagePreview ? (
              <div className="image-preview">
                <img src={imagePreview} alt={copy.previewAlt} />

                {imageMode === 'upload' ? (
                  <button type="button" onClick={clearUploadedImage} aria-label={copy.removeImage}>
                    <X size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </fieldset>
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

          <button className="button-link button-link--primary" type="submit">
            {t.common.submitForReview}
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
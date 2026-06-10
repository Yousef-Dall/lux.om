import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Image,
  Link as LinkIcon,
  MapPin,
  Sparkles,
  Tags,
  UploadCloud,
  Users,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { ApiError, apiClient } from '../api/client';
import { getLandmarks, getTravelAgencies } from '../api/marketplace';
import { useAuth } from '../auth/AuthContext';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { Landmark, TravelAgency } from '../types';

type ImageMode = 'upload' | 'url';

async function uploadImage(file: File, token: string) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/api/uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : 'Image upload failed'
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Image upload failed');
  }

  const uploadedUrl =
    'url' in payload && typeof payload.url === 'string'
      ? payload.url
      : 'fileUrl' in payload && typeof payload.fileUrl === 'string'
        ? payload.fileUrl
        : 'imageUrl' in payload && typeof payload.imageUrl === 'string'
          ? payload.imageUrl
          : 'path' in payload && typeof payload.path === 'string'
            ? payload.path
            : 'file' in payload &&
                payload.file &&
                typeof payload.file === 'object' &&
                'url' in payload.file &&
                typeof payload.file.url === 'string'
              ? payload.file.url
              : null;

  if (!uploadedUrl) {
    throw new Error('Upload succeeded, but no image URL was returned');
  }

  if (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')) {
    return uploadedUrl;
  }

  return `${window.location.origin}${uploadedUrl.startsWith('/') ? uploadedUrl : `/${uploadedUrl}`}`;
}

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

const initialForm = {
  title: '',
  category: 'Desert',
  location: '',
  nearestLandmarkId: '',
  distanceFromLandmark: '',
  travelAgencyId: '',
  provider: '',
  groupSize: '',
  difficulty: 'Easy',
  language: 'Arabic / English',
  price: '',
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
  outdoor: true
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export default function AddActivity() {
  const { t, language } = useLanguage();
  const { token } = useAuth();

  useDocumentTitle('Add activity');

  const [form, setForm] = useState(initialForm);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Thursday', 'Friday', 'Saturday']);
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);
  const [imageMode, setImageMode] = useState<ImageMode>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [travelAgencies, setTravelAgencies] = useState<TravelAgency[]>([]);

  const addActivityCopy = t.addActivity ?? t.addExperience;

  const copy =
    language === 'ar'
      ? {
          addActivityTitle: 'أضف نشاطاً',
          addActivityDescription: 'أضف نشاطاً منظماً إلى lux.om ليتم مراجعته قبل النشر.',
          activityDetails: 'تفاصيل النشاط',
          activityTitle: 'عنوان النشاط',
          activityType: 'نوع النشاط',
          activityImage: 'صورة النشاط',
          activityPreview: 'معاينة صورة النشاط',
          providerInfo: 'معلومات المنظم',
          providerDetails: 'اربط النشاط بوكالة سفر وأضف تفاصيل تجربة الضيوف',
          travelAgency: 'وكالة السفر',
          noTravelAgency: 'بدون وكالة محددة',
          providerName: 'اسم المنظم اليدوي',
          providerPlaceholder: 'مثال: Muscat Coast Activities',
          groupSize: 'حجم المجموعة',
          groupSizePlaceholder: 'مثال: 2-8 ضيوف',
          difficulty: 'الصعوبة',
          language: 'اللغة',
          nearestLandmark: 'أقرب معلم أو منطقة',
          noLandmark: 'بدون معلم محدد',
          distance: 'المسافة من المعلم',
          distancePlaceholder: 'مثال: 20 دقيقة من مول عُمان',
          imageSource: 'مصدر الصورة',
          removeImage: 'إزالة الصورة',
          submitted: 'تم إرسال النشاط للمراجعة.',
          reviewHint: 'تتم مراجعة الأنشطة قبل نشرها على lux.om.',
          submitting: 'جاري الإرسال...',
          authError: 'يجب تسجيل الدخول قبل إضافة نشاط.',
          optionsError: 'تعذر تحميل وكالات السفر والمعالم من الخادم.',
          submitError: 'تعذر إرسال النشاط للمراجعة. حاولي مرة أخرى.'
        }
      : {
          addActivityTitle: 'Add activity',
          addActivityDescription:
            'Submit a curated Oman activity to lux.om for review before it goes live.',
          activityDetails: 'Activity details',
          activityTitle: 'Activity title',
          activityType: 'Activity type',
          activityImage: 'Activity image',
          activityPreview: 'Activity preview',
          providerInfo: 'Organizer information',
          providerDetails: 'Connect this activity to a travel agency and add guest details',
          travelAgency: 'Travel agency',
          noTravelAgency: 'No travel agency selected',
          providerName: 'Manual organizer name',
          providerPlaceholder: 'Example: Muscat Coast Activities',
          groupSize: 'Group size',
          groupSizePlaceholder: 'Example: 2-8 guests',
          difficulty: 'Difficulty',
          language: 'Language',
          nearestLandmark: 'Nearest landmark or area',
          noLandmark: 'No landmark selected',
          distance: 'Distance from landmark',
          distancePlaceholder: 'Example: 20 minutes from Mall of Oman',
          imageSource: 'Image source',
          removeImage: 'Remove image',
          submitted: 'Activity submitted for review.',
          reviewHint: 'Activities are reviewed before going public on lux.om.',
          submitting: 'Submitting...',
          authError: 'You must be logged in before adding an activity.',
          optionsError: 'Could not load travel agencies and landmarks from the server.',
          submitError: 'Could not submit this activity for review. Please try again.'
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
      form.category,
      form.location,
      form.price,
      form.duration,
      form.durationMinutes,
      form.description,
      form.startTime,
      form.endTime,
      selectedDays.length > 0 ? 'days' : '',
      imageMode === 'upload' ? imageFile?.name : form.image
    ];

    return requiredValues.filter(Boolean).length;
  }, [form, selectedDays, imageMode, imageFile]);

  const formCompletion = Math.round((completedRequiredFields / 11) * 100);

  function updateForm<K extends keyof typeof initialForm>(field: K, value: (typeof initialForm)[K]) {
    setSubmitted(false);
    setSubmitError('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleDay(day: string) {
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

  function clearUploadedImage() {
    setImageFile(null);
    setSubmitError('');
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

    if (imageMode === 'upload' && !imageFile) {
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

      const imageUrl =
        imageMode === 'upload' && imageFile ? await uploadImage(imageFile, token) : form.image.trim();

      const selectedAgency = travelAgencies.find((agency) => agency.id === form.travelAgencyId);

      const highlightTexts = [
        ...selectedHighlights,
        ...form.highlights
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      ];

      await apiClient.post(
        '/api/activities',
        {
          titleEn: form.title,
          descriptionEn: form.description,
          locationEn: form.location,
          categoryEn: form.category,
          travelAgencyId: optionalText(form.travelAgencyId),
          providerEn: optionalText(form.provider) ?? selectedAgency?.name,
          price: form.price,
          durationMinutes: Number(form.durationMinutes),
          durationLabelEn: form.duration,
          groupSize: optionalText(form.groupSize),
          language: optionalText(form.language),
          difficulty: optionalText(form.difficulty),
          activityType: optionalText(form.activityType),
          familyFriendly: form.familyFriendly,
          includesTransfer: form.includesTransfer,
          mealIncluded: form.mealIncluded,
          outdoor: form.outdoor,
          nearestLandmarkId: optionalText(form.nearestLandmarkId),
          distanceFromLandmarkEn: optionalText(form.distanceFromLandmark),
          images: [
            {
              url: imageUrl,
              altEn: form.title,
              sortOrder: 0
            }
          ],
          highlights: highlightTexts.map((highlight) => ({
            textEn: highlight
          }))
        },
        { token }
      );

      setSubmitted(true);
      setForm(initialForm);
      setSelectedDays(['Thursday', 'Friday', 'Saturday']);
      setSelectedHighlights([]);
      setImageMode('upload');
      setImageFile(null);
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
    <section className="page-section container">
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
                placeholder={addActivityCopy.locationPlaceholder}
              />
            </label>

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

            <label>
              {addActivityCopy.price}
              <input
                required
                value={form.price}
                onChange={(event) => updateForm('price', event.target.value)}
                placeholder={addActivityCopy.pricePlaceholder}
              />
            </label>

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
              {copy.travelAgency}
              <select
                value={form.travelAgencyId}
                disabled={loadingOptions}
                onChange={(event) => {
                  const selectedAgency = travelAgencies.find(
                    (agency) => agency.id === event.target.value
                  );

                  setSubmitted(false);
                  setSubmitError('');
                  setForm((current) => ({
                    ...current,
                    travelAgencyId: event.target.value,
                    provider: selectedAgency?.name ?? current.provider
                  }));
                }}
              >
                <option value="">{copy.noTravelAgency}</option>
                {travelAgencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                    {agency.verified ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {copy.providerName}
              <input
                value={form.provider}
                onChange={(event) => updateForm('provider', event.target.value)}
                placeholder={copy.providerPlaceholder}
              />
            </label>

            <label>
              {copy.groupSize}
              <input
                value={form.groupSize}
                onChange={(event) => updateForm('groupSize', event.target.value)}
                placeholder={copy.groupSizePlaceholder}
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
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImageFile(file);
                    setSubmitted(false);
                    setSubmitError('');
                  }}
                />
                <UploadCloud size={28} aria-hidden="true" />
                <span>{imageFile ? imageFile.name : addActivityCopy.chooseImage}</span>
                <small>{addActivityCopy.imageHint}</small>
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

            {imagePreview ? (
              <div className="image-preview">
                <img src={imagePreview} alt={copy.activityPreview} />

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
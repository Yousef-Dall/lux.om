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

import SectionHeader from '../components/SectionHeader';
import { landmarks } from '../data/mockData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

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

export default function AddActivity() {
  const { t, language } = useLanguage();

  useDocumentTitle('Add activity');

  const [form, setForm] = useState(initialForm);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Thursday', 'Friday', 'Saturday']);
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);
  const [imageMode, setImageMode] = useState<ImageMode>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const addActivityCopy = t.addActivity ?? t.addExperience;

  const copy =
    language === 'ar'
      ? {
          addActivityTitle: 'أضف نشاطاً',
          addActivityDescription:
            'أضف نشاطاً منظماً إلى lux.om ليتم مراجعته قبل النشر.',
          activityDetails: 'تفاصيل النشاط',
          activityTitle: 'عنوان النشاط',
          activityType: 'نوع النشاط',
          activityImage: 'صورة النشاط',
          activityPreview: 'معاينة صورة النشاط',
          providerInfo: 'معلومات المنظم',
          providerDetails: 'أضف بيانات الجهة المنظمة وتجربة الضيوف',
          providerName: 'اسم المنظم',
          providerPlaceholder: 'مثال: Muscat Coast Activities',
          groupSize: 'حجم المجموعة',
          groupSizePlaceholder: 'مثال: 2-8 ضيوف',
          difficulty: 'الصعوبة',
          language: 'اللغة',
          locationContext: 'سياق الموقع',
          nearestLandmark: 'أقرب معلم أو منطقة',
          noLandmark: 'بدون معلم محدد',
          imageSource: 'مصدر الصورة',
          removeImage: 'إزالة الصورة',
          submitted: 'تم إرسال النشاط للمراجعة.',
          reviewHint: 'تتم مراجعة الأنشطة قبل نشرها على lux.om.'
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
          providerInfo: 'Provider information',
          providerDetails: 'Add the host, group format, and guest experience details',
          providerName: 'Provider name',
          providerPlaceholder: 'Example: Muscat Coast Activities',
          groupSize: 'Group size',
          groupSizePlaceholder: 'Example: 2-8 guests',
          difficulty: 'Difficulty',
          language: 'Language',
          locationContext: 'Location context',
          nearestLandmark: 'Nearest landmark or area',
          noLandmark: 'No landmark selected',
          imageSource: 'Image source',
          removeImage: 'Remove image',
          submitted: 'Activity submitted for review.',
          reviewHint: 'Activities are reviewed before going public on lux.om.'
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
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleDay(day: string) {
    setSubmitted(false);
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day]
    );
  }

  function toggleHighlight(highlight: string) {
    setSubmitted(false);
    setSelectedHighlights((current) =>
      current.includes(highlight)
        ? current.filter((item) => item !== highlight)
        : [...current, highlight]
    );
  }

  function clearUploadedImage() {
    setImageFile(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

    const selectedLandmark = landmarks.find((landmark) => landmark.id === form.nearestLandmarkId);

    const activityPayload = {
      title: form.title,
      slug: form.title.toLowerCase().trim().replace(/\s+/g, '-'),
      category: form.category,
      location: form.location,
      nearestLandmarkId: selectedLandmark?.id || undefined,
      nearestLandmarkName: selectedLandmark?.name || undefined,
      provider: form.provider || undefined,
      groupSize: form.groupSize || undefined,
      difficulty: form.difficulty,
      language: form.language || undefined,
      price: form.price,
      duration: form.duration,
      durationMinutes: Number(form.durationMinutes),
      imageSource: imageMode,
      imageUrl: imageMode === 'url' ? form.image : '',
      imageFileName: imageFile?.name ?? null,
      description: form.description,
      highlights: [
        ...selectedHighlights,
        ...form.highlights
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      ],
      availability: {
        days: selectedDays,
        startTime: form.startTime,
        endTime: form.endTime
      },
      specs: {
        durationType: form.durationType,
        experienceType: form.activityType,
        familyFriendly: form.familyFriendly,
        includesTransfer: form.includesTransfer,
        mealIncluded: form.mealIncluded,
        outdoor: form.outdoor
      },
      status: 'PENDING'
    };

    console.log('Activity submitted:', activityPayload);

    setSubmitted(true);
    setForm(initialForm);
    setSelectedDays(['Thursday', 'Friday', 'Saturday']);
    setSelectedHighlights([]);
    setImageMode('upload');
    setImageFile(null);
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

          <button className="button-link button-link--primary" type="submit">
            {t.common.submitForReview}
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
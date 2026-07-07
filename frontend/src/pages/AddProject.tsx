import { Building2, CheckCircle2, FileText, Image, Link as LinkIcon, MapPin } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { createDeveloperProject } from '../api/developerProjects';
import { getDevelopers, getLandmarks } from '../api/marketplace';
import { useAuth } from '../auth/AuthContext';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import CreationReadinessPanel, { type CreationReadinessCheck } from '../components/CreationReadinessPanel';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { parseCoordinatesFromMapInput } from '../utils/mapLocation';
import { useLanguage } from '../i18n/LanguageContext';
import type { DevelopmentCompany, Landmark, PriceQualifier } from '../types';

type DeveloperMode = 'auto' | 'existing' | 'manual';

const initialForm = {
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  locationEn: '',
  locationAr: '',
  mapPlaceLabel: '',
  mapAddress: '',
  mapGoogleUrl: '',
  latitude: '',
  longitude: '',
  completionStatus: 'Off-plan',
  handoverDate: '',
  totalUnits: '',
  availableUnits: '',
  bedroomsSummary: '',
  amenities: '',
  paymentPlan: '',
  brochureUrl: '',
  masterplanUrl: '',
  videoWalkthroughUrl: '',
  image: '',
  images: '',
  startingPriceAmount: '',
  priceCurrency: 'OMR',
  priceQualifier: 'FROM' as PriceQualifier,
  developerMode: 'auto' as DeveloperMode,
  developerId: '',
  developerNameEn: '',
  developerNameAr: '',
  nearestLandmarkId: ''
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseImageUrls(value: string, fallbackAlt: string) {
  return parseCommaList(value).map((url, index) => ({
    url,
    altEn: fallbackAlt,
    sortOrder: index
  }));
}

export default function AddProject() {
  const { language } = useLanguage();
  const { token, user, isAdmin } = useAuth();

  useDocumentTitle('Add developer project');

  const [form, setForm] = useState(initialForm);
  const [developers, setDevelopers] = useState<DevelopmentCompany[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdSlug, setCreatedSlug] = useState('');

  const emailVerificationRequired = Boolean(user && !user.emailVerified && !isAdmin);

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'مشروع مطور عقاري',
          title: 'أضف مشروعاً كاملاً',
          description: 'أنشئ صفحة مشروع تجمع معلومات التطوير، المخطط، خطة الدفع، والصور قبل إضافة الوحدات المتاحة.',
          projectIdentity: 'هوية المشروع',
          projectIdentityText: 'اسم المشروع، الموقع، المطور، والمرحلة الحالية.',
          inventory: 'المخزون والوحدات',
          inventoryText: 'عدد الوحدات، المتاح، الملخص السكني، ونطاق السعر.',
          mediaDocs: 'الوسائط والمستندات',
          mediaDocsText: 'صور المشروع، البروشور، المخطط العام، وفيديو الجولة.',
          projectName: 'اسم المشروع بالإنجليزية',
          projectNameAr: 'اسم المشروع بالعربية',
          descriptionEn: 'وصف المشروع بالإنجليزية',
          descriptionAr: 'وصف المشروع بالعربية',
          locationEn: 'الموقع بالإنجليزية',
          locationAr: 'الموقع بالعربية',
          completionStatus: 'حالة الإنجاز',
          handoverDate: 'تاريخ التسليم المتوقع',
          developerMode: 'المطور',
          autoDeveloper: 'استخدام اسم حسابي / الشركة',
          existingDeveloper: 'ربط بمطور مسجل',
          manualDeveloper: 'إدخال اسم مطور',
          selectDeveloper: 'اختر مطوراً',
          developerNameEn: 'اسم المطور بالإنجليزية',
          developerNameAr: 'اسم المطور بالعربية',
          landmark: 'أقرب معلم أو منطقة',
          noLandmark: 'بدون معلم محدد',
          mapLocation: 'موقع Google Maps',
          mapLocationText: 'الصق رابط Google Maps أو أضف الإحداثيات ليظهر المشروع على خريطة lux.om.',
          mapPlaceLabel: 'اسم النقطة على الخريطة',
          mapPlaceLabelPlaceholder: 'مثال: الواجهة البحرية، المرحلة الأولى',
          mapAddress: 'عنوان الخريطة',
          mapAddressPlaceholder: 'العنوان أو اسم الشارع كما يظهر للعملاء',
          googleMapsUrl: 'رابط Google Maps',
          googleMapsUrlPlaceholder: 'الصق رابط Google Maps وسيتم التقاط الإحداثيات إن وجدت',
          latitude: 'خط العرض',
          longitude: 'خط الطول',
          coordinatesHint: 'الإحداثيات اختيارية لكنها مطلوبة لإظهار دبوس المشروع على صفحة الخريطة.',
          totalUnits: 'إجمالي الوحدات',
          availableUnits: 'الوحدات المتاحة',
          bedroomsSummary: 'ملخص الغرف',
          amenities: 'مرافق المشروع',
          amenitiesPlaceholder: 'مسبح, نادي صحي, ممشى, أمن',
          startingPrice: 'السعر يبدأ من',
          currency: 'العملة',
          priceType: 'نوع السعر',
          paymentPlan: 'خطة الدفع',
          image: 'الصورة الرئيسية',
          images: 'صور إضافية',
          imagesPlaceholder: 'ضع روابط الصور مفصولة بفواصل',
          brochure: 'رابط البروشور',
          masterplan: 'رابط المخطط العام',
          video: 'رابط الفيديو',
          submit: 'إرسال المشروع للمراجعة',
          submitting: 'جاري الإرسال...',
          success: 'تم إرسال المشروع للمراجعة.',
          addUnit: 'إضافة وحدة لهذا المشروع',
          optionsError: 'تعذر تحميل المطورين والمعالم.',
          authError: 'يجب تسجيل الدخول قبل إضافة مشروع.',
          submitError: 'تعذر إنشاء المشروع. حاول مرة أخرى.',
          readinessTitle: 'جاهزية المشروع للمراجعة',
          readinessReview: 'قبل الإرسال',
          readinessDescription: 'هذه النقاط تساعد فريق المراجعة على فهم جاهزية المشروع وتساعد المشترين على الثقة بالصفحة.',
          identityReady: 'هوية المشروع والمطور',
          identityReadyText: 'الاسم، الموقع، المطور، وحالة التسليم واضحة.',
          inventoryReady: 'المخزون والسعر',
          inventoryReadyText: 'عدد الوحدات، الوحدات المتاحة، ملخص الغرف، والسعر مذكورة.',
          mediaReady: 'الوسائط والمستندات',
          mediaReadyText: 'صورة رئيسية، صور إضافية، بروشور، مخطط عام، وفيديو أو جولة.',
          storyReady: 'وصف وثقة المشروع',
          storyReadyText: 'الوصف وخطة الدفع والمرافق تشرح قيمة المشروع للمشتري.',
          unitsReady: 'خطوة الوحدات التالية',
          unitsReadyText: 'بعد اعتماد المشروع، أضف وحدات مرتبطة ليظهر المشروع كمخزون كامل.'
        }
      : {
          eyebrow: 'Developer project',
          title: 'Add a full development project',
          description: 'Create a project page with development details, masterplan, payment plan, media, and launch context before adding available units.',
          projectIdentity: 'Project identity',
          projectIdentityText: 'Project name, location, developer, and delivery stage.',
          inventory: 'Inventory & unit mix',
          inventoryText: 'Total units, available units, bedroom mix, and starting price.',
          mediaDocs: 'Media & documents',
          mediaDocsText: 'Project images, brochure, masterplan, and video walkthrough.',
          projectName: 'Project name in English',
          projectNameAr: 'Project name in Arabic',
          descriptionEn: 'Project description in English',
          descriptionAr: 'Project description in Arabic',
          locationEn: 'Location in English',
          locationAr: 'Location in Arabic',
          completionStatus: 'Completion status',
          handoverDate: 'Expected handover date',
          developerMode: 'Developer',
          autoDeveloper: 'Use my account / company name',
          existingDeveloper: 'Link existing developer',
          manualDeveloper: 'Enter developer name',
          selectDeveloper: 'Select developer',
          developerNameEn: 'Developer name in English',
          developerNameAr: 'Developer name in Arabic',
          landmark: 'Nearest landmark or area',
          noLandmark: 'No landmark selected',
          mapLocation: 'Google Maps location',
          mapLocationText: 'Paste a Google Maps link or add coordinates so this project can appear on the lux.om map.',
          mapPlaceLabel: 'Map place label',
          mapPlaceLabelPlaceholder: 'Example: Waterfront District, Phase 1',
          mapAddress: 'Map address',
          mapAddressPlaceholder: 'Street address or area name customers should see',
          googleMapsUrl: 'Google Maps URL',
          googleMapsUrlPlaceholder: 'Paste a Google Maps URL; coordinates will auto-fill when available',
          latitude: 'Latitude',
          longitude: 'Longitude',
          coordinatesHint: 'Coordinates are optional, but needed to pin this project on the public map.',
          totalUnits: 'Total units',
          availableUnits: 'Available units',
          bedroomsSummary: 'Bedroom mix summary',
          amenities: 'Project amenities',
          amenitiesPlaceholder: 'Pool, gym, promenade, security',
          startingPrice: 'Starting price',
          currency: 'Currency',
          priceType: 'Price type',
          paymentPlan: 'Payment plan',
          image: 'Main image URL',
          images: 'Additional images',
          imagesPlaceholder: 'Comma-separated image URLs',
          brochure: 'Brochure URL',
          masterplan: 'Masterplan URL',
          video: 'Video walkthrough URL',
          submit: 'Submit project for review',
          submitting: 'Submitting...',
          success: 'Project submitted for review.',
          addUnit: 'Add a unit to this project',
          optionsError: 'Could not load developers and landmarks.',
          authError: 'You must be logged in before adding a project.',
          submitError: 'Could not create this project. Please try again.',
          readinessTitle: 'Project review readiness',
          readinessReview: 'Before submit',
          readinessDescription: 'These checks help reviewers understand launch readiness and help buyers trust the project page.',
          identityReady: 'Project and developer identity',
          identityReadyText: 'Name, location, developer, and handover stage are clear.',
          inventoryReady: 'Inventory and pricing',
          inventoryReadyText: 'Total units, available units, bedroom mix, and starting price are included.',
          mediaReady: 'Media and documents',
          mediaReadyText: 'Main image, gallery, brochure, masterplan, and video or tour are present.',
          storyReady: 'Project story and trust',
          storyReadyText: 'Description, payment plan, and amenities explain the value to buyers.',
          unitsReady: 'Next unit step',
          unitsReadyText: 'After project approval, add linked units so the project becomes complete inventory.'
        };

  const completion = useMemo(() => {
    const required = [
      form.nameEn,
      form.locationEn,
      form.descriptionEn,
      form.image,
      form.handoverDate,
      form.totalUnits,
      form.availableUnits,
      form.bedroomsSummary,
      form.startingPriceAmount,
      form.brochureUrl,
      form.masterplanUrl,
      form.videoWalkthroughUrl
    ];

    return Math.round((required.filter(Boolean).length / required.length) * 100);
  }, [
    form.availableUnits,
    form.bedroomsSummary,
    form.brochureUrl,
    form.descriptionEn,
    form.handoverDate,
    form.image,
    form.locationEn,
    form.masterplanUrl,
    form.nameEn,
    form.startingPriceAmount,
    form.totalUnits,
    form.videoWalkthroughUrl
  ]);

  const projectImageCount = parseCommaList(form.images).length + (form.image.trim() ? 1 : 0);
  const hasDeveloperIdentity =
    form.developerMode === 'auto' ||
    Boolean(form.developerId || form.developerNameEn.trim() || form.developerNameAr.trim());
  const projectReadinessChecks: CreationReadinessCheck[] = [
    {
      key: 'identity',
      title: copy.identityReady,
      description: copy.identityReadyText,
      done: Boolean(
        form.nameEn.trim() &&
          form.locationEn.trim() &&
          form.handoverDate &&
          hasDeveloperIdentity &&
          (form.nearestLandmarkId || form.mapGoogleUrl.trim() || (form.latitude.trim() && form.longitude.trim()))
      ),
      critical: true
    },
    {
      key: 'inventory',
      title: copy.inventoryReady,
      description: copy.inventoryReadyText,
      done: Boolean(
        form.totalUnits.trim() &&
          form.availableUnits.trim() &&
          form.bedroomsSummary.trim() &&
          (form.priceQualifier === 'ON_REQUEST' || form.startingPriceAmount.trim())
      ),
      critical: true
    },
    {
      key: 'media-documents',
      title: copy.mediaReady,
      description: copy.mediaReadyText,
      done: Boolean(
        projectImageCount >= 3 &&
          form.brochureUrl.trim() &&
          form.masterplanUrl.trim() &&
          form.videoWalkthroughUrl.trim()
      ),
      critical: true
    },
    {
      key: 'story',
      title: copy.storyReady,
      description: copy.storyReadyText,
      done: Boolean(
        form.descriptionEn.trim().length >= 120 &&
          form.amenities.trim() &&
          form.paymentPlan.trim()
      )
    },
    {
      key: 'units-next',
      title: copy.unitsReady,
      description: copy.unitsReadyText,
      done: Boolean(form.availableUnits.trim() && Number(form.availableUnits) > 0)
    }
  ];

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
        if (isMounted) setSubmitError(copy.optionsError);
      } finally {
        if (isMounted) setLoadingOptions(false);
      }
    }

    void loadOptions();

    return () => {
      isMounted = false;
    };
  }, [language]);

  function updateForm<K extends keyof typeof initialForm>(field: K, value: (typeof initialForm)[K]) {
    setSubmitError('');
    setCreatedSlug('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleMapUrlChange(value: string) {
    const coordinates = parseCoordinatesFromMapInput(value);

    setSubmitError('');
    setCreatedSlug('');
    setForm((current) => ({
      ...current,
      mapGoogleUrl: value,
      latitude: coordinates?.latitude ?? current.latitude,
      longitude: coordinates?.longitude ?? current.longitude
    }));
  }

  function getSubmitErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
      const payload = error.payload as {
        issues?: Array<{ path?: string; message?: string }>;
      } | null;

      if (payload?.issues?.length) {
        return payload.issues
          .map((issue) =>
            [issue.path, issue.message].filter(Boolean).join(': ')
          )
          .join(' · ');
      }

      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return copy.submitError;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setSubmitError(copy.authError);
      return;
    }

    if (emailVerificationRequired) return;

    try {
      setSubmitting(true);
      setSubmitError('');
      setCreatedSlug('');

      const project = await createDeveloperProject(
        {
          nameEn: form.nameEn,
          nameAr: optionalText(form.nameAr),
          descriptionEn: optionalText(form.descriptionEn),
          descriptionAr: optionalText(form.descriptionAr),
          locationEn: form.locationEn,
          locationAr: optionalText(form.locationAr),
          mapPlaceLabel: optionalText(form.mapPlaceLabel),
          mapAddress: optionalText(form.mapAddress),
          mapGoogleUrl: optionalText(form.mapGoogleUrl),
          latitude: optionalText(form.latitude),
          longitude: optionalText(form.longitude),
          completionStatus: optionalText(form.completionStatus),
          handoverDate: optionalText(form.handoverDate),
          totalUnits: optionalNumber(form.totalUnits),
          availableUnits: optionalNumber(form.availableUnits),
          bedroomsSummary: optionalText(form.bedroomsSummary),
          amenities: parseCommaList(form.amenities),
          paymentPlan: optionalText(form.paymentPlan),
          brochureUrl: optionalText(form.brochureUrl),
          masterplanUrl: optionalText(form.masterplanUrl),
          videoWalkthroughUrl: optionalText(form.videoWalkthroughUrl),
          image: optionalText(form.image),
          images: parseImageUrls(form.images, form.nameEn),
          startingPriceAmount: optionalText(form.startingPriceAmount),
          priceCurrency: optionalText(form.priceCurrency),
          priceQualifier: form.priceQualifier,
          developerId: form.developerMode === 'existing' ? optionalText(form.developerId) : undefined,
          developerNameEn: form.developerMode === 'manual' ? optionalText(form.developerNameEn) : undefined,
          developerNameAr: form.developerMode === 'manual' ? optionalText(form.developerNameAr) : undefined,
          nearestLandmarkId: optionalText(form.nearestLandmarkId)
        },
        token,
        language
      );

      setCreatedSlug(project.slug);
      setForm(initialForm);
    } catch (error) {
      console.error(error);
      setSubmitError(getSubmitErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (emailVerificationRequired) {
    return (
      <section className="page-section container add-listing-page add-project-page">
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
        <EmailVerificationBanner mode="blocking" />
      </section>
    );
  }

  return (
    <section className="page-section container add-listing-page add-project-page">
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <div className="persona-flow-card persona-flow-card--listing">
        <div>
          <p className="eyebrow">{language === 'ar' ? 'مشروع ثم وحدات' : 'Project first, units next'}</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <ul>
          {[copy.projectIdentity, copy.inventory, copy.mediaDocs].map((point) => (
            <li key={point}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      <form className="form-card form-card--wide listing-form" onSubmit={handleSubmit}>
        <div className="form-status-card">
          <div>
            <p className="eyebrow">{language === 'ar' ? 'جاهزية المشروع' : 'Project readiness'}</p>
            <h2>{completion}% {language === 'ar' ? 'جاهز' : 'ready'}</h2>
            <p>{language === 'ar' ? 'أكمل البيانات الأساسية لإرسال المشروع للمراجعة.' : 'Complete the essential details to submit the project for review.'}</p>
          </div>
          <div className="form-progress" aria-label={"Project completion " + completion + "%"}>
            <span style={{ width: completion + '%' }} />
          </div>
        </div>

        {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}

        <CreationReadinessPanel
          title={copy.readinessTitle}
          description={copy.readinessDescription}
          completion={completion}
          readyLabel={language === 'ar' ? 'جاهز' : 'ready'}
          reviewLabel={copy.readinessReview}
          checks={projectReadinessChecks}
          language={language}
        />

        {createdSlug ? (
          <div className="success-message success-message--floating" role="status">
            <strong>{copy.success}</strong>
            <Link className="button-link button-link--secondary" to="/add-listing">
              {copy.addUnit}
            </Link>
          </div>
        ) : null}

        <section className="form-section-card">
          <div className="form-group-heading">
            <span className="form-section-icon"><Building2 size={18} aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">{copy.projectIdentity}</p>
              <h2>{copy.projectIdentityText}</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>{copy.projectName}<input required value={form.nameEn} onChange={(event) => updateForm('nameEn', event.target.value)} /></label>
            <label>{copy.projectNameAr}<input value={form.nameAr} onChange={(event) => updateForm('nameAr', event.target.value)} /></label>
            <label>{copy.locationEn}<input required value={form.locationEn} onChange={(event) => updateForm('locationEn', event.target.value)} /></label>
            <label>{copy.locationAr}<input value={form.locationAr} onChange={(event) => updateForm('locationAr', event.target.value)} /></label>
            <label>{copy.completionStatus}<input value={form.completionStatus} onChange={(event) => updateForm('completionStatus', event.target.value)} /></label>
            <label>{copy.handoverDate}<input type="date" value={form.handoverDate} onChange={(event) => updateForm('handoverDate', event.target.value)} /></label>
            <label>{copy.developerMode}<select value={form.developerMode} onChange={(event) => updateForm('developerMode', event.target.value as DeveloperMode)}><option value="auto">{copy.autoDeveloper}</option><option value="existing">{copy.existingDeveloper}</option><option value="manual">{copy.manualDeveloper}</option></select></label>
            {form.developerMode === 'existing' ? <label>{copy.selectDeveloper}<select required disabled={loadingOptions} value={form.developerId} onChange={(event) => updateForm('developerId', event.target.value)}><option value="">{copy.selectDeveloper}</option>{developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name}</option>)}</select></label> : null}
            {form.developerMode === 'manual' ? <><label>{copy.developerNameEn}<input required value={form.developerNameEn} onChange={(event) => updateForm('developerNameEn', event.target.value)} /></label><label>{copy.developerNameAr}<input value={form.developerNameAr} onChange={(event) => updateForm('developerNameAr', event.target.value)} /></label></> : null}
            <label>{copy.landmark}<select disabled={loadingOptions} value={form.nearestLandmarkId} onChange={(event) => updateForm('nearestLandmarkId', event.target.value)}><option value="">{copy.noLandmark}</option>{landmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name} · {landmark.city}</option>)}</select></label>
          </div>

          <div className="map-location-card">
            <div>
              <p className="eyebrow">{copy.mapLocation}</p>
              <h3>{copy.mapLocationText}</h3>
              <small>{copy.coordinatesHint}</small>
            </div>

            <div className="form-grid">
              <label>{copy.mapPlaceLabel}<input placeholder={copy.mapPlaceLabelPlaceholder} value={form.mapPlaceLabel} onChange={(event) => updateForm('mapPlaceLabel', event.target.value)} /></label>
              <label>{copy.mapAddress}<input placeholder={copy.mapAddressPlaceholder} value={form.mapAddress} onChange={(event) => updateForm('mapAddress', event.target.value)} /></label>
              <label className="form-grid__wide">{copy.googleMapsUrl}<input inputMode="url" placeholder={copy.googleMapsUrlPlaceholder} value={form.mapGoogleUrl} onChange={(event) => handleMapUrlChange(event.target.value)} /></label>
              <label>{copy.latitude}<input type="number" step="0.0000001" min="-90" max="90" value={form.latitude} onChange={(event) => updateForm('latitude', event.target.value)} /></label>
              <label>{copy.longitude}<input type="number" step="0.0000001" min="-180" max="180" value={form.longitude} onChange={(event) => updateForm('longitude', event.target.value)} /></label>
            </div>
          </div>
        </section>

        <section className="form-section-card">
          <div className="form-group-heading">
            <span className="form-section-icon"><MapPin size={18} aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">{copy.inventory}</p>
              <h2>{copy.inventoryText}</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>{copy.totalUnits}<input type="number" min="0" value={form.totalUnits} onChange={(event) => updateForm('totalUnits', event.target.value)} /></label>
            <label>{copy.availableUnits}<input type="number" min="0" value={form.availableUnits} onChange={(event) => updateForm('availableUnits', event.target.value)} /></label>
            <label>{copy.bedroomsSummary}<input placeholder="1BR, 2BR, villas" value={form.bedroomsSummary} onChange={(event) => updateForm('bedroomsSummary', event.target.value)} /></label>
            <label>{copy.startingPrice}<input type="number" min="0" step="0.001" value={form.startingPriceAmount} onChange={(event) => updateForm('startingPriceAmount', event.target.value)} /></label>
            <label>{copy.currency}<input maxLength={3} value={form.priceCurrency} onChange={(event) => updateForm('priceCurrency', event.target.value.toUpperCase())} /></label>
            <label>{copy.priceType}<select value={form.priceQualifier} onChange={(event) => updateForm('priceQualifier', event.target.value as PriceQualifier)}><option value="FROM">Starting from</option><option value="FIXED">Fixed</option><option value="ON_REQUEST">On request</option></select></label>
            <label>{copy.amenities}<input placeholder={copy.amenitiesPlaceholder} value={form.amenities} onChange={(event) => updateForm('amenities', event.target.value)} /></label>
            <label>{copy.paymentPlan}<textarea value={form.paymentPlan} onChange={(event) => updateForm('paymentPlan', event.target.value)} /></label>
          </div>
        </section>

        <section className="form-section-card">
          <div className="form-group-heading">
            <span className="form-section-icon"><Image size={18} aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">{copy.mediaDocs}</p>
              <h2>{copy.mediaDocsText}</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>{copy.image}<input required value={form.image} onChange={(event) => updateForm('image', event.target.value)} /></label>
            <label>{copy.images}<input placeholder={copy.imagesPlaceholder} value={form.images} onChange={(event) => updateForm('images', event.target.value)} /></label>
            <label>{copy.brochure}<span className="input-with-icon"><LinkIcon size={16} aria-hidden="true" /><input value={form.brochureUrl} onChange={(event) => updateForm('brochureUrl', event.target.value)} /></span></label>
            <label>{copy.masterplan}<span className="input-with-icon"><FileText size={16} aria-hidden="true" /><input value={form.masterplanUrl} onChange={(event) => updateForm('masterplanUrl', event.target.value)} /></span></label>
            <label>{copy.video}<input value={form.videoWalkthroughUrl} onChange={(event) => updateForm('videoWalkthroughUrl', event.target.value)} /></label>
          </div>
          <label>{copy.descriptionEn}<textarea required value={form.descriptionEn} onChange={(event) => updateForm('descriptionEn', event.target.value)} /></label>
          <label>{copy.descriptionAr}<textarea value={form.descriptionAr} onChange={(event) => updateForm('descriptionAr', event.target.value)} /></label>
        </section>

        <div className="form-submit-bar">
          <div><strong>{completion}% {language === 'ar' ? 'جاهز' : 'ready'}</strong><span>{language === 'ar' ? 'سيتم مراجعة المشروع قبل النشر.' : 'Projects are reviewed before publication.'}</span></div>
          <button className="button-link button-link--primary" disabled={submitting} type="submit">{submitting ? copy.submitting : copy.submit}</button>
        </div>
      </form>
    </section>
  );
}

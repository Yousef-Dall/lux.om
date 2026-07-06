import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Download,
  FileText,
  Image as ImageIcon,
  MapPin,
  MoveRight,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getDeveloperProjectBySlug } from '../api/developerProjects';
import ButtonLink from '../components/ButtonLink';
import MediaQualityGuidance from '../components/MediaQualityGuidance';
import ReportModal from '../components/ReportModal';
import SectionHeader from '../components/SectionHeader';
import TrustBadges from '../components/TrustBadges';
import WhatsAppActions from '../components/WhatsAppActions';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { DeveloperProject } from '../types';
import { formatMarketplacePrice } from '../utils/format';
import { getSafeEmbedUrl } from '../utils/mediaEmbeds';

function formatProjectDate(value: string | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium'
  }).format(parsed);
}

export default function DeveloperProjectDetails() {
  const { slug } = useParams();
  const { language } = useLanguage();
  const { token } = useAuth();
  const [project, setProject] = useState<DeveloperProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentTitle(project ? project.name : 'Developer project');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'مشروع مطور عقاري',
          loading: 'جاري التحميل...',
          notFound: 'المشروع غير موجود',
          newDevelopment: 'مشروع جديد',
          totalUnits: 'إجمالي الوحدات',
          available: 'المتاح',
          unitMix: 'مزيج الوحدات',
          startingPrice: 'السعر يبدأ من',
          handover: 'موعد التسليم',
          developer: 'المطور',
          verifiedDeveloper: 'مطور موثق',
          reviewedByLux: 'تمت مراجعة المشروع قبل النشر',
          reviewedByLuxText: 'يعرض lux.om المشاريع المنشورة بعد مراجعة أساسية للبيانات والوسائط وربط المطور.',
          mediaReady: 'وسائط المشروع جاهزة للمراجعة',
          mediaReadyText: 'راجعي الصور، المخطط العام، الفيديو، والبروشور قبل طلب التفاصيل.',
          unitsReady: 'وحدات مرتبطة بالمشروع',
          unitsReadyText: 'انتقلي مباشرة للوحدات المنشورة وقارني الأسعار والمواصفات.',
          requestDetails: 'طلب تفاصيل المشروع',
          viewDeveloper: 'عرض ملف المطور',
          reportTrustIssue: 'الإبلاغ عن مشكلة ثقة',
          reportTrustDescription: 'أرسلي بلاغاً إذا كانت بيانات المشروع أو المطور تبدو غير دقيقة أو غير آمنة.',
          reportTrustTrigger: 'الإبلاغ عن المشروع',
          brochure: 'تحميل البروشور',
          masterplan: 'المخطط العام',
          projectVideo: 'فيديو المشروع',
          about: 'عن المشروع',
          paymentPlan: 'خطة الدفع',
          amenities: 'المرافق',
          trustTitle: 'الثقة والجاهزية',
          unitsEyebrow: 'الوحدات',
          unitsTitle: 'الوحدات المتاحة في المشروع',
          noUnits: 'لم تتم إضافة وحدات منشورة لهذا المشروع بعد.',
          viewUnit: 'عرض الوحدة',
          contactSafely: 'اطلبي التفاصيل من خلال القنوات الواضحة داخل lux.om وراجعي المستندات قبل أي دفعة.'
        }
      : {
          eyebrow: 'Developer project',
          loading: 'Loading...',
          notFound: 'Project not found',
          newDevelopment: 'New development',
          totalUnits: 'Total units',
          available: 'Available',
          unitMix: 'Unit mix',
          startingPrice: 'Starting price',
          handover: 'Handover',
          developer: 'Developer',
          verifiedDeveloper: 'Verified developer',
          reviewedByLux: 'Reviewed before publishing',
          reviewedByLuxText: 'lux.om shows published projects after a baseline review of data, media, and developer linkage.',
          mediaReady: 'Project media ready to review',
          mediaReadyText: 'Check photos, masterplan, video, and brochure before requesting details.',
          unitsReady: 'Linked project units',
          unitsReadyText: 'Jump straight to published units and compare pricing and specifications.',
          requestDetails: 'Request project details',
          viewDeveloper: 'View developer profile',
          reportTrustIssue: 'Report a trust concern',
          reportTrustDescription: 'Send a report if the project or developer information looks inaccurate or unsafe.',
          reportTrustTrigger: 'Report this project',
          brochure: 'Open brochure',
          masterplan: 'Masterplan',
          projectVideo: 'Project video',
          about: 'About the project',
          paymentPlan: 'Payment plan',
          amenities: 'Amenities',
          trustTitle: 'Trust and readiness',
          unitsEyebrow: 'Units',
          unitsTitle: 'Available units in this project',
          noUnits: 'No published units have been added to this project yet.',
          viewUnit: 'View unit',
          contactSafely: 'Request details through clear lux.om channels and review documents before any payment.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadProject() {
      if (!slug) return;
      try {
        setLoading(true);
        setError('');
        const apiProject = await getDeveloperProjectBySlug(slug, language);
        if (isMounted) setProject(apiProject);
      } catch (loadError) {
        console.error(loadError);
        if (isMounted) setError(language === 'ar' ? 'تعذر تحميل المشروع.' : 'Could not load this project.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [language, slug]);

  if (loading) {
    return (
      <section className="page-section container">
        <p>{copy.loading}</p>
      </section>
    );
  }

  if (error || !project) {
    return (
      <section className="page-section container">
        <SectionHeader eyebrow={copy.eyebrow} title={error || copy.notFound} />
      </section>
    );
  }

  const galleryImages = (
    project.images?.length
      ? project.images.map((image, imageIndex) => ({
          url: image.url,
          alt: image.altEn || image.altAr || `${project.name} ${imageIndex + 1}`
        }))
      : project.image
        ? [{ url: project.image, alt: project.name }]
        : []
  ).filter((image) => image.url);

  const primaryImage = galleryImages[0];
  const projectVideoEmbedUrl = project.videoWalkthroughUrl ? getSafeEmbedUrl(project.videoWalkthroughUrl) : null;
  const startingPrice = formatMarketplacePrice({
    priceAmount: project.startingPriceAmount,
    priceCurrency: project.priceCurrency,
    priceQualifier: project.priceQualifier,
    language
  });

  const projectStats = [
    {
      label: copy.totalUnits,
      value: project.totalUnits ?? '—',
      icon: Building2
    },
    {
      label: copy.available,
      value: project.availableUnits ?? '—',
      icon: Users
    },
    {
      label: copy.unitMix,
      value: project.bedroomsSummary || '—',
      icon: Sparkles
    },
    {
      label: copy.handover,
      value: formatProjectDate(project.handoverDate, language),
      icon: CalendarDays
    }
  ];

  return (
    <article className="details-page developer-project-detail-page">
      <section className="details-hero details-hero--project">
        <div className="container">
          <Link className="back-link" to="/projects">
            {language === 'ar' ? 'العودة إلى المشاريع' : 'Back to projects'}
          </Link>

          <div className="details-hero__content">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{project.name}</h1>
            <p>
              <MapPin size={18} aria-hidden="true" />
              {project.location}
            </p>
          </div>
        </div>
      </section>

      <section className="container details-grid developer-project-conversion-grid">
        <div>
          <div className="details-gallery developer-project-gallery">
            {primaryImage ? (
              <div className="details-image-wrap">
                <img className="details-image" src={primaryImage.url} alt={primaryImage.alt} />

                {project.developer?.verified ? (
                  <span className="details-image-badge">
                    <BadgeCheck size={15} aria-hidden="true" />
                    {copy.verifiedDeveloper}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="developer-project-media-placeholder">
                <ImageIcon size={28} aria-hidden="true" />
                <span>{project.name}</span>
              </div>
            )}

            {galleryImages.length > 1 ? (
              <div className="details-gallery-grid">
                {galleryImages.slice(1).map((image, imageIndex) => (
                  <img
                    key={`${image.url}-${imageIndex}`}
                    src={image.url}
                    alt={image.alt}
                    loading="lazy"
                  />
                ))}
              </div>
            ) : null}
          </div>

          {projectVideoEmbedUrl || project.masterplanUrl || project.brochureUrl ? (
            <section className="premium-media-section" aria-labelledby="project-media-title">
              <div className="details-section-heading">
                <p className="eyebrow">lux.om media</p>
                <h2 id="project-media-title">{copy.mediaReady}</h2>
              </div>

              <div className="premium-media-grid">
                {projectVideoEmbedUrl ? (
                  <iframe
                    src={projectVideoEmbedUrl}
                    title={copy.projectVideo}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : null}

                {project.brochureUrl ? (
                  <a className="premium-media-link" href={project.brochureUrl} target="_blank" rel="noreferrer">
                    <Download size={16} aria-hidden="true" />
                    {copy.brochure}
                  </a>
                ) : null}

                {project.masterplanUrl ? (
                  <a className="premium-media-link" href={project.masterplanUrl} target="_blank" rel="noreferrer">
                    <FileText size={16} aria-hidden="true" />
                    {copy.masterplan}
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="details-content">
            <div className="details-section-heading">
              <p className="eyebrow">{project.completionStatus || copy.newDevelopment}</p>
              <h2>{copy.about}</h2>
            </div>

            <p>{project.description}</p>

            <TrustBadges
              verificationStatus={project.developer?.verificationStatus}
              verificationSource={project.developer?.verificationSource}
              verificationDate={project.developer?.verificationDate}
              verificationExpiryDate={project.developer?.verificationExpiryDate}
              mediaQualityStatus={project.mediaQualityStatus}
              variant="full"
            />

            <div className="detail-conversion-strip detail-conversion-strip--three" aria-label={copy.trustTitle}>
              <article>
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>{copy.reviewedByLux}</strong>
                  <span>{copy.reviewedByLuxText}</span>
                </div>
              </article>

              <article>
                <PlayCircle size={18} aria-hidden="true" />
                <div>
                  <strong>{copy.mediaReady}</strong>
                  <span>{copy.mediaReadyText}</span>
                </div>
              </article>

              <article>
                <Building2 size={18} aria-hidden="true" />
                <div>
                  <strong>{copy.unitsReady}</strong>
                  <span>{copy.unitsReadyText}</span>
                </div>
              </article>
            </div>

            <MediaQualityGuidance item={project} itemType="project" language={language} />

            {project.paymentPlan ? (
              <>
                <h3>{copy.paymentPlan}</h3>
                <p>{project.paymentPlan}</p>
              </>
            ) : null}

            {project.amenities.length ? (
              <>
                <h3>{copy.amenities}</h3>
                <div className="amenity-filter-list">
                  {project.amenities.map((amenity) => (
                    <span key={amenity}>{amenity}</span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <aside className="booking-panel booking-panel--premium" aria-label={copy.trustTitle}>
          <div>
            <span className="booking-panel__label">{project.completionStatus || copy.newDevelopment}</span>
            <strong className="price">{startingPrice}</strong>
          </div>

          <div className="booking-panel-specs booking-panel-specs--stacked">
            {projectStats.map((item) => {
              const Icon = item.icon;

              return (
                <span key={item.label}>
                  <Icon size={16} aria-hidden="true" />
                  {item.label}: {item.value}
                </span>
              );
            })}
          </div>

          {project.developer ? (
            <Link
              to={`/developers/${project.developer.slug}`}
              className="booking-panel-developer"
              aria-label={`${copy.viewDeveloper}: ${project.developer.name}`}
            >
              {project.developer.logo ? (
                <img src={project.developer.logo} alt={`${project.developer.name} logo`} loading="lazy" />
              ) : null}

              <span>
                <small>{copy.developer}</small>
                <strong>
                  {project.developer.name}
                  {project.developer.verified ? <ShieldCheck size={14} aria-hidden="true" /> : null}
                </strong>
              </span>
            </Link>
          ) : null}

          <div className="booking-panel-trust-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>{copy.contactSafely}</span>
          </div>

          <div className="booking-panel-actions">
            <ButtonLink to={`/contact?type=DEVELOPER_PARTNERSHIP&projectId=${project.id}`} isFullWidth>
              {copy.requestDetails}
              <MoveRight size={16} aria-hidden="true" />
            </ButtonLink>

            {project.developer ? (
              <ButtonLink to={`/developers/${project.developer.slug}`} variant="secondary" isFullWidth>
                {copy.viewDeveloper}
              </ButtonLink>
            ) : null}

            {project.developer?.phone ? (
              <WhatsAppActions
                phone={project.developer.phone}
                title={project.name}
                location={project.location}
                label={language === 'ar' ? 'استفسار واتساب' : 'WhatsApp inquiry'}
              />
            ) : null}
          </div>

          {project.developer ? (
            <div className="provider-report-card provider-report-card--compact">
              <h3>{copy.reportTrustIssue}</h3>
              <p>{copy.reportTrustDescription}</p>
              <ReportModal
                targetType="DEVELOPER"
                targetId={project.developer.id}
                targetTitle={project.name}
                token={token}
                triggerLabel={copy.reportTrustTrigger}
              />
            </div>
          ) : null}
        </aside>
      </section>

      <section className="container form-section-card developer-project-units-section" id="project-units">
        <div className="form-group-heading">
          <div>
            <p className="eyebrow">{copy.unitsEyebrow}</p>
            <h2>{copy.unitsTitle}</h2>
          </div>
        </div>

        {project.units?.length ? (
          <div className="dashboard-v2-record-grid developer-project-unit-grid">
            {project.units.map((unit) => (
              <article className="dashboard-v2-record-card" key={unit.id}>
                <img src={unit.image} alt={unit.title} />
                <div className="dashboard-v2-record-card__body">
                  <h3>{unit.title}</h3>
                  <p>{unit.location}</p>
                  <strong>{unit.price}</strong>
                  <Link className="button-link button-link--secondary" to={`/listings/${unit.slug}`}>
                    {copy.viewUnit}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>{copy.noUnits}</p>
        )}
      </section>
    </article>
  );
}

import {
  ArrowRight,
  Building2,
  Globe2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getDeveloperBySlug, getListings } from '../api/marketplace';
import ButtonLink from '../components/ButtonLink';
import { ListingCard } from '../components/Cards';
import SectionHeader from '../components/SectionHeader';
import TrustBadges from '../components/TrustBadges';
import WhatsAppActions from '../components/WhatsAppActions';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { DevelopmentCompany, Listing } from '../types';

export default function DeveloperDetails() {
  const { slug } = useParams();
  const { language } = useLanguage();

  const [developer, setDeveloper] = useState<DevelopmentCompany | null>(null);
  const [developerListings, setDeveloperListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useDocumentTitle(developer ? developer.name : 'Developer details');

  const copy =
    language === 'ar'
      ? {
          notFoundEyebrow: 'المطور غير موجود',
          notFoundTitle: 'ملف شركة التطوير لم يعد متاحاً.',
          backToDevelopers: 'الرجوع للمطورين',
          eyebrow: 'شركة تطوير',
          verifiedDeveloper: 'مطور موثق',
          featuredPartner: 'شريك مميز',
          listedProperties: 'العقارات المنشورة',
          propertiesBy: 'عقارات بواسطة',
          propertiesDescription:
            'استكشف العقارات الحالية، الإقامات القصيرة، الإيجارات، وفرص البيع المرتبطة بهذه الشركة.',
          viewAll: 'عرض كل العقارات المرتبطة',
          noListingsTitle: 'لا توجد عقارات منشورة حالياً',
          noListingsText: 'ملف الشركة جاهز، لكن لم تتم إضافة عقارات عامة بعد.',
          companyProfile: 'ملف الشركة',
          specialties: 'التخصصات',
          location: 'الموقع',
          established: 'تأسست عام',
          phone: 'الهاتف',
          email: 'البريد الإلكتروني',
          website: 'الموقع الإلكتروني',
          partner: 'كن شريكاً مع lux.om',
          whatsapp: 'تواصل عبر واتساب',
          loading: 'جاري تحميل ملف المطور...',
          error: 'تعذر تحميل ملف المطور. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.'
        }
      : {
          notFoundEyebrow: 'Developer not found',
          notFoundTitle: 'This development company profile is no longer available.',
          backToDevelopers: 'Back to developers',
          eyebrow: 'Development company',
          verifiedDeveloper: 'Verified developer',
          featuredPartner: 'Featured partner',
          listedProperties: 'Listed properties',
          propertiesBy: 'Properties by',
          propertiesDescription:
            'Explore current listings, short stays, rentals, and sale opportunities connected to this development company.',
          viewAll: 'View all linked properties',
          noListingsTitle: 'No public listings yet',
          noListingsText: 'This company profile is ready, but public properties have not been added yet.',
          companyProfile: 'Company profile',
          specialties: 'Specialties',
          location: 'Location',
          established: 'Established',
          phone: 'Phone',
          email: 'Email',
          website: 'Website',
          partner: 'Partner with lux.om',
          whatsapp: 'Chat on WhatsApp',
          loading: 'Loading developer profile...',
          error: 'Could not load developer profile. Make sure the backend is running and try again.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadDeveloper() {
      if (!slug) {
        setDeveloper(null);
        setDeveloperListings([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError('');

        const [apiDeveloper, apiListings] = await Promise.all([
          getDeveloperBySlug(slug, language),
          getListings(language, { take: 100 })
        ]);

        if (!isMounted) return;

        setDeveloper(apiDeveloper);
        setDeveloperListings(
          apiListings.filter((listing) => listing.developerId === apiDeveloper.id)
        );
      } catch (error) {
        if (!isMounted) return;

        console.error(error);
        setDeveloper(null);
        setDeveloperListings([]);
        setLoadError(copy.error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadDeveloper();

    return () => {
      isMounted = false;
    };
  }, [slug, language, copy.error]);

  if (loading) {
    return (
      <section className="page-section container not-found" aria-labelledby="developer-loading-title">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="developer-loading-title">{copy.loading}</h1>
      </section>
    );
  }

  if (!developer || loadError) {
    return (
      <section
        className="page-section container not-found"
        aria-labelledby="developer-not-found-title"
      >
        <p className="eyebrow">{copy.notFoundEyebrow}</p>
        <h1 id="developer-not-found-title">{loadError || copy.notFoundTitle}</h1>
        <ButtonLink to="/developers">{copy.backToDevelopers}</ButtonLink>
      </section>
    );
  }

  return (
    <article className="developer-details-page">
      <section className="developer-profile-hero">
        <div className="container developer-profile-hero__grid">
          <div>
            <Link className="back-link" to="/developers">
              {copy.backToDevelopers}
            </Link>

            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{developer.name}</h1>
            <p>{developer.description}</p>
            <TrustBadges
              verificationStatus={developer.verificationStatus}
              verificationSource={developer.verificationSource}
              verificationDate={developer.verificationDate}
              verificationExpiryDate={developer.verificationExpiryDate}
              variant="full"
              className="provider-profile-trust"
            />

            <div className="developer-profile-hero__badges">
              {developer.verified ? (
                <span>
                  <ShieldCheck size={16} aria-hidden="true" />
                  {copy.verifiedDeveloper}
                </span>
              ) : null}

              {developer.featured ? (
                <span>
                  <Sparkles size={16} aria-hidden="true" />
                  {copy.featuredPartner}
                </span>
              ) : null}

              <span>
                <MapPin size={16} aria-hidden="true" />
                {developer.headquarters || developer.location}
              </span>

              <span>
                <Building2 size={16} aria-hidden="true" />
                {developerListings.length} {copy.listedProperties}
              </span>
            </div>
          </div>

          {developer.logo ? (
            <div className="developer-profile-logo">
              <img src={developer.logo} alt={`${developer.name} logo`} />
            </div>
          ) : (
            <div className="developer-profile-logo" aria-hidden="true">
              <Building2 size={48} />
            </div>
          )}
        </div>
      </section>

      <section className="page-section container">
        <div className="developer-profile-grid">
          <div>
            <SectionHeader
              eyebrow={copy.listedProperties}
              title={`${copy.propertiesBy} ${developer.name}`}
              description={copy.propertiesDescription}
              actions={
                <ButtonLink to={`/listings?developer=${developer.slug}`} variant="soft">
                  {copy.viewAll}
                  <ArrowRight size={16} aria-hidden="true" />
                </ButtonLink>
              }
            />

            {developerListings.length > 0 ? (
              <div className="listing-grid">
                {developerListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--premium">
                <Building2 size={34} aria-hidden="true" />
                <h2>{copy.noListingsTitle}</h2>
                <p>{copy.noListingsText}</p>
              </div>
            )}
          </div>

          <aside className="developer-profile-panel">
            <h2>{copy.companyProfile}</h2>

            <div className="developer-profile-panel__facts">
              {developer.specialties.length > 0 ? (
                <span>
                  <Building2 size={17} aria-hidden="true" />
                  <strong>{copy.specialties}:</strong> {developer.specialties.join(', ')}
                </span>
              ) : null}

              <span>
                <MapPin size={17} aria-hidden="true" />
                <strong>{copy.location}:</strong> {developer.location || developer.headquarters}
              </span>

              {developer.establishedYear ? (
                <span>
                  <Sparkles size={17} aria-hidden="true" />
                  <strong>{copy.established}:</strong> {developer.establishedYear}
                </span>
              ) : null}

              {developer.phone ? (
                <a href={`tel:${developer.phone.replace(/\s/g, '')}`}>
                  <Phone size={17} aria-hidden="true" />
                  <strong>{copy.phone}:</strong> {developer.phone}
                </a>
              ) : null}

              {developer.email ? (
                <a href={`mailto:${developer.email}`}>
                  <Mail size={17} aria-hidden="true" />
                  <strong>{copy.email}:</strong> {developer.email}
                </a>
              ) : null}

              {developer.phone ? (
                <WhatsAppActions
                  phone={developer.phone}
                  title={developer.name}
                  location={developer.location || developer.headquarters}
                  label={copy.whatsapp}
                />
              ) : null}

              {developer.website ? (
                <a href={developer.website} target="_blank" rel="noreferrer">
                  <Globe2 size={17} aria-hidden="true" />
                  <strong>{copy.website}:</strong> {developer.website.replace(/^https?:\/\//, '')}
                </a>
              ) : null}
            </div>

            <ButtonLink to="/contact" isFullWidth>
              {copy.partner}
            </ButtonLink>
          </aside>
        </div>
      </section>
    </article>
  );
}
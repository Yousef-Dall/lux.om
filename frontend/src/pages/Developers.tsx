import { ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getDevelopers, getListings } from '../api/marketplace';
import ButtonLink from '../components/ButtonLink';
import PartnerCard from '../components/PartnerCard';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { DevelopmentCompany, Listing } from '../types';

export default function Developers() {
  const { language } = useLanguage();

  useDocumentTitle('Development companies');

  const [developmentCompanies, setDevelopmentCompanies] = useState<DevelopmentCompany[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'المطورون',
          title: 'اكتشف المطورين الموثوقين والمشاريع العقارية الجديدة في عُمان.',
          description:
            'تصفح شركات التطوير، المجتمعات السكنية، المشاريع المميزة، والعقارات المرتبطة بأهم مناطق النمو العقاري في عُمان.',
          partner: 'كن شريكاً مع lux.om',
          network: 'شبكة المطورين',
          heroTitle: 'مصمم لشركات التطوير العقاري والإنشاءات والمشترين الجادين.',
          heroText:
            'تمنح lux.om شركات التطوير حضوراً واضحاً يساعد المشترين والمستأجرين على فهم الشركة، استكشاف عقاراتها، ومتابعة مشاريعها القادمة.',
          developerProfiles: 'ملفات المطورين',
          featuredPartners: 'شركاء مميزون',
          linkedProperties: 'عقارات مرتبطة',
         verifiedDeveloper: 'مطور موثق',
developer: 'مطور',
featured: 'مميز',
headquarters: 'المقر',
phone: 'الهاتف',
email: 'البريد الإلكتروني',
website: 'الموقع الإلكتروني',
listedProperties: 'عقارات منشورة',
viewProfile: 'عرض ملف الشركة',
          cardAria: 'عرض ملف المطور',
          loading: 'جاري تحميل المطورين...',
          error: 'تعذر تحميل المطورين. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.',
          emptyTitle: 'لا يوجد مطورون حالياً',
          emptyText: 'سيتم عرض شركات التطوير هنا بعد إضافتها واعتمادها.'
        }
      : {
          eyebrow: 'Developers',
          title: 'Discover trusted developers and new property projects in Oman.',
          description:
            'Browse development companies, master communities, premium projects, and properties connected to Oman’s most important real estate growth areas.',
          partner: 'Partner with lux.om',
          network: 'Developer network',
          heroTitle: 'Built for construction companies, real estate developers, and serious buyers.',
          heroText:
            'lux.om gives development companies a dedicated presence where buyers and renters can understand the company, explore its listed properties, and discover project pipelines.',
          developerProfiles: 'developer profiles',
          featuredPartners: 'featured partners',
          linkedProperties: 'linked properties',
         verifiedDeveloper: 'Verified developer',
developer: 'Developer',
featured: 'Featured',
headquarters: 'Headquarters',
phone: 'Phone',
email: 'Email',
website: 'Website',
listedProperties: 'listed properties',
viewProfile: 'View company profile',
          cardAria: 'View developer profile',
          loading: 'Loading developers...',
          error: 'Could not load developers. Make sure the backend is running and try again.',
          emptyTitle: 'No developers yet',
          emptyText: 'Development companies will appear here after they are added and approved.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      try {
        setLoading(true);
        setLoadError('');

        const [apiDevelopers, apiListings] = await Promise.all([
          getDevelopers(language, { take: 100 }),
          getListings(language, { take: 100 })
        ]);

        if (!isMounted) return;

        setDevelopmentCompanies(apiDevelopers);
        setListings(apiListings);
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

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, [language, copy.error]);

  const featuredDevelopers = developmentCompanies.filter((developer) => developer.featured);
  const linkedPropertyCount = listings.filter((listing) => listing.developerId).length;

  return (
    <section className="page-section container partner-directory-page developers-page">
      <SectionHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <ButtonLink to="/contact" variant="soft">
            {copy.partner}
            <ArrowRight size={16} aria-hidden="true" />
          </ButtonLink>
        }
      />

      <section
  className="developer-hero-panel partner-directory-hero"
  aria-labelledby="developer-network-title"
>
        <div>
          <p className="eyebrow">{copy.network}</p>
          <h2 id="developer-network-title">{copy.heroTitle}</h2>
          <p>{copy.heroText}</p>
        </div>

        <div
  className="developer-hero-stats partner-directory-stats"
  aria-label="Developer marketplace statistics"
>
          <span>
            <strong>{developmentCompanies.length}</strong>
            {copy.developerProfiles}
          </span>

          <span>
            <strong>{featuredDevelopers.length}</strong>
            {copy.featuredPartners}
          </span>

          <span>
            <strong>{linkedPropertyCount}</strong>
            {copy.linkedProperties}
          </span>
        </div>
      </section>

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

      {!loading && !loadError && developmentCompanies.length > 0 ? (
  <div className="travel-agency-grid">
    {developmentCompanies.map((developer) => (
      <PartnerCard
        key={developer.id}
        href={`/developers/${developer.slug}`}
        name={developer.name}
        image={developer.logo}
        description={developer.description}
        headquarters={developer.headquarters || developer.location}
        phone={developer.phone}
        email={developer.email}
        website={developer.website}
        verified={developer.verified}
        featured={developer.featured}
        verificationStatus={developer.verificationStatus}
        verificationSource={developer.verificationSource}
        verificationDate={developer.verificationDate}
        verificationExpiryDate={developer.verificationExpiryDate}
        labels={{
          verified: copy.verifiedDeveloper,
          featured: copy.featured,
          headquarters: copy.headquarters,
          phone: copy.phone,
          email: copy.email,
          website: copy.website,
          view: copy.viewProfile
        }}
      />
    ))}
  </div>
) : null}

      {!loading && !loadError && developmentCompanies.length === 0 ? (
        <div className="empty-state empty-state--premium">
          <Sparkles size={34} aria-hidden="true" />
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyText}</p>
        </div>
      ) : null}
    </section>
  );
}
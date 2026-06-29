import { ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getTravelAgencies } from '../api/marketplace';
import ButtonLink from '../components/ButtonLink';
import PartnerCard from '../components/PartnerCard';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { TravelAgency } from '../types';

export default function TravelAgencies() {
  const { language } = useLanguage();

  useDocumentTitle(language === 'ar' ? 'وكالات السفر' : 'Travel agencies');

  const [agencies, setAgencies] = useState<TravelAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'شركاء الأنشطة',
          title: 'اكتشف وكالات السفر ومنظمي التجارب الموثوقين في عُمان.',
          description:
            'تصفح الشركاء الذين يقدمون الجولات والأنشطة والمغامرات والتجارب الثقافية والترفيهية عبر lux.om.',
          partner: 'كن شريكاً مع lux.om',
          network: 'شبكة شركاء التجارب',
          heroTitle: 'مصممة لوكالات السفر ومنظمي الأنشطة والتجارب المحلية.',
          heroText:
            'تمنح lux.om الشركاء السياحيين حضوراً احترافياً يساعد الزوار والسكان على التعرف إلى الجهة المنظمة واكتشاف أنشطتها والتواصل معها بثقة.',
          agencyProfiles: 'ملفات شركاء',
          featuredPartners: 'شركاء مميزون',
          verifiedPartners: 'شركاء موثقون',
          loading: 'جاري تحميل وكالات السفر...',
          error: 'تعذر تحميل وكالات السفر. تأكد أن الخادم يعمل ثم حاول مرة أخرى.',
          verified: 'شريك موثق',
          featured: 'مميزة',
          headquarters: 'المقر',
          phone: 'الهاتف',
          email: 'البريد الإلكتروني',
          website: 'الموقع الإلكتروني',
          view: 'عرض الوكالة',
          noResultsTitle: 'لا توجد وكالات سفر حالياً',
          noResultsText: 'ستظهر وكالات السفر ومنظمو الأنشطة هنا بعد إضافتهم واعتمادهم.'
        }
      : {
          eyebrow: 'Activity partners',
          title: 'Discover trusted travel agencies and experience operators in Oman.',
          description:
            'Browse partners offering tours, activities, adventures, cultural experiences, and local entertainment through lux.om.',
          partner: 'Partner with lux.om',
          network: 'Experience partner network',
          heroTitle: 'Built for travel agencies, activity operators, and local experience providers.',
          heroText:
            'lux.om gives tourism partners a professional presence where residents and visitors can understand the operator, discover its activities, and connect with confidence.',
          agencyProfiles: 'partner profiles',
          featuredPartners: 'featured partners',
          verifiedPartners: 'verified partners',
          loading: 'Loading travel agencies...',
          error: 'Could not load travel agencies. Make sure the backend is running and try again.',
          verified: 'Verified partner',
          featured: 'Featured',
          headquarters: 'Headquarters',
          phone: 'Phone',
          email: 'Email',
          website: 'Website',
          view: 'View agency',
          noResultsTitle: 'No travel agencies yet',
          noResultsText:
            'Travel agencies and activity operators will appear here after they are added and approved.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadAgencies() {
      try {
        setLoading(true);
        setLoadError('');

        const response = await getTravelAgencies(language, {
          take: 100
        });

        if (!isMounted) return;

        setAgencies(response);
      } catch (error) {
        console.error(error);

        if (isMounted) {
          setLoadError(copy.error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadAgencies();

    return () => {
      isMounted = false;
    };
  }, [language, copy.error]);

  const featuredAgencies = agencies.filter((agency) => agency.featured);
  const verifiedAgencies = agencies.filter((agency) => agency.verified);

  return (
    <section className="page-section container partner-directory-page travel-agencies-page">
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
        className="partner-directory-hero"
        aria-labelledby="travel-agency-network-title"
      >
        <div>
          <p className="eyebrow">{copy.network}</p>
          <h2 id="travel-agency-network-title">{copy.heroTitle}</h2>
          <p>{copy.heroText}</p>
        </div>

        <div
          className="partner-directory-stats"
          aria-label="Travel agency marketplace statistics"
        >
          <span>
            <strong>{agencies.length}</strong>
            {copy.agencyProfiles}
          </span>

          <span>
            <strong>{featuredAgencies.length}</strong>
            {copy.featuredPartners}
          </span>

          <span>
            <strong>{verifiedAgencies.length}</strong>
            {copy.verifiedPartners}
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

      {!loading && !loadError && agencies.length > 0 ? (
        <div className="travel-agency-grid">
          {agencies.map((agency) => (
            <PartnerCard
              key={agency.id}
              href={`/travel-agencies/${agency.slug}`}
              name={agency.name}
              image={agency.logo}
              description={agency.description}
              headquarters={agency.headquarters}
              phone={agency.phone}
              email={agency.email}
              website={agency.website}
              verified={agency.verified}
              featured={agency.featured}
              verificationStatus={agency.verificationStatus}
              verificationSource={agency.verificationSource}
              verificationDate={agency.verificationDate}
              verificationExpiryDate={agency.verificationExpiryDate}
              labels={{
                verified: copy.verified,
                featured: copy.featured,
                headquarters: copy.headquarters,
                phone: copy.phone,
                email: copy.email,
                website: copy.website,
                view: copy.view
              }}
            />
          ))}
        </div>
      ) : null}

      {!loading && !loadError && agencies.length === 0 ? (
        <div className="empty-state empty-state--premium">
          <Sparkles size={34} aria-hidden="true" />
          <h2>{copy.noResultsTitle}</h2>
          <p>{copy.noResultsText}</p>
        </div>
      ) : null}
    </section>
  );
}
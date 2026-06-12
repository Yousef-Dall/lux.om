import { useEffect, useState } from 'react';

import { getTravelAgencies } from '../api/marketplace';
import PartnerCard from '../components/PartnerCard';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { TravelAgency } from '../types';

export default function TravelAgencies() {
  const { language } = useLanguage();

  useDocumentTitle(
    language === 'ar' ? 'وكالات السفر' : 'Travel agencies'
  );

  const [agencies, setAgencies] = useState<TravelAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'شركاء الأنشطة',
          title: 'وكالات السفر ومنظمو التجارب',
          description:
            'اكتشف وكالات السفر التي تنظم الأنشطة والتجارب على lux.om.',
          loading: 'جاري تحميل وكالات السفر...',
          error: 'تعذر تحميل وكالات السفر.',
          verified: 'شريك موثق',
          featured: 'مميزة',
          headquarters: 'المقر',
          phone: 'الهاتف',
          email: 'البريد الإلكتروني',
          website: 'الموقع الإلكتروني',
          view: 'عرض الوكالة',
          noResults: 'لا توجد وكالات سفر حالياً.'
        }
      : {
          eyebrow: 'Activity partners',
          title: 'Travel agencies and activity operators',
          description:
            'Explore the travel agencies organizing curated activities on lux.om.',
          loading: 'Loading travel agencies...',
          error: 'Could not load travel agencies.',
          verified: 'Verified partner',
          featured: 'Featured',
          headquarters: 'Headquarters',
          phone: 'Phone',
          email: 'Email',
          website: 'Website',
          view: 'View agency',
          noResults: 'No travel agencies available yet.'
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

  return (
    <section className="page-section container">
      <SectionHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      {loading ? (
        <p className="inline-info">{copy.loading}</p>
      ) : null}

      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && agencies.length === 0 ? (
        <p className="inline-info">{copy.noResults}</p>
      ) : null}

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
    </section>
  );
}
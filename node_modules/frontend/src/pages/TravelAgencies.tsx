import { BadgeCheck, Building2, Globe, Mail, MapPin, MoveRight, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getTravelAgencies } from '../api/marketplace';
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
          title: 'وكالات السفر ومنظمو التجارب',
          description: 'اكتشف وكالات السفر التي تنظم الأنشطة والتجارب على lux.om.',
          loading: 'جاري تحميل وكالات السفر...',
          error: 'تعذر تحميل وكالات السفر.',
          verified: 'موثقة',
          headquarters: 'المقر',
          view: 'عرض الوكالة',
          noResults: 'لا توجد وكالات سفر حالياً.'
        }
      : {
          eyebrow: 'Activity partners',
          title: 'Travel agencies and activity operators',
          description: 'Explore the travel agencies organizing curated activities on lux.om.',
          loading: 'Loading travel agencies...',
          error: 'Could not load travel agencies.',
          verified: 'Verified',
          headquarters: 'Headquarters',
          view: 'View agency',
          noResults: 'No travel agencies available yet.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadAgencies() {
      try {
        setLoading(true);
        setLoadError('');

        const response = await getTravelAgencies(language, { take: 100 });

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
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

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

      <div className="developer-grid">
        {agencies.map((agency) => (
          <article className="developer-card" key={agency.id}>
            <div className="developer-card__media">
              {agency.logo ? (
                <img src={agency.logo} alt={agency.name} loading="lazy" />
              ) : (
                <span className="developer-card__placeholder">
                  <Building2 size={28} aria-hidden="true" />
                </span>
              )}

              {agency.verified ? (
                <span className="developer-card__badge">
                  <BadgeCheck size={15} aria-hidden="true" />
                  {copy.verified}
                </span>
              ) : null}
            </div>

            <div className="developer-card__body">
              <h2>
                <Link to={`/travel-agencies/${agency.slug}`}>{agency.name}</Link>
              </h2>

              {agency.description ? <p>{agency.description}</p> : null}

              {agency.headquarters ? (
                <p className="inline-info">
                  <MapPin size={16} aria-hidden="true" />
                  {copy.headquarters}: {agency.headquarters}
                </p>
              ) : null}

              <div className="developer-contact-list">
                {agency.phone ? (
                  <span>
                    <Phone size={15} aria-hidden="true" />
                    {agency.phone}
                  </span>
                ) : null}

                {agency.email ? (
                  <span>
                    <Mail size={15} aria-hidden="true" />
                    {agency.email}
                  </span>
                ) : null}

                {agency.website ? (
                  <span>
                    <Globe size={15} aria-hidden="true" />
                    {agency.website}
                  </span>
                ) : null}
              </div>

              <Link className="lux-card-link" to={`/travel-agencies/${agency.slug}`}>
                {copy.view}
                <MoveRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
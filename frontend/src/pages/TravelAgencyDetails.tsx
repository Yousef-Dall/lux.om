import { BadgeCheck, Building2, Globe, Mail, MapPin, MoveRight, Phone, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getActivities, getTravelAgencyBySlug } from '../api/marketplace';
import ButtonLink from '../components/ButtonLink';
import { ActivityCard } from '../components/Cards';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity, TravelAgency } from '../types';

export default function TravelAgencyDetails() {
  const { language } = useLanguage();
  const { slug } = useParams();

  const [agency, setAgency] = useState<TravelAgency | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useDocumentTitle(agency ? agency.name : language === 'ar' ? 'وكالة السفر' : 'Travel agency');

  const copy =
    language === 'ar'
      ? {
          back: 'الرجوع إلى وكالات السفر',
          notFoundEyebrow: 'الوكالة غير موجودة',
          notFoundTitle: 'هذه الوكالة غير متاحة.',
          loading: 'جاري تحميل وكالة السفر...',
          error: 'تعذر تحميل تفاصيل وكالة السفر.',
          verified: 'وكالة موثقة',
          headquarters: 'المقر',
          established: 'تأسست عام',
          contact: 'بيانات التواصل',
          activities: 'أنشطة هذه الوكالة',
          noActivities: 'لا توجد أنشطة منشورة لهذه الوكالة حالياً.',
          viewActivities: 'عرض كل الأنشطة'
        }
      : {
          back: 'Back to travel agencies',
          notFoundEyebrow: 'Travel agency not found',
          notFoundTitle: 'This travel agency is not available.',
          loading: 'Loading travel agency...',
          error: 'Could not load travel agency details.',
          verified: 'Verified agency',
          headquarters: 'Headquarters',
          established: 'Established',
          contact: 'Contact details',
          activities: 'Activities by this agency',
          noActivities: 'No published activities from this agency yet.',
          viewActivities: 'View all activities'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadAgency() {
      if (!slug) {
        setAgency(null);
        setActivities([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError('');

        const agencyResponse = await getTravelAgencyBySlug(slug, language);
        const agencyActivities = await getActivities(language, {
          take: 100,
          travelAgencyId: agencyResponse.id
        });

        if (!isMounted) return;

        setAgency(agencyResponse);
        setActivities(agencyActivities);
      } catch (error) {
        console.error(error);

        if (isMounted) {
          setAgency(null);
          setActivities([]);
          setLoadError(copy.error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadAgency();

    return () => {
      isMounted = false;
    };
  }, [slug, language, copy.error]);

  if (loading) {
    return (
      <section className="page-section container not-found">
        <p className="eyebrow">lux.om</p>
        <h1>{copy.loading}</h1>
      </section>
    );
  }

  if (!agency || loadError) {
    return (
      <section className="page-section container not-found">
        <p className="eyebrow">{copy.notFoundEyebrow}</p>
        <h1>{loadError || copy.notFoundTitle}</h1>
        <ButtonLink to="/travel-agencies">{copy.back}</ButtonLink>
      </section>
    );
  }

  return (
    <article className="details-page travel-agency-details-page">
      <section className="details-hero details-hero--developer">
        <div className="container">
          <Link className="back-link" to="/travel-agencies">
            {copy.back}
          </Link>

          <div className="details-hero__content">
            <p className="eyebrow">{copy.verified}</p>
            <h1>{agency.name}</h1>

            {agency.headquarters ? (
              <p>
                <MapPin size={18} aria-hidden="true" />
                {agency.headquarters}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container details-grid">
        <div>
          <div className="details-content">
            <div className="developer-callout">
              {agency.logo ? (
                <img src={agency.logo} alt={agency.name} />
              ) : (
                <span className="developer-callout__placeholder">
                  <Building2 size={24} aria-hidden="true" />
                </span>
              )}

              <div>
                <p className="eyebrow">{copy.verified}</p>
                <h2>
                  {agency.name}
                  {agency.verified ? (
                    <span className="verified-inline">
                      <BadgeCheck size={16} aria-hidden="true" />
                      {copy.verified}
                    </span>
                  ) : null}
                </h2>

                {agency.description ? <p>{agency.description}</p> : null}
              </div>
            </div>

            <h2>{copy.contact}</h2>

            <div className="activity-spec-grid">
              {agency.headquarters ? (
                <div className="activity-spec-card">
                  <MapPin size={20} aria-hidden="true" />
                  <span>{copy.headquarters}</span>
                  <strong>{agency.headquarters}</strong>
                </div>
              ) : null}

              {agency.establishedYear ? (
                <div className="activity-spec-card">
                  <BadgeCheck size={20} aria-hidden="true" />
                  <span>{copy.established}</span>
                  <strong>{agency.establishedYear}</strong>
                </div>
              ) : null}

              {agency.phone ? (
                <div className="activity-spec-card">
                  <Phone size={20} aria-hidden="true" />
                  <span>Phone</span>
                  <strong>{agency.phone}</strong>
                </div>
              ) : null}

              {agency.email ? (
                <div className="activity-spec-card">
                  <Mail size={20} aria-hidden="true" />
                  <span>Email</span>
                  <strong>{agency.email}</strong>
                </div>
              ) : null}

              {agency.website ? (
                <div className="activity-spec-card">
                  <Globe size={20} aria-hidden="true" />
                  <span>Website</span>
                  <strong>{agency.website}</strong>
                </div>
              ) : null}
            </div>

            <h2>{copy.activities}</h2>

            {activities.length > 0 ? (
              <div className="activity-grid">
                {activities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--premium">
                <Sparkles size={34} aria-hidden="true" />
                <h3>{copy.noActivities}</h3>
              </div>
            )}
          </div>
        </div>

        <aside className="booking-panel booking-panel--premium">
          <div>
            <span className="booking-panel__label">{copy.verified}</span>
            <strong className="price">{agency.name}</strong>
          </div>

          {agency.headquarters ? (
            <p className="inline-info">
              <MapPin size={18} aria-hidden="true" />
              {agency.headquarters}
            </p>
          ) : null}

          {agency.phone ? (
            <p className="inline-info">
              <Phone size={18} aria-hidden="true" />
              {agency.phone}
            </p>
          ) : null}

          {agency.email ? (
            <p className="inline-info">
              <Mail size={18} aria-hidden="true" />
              {agency.email}
            </p>
          ) : null}

          {agency.website ? (
            <p className="inline-info">
              <Globe size={18} aria-hidden="true" />
              {agency.website}
            </p>
          ) : null}

          <ButtonLink to={`/activities?travelAgencyId=${agency.id}`} isFullWidth>
            {copy.viewActivities}
            <MoveRight size={16} aria-hidden="true" />
          </ButtonLink>
        </aside>
      </section>
    </article>
  );
}
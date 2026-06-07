import {
  CalendarDays,
  Car,
  Clock,
  MapPin,
  Moon,
  Mountain,
  MoveRight,
  Sparkles,
  Users,
  Utensils
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import ButtonLink from '../components/ButtonLink';
import { activities } from '../data/mockData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDayList, formatTimeRange } from '../utils/format';

export default function ActivityDetails() {
  const { t, language } = useLanguage();
  const { slug } = useParams();

  const activity = activities.find((item) => item.slug === slug);

  useDocumentTitle(activity ? activity.title : 'Activity not found');

  const activityCopy = t.activities ?? t.experiences;

  const copy =
    language === 'ar'
      ? {
          notFoundEyebrow: 'النشاط غير موجود',
          notFoundTitle: 'هذا النشاط لم يعد متاحاً.',
          featured: 'مميز',
          summary: 'ملخص النشاط',
          near: 'بالقرب من',
          hostedBy: 'بواسطة',
          activityType: 'نوع النشاط'
        }
      : {
          notFoundEyebrow: 'Activity not found',
          notFoundTitle: 'This activity is no longer available.',
          featured: 'Featured',
          summary: 'Activity summary',
          near: 'Near',
          hostedBy: 'Hosted by',
          activityType: 'Activity type'
        };

  if (!activity) {
    return (
      <section className="page-section container not-found" aria-labelledby="activity-not-found-title">
        <p className="eyebrow">{copy.notFoundEyebrow}</p>
        <h1 id="activity-not-found-title">{copy.notFoundTitle}</h1>
        <ButtonLink to="/activities">{t.common.backToActivities}</ButtonLink>
      </section>
    );
  }

  const specs = activity.specs;

  const specItems = [
    {
      label: activityCopy.durationType,
      value: specs.durationType,
      icon: specs.durationType === 'Overnight' ? Moon : Clock
    },
    {
      label: activityCopy.activityType ?? copy.activityType,
      value: specs.experienceType,
      icon: Users
    },
    {
      label: activityCopy.familyFriendly,
      value: specs.familyFriendly ? t.common.yes : t.common.no,
      icon: Sparkles
    },
    {
      label: activityCopy.includesTransfer,
      value: specs.includesTransfer ? t.common.yes : t.common.no,
      icon: Car
    },
    {
      label: activityCopy.mealIncluded,
      value: specs.mealIncluded ? t.common.yes : t.common.no,
      icon: Utensils
    },
    {
      label: activityCopy.outdoor,
      value: specs.outdoor ? t.common.yes : t.common.no,
      icon: Mountain
    }
  ];

  const includedSpecs = [
    specs.familyFriendly ? activityCopy.familyFriendly : null,
    specs.includesTransfer ? activityCopy.includesTransfer : null,
    specs.mealIncluded ? activityCopy.mealIncluded : null,
    specs.outdoor ? activityCopy.outdoor : null
  ].filter(Boolean);

  return (
    <article className="details-page">
      <section className="details-hero details-hero--activity">
        <div className="container">
          <Link className="back-link" to="/activities">
            {t.common.backToActivities}
          </Link>

          <div className="details-hero__content">
            <p className="eyebrow">{activity.category}</p>

            <h1>{activity.title}</h1>

            <p>
              <MapPin size={18} aria-hidden="true" />
              {activity.location}
            </p>
          </div>
        </div>
      </section>

      <section className="container details-grid">
        <div>
          <div className="details-image-wrap">
            <img className="details-image" src={activity.image} alt={activity.title} />

            {activity.featured ? (
              <span className="details-image-badge">
                <Sparkles size={15} aria-hidden="true" />
                {copy.featured}
              </span>
            ) : null}
          </div>

          <div className="details-content">
            <div className="details-section-heading">
              <p className="eyebrow">{activity.category}</p>
              <h2>{activityCopy.overview}</h2>
            </div>

            <p>{activity.description}</p>

            <div className="details-highlight-strip">
              <span>
                <Clock size={17} aria-hidden="true" />
                {activity.duration}
              </span>

              <span>
                <Users size={17} aria-hidden="true" />
                {specs.experienceType}
              </span>

              <span>
                <CalendarDays size={17} aria-hidden="true" />
                {formatTimeRange(activity.availability.startTime, activity.availability.endTime)}
              </span>

              {activity.nearestLandmarkName ? (
                <span>
                  <MapPin size={17} aria-hidden="true" />
                  {copy.near} {activity.nearestLandmarkName}
                </span>
              ) : null}
            </div>

            {activity.provider ? (
              <p className="inline-info">
                <Sparkles size={18} aria-hidden="true" />
                {copy.hostedBy} {activity.provider}
              </p>
            ) : null}

            <h2>{activityCopy.availability}</h2>

            <div className="activity-availability">
              <div>
                <CalendarDays size={20} aria-hidden="true" />
                <span>{activityCopy.availableDays}</span>
                <strong>{formatDayList(activity.availability.days)}</strong>
              </div>

              <div>
                <Clock size={20} aria-hidden="true" />
                <span>{activityCopy.availableTime}</span>
                <strong>
                  {activityCopy.from} {activity.availability.startTime} {activityCopy.to}{' '}
                  {activity.availability.endTime}
                </strong>
              </div>
            </div>

            <h2>{activityCopy.advancedDetails}</h2>

            <div className="activity-spec-grid">
              {specItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div className="activity-spec-card" key={item.label}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                );
              })}
            </div>

            <h2>{activityCopy.highlights}</h2>

            <ul className="amenity-list">
              {activity.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="booking-panel booking-panel--premium" aria-label={copy.summary}>
          <div>
            <span className="booking-panel__label">{activity.category}</span>
            <strong className="price">{activity.price}</strong>
          </div>

          <p className="inline-info">
            <Clock size={18} aria-hidden="true" />
            {activity.duration}
          </p>

          <p className="inline-info">
            <CalendarDays size={18} aria-hidden="true" />
            {formatDayList(activity.availability.days)}
          </p>

          <p className="inline-info">
            <Clock size={18} aria-hidden="true" />
            {formatTimeRange(activity.availability.startTime, activity.availability.endTime)}
          </p>

          {activity.nearestLandmarkName ? (
            <p className="inline-info">
              <MapPin size={18} aria-hidden="true" />
              {copy.near} {activity.nearestLandmarkName}
            </p>
          ) : null}

          <div className="booking-panel-specs">
            <span>{specs.durationType}</span>
            <span>{specs.experienceType}</span>

            {activity.groupSize ? <span>{activity.groupSize}</span> : null}
            {activity.difficulty ? <span>{activity.difficulty}</span> : null}
            {activity.language ? <span>{activity.language}</span> : null}

            {includedSpecs.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          <ButtonLink to="/contact" isFullWidth>
            {activityCopy.requestBooking}
            <MoveRight size={16} aria-hidden="true" />
          </ButtonLink>

          <p>{activityCopy.finalConfirmation}</p>
        </aside>
      </section>
    </article>
  );
}
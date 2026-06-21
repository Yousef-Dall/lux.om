import {
  BadgeCheck,
  CalendarDays,
  Car,
  Clock,
  MapPin,
  Moon,
  Mountain,
  MoveRight,
    Send,
  Sparkles,
  Users,
  Utensils
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { createBooking } from '../api/bookings';
import { ApiError } from '../api/client';
import { getActivityBySlug } from '../api/marketplace';
import { useAuth } from '../auth/AuthContext';
import ButtonLink from '../components/ButtonLink';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity } from '../types';
import {
  formatDayList,
  formatMarketplacePrice,
  formatTimeRange
} from '../utils/format';

export default function ActivityDetails() {
  const { t, language } = useLanguage();
    const { token, user, isAuthenticated } = useAuth();
  const { slug } = useParams();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [bookingTime, setBookingTime] = useState('');
    const [bookingGuests, setBookingGuests] = useState('2');
    const [bookingName, setBookingName] = useState('');
    const [bookingEmail, setBookingEmail] = useState('');
    const [bookingPhone, setBookingPhone] = useState('');
    const [bookingMessage, setBookingMessage] = useState('');
    const [bookingSubmitting, setBookingSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [bookingSuccess, setBookingSuccess] = useState('');

  useDocumentTitle(activity ? activity.title : 'Activity details');

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
          organizedBy: 'من تنظيم',
          travelAgency: 'وكالة السفر',
          verifiedAgency: 'وكالة موثقة',
          activityType: 'نوع النشاط',
          travelRegion: 'نطاق النشاط',
          insideOman: 'داخل عُمان',
          outsideOman: 'خارج عُمان',
            bookingTitle: 'اطلبي الحجز مباشرة',
            bookingText: 'اختاري التاريخ والوقت وعدد الضيوف، وسيراجع فريق lux.om الطلب مع منظم النشاط.',
            bookingDate: 'تاريخ الحجز',
            bookingTime: 'الوقت المفضل',
            guests: 'عدد الضيوف',
            contactName: 'اسم التواصل',
            contactEmail: 'بريد التواصل',
            contactPhone: 'رقم الهاتف',
            message: 'ملاحظات إضافية',
            messagePlaceholder: 'مثلاً: لدينا طفلان، نحتاج نقل من الفندق...',
            submitBooking: 'إرسال طلب الحجز',
            submittingBooking: 'جاري إرسال الطلب...',
            loginToBook: 'سجلي الدخول لإرسال طلب حجز مباشر.',
            goToLogin: 'تسجيل الدخول',
            bookingSuccess: 'تم إرسال طلب الحجز بنجاح. يمكنك متابعة الطلب من لوحة التحكم.',
            bookingError: 'تعذر إرسال طلب الحجز. حاولي مرة أخرى.',
            requiredBookingFields: 'يرجى تعبئة تاريخ الحجز واسم التواصل والبريد الإلكتروني.',
          loading: 'جاري تحميل النشاط...',
          error: 'تعذر تحميل تفاصيل النشاط. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.'
        }
      : {
          notFoundEyebrow: 'Activity not found',
          notFoundTitle: 'This activity is no longer available.',
          featured: 'Featured',
          summary: 'Activity summary',
          near: 'Near',
          hostedBy: 'Hosted by',
          organizedBy: 'Organized by',
          travelAgency: 'Travel agency',
          verifiedAgency: 'Verified agency',
          activityType: 'Activity type',
          travelRegion: 'Activity region',
          insideOman: 'Inside Oman',
          outsideOman: 'Outside Oman',
            bookingTitle: 'Book this activity directly',
            bookingText: 'Choose your date, preferred time, and guest count. lux.om will route the request to the activity provider.',
            bookingDate: 'Booking date',
            bookingTime: 'Preferred time',
            guests: 'Guests',
            contactName: 'Contact name',
            contactEmail: 'Contact email',
            contactPhone: 'Phone',
            message: 'Additional notes',
            messagePlaceholder: 'Example: We have two children and need hotel pickup...',
            submitBooking: 'Send booking request',
            submittingBooking: 'Sending request...',
            loginToBook: 'Log in to send a direct booking request.',
            goToLogin: 'Log in',
            bookingSuccess: 'Booking request sent successfully. You can follow it from your dashboard.',
            bookingError: 'Could not send the booking request. Please try again.',
            requiredBookingFields: 'Please fill booking date, contact name, and contact email.',
          loading: 'Loading activity...',
          error: 'Could not load activity details. Make sure the backend is running and try again.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadActivity() {
      if (!slug) {
        setActivity(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError('');

        const apiActivity = await getActivityBySlug(slug, language);

        if (!isMounted) return;

        setActivity(apiActivity);
      } catch (error) {
        if (!isMounted) return;

        console.error(error);
        setActivity(null);
        setLoadError(copy.error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadActivity();

    return () => {
      isMounted = false;
    };
  }, [slug, language, copy.error]);


    useEffect(() => {
      if (!user) return;

      setBookingName((current) => current || user.name || '');
      setBookingEmail((current) => current || user.email || '');
      setBookingPhone((current) => current || user.phone || '');
    }, [user]);

    async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();

      if (!activity) return;

      if (!token) {
        setBookingError(copy.loginToBook);
        return;
      }

      if (!bookingDate || !bookingName.trim() || !bookingEmail.trim()) {
        setBookingError(copy.requiredBookingFields);
        return;
      }

      try {
        setBookingSubmitting(true);
        setBookingError('');
        setBookingSuccess('');

        await createBooking(
          {
            activityId: activity.id,
            scheduledDate: bookingDate,
            preferredTime: bookingTime || undefined,
            guests: Number(bookingGuests) || 1,
            contactName: bookingName.trim(),
            contactEmail: bookingEmail.trim(),
            contactPhone: bookingPhone.trim() || undefined,
            message: bookingMessage.trim() || undefined,
            amount: 0,
            commission: 0
          },
          token
        );

        setBookingSuccess(copy.bookingSuccess);
        setBookingMessage('');
      } catch (error) {
        console.error(error);

        if (error instanceof ApiError) {
          setBookingError(error.message);
        } else {
          setBookingError(copy.bookingError);
        }
      } finally {
        setBookingSubmitting(false);
      }
    }

  if (loading) {
    return (
      <section className="page-section container not-found" aria-labelledby="activity-loading-title">
        <p className="eyebrow">{activityCopy.eyebrow}</p>
        <h1 id="activity-loading-title">{copy.loading}</h1>
      </section>
    );
  }

  if (!activity || loadError) {
    return (
      <section className="page-section container not-found" aria-labelledby="activity-not-found-title">
        <p className="eyebrow">{copy.notFoundEyebrow}</p>
        <h1 id="activity-not-found-title">{loadError || copy.notFoundTitle}</h1>
        <ButtonLink to="/activities">{t.common.backToActivities}</ButtonLink>
      </section>
    );
  }

  const specs = activity.specs;
  const agency = activity.travelAgency;
  const organizerName = agency?.name || activity.provider;
  const travelRegionLabel =
    activity.travelRegion === 'OUTSIDE_OMAN'
      ? copy.outsideOman
      : copy.insideOman;

  const activityGalleryImages = (
    activity.images?.length
      ? activity.images.map((image, imageIndex) => ({
          url: image.url,
          alt: image.altEn || image.altAr || `${activity.title} ${imageIndex + 1}`
        }))
      : [
          {
            url: activity.image,
            alt: activity.title
          }
        ]
  ).filter((image) => image.url);

  const primaryActivityImage = activityGalleryImages[0] ?? {
    url: activity.image,
    alt: activity.title
  };

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
      label: copy.travelRegion,
      value: travelRegionLabel,
      icon: MapPin
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
   <article className="details-page details-page--activity-detail">
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
            <div className="details-gallery">
              <div className="details-image-wrap">
                <img
                  className="details-image"
                  src={primaryActivityImage.url}
                  alt={primaryActivityImage.alt}
                />


            {activity.featured ? (
              <span className="details-image-badge">
                <Sparkles size={15} aria-hidden="true" />
                {copy.featured}
              </span>
            ) : null}
              </div>

              {activityGalleryImages.length > 1 ? (
                <div className="details-gallery-grid">
                  {activityGalleryImages.slice(1).map((image, imageIndex) => (
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

            {agency ? (
              <div className="developer-callout">
                {agency.logo ? (
                  <img src={agency.logo} alt={agency.name} />
                ) : (
                  <span className="developer-callout__placeholder">
                    <Users size={22} aria-hidden="true" />
                  </span>
                )}

                <div>
                  <p className="eyebrow">{copy.travelAgency}</p>
                  <h3>
                    {agency.name}
                    {agency.verified ? (
                      <span className="verified-inline">
                        <BadgeCheck size={16} aria-hidden="true" />
                        {copy.verifiedAgency}
                      </span>
                    ) : null}
                  </h3>

                  {agency.shortDescription ? <p>{agency.shortDescription}</p> : null}
                </div>
              </div>
            ) : organizerName ? (
              <p className="inline-info">
                <Sparkles size={18} aria-hidden="true" />
                {copy.hostedBy} {organizerName}
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
            <strong className="price">
                {formatMarketplacePrice({
                  price: activity.price,
                  priceAmount: activity.priceAmount,
                  priceCurrency: activity.priceCurrency,
                  priceQualifier: activity.priceQualifier,
                  priceUnit: activity.priceUnit,
                  language
                })}
              </strong>
          </div>

          {organizerName ? (
            <p className="inline-info">
              {agency?.verified ? (
                <BadgeCheck size={18} aria-hidden="true" />
              ) : (
                <Sparkles size={18} aria-hidden="true" />
              )}
              {copy.organizedBy} {organizerName}
            </p>
          ) : null}

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
            <span>{travelRegionLabel}</span>

            {activity.groupSize ? <span>{activity.groupSize}</span> : null}
            {activity.difficulty ? <span>{activity.difficulty}</span> : null}
            {activity.language ? <span>{activity.language}</span> : null}

            {includedSpecs.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
            <div className="activity-booking-card">
              <h2>{copy.bookingTitle}</h2>
              <p>{copy.bookingText}</p>

              {isAuthenticated ? (
                <form className="activity-booking-form" onSubmit={handleBookingSubmit}>
                  <label>
                    {copy.bookingDate}
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(event) => setBookingDate(event.target.value)}
                      required
                    />
                  </label>

                  <label>
                    {copy.bookingTime}
                    <input
                      type="time"
                      value={bookingTime}
                      onChange={(event) => setBookingTime(event.target.value)}
                    />
                  </label>

                  <label>
                    {copy.guests}
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={bookingGuests}
                      onChange={(event) => setBookingGuests(event.target.value)}
                      required
                    />
                  </label>

                  <label>
                    {copy.contactName}
                    <input
                      value={bookingName}
                      onChange={(event) => setBookingName(event.target.value)}
                      required
                    />
                  </label>

                  <label>
                    {copy.contactEmail}
                    <input
                      type="email"
                      value={bookingEmail}
                      onChange={(event) => setBookingEmail(event.target.value)}
                      required
                    />
                  </label>

                  <label>
                    {copy.contactPhone}
                    <input
                      value={bookingPhone}
                      onChange={(event) => setBookingPhone(event.target.value)}
                    />
                  </label>

                  <label className="activity-booking-form__full">
                    {copy.message}
                    <textarea
                      value={bookingMessage}
                      onChange={(event) => setBookingMessage(event.target.value)}
                      placeholder={copy.messagePlaceholder}
                      rows={4}
                    />
                  </label>

                  {bookingError ? (
                    <p className="form-error" role="alert">{bookingError}</p>
                  ) : null}

                  {bookingSuccess ? (
                    <p className="form-success" role="status">{bookingSuccess}</p>
                  ) : null}

                  <button className="button-link button-link--primary" type="submit" disabled={bookingSubmitting}>
                    {bookingSubmitting ? copy.submittingBooking : copy.submitBooking}
                    <Send size={16} aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <div className="activity-booking-login">
                  <p>{copy.loginToBook}</p>
                  <ButtonLink to="/login" isFullWidth>
                    {copy.goToLogin}
                    <MoveRight size={16} aria-hidden="true" />
                  </ButtonLink>
                </div>
              )}
            </div>

            <p>{activityCopy.finalConfirmation}</p>
        </aside>
      </section>
    </article>
  );
}

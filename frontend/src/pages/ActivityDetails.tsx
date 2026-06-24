import {
BadgeCheck,
CalendarDays,
Car,
Clock,
FileText,
Globe2,
Hotel,
MapPin,
Moon,
Mountain,
MoveRight,
Plane,
Send,
ShieldCheck,
Sparkles,
Users,
Utensils
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
getActivityAvailability,
type ActivityAvailability
} from '../api/activities';
import { createBooking } from '../api/bookings';
import { ApiError } from '../api/client';
import { getActivityBySlug } from '../api/marketplace';
import { useAuth } from '../auth/AuthContext';
import ButtonLink from '../components/ButtonLink';
import ReportModal from '../components/ReportModal';
import ReviewSection from '../components/ReviewSection';
import SavedButton from '../components/SavedButton';
import TrustBadges from '../components/TrustBadges';
import WhatsAppActions from '../components/WhatsAppActions';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity } from '../types';
import {
formatDayList,
formatMarketplacePrice,
formatTimeRange
} from '../utils/format';
import { getSafeEmbedUrl } from '../utils/mediaEmbeds';

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
const [availability, setAvailability] = useState<ActivityAvailability | null>(null);
const [availabilityLoading, setAvailabilityLoading] = useState(false);
const [availabilityError, setAvailabilityError] = useState('');

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
outsideOmanPackage: 'باقة سفر خارج عُمان',
packageDetails: 'تفاصيل باقة السفر',
destination: 'الوجهة',
departureCity: 'مدينة المغادرة',
tripLength: 'مدة الرحلة',
days: 'أيام',
nights: 'ليالٍ',
minimumGroupSize: 'الحد الأدنى للمجموعة',
capacity: 'السعة القصوى',
guestsShort: 'ضيوف',
flights: 'الطيران',
flightIncluded: 'الطيران مشمول',
airline: 'شركة الطيران',
flightNotes: 'ملاحظات الطيران',
hotel: 'الفندق',
hotelIncluded: 'الفندق مشمول',
hotelName: 'اسم الفندق',
hotelRating: 'تصنيف الفندق',
roomType: 'نوع الغرفة',
mealPlan: 'خطة الوجبات',
services: 'الخدمات',
visaSupportIncluded: 'دعم التأشيرة',
travelInsuranceIncluded: 'تأمين السفر',
airportTransferIncluded: 'مواصلات المطار',
availableTravelDates: 'تواريخ السفر المتاحة',
packageItinerary: 'برنامج الرحلة',
requiredDocuments: 'الوثائق المطلوبة',
cancellationPolicy: 'سياسة الإلغاء',
packageInclusions: 'المشمول في الباقة',
packageExclusions: 'غير المشمول في الباقة',
packageDisclaimer:
'تفاصيل الباقة مقدمة من المنظم ويجب تأكيد الطيران والفندق والتأشيرة والتوفر قبل الحجز.',
premiumMedia: 'الوسائط المميزة',
report: 'الإبلاغ عن هذا النشاط',
bookingTitle: 'اطلبي الحجز مباشرة',
bookingText:
'اختاري التاريخ والوقت وعدد الضيوف، وسيراجع فريق lux.om الطلب مع منظم النشاط.',
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
checkingAvailability: 'جاري فحص التوفر...',
availableSeats: 'مقاعد متاحة',
unlimitedAvailability: 'التوفر مفتوح لهذا النشاط.',
availabilityUnavailable: 'لا يوجد توفر كافٍ لهذا التاريخ والوقت.',
availabilityError: 'تعذر فحص التوفر حالياً.',
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
outsideOmanPackage: 'Outside-Oman travel package',
packageDetails: 'Travel package details',
destination: 'Destination',
departureCity: 'Departure city',
tripLength: 'Trip length',
days: 'days',
nights: 'nights',
minimumGroupSize: 'Minimum group size',
capacity: 'Capacity',
guestsShort: 'guests',
flights: 'Flights',
flightIncluded: 'Flight included',
airline: 'Airline',
flightNotes: 'Flight notes',
hotel: 'Hotel',
hotelIncluded: 'Hotel included',
hotelName: 'Hotel name',
hotelRating: 'Hotel rating',
roomType: 'Room type',
mealPlan: 'Meal plan',
services: 'Services',
visaSupportIncluded: 'Visa support',
travelInsuranceIncluded: 'Travel insurance',
airportTransferIncluded: 'Airport transfer',
availableTravelDates: 'Available travel dates',
packageItinerary: 'Package itinerary',
requiredDocuments: 'Required documents',
cancellationPolicy: 'Cancellation policy',
packageInclusions: 'Package inclusions',
packageExclusions: 'Package exclusions',
packageDisclaimer:
'Package details are provided by the organizer and should be confirmed before booking, including flight, hotel, visa, and availability details.',
premiumMedia: 'Premium media',
report: 'Report this activity',
bookingTitle: 'Book this activity directly',
bookingText:
'Choose your date, preferred time, and guest count. lux.om will route the request to the activity provider.',
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
bookingSuccess:
'Booking request sent successfully. You can follow it from your dashboard.',
bookingError: 'Could not send the booking request. Please try again.',
checkingAvailability: 'Checking availability...',
availableSeats: 'seats available',
unlimitedAvailability: 'Availability is open for this activity.',
availabilityUnavailable: 'Not enough availability for this date and time.',
availabilityError: 'Could not check availability right now.',
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


useEffect(() => {
if (!activity?.id || !bookingDate) {
  setAvailability(null);
  setAvailabilityError('');
  return;
}

let isActive = true;

async function loadAvailability() {
  try {
    setAvailabilityLoading(true);
    setAvailabilityError('');

    const response = await getActivityAvailability(activity!.id, {
      date: bookingDate,
      time: bookingTime || undefined,
      guests: Number(bookingGuests) || 1
    });

    if (!isActive) return;

    setAvailability(response.availability);
  } catch (error) {
    console.error(error);

    if (!isActive) return;

    setAvailability(null);

    if (error instanceof ApiError) {
      setAvailabilityError(error.message);
    } else {
      setAvailabilityError(copy.availabilityError);
    }
  } finally {
    if (isActive) {
      setAvailabilityLoading(false);
    }
  }
}

void loadAvailability();

return () => {
  isActive = false;
};
}, [activity?.id, bookingDate, bookingTime, bookingGuests, language]);

const isBookingAvailabilityBlocked = Boolean(
availability && !availability.available
);

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

if (isBookingAvailabilityBlocked) {
  setBookingError(availability?.unavailableReason || copy.availabilityUnavailable);
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
    message: bookingMessage.trim() || undefined
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
return ( <section className="page-section container not-found" aria-labelledby="activity-loading-title"> <p className="eyebrow">{activityCopy.eyebrow}</p> <h1 id="activity-loading-title">{copy.loading}</h1> </section>
);
}

if (!activity || loadError) {
return ( <section className="page-section container not-found" aria-labelledby="activity-not-found-title"> <p className="eyebrow">{copy.notFoundEyebrow}</p> <h1 id="activity-not-found-title">{loadError || copy.notFoundTitle}</h1> <ButtonLink to="/activities">{t.common.backToActivities}</ButtonLink> </section>
);
}

const specs = activity.specs;
const agency = activity.travelAgency;
const organizerName = agency?.name || activity.provider;
const isOutsideOman = activity.travelRegion === 'OUTSIDE_OMAN';
const travelRegionLabel = isOutsideOman ? copy.outsideOman : copy.insideOman;

const destinationLabel = [
activity.destinationCity,
activity.destinationCountry
]
.filter(Boolean)
.join(', ');

const tripLength = [
activity.tripDurationDays
? `${activity.tripDurationDays} ${copy.days}`
: null,
activity.tripDurationNights
? `${activity.tripDurationNights} ${copy.nights}`
: null
]
.filter(Boolean)
.join(' / ');

const packageSummaryItems = [
{
label: copy.destination,
value: destinationLabel,
icon: Globe2
},
{
label: copy.departureCity,
value: activity.departureCity,
icon: Plane
},
{
label: copy.tripLength,
value: tripLength,
icon: Clock
},
{
label: copy.minimumGroupSize,
value: activity.minimumGroupSize
? `${activity.minimumGroupSize}+ ${copy.guestsShort}`
: undefined,
icon: Users
}
];

const packageServiceBadges = [
activity.flightIncluded ? copy.flightIncluded : undefined,
activity.hotelIncluded ? copy.hotelIncluded : undefined,
activity.visaSupportIncluded ? copy.visaSupportIncluded : undefined,
activity.travelInsuranceIncluded ? copy.travelInsuranceIncluded : undefined,
activity.airportTransferIncluded ? copy.airportTransferIncluded : undefined
].filter((item): item is string => Boolean(item));

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

const premiumMediaLinks = [
activity.videoWalkthroughUrl
  ? { type: 'VIDEO_WALKTHROUGH', url: activity.videoWalkthroughUrl, title: 'Video walkthrough' }
  : null,
activity.tour360Url
  ? { type: 'TOUR_360', url: activity.tour360Url, title: '360 tour' }
  : null,
activity.virtualTourUrl
  ? { type: 'VIRTUAL_TOUR', url: activity.virtualTourUrl, title: 'Virtual tour' }
  : null,
...(activity.premiumMedia ?? []).map((media) => ({
  type: media.type,
  url: media.url,
  title: media.titleEn || media.titleAr || media.type.replace(/_/g, ' ')
}))
].filter((media): media is { type: string; url: string; title: string } => Boolean(media?.url));

const embeddableMedia = premiumMediaLinks
.map((media) => ({ ...media, embedUrl: getSafeEmbedUrl(media.url) }))
.filter((media) => Boolean(media.embedUrl));

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

return ( <article className="details-page details-page--activity-detail"> <section className="details-hero details-hero--activity"> <div className="container"> <Link className="back-link" to="/activities">
{t.common.backToActivities} </Link>


      <div className="details-hero__content">
        <p className="eyebrow">{activity.category}</p>

        <h1>{activity.title}</h1>

        <p>
          <MapPin size={18} aria-hidden="true" />
          {activity.location}
        </p>

        {isOutsideOman ? (
          <span className="travel-package-badge">
            <Plane size={15} aria-hidden="true" />
            {copy.outsideOmanPackage}
          </span>
        ) : null}
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

      {embeddableMedia.length > 0 ? (
        <section className="premium-media-section" aria-labelledby="activity-premium-media-title">
          <div className="details-section-heading">
            <p className="eyebrow">lux.om media</p>
            <h2 id="activity-premium-media-title">{copy.premiumMedia}</h2>
          </div>

          <div className="premium-media-grid">
            {embeddableMedia.map((media) => (
              <iframe
                key={`${media.type}-${media.url}`}
                src={media.embedUrl}
                title={media.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="details-content">
        <div className="details-section-heading">
          <p className="eyebrow">{activity.category}</p>
          <h2>{activityCopy.overview}</h2>
        </div>

        <p>{activity.description}</p>

        <TrustBadges
          verificationStatus={activity.verificationStatus}
          mediaQualityStatus={activity.mediaQualityStatus}
        />

        <div className="stage8-detail-actions">
          <SavedButton targetId={activity.id} targetType="activity" />
          <WhatsAppActions
            phone={activity.travelAgency?.phone || activity.owner?.phone}
            title={activity.title}
            location={activity.location}
            label={language === 'ar' ? 'استفسار واتساب' : 'WhatsApp inquiry'}
          />
          <ReportModal
                targetType="ACTIVITY"
                targetId={activity.id}
                targetTitle={activity.title}
                token={token}
                triggerLabel={copy.report}
              />
        </div>

        <div className="details-highlight-strip">
          <span>
            <Clock size={17} aria-hidden="true" />
            {isOutsideOman && tripLength ? tripLength : activity.duration}
          </span>

          <span>
            <Users size={17} aria-hidden="true" />
            {specs.experienceType}
          </span>

          <span>
            <CalendarDays size={17} aria-hidden="true" />
            {formatTimeRange(activity.availability.startTime, activity.availability.endTime)}
          </span>

          {isOutsideOman && destinationLabel ? (
            <span>
              <Globe2 size={17} aria-hidden="true" />
              {destinationLabel}
            </span>
          ) : null}

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

        {isOutsideOman ? (
          <section className="activity-package-details">
            <div className="details-section-heading">
              <p className="eyebrow">{copy.outsideOmanPackage}</p>
              <h2>{copy.packageDetails}</h2>
            </div>

            <div className="package-summary-grid">
              {packageSummaryItems.map((item) => {
                if (!item.value) return null;

                const Icon = item.icon;

                return (
                  <div className="package-info-card" key={item.label}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                );
              })}
            </div>

            {packageServiceBadges.length > 0 ? (
              <div className="package-feature-list">
                {packageServiceBadges.map((badge) => (
                  <span key={badge}>
                    <ShieldCheck size={15} aria-hidden="true" />
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="package-detail-grid">
              {(activity.flightIncluded ||
                activity.airline ||
                activity.flightNotes) ? (
                <div className="package-detail-card">
                  <h3>
                    <Plane size={18} aria-hidden="true" />
                    {copy.flights}
                  </h3>

                  <dl>
                    {typeof activity.flightIncluded === 'boolean' ? (
                      <>
                        <dt>{copy.flightIncluded}</dt>
                        <dd>{activity.flightIncluded ? t.common.yes : t.common.no}</dd>
                      </>
                    ) : null}

                    {activity.airline ? (
                      <>
                        <dt>{copy.airline}</dt>
                        <dd>{activity.airline}</dd>
                      </>
                    ) : null}

                    {activity.flightNotes ? (
                      <>
                        <dt>{copy.flightNotes}</dt>
                        <dd>{activity.flightNotes}</dd>
                      </>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              {(activity.hotelIncluded ||
                activity.hotelName ||
                activity.hotelRating ||
                activity.roomType ||
                activity.mealPlan) ? (
                <div className="package-detail-card">
                  <h3>
                    <Hotel size={18} aria-hidden="true" />
                    {copy.hotel}
                  </h3>

                  <dl>
                    {typeof activity.hotelIncluded === 'boolean' ? (
                      <>
                        <dt>{copy.hotelIncluded}</dt>
                        <dd>{activity.hotelIncluded ? t.common.yes : t.common.no}</dd>
                      </>
                    ) : null}

                    {activity.hotelName ? (
                      <>
                        <dt>{copy.hotelName}</dt>
                        <dd>{activity.hotelName}</dd>
                      </>
                    ) : null}

                    {activity.hotelRating ? (
                      <>
                        <dt>{copy.hotelRating}</dt>
                        <dd>{activity.hotelRating}★</dd>
                      </>
                    ) : null}

                    {activity.roomType ? (
                      <>
                        <dt>{copy.roomType}</dt>
                        <dd>{activity.roomType}</dd>
                      </>
                    ) : null}

                    {activity.mealPlan ? (
                      <>
                        <dt>{copy.mealPlan}</dt>
                        <dd>{activity.mealPlan}</dd>
                      </>
                    ) : null}
                  </dl>
                </div>
              ) : null}
            </div>

            <div className="package-text-grid">
              {activity.availableTravelDates ? (
                <section>
                  <h3>{copy.availableTravelDates}</h3>
                  <p>{activity.availableTravelDates}</p>
                </section>
              ) : null}

              {activity.packageItinerary ? (
                <section>
                  <h3>{copy.packageItinerary}</h3>
                  <p>{activity.packageItinerary}</p>
                </section>
              ) : null}

              {activity.requiredDocuments ? (
                <section>
                  <h3>{copy.requiredDocuments}</h3>
                  <p>{activity.requiredDocuments}</p>
                </section>
              ) : null}

              {activity.cancellationPolicy ? (
                <section>
                  <h3>{copy.cancellationPolicy}</h3>
                  <p>{activity.cancellationPolicy}</p>
                </section>
              ) : null}

              {activity.packageInclusions ? (
                <section>
                  <h3>{copy.packageInclusions}</h3>
                  <p>{activity.packageInclusions}</p>
                </section>
              ) : null}

              {activity.packageExclusions ? (
                <section>
                  <h3>{copy.packageExclusions}</h3>
                  <p>{activity.packageExclusions}</p>
                </section>
              ) : null}
            </div>

            <p className="package-notice">
              <FileText size={16} aria-hidden="true" />
              {copy.packageDisclaimer}
            </p>
          </section>
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
        <span className="booking-panel__label">
          {isOutsideOman ? copy.outsideOmanPackage : activity.category}
        </span>
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
        {isOutsideOman && tripLength ? tripLength : activity.duration}
      </p>

      {isOutsideOman && destinationLabel ? (
        <p className="inline-info">
          <Globe2 size={18} aria-hidden="true" />
          {destinationLabel}
        </p>
      ) : null}

      {isOutsideOman && activity.departureCity ? (
        <p className="inline-info">
          <Plane size={18} aria-hidden="true" />
          {copy.departureCity}: {activity.departureCity}
        </p>
      ) : null}

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

        {packageServiceBadges.map((item) => (
          <span key={item}>{item}</span>
        ))}

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

            {bookingDate ? (
              <div
                className={`activity-availability-note ${
                  isBookingAvailabilityBlocked
                    ? 'activity-availability-note--warning'
                    : ''
                }`}
                role={isBookingAvailabilityBlocked ? 'alert' : 'status'}
              >
                {availabilityLoading ? copy.checkingAvailability : null}

                {!availabilityLoading && availabilityError ? availabilityError : null}

                {!availabilityLoading && !availabilityError && availability ? (
                  availability.availableGuests === null ? (
                    copy.unlimitedAvailability
                  ) : availability.available ? (
                    `${availability.availableGuests} ${copy.availableSeats}`
                  ) : (
                    availability.unavailableReason || copy.availabilityUnavailable
                  )
                ) : null}
              </div>
            ) : null}

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
              <p className="form-error" role="alert">
                {bookingError}
              </p>
            ) : null}

            {bookingSuccess ? (
              <p className="form-success" role="status">
                {bookingSuccess}
              </p>
            ) : null}

            <button
              className="button-link button-link--primary"
              type="submit"
              disabled={bookingSubmitting || availabilityLoading || isBookingAvailabilityBlocked}
            >
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

  <section className="container stage8-review-wrap">
    <ReviewSection targetType="ACTIVITY" targetId={activity.id} />
  </section>
</article>


);
}

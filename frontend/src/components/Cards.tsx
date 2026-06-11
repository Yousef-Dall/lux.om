import {
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Clock,
  Heart,
  MapPin,
  MoveRight,
  Ruler,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useLanguage } from '../i18n/LanguageContext';
import type { Activity, Listing, ListingTransaction } from '../types';
import { formatDayList, formatTimeRange } from '../utils/format';

type ListingCardProps = {
  listing: Listing;
  variant?: 'default' | 'featured';
};

function getTransactionLabel(transaction: ListingTransaction | string, language: 'en' | 'ar') {
  if (language === 'ar') {
    const labels: Record<string, string> = {
      Sale: 'بيع',
      Rent: 'إيجار',
      'Short stay': 'إقامة قصيرة'
    };

    return labels[transaction] ?? transaction;
  }

  return transaction;
}

function getPropertyTypeLabel(type: string, language: 'en' | 'ar') {
  if (language === 'ar') {
    const labels: Record<string, string> = {
      Villa: 'فيلا',
      Apartment: 'شقة',
      Chalet: 'شاليه',
      Penthouse: 'بنتهاوس',
      'Resort apartment': 'شقة منتجع',
      Land: 'أرض'
    };

    return labels[type] ?? type;
  }

  return type;
}

function getActivityTypeLabel(type: string, language: 'en' | 'ar') {
  if (language === 'ar') {
    const labels: Record<string, string> = {
      Private: 'خاص',
      Group: 'جماعي',
      Both: 'خاص وجماعي'
    };

    return labels[type] ?? type;
  }

  return type;
}

function getDurationLabel(duration: string, language: 'en' | 'ar') {
  if (language === 'ar') {
    const labels: Record<string, string> = {
      Short: 'قصير',
      'Half day': 'نصف يوم',
      'Full day': 'يوم كامل',
      Overnight: 'ليلة كاملة',
      '6 hours': '٦ ساعات',
      '1 night': 'ليلة واحدة'
    };

    return labels[duration] ?? duration;
  }

  return duration;
}

function getDifficultyLabel(difficulty: string, language: 'en' | 'ar') {
  if (language === 'ar') {
    const labels: Record<string, string> = {
      Easy: 'سهل',
      Moderate: 'متوسط',
      Challenging: 'متقدم'
    };

    return labels[difficulty] ?? difficulty;
  }

  return difficulty;
}

function getActivityCategoryLabel(category: string, language: 'en' | 'ar') {
  if (language === 'ar') {
    const labels: Record<string, string> = {
      Adventure: 'مغامرة',
      Culture: 'ثقافة',
      Desert: 'صحراء',
      Family: 'عائلي',
      'Food & Dining': 'طعام',
      Luxury: 'فاخر',
      Mountain: 'جبال',
      Nature: 'طبيعة',
      Sea: 'بحر',
      'Water Sports': 'رياضات مائية',
      Wellness: 'استجمام'
    };

    return labels[category] ?? category;
  }

  return category;
}

function getAmenityLabel(amenity: string, language: 'en' | 'ar') {
  if (language === 'ar') {
    const labels: Record<string, string> = {
      'Private pool': 'مسبح خاص',
      'Sea view': 'إطلالة بحر',
      Parking: 'موقف سيارات',
      Garden: 'حديقة',
      Terrace: 'تراس',
      'Pool access': 'دخول للمسبح',
      Furnished: 'مفروش',
      'Gym access': 'دخول للنادي',
      'Family friendly': 'مناسب للعائلات',
      Security: 'أمن',
      'Maid room': 'غرفة خادمة',
      'Driver room': 'غرفة سائق',
      Balcony: 'شرفة',
      'Beach nearby': 'قريب من الشاطئ',
      Kitchen: 'مطبخ',
      Housekeeping: 'تنظيف',
      'Smart access': 'دخول ذكي',
      Elevator: 'مصعد',
      'Golf view': 'إطلالة جولف',
      'Resort access': 'دخول للمنتجع'
    };

    return labels[amenity] ?? amenity;
  }

  return amenity;
}

function getHighlightLabel(highlight: string, language: 'en' | 'ar') {
  if (language === 'ar') {
    const labels: Record<string, string> = {
      'Private guide': 'مرشد خاص',
      'Dinner setup': 'ترتيب عشاء',
      'Dune transfer': 'نقل للكثبان',
      'Boat included': 'يشمل القارب',
      Snorkeling: 'سنوركلينغ',
      Refreshments: 'مشروبات خفيفة',
      'Local guide': 'مرشد محلي',
      'Family friendly': 'مناسب للعائلات',
      'Sunset view': 'إطلالة الغروب',
      'Hotel pickup': 'استلام من الفندق',
      'Private boat': 'قارب خاص',
      'Souq walk': 'جولة في السوق',
      'Fort visit': 'زيارة الحصن'
    };

    return labels[highlight] ?? highlight;
  }

  return highlight;
}

function getCardCopy(language: 'en' | 'ar') {
  return language === 'ar'
    ? {
        featured: 'مميز',
        near: 'بالقرب من',
        developedBy: 'طُوّر بواسطة',
        hostedBy: 'بواسطة',
        organizedBy: 'من تنظيم',
        travelAgency: 'وكالة السفر',
        curatedProperty: 'عقار مختار',
        curatedActivity: 'نشاط مختار',
        listingDetails: 'تفاصيل العقار',
        amenities: 'المرافق',
        activityDetails: 'تفاصيل النشاط',
        activityHighlights: 'مميزات النشاط',
        sqm: 'م²',
        viewDeveloperProfile: 'عرض ملف المطور',
        viewAgencyProfile: 'عرض وكالة السفر'
      }
    : {
        featured: 'Featured',
        near: 'Near',
        developedBy: 'Developed by',
        hostedBy: 'Hosted by',
        organizedBy: 'Organized by',
        travelAgency: 'Travel agency',
        curatedProperty: 'Curated property',
        curatedActivity: 'Curated activity',
        listingDetails: 'Listing details',
        amenities: 'Amenities',
        activityDetails: 'Activity details',
        activityHighlights: 'Activity highlights',
        sqm: 'sqm',
        viewDeveloperProfile: 'View developer profile',
        viewAgencyProfile: 'View travel agency'
      };
}

export function ListingCard({ listing, variant = 'default' }: ListingCardProps) {
  const { t, language } = useLanguage();
  const copy = getCardCopy(language);

  const previewAmenities = listing.amenities.slice(0, 3);
  const extraAmenityCount = Math.max(listing.amenities.length - previewAmenities.length, 0);

  const transactionLabel = getTransactionLabel(listing.transaction, language);
  const propertyTypeLabel = getPropertyTypeLabel(listing.type, language);

  return (
    <article className={`listing-card lux-market-card lux-market-card--${variant}`}>
      <Link
        className="listing-card__media lux-market-card__media"
        to={`/listings/${listing.slug}`}
        aria-label={`${t.common.view} ${listing.title}`}
      >
        <img src={listing.image} alt={listing.title} loading="lazy" />

        <span className="lux-card-badge lux-card-badge--top">{transactionLabel}</span>

        <span className="lux-card-save" aria-hidden="true">
          <Heart size={16} />
        </span>

        <div className="lux-card-gradient" aria-hidden="true" />

        <div className="lux-card-price">
          <span>{transactionLabel}</span>
          <strong>{listing.price}</strong>
        </div>
      </Link>

      <div className="listing-card__body lux-market-card__body">
        <div className="lux-card-meta">
          <span>{propertyTypeLabel}</span>

          {listing.featured ? (
            <span>
              <Sparkles size={14} aria-hidden="true" />
              {copy.featured}
            </span>
          ) : null}
        </div>

        <h3>
          <Link to={`/listings/${listing.slug}`}>{listing.title}</Link>
        </h3>

        <p className="lux-card-location">
          <MapPin size={16} aria-hidden="true" />
          {listing.location}
        </p>

        {listing.nearestLandmarkName ? (
          <p className="lux-card-nearby">
            <MapPin size={15} aria-hidden="true" />
            {copy.near} {listing.nearestLandmarkName}
            {listing.distanceFromLandmark ? ` · ${listing.distanceFromLandmark}` : ''}
          </p>
        ) : null}

        {listing.developer ? (
          <Link
            to={`/developers/${listing.developer.slug}`}
            className="lux-card-developer"
            aria-label={`${copy.viewDeveloperProfile}: ${listing.developer.name}`}
          >
            <img src={listing.developer.logo} alt={`${listing.developer.name} logo`} loading="lazy" />

            <span>
              <small>{copy.developedBy}</small>
              <strong>
                {listing.developer.name}
                {listing.developer.verified ? <ShieldCheck size={14} aria-hidden="true" /> : null}
              </strong>
            </span>
          </Link>
        ) : null}

        <p className="lux-card-description">{listing.description}</p>

        <div className="lux-card-facts" aria-label={copy.listingDetails}>
          <span>
            <BedDouble size={16} aria-hidden="true" />
            {listing.beds}
          </span>

          <span>
            <Bath size={16} aria-hidden="true" />
            {listing.baths}
          </span>

          <span>
            <Ruler size={16} aria-hidden="true" />
            {listing.sqm} {copy.sqm}
          </span>
        </div>

        <div className="lux-chip-list" aria-label={copy.amenities}>
          {previewAmenities.map((amenity) => (
            <span key={amenity}>{getAmenityLabel(amenity, language)}</span>
          ))}

          {extraAmenityCount > 0 ? <span>+{extraAmenityCount}</span> : null}
        </div>

        <div className="lux-card-footer">
          <span>{copy.curatedProperty}</span>

          <Link to={`/listings/${listing.slug}`} className="lux-card-link">
            {t.common.view}
            <MoveRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

type ActivityCardProps = {
  activity: Activity;
  variant?: 'default' | 'featured';
};

export function ActivityCard({ activity, variant = 'default' }: ActivityCardProps) {
  const { t, language } = useLanguage();
  const copy = getCardCopy(language);

  const previewHighlights = activity.highlights.slice(0, 3);

  const activityTypeLabel = getActivityTypeLabel(activity.specs.experienceType, language);
  const categoryLabel = getActivityCategoryLabel(activity.category, language);
  const durationLabel = getDurationLabel(activity.duration, language);

  const agency = activity.travelAgency;
  const organizerName = agency?.name || activity.provider;

  return (
    <article className={`activity-card lux-market-card lux-activity-card lux-market-card--${variant}`}>
      <Link
        className="activity-card__media lux-market-card__media"
        to={`/activities/${activity.slug}`}
        aria-label={`${t.common.view} ${activity.title}`}
      >
        <img src={activity.image} alt={activity.title} loading="lazy" />

        <span className="lux-card-badge lux-card-badge--top">{categoryLabel}</span>

        <span className="lux-card-save" aria-hidden="true">
          <Heart size={16} />
        </span>

        <div className="lux-card-gradient" aria-hidden="true" />

        <div className="lux-card-price">
          <span>{durationLabel}</span>
          <strong>{activity.price}</strong>
        </div>
      </Link>

      <div className="activity-card__body lux-market-card__body">
        <div className="lux-card-meta">
          <span>{activityTypeLabel}</span>

          {activity.featured ? (
            <span>
              <Sparkles size={14} aria-hidden="true" />
              {copy.featured}
            </span>
          ) : null}
        </div>

        <h3>
          <Link to={`/activities/${activity.slug}`}>{activity.title}</Link>
        </h3>

        <p className="lux-card-location">
          <MapPin size={16} aria-hidden="true" />
          {activity.location}
        </p>

        {agency ? (
          <Link
            to={`/travel-agencies/${agency.slug}`}
            className="lux-card-developer"
            aria-label={`${copy.viewAgencyProfile}: ${agency.name}`}
          >
            {agency.logo ? (
              <img src={agency.logo} alt={`${agency.name} logo`} loading="lazy" />
            ) : (
              <span className="lux-card-developer__placeholder">
                <Building2 size={16} aria-hidden="true" />
              </span>
            )}

            <span>
              <small>{copy.travelAgency}</small>
              <strong>
                {agency.name}
                {agency.verified ? <BadgeCheck size={14} aria-hidden="true" /> : null}
              </strong>
            </span>
          </Link>
        ) : organizerName ? (
          <p className="lux-card-provider">
            <Building2 size={15} aria-hidden="true" />
            {copy.organizedBy} {organizerName}
          </p>
        ) : null}

        {activity.nearestLandmarkName ? (
          <p className="lux-card-nearby">
            <MapPin size={15} aria-hidden="true" />
            {copy.near} {activity.nearestLandmarkName}
          </p>
        ) : null}

        <p className="lux-card-description">{activity.description}</p>

        <div className="lux-card-facts" aria-label={copy.activityDetails}>
          <span>
            <Clock size={16} aria-hidden="true" />
            {durationLabel}
          </span>

          <span>
            <Users size={16} aria-hidden="true" />
            {activity.groupSize ?? activityTypeLabel}
          </span>

          <span>
            <CalendarDays size={16} aria-hidden="true" />
            {formatDayList(activity.availability.days, language === 'ar' ? 'و' : '&')}
          </span>
        </div>

        <div className="lux-chip-list" aria-label={copy.activityHighlights}>
          {activity.difficulty ? (
            <span>{getDifficultyLabel(activity.difficulty, language)}</span>
          ) : null}

          {activity.language ? <span>{activity.language}</span> : null}

          {previewHighlights.map((highlight) => (
            <span key={highlight}>{getHighlightLabel(highlight, language)}</span>
          ))}
        </div>

        <div className="lux-availability-pill">
          <span>{t.activities?.availableTime ?? t.experiences.availableTime}</span>
          <strong>
            {formatTimeRange(activity.availability.startTime, activity.availability.endTime)}
          </strong>
        </div>

        <div className="lux-card-footer">
          <span>{copy.curatedActivity}</span>

          <Link to={`/activities/${activity.slug}`} className="lux-card-link">
            {t.common.view}
            <MoveRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Temporary alias while old page imports are migrated.
 * New code should use ActivityCard.
 */

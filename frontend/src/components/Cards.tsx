import {
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Clock,
  Globe2,
  Heart,
  Hotel,
  MapPin,
  MoveRight,
  Plane,
  Ruler,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';

import SavedButton from './SavedButton';
import TrustBadges from './TrustBadges';
import WhatsAppActions from './WhatsAppActions';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity, DeveloperProject, Listing, ListingTransaction } from '../types';
import {
  formatDayList,
  formatMarketplacePrice,
  formatTimeRange
} from '../utils/format';
import { formatListingBuyerEligibility } from '../utils/listingEligibility';

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

function getActivityTravelRegionLabel(region: string, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    INSIDE_OMAN: {
      en: 'Inside Oman',
      ar: 'داخل عُمان'
    },
    OUTSIDE_OMAN: {
      en: 'Outside Oman',
      ar: 'خارج عُمان'
    }
  };

  const label = labels[region];

  if (!label) return region;

  return language === 'ar' ? label.ar : label.en;
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
      'Fort visit': 'زيارة الحصن',
      'Flight included': 'الطيران مشمول',
      'Hotel included': 'الفندق مشمول',
      'Visa support': 'دعم التأشيرة',
      'Travel insurance': 'تأمين السفر',
      'Airport transfer': 'مواصلات المطار'
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
        insideOmanActivity: 'نشاط داخل عُمان',
        outsideOmanPackage: 'باقة سفر خارج عُمان',
        listingDetails: 'تفاصيل العقار',
        amenities: 'المرافق',
        activityDetails: 'تفاصيل النشاط',
        activityHighlights: 'مميزات النشاط',
        packageDetails: 'تفاصيل الباقة',
        destination: 'الوجهة',
        departureFrom: 'المغادرة من',
        tripLength: 'مدة الرحلة',
        days: 'أيام',
        nights: 'ليالٍ',
        servicesIncluded: 'خدمات مشمولة',
        flightIncluded: 'الطيران',
        hotelIncluded: 'الفندق',
        visaSupport: 'دعم التأشيرة',
        travelInsurance: 'تأمين السفر',
        airportTransfer: 'مواصلات المطار',
        sqm: 'م²',
        viewDeveloperProfile: 'عرض ملف المطور',
        viewAgencyProfile: 'عرض وكالة السفر',
        virtualTour: 'جولة افتراضية',
        floorPlan: 'مخطط',
        verified: 'موثق',
        whatsapp: 'واتساب'
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
        insideOmanActivity: 'Inside-Oman activity',
        outsideOmanPackage: 'Outside-Oman package',
        listingDetails: 'Listing details',
        amenities: 'Amenities',
        activityDetails: 'Activity details',
        activityHighlights: 'Activity highlights',
        packageDetails: 'Package details',
        destination: 'Destination',
        departureFrom: 'Departure from',
        tripLength: 'Trip length',
        days: 'days',
        nights: 'nights',
        servicesIncluded: 'Included services',
        flightIncluded: 'Flight',
        hotelIncluded: 'Hotel',
        visaSupport: 'Visa support',
        travelInsurance: 'Travel insurance',
        airportTransfer: 'Airport transfer',
        sqm: 'sqm',
        viewDeveloperProfile: 'View developer profile',
        viewAgencyProfile: 'View travel agency',
        virtualTour: 'Virtual tour',
        floorPlan: 'Floor plan',
        verified: 'Verified',
        whatsapp: 'WhatsApp'
      };
}

export function ListingCard({ listing, variant = 'default' }: ListingCardProps) {
  const { t, language } = useLanguage();
  const copy = getCardCopy(language);

  const previewAmenities = listing.amenities.slice(0, 3);
  const extraAmenityCount = Math.max(listing.amenities.length - previewAmenities.length, 0);

  const transactionLabel = getTransactionLabel(listing.transaction, language);
  const propertyTypeLabel = getPropertyTypeLabel(listing.type, language);
  const buyerEligibilityPreview =
    listing.transaction === 'Sale' && listing.buyerEligibility?.length
      ? listing.buyerEligibility
          .slice(0, 2)
          .map((item) => formatListingBuyerEligibility(item, language))
          .join(language === 'ar' ? '، ' : ', ')
      : '';

  const formattedPrice = formatMarketplacePrice({
    price: listing.price,
    priceAmount: listing.priceAmount,
    priceCurrency: listing.priceCurrency,
    priceQualifier: listing.priceQualifier,
    priceUnit: listing.priceUnit,
    language
  });

  const listingPrimaryImage = listing.images?.[0]?.url || listing.image;
  const listingImageCount = listing.images?.length ?? 0;
  const hasListingVirtualTour = Boolean(
    listing.tour360Url ||
      listing.virtualTourUrl ||
      listing.premiumMedia?.some((media) => media.type === 'TOUR_360' || media.type === 'VIRTUAL_TOUR')
  );
  const hasListingVideo = Boolean(
    listing.videoWalkthroughUrl ||
      listing.premiumMedia?.some((media) => media.type === 'VIDEO_WALKTHROUGH')
  );
  const hasListingFloorPlan = Boolean(
    listing.floorPlanUrl || listing.premiumMedia?.some((media) => media.type === 'FLOOR_PLAN')
  );

  return (
    <article className={`listing-card lux-market-card lux-market-card--${variant}`}>
      <Link
        className="listing-card__media lux-market-card__media"
        to={`/listings/${listing.slug}`}
        aria-label={`${t.common.view} ${listing.title}`}
      >
        <img src={listingPrimaryImage} alt={listing.title} loading="lazy" />

        {listingImageCount > 1 ? (
          <span className="lux-card-image-count">{listingImageCount} photos</span>
        ) : null}

        <div className="lux-card-media-flags">
          {hasListingVirtualTour ? <span>{copy.virtualTour}</span> : null}
          {hasListingVideo ? <span>Video</span> : null}
          {hasListingFloorPlan ? <span>{copy.floorPlan}</span> : null}
        </div>

        <span className="lux-card-badge lux-card-badge--top">{transactionLabel}</span>

        <span className="lux-card-save" aria-hidden="true">
          <Heart size={16} />
        </span>

        <div className="lux-card-gradient" aria-hidden="true" />

        <div className="lux-card-price">
          <span>{transactionLabel}</span>
          <strong>{formattedPrice}</strong>
        </div>
      </Link>

      <div className="listing-card__body lux-market-card__body">
        <div className="lux-card-meta">
          <span>{propertyTypeLabel}</span>

          {buyerEligibilityPreview ? <span>{buyerEligibilityPreview}</span> : null}

          {listing.featured ? (
            <span>
              <Sparkles size={14} aria-hidden="true" />
              {copy.featured}
            </span>
          ) : null}
        </div>

        <TrustBadges
          verificationStatus={listing.verificationStatus}
          mediaQualityStatus={listing.mediaQualityStatus}
          buyerEligibility={listing.buyerEligibility}
        />

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
        ) : listing.developerName ? (
          <div className="lux-card-developer">
            <span>
              <small>{copy.developedBy}</small>
              <strong>{listing.developerName}</strong>
            </span>
          </div>
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
          <SavedButton targetId={listing.id} targetType="listing" />
          <WhatsAppActions
            phone={listing.owner?.phone}
            title={listing.title}
            location={listing.location}
            label={copy.whatsapp}
          />
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


type ProjectCardProps = {
  project: DeveloperProject;
  variant?: 'default' | 'featured';
};

function formatProjectHandover(value: string | undefined, language: 'en' | 'ar') {
  if (!value) return language === 'ar' ? 'قيد التحديث' : 'To be confirmed';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium'
  }).format(parsed);
}

export function ProjectCard({ project, variant = 'default' }: ProjectCardProps) {
  const { t, language } = useLanguage();
  const developer = project.developer;
  const primaryImage = project.images?.[0]?.url || project.image;
  const imageCount = project.images?.length ?? 0;
  const formattedPrice = formatMarketplacePrice({
    priceAmount: project.startingPriceAmount,
    priceCurrency: project.priceCurrency,
    priceQualifier: project.priceQualifier,
    language
  });

  const projectCopy =
    language === 'ar'
      ? {
          project: 'مشروع تطوير',
          startingPrice: 'يبدأ من',
          handover: 'التسليم',
          units: 'وحدات',
          available: 'متاح',
          developer: 'المطور',
          viewDeveloper: 'عرض المطور',
          viewProject: 'عرض المشروع',
          brochure: 'بروشور',
          masterplan: 'مخطط عام',
          video: 'فيديو',
          verifiedDeveloper: 'مطور موثق',
          unitMix: 'مزيج الوحدات',
          whatsapp: 'واتساب'
        }
      : {
          project: 'Development project',
          startingPrice: 'From',
          handover: 'Handover',
          units: 'units',
          available: 'available',
          developer: 'Developer',
          viewDeveloper: 'View developer',
          viewProject: 'View project',
          brochure: 'Brochure',
          masterplan: 'Masterplan',
          video: 'Video',
          verifiedDeveloper: 'Verified developer',
          unitMix: 'Unit mix',
          whatsapp: 'WhatsApp'
        };

  return (
    <article className={`project-card lux-market-card lux-project-card lux-market-card--${variant}`}>
      <Link
        className="lux-market-card__media lux-project-card__media"
        to={`/projects/${project.slug}`}
        aria-label={`${t.common.view} ${project.name}`}
      >
        {primaryImage ? (
          <img src={primaryImage} alt={project.name} loading="lazy" />
        ) : (
          <span className="lux-project-card__placeholder" aria-hidden="true">
            <Building2 size={34} />
          </span>
        )}

        {imageCount > 1 ? <span className="lux-card-image-count">{imageCount} photos</span> : null}

        <div className="lux-card-media-flags">
          {project.brochureUrl ? <span>{projectCopy.brochure}</span> : null}
          {project.masterplanUrl ? <span>{projectCopy.masterplan}</span> : null}
          {project.videoWalkthroughUrl ? <span>{projectCopy.video}</span> : null}
        </div>

        <span className="lux-card-badge lux-card-badge--top">{projectCopy.project}</span>
        <div className="lux-card-gradient" aria-hidden="true" />

        <div className="lux-card-price">
          <span>{projectCopy.startingPrice}</span>
          <strong>{formattedPrice}</strong>
        </div>
      </Link>

      <div className="lux-market-card__body">
        <div className="lux-card-meta">
          {project.completionStatus ? <span>{project.completionStatus}</span> : null}
        </div>

        <TrustBadges
          verificationStatus={developer?.verificationStatus}
          mediaQualityStatus={project.mediaQualityStatus}
        />

        <h3>
          <Link to={`/projects/${project.slug}`}>{project.name}</Link>
        </h3>

        <p className="lux-card-location">
          <MapPin size={16} aria-hidden="true" />
          {project.location}
        </p>

        {developer ? (
          <Link
            to={`/developers/${developer.slug}`}
            className="lux-card-developer"
            aria-label={`${projectCopy.viewDeveloper}: ${developer.name}`}
          >
            {developer.logo ? (
              <img src={developer.logo} alt={`${developer.name} logo`} loading="lazy" />
            ) : (
              <span className="lux-card-developer__placeholder">
                <Building2 size={16} aria-hidden="true" />
              </span>
            )}
            <span>
              <small>{projectCopy.developer}</small>
              <strong>
                {developer.name}
                {developer.verified ? <ShieldCheck size={14} aria-hidden="true" /> : null}
              </strong>
            </span>
          </Link>
        ) : null}

        <p className="lux-card-description">{project.description}</p>

        <div className="lux-card-facts" aria-label={projectCopy.project}>
          <span>
            <Building2 size={16} aria-hidden="true" />
            {project.totalUnits ?? '—'} {projectCopy.units}
          </span>
          <span>
            <Users size={16} aria-hidden="true" />
            {project.availableUnits ?? '—'} {projectCopy.available}
          </span>
          <span>
            <CalendarDays size={16} aria-hidden="true" />
            {formatProjectHandover(project.handoverDate, language)}
          </span>
        </div>

        {project.bedroomsSummary || project.amenities.length ? (
          <div className="lux-chip-list" aria-label={projectCopy.unitMix}>
            {project.bedroomsSummary ? <span>{project.bedroomsSummary}</span> : null}
            {project.amenities.slice(0, 3).map((amenity) => (
              <span key={amenity}>{amenity}</span>
            ))}
          </div>
        ) : null}

        <div className="lux-card-footer">
          <WhatsAppActions
            phone={developer?.phone || project.owner?.phone}
            title={project.name}
            location={project.location}
            label={projectCopy.whatsapp}
          />
          <span>{projectCopy.project}</span>
          <Link to={`/projects/${project.slug}`} className="lux-card-link">
            {projectCopy.viewProject}
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

  const isOutsideOmanPackage = activity.travelRegion === 'OUTSIDE_OMAN';
  const previewHighlights = activity.highlights.slice(0, 3);

  const activityTypeLabel = getActivityTypeLabel(activity.specs.experienceType, language);
  const categoryLabel = getActivityCategoryLabel(activity.category, language);
  const durationLabel = getDurationLabel(activity.duration, language);
  const travelRegionLabel = activity.travelRegion
    ? getActivityTravelRegionLabel(activity.travelRegion, language)
    : '';

  const agency = activity.travelAgency;
  const organizerName = agency?.name || activity.provider;

  const formattedPrice = formatMarketplacePrice({
    price: activity.price,
    priceAmount: activity.priceAmount,
    priceCurrency: activity.priceCurrency,
    priceQualifier: activity.priceQualifier,
    priceUnit: activity.priceUnit,
    language
  });

  const activityPrimaryImage = activity.images?.[0]?.url || activity.image;
  const activityImageCount = activity.images?.length ?? 0;
  const hasActivityVirtualTour = Boolean(
    activity.tour360Url ||
      activity.virtualTourUrl ||
      activity.premiumMedia?.some((media) => media.type === 'TOUR_360' || media.type === 'VIRTUAL_TOUR')
  );
  const hasActivityVideo = Boolean(
    activity.videoWalkthroughUrl ||
      activity.premiumMedia?.some((media) => media.type === 'VIDEO_WALKTHROUGH')
  );

  const destinationLabel = [
    activity.destinationCity,
    activity.destinationCountry
  ]
    .filter(Boolean)
    .join(', ');

  const tripLengthLabel = [
    activity.tripDurationDays
      ? `${activity.tripDurationDays} ${copy.days}`
      : null,
    activity.tripDurationNights
      ? `${activity.tripDurationNights} ${copy.nights}`
      : null
  ]
    .filter(Boolean)
    .join(' / ');

  const packageServices = [
    activity.flightIncluded ? copy.flightIncluded : null,
    activity.hotelIncluded ? copy.hotelIncluded : null,
    activity.visaSupportIncluded ? copy.visaSupport : null,
    activity.travelInsuranceIncluded ? copy.travelInsurance : null,
    activity.airportTransferIncluded ? copy.airportTransfer : null
  ].filter((item): item is string => Boolean(item));

  const packageFacts = [
    destinationLabel
      ? {
          icon: Globe2,
          value: destinationLabel
        }
      : null,
    activity.departureCity
      ? {
          icon: Plane,
          value: `${copy.departureFrom}: ${activity.departureCity}`
        }
      : null,
    tripLengthLabel
      ? {
          icon: Clock,
          value: tripLengthLabel
        }
      : null
  ].filter((item): item is { icon: typeof Globe2; value: string } => Boolean(item));

  const cardModeLabel = isOutsideOmanPackage
    ? copy.outsideOmanPackage
    : copy.insideOmanActivity;

  return (
    <article
      className={`activity-card lux-market-card lux-activity-card ${
        isOutsideOmanPackage ? 'lux-activity-card--package' : 'lux-activity-card--local'
      } lux-market-card--${variant}`}
    >
      <Link
        className="activity-card__media lux-market-card__media"
        to={`/activities/${activity.slug}`}
        aria-label={`${t.common.view} ${activity.title}`}
      >
        <img src={activityPrimaryImage} alt={activity.title} loading="lazy" />

        {activityImageCount > 1 ? (
          <span className="lux-card-image-count">{activityImageCount} photos</span>
        ) : null}

        <div className="lux-card-media-flags">
          {hasActivityVirtualTour ? <span>{copy.virtualTour}</span> : null}
          {hasActivityVideo ? <span>Video</span> : null}
        </div>

        <span
          className={`lux-card-badge lux-card-badge--top ${
            isOutsideOmanPackage ? 'lux-card-badge--package' : ''
          }`}
        >
          {isOutsideOmanPackage ? copy.outsideOmanPackage : categoryLabel}
        </span>

        <span className="lux-card-save" aria-hidden="true">
          <Heart size={16} />
        </span>

        <div className="lux-card-gradient" aria-hidden="true" />

        <div className="lux-card-price">
          <span>{isOutsideOmanPackage && tripLengthLabel ? tripLengthLabel : durationLabel}</span>
          <strong>{formattedPrice}</strong>
        </div>
      </Link>

      <div className="activity-card__body lux-market-card__body">
        <div className="lux-card-meta lux-card-meta--fixed">
          <div className="lux-card-meta-main-slot">
            <span className="lux-card-meta-chip lux-card-meta-chip--type">
              {activityTypeLabel}
            </span>
          </div>

          <div className="lux-card-meta-featured-slot">
            {activity.featured ? (
              <span className="lux-card-meta-chip lux-card-meta-chip--featured">
                <Sparkles size={14} aria-hidden="true" />
                {copy.featured}
              </span>
            ) : null}
          </div>
        </div>

        <div className="lux-card-region-slot">
          {travelRegionLabel ? (
            <span className="lux-card-meta-chip lux-card-meta-chip--region">
              {travelRegionLabel}
            </span>
          ) : null}

          {isOutsideOmanPackage && destinationLabel ? (
            <span className="lux-card-meta-chip lux-card-meta-chip--destination">
              <Plane size={14} aria-hidden="true" />
              {destinationLabel}
            </span>
          ) : null}
        </div>

        <TrustBadges
          verificationStatus={activity.verificationStatus}
          mediaQualityStatus={activity.mediaQualityStatus}
        />

        <h3>
          <Link to={`/activities/${activity.slug}`}>{activity.title}</Link>
        </h3>

        {isOutsideOmanPackage && destinationLabel ? (
          <p className="lux-card-location lux-card-route">
            <Globe2 size={16} aria-hidden="true" />
            {copy.destination}: {destinationLabel}
          </p>
        ) : (
          <p className="lux-card-location">
            <MapPin size={16} aria-hidden="true" />
            {activity.location}
          </p>
        )}

        {isOutsideOmanPackage && activity.departureCity ? (
          <p className="lux-card-nearby">
            <Plane size={15} aria-hidden="true" />
            {copy.departureFrom} {activity.departureCity}
          </p>
        ) : null}

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

        {!isOutsideOmanPackage && activity.nearestLandmarkName ? (
          <p className="lux-card-nearby">
            <MapPin size={15} aria-hidden="true" />
            {copy.near} {activity.nearestLandmarkName}
          </p>
        ) : null}

        <p className="lux-card-description">{activity.description}</p>

        {isOutsideOmanPackage && packageFacts.length > 0 ? (
          <div className="lux-card-package-summary" aria-label={copy.packageDetails}>
            {packageFacts.map((fact) => {
              const Icon = fact.icon;

              return (
                <span key={fact.value}>
                  <Icon size={16} aria-hidden="true" />
                  {fact.value}
                </span>
              );
            })}
          </div>
        ) : (
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
        )}

        {isOutsideOmanPackage && packageServices.length > 0 ? (
          <div className="lux-card-package-service-list" aria-label={copy.servicesIncluded}>
            {packageServices.map((service) => (
              <span key={service}>
                {service === copy.hotelIncluded ? (
                  <Hotel size={14} aria-hidden="true" />
                ) : service === copy.flightIncluded ? (
                  <Plane size={14} aria-hidden="true" />
                ) : (
                  <ShieldCheck size={14} aria-hidden="true" />
                )}
                {service}
              </span>
            ))}
          </div>
        ) : null}

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
          <SavedButton targetId={activity.id} targetType="activity" />
          <WhatsAppActions
            phone={activity.owner?.phone || activity.travelAgency?.phone}
            title={activity.title}
            location={activity.location}
            label={copy.whatsapp}
          />
          <span>{cardModeLabel}</span>

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
export const ExperienceCard = ActivityCard;
import {
  Bath,
  BedDouble,
  Building2,
  Car,
  Home,
  MapPin,
  MoveRight,
  Ruler,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getListingBySlug, getRelatedListingsBySlug } from '../api/marketplace';
import ButtonLink from '../components/ButtonLink';
import InvestorWatchlistForm from '../components/InvestorWatchlistForm';
import { ListingCard } from '../components/Cards';
import MediaQualityGuidance from '../components/MediaQualityGuidance';
import ReportModal from '../components/ReportModal';
import ReviewSection from '../components/ReviewSection';
import SavedButton from '../components/SavedButton';
import TrustBadges from '../components/TrustBadges';
import WhatsAppActions from '../components/WhatsAppActions';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { Listing } from '../types';
import { formatMarketplacePrice } from '../utils/format';
import { formatListingBuyerEligibilityList } from '../utils/listingEligibility';
import { getSafeEmbedUrl } from '../utils/mediaEmbeds';

export default function ListingDetails() {
  const { t, language } = useLanguage();
  const { token } = useAuth();
  const { slug } = useParams();

  const [listing, setListing] = useState<Listing | null>(null);
  const [relatedListings, setRelatedListings] = useState<Listing[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useDocumentTitle(listing ? listing.title : 'Listing details');

  const copy =
    language === 'ar'
      ? {
          notFoundEyebrow: 'العقار غير موجود',
          notFoundTitle: 'هذا العقار لم يعد متاحاً.',
          featured: 'مميز',
          beds: 'غرف',
          baths: 'حمامات',
          sqm: 'متر مربع',
          near: 'بالقرب من',
          parking: 'موقف متاح',
floor: 'الطابق',
minStay: 'الحد الأدنى للإقامة',
nights: 'ليالٍ',
available: 'متاح',
notSpecified: 'غير محدد',
          developmentCompany: 'شركة التطوير',
          developedBy: 'تم تطويره بواسطة',
          verifiedDeveloper: 'مطور موثق',
          viewCompanyProfile: 'عرض ملف الشركة',
          viewDeveloperListings: 'عرض عقارات هذا المطور',
          buyerEligibility: 'أهلية الشراء',
          investorReadiness: 'جاهزية المستثمر',
          eligibilityDisclaimer: 'يجب التحقق من الأهلية قبل الشراء وتخضع للوائح عُمان المعمول بها.',
          eligibilityNotSpecified: 'لم يتم تحديد أهلية المستثمر لهذا العقار بعد.',
          premiumMedia: 'الوسائط المميزة',
          floorPlan: 'مخطط العقار',
          report: 'الإبلاغ عن هذا العقار',
            reviewedByLux: 'تمت مراجعته قبل النشر',
            reviewedByLuxText:
              'يعرض lux.om العقارات المنشورة بعد مراجعة أساسية للمحتوى والوسائط قبل ظهورها للعامة.',
            fastInquiry: 'استفسار سريع',
            fastInquiryText: 'اختاري واتساب أو نموذج التواصل وسيساعدك فريق lux.om في توجيه الطلب للطرف المناسب.',
            mediaConfidence: 'صور ومعلومات جاهزة للمراجعة',
            mediaConfidenceText: 'راجعي جودة الوسائط، المخطط، والجولة قبل طلب الزيارة أو التفاصيل.',
            requestTour: 'طلب زيارة أو تفاصيل',
            compareReviews: 'قراءة التقييمات',
            safeNextStepText: 'اطلبي التفاصيل، راجعي الأهلية والمستندات، ولا تحولي أي مبالغ خارج القنوات المتفق عليها.',
          relatedEyebrow: 'اقتراحات مشابهة',
          relatedTitle: 'عقارات مشابهة قد تناسبك',
          relatedText: 'اختيارات قريبة حسب الموقع، النوع، السعر، المطور، وجودة البيانات.',
          relatedLoading: 'جاري تحميل عقارات مشابهة...',
          viewAllRelated: 'عرض كل العقارات',
          noRelated: 'لا توجد عقارات مشابهة كافية حالياً.',
          loading: 'جاري تحميل العقار...',
          error: 'تعذر تحميل تفاصيل العقار. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.'
        }
      : {
          notFoundEyebrow: 'Listing not found',
          notFoundTitle: 'This listing is no longer available.',
          featured: 'Featured',
          beds: 'beds',
          baths: 'baths',
          sqm: 'sqm',
          near: 'Near',
          parking: 'Parking available',
floor: 'Floor',
minStay: 'Minimum stay',
nights: 'nights',
available: 'Available',
notSpecified: 'Not specified',
          developmentCompany: 'Development company',
          developedBy: 'Developed by',
          verifiedDeveloper: 'Verified developer',
          viewCompanyProfile: 'View company profile',
          viewDeveloperListings: 'View properties by this developer',
          buyerEligibility: 'Buyer eligibility',
          investorReadiness: 'Investor readiness',
          eligibilityDisclaimer: 'Eligibility should be verified before purchase and is subject to applicable Omani regulations.',
          eligibilityNotSpecified: 'Investor eligibility has not been marked yet.',
          premiumMedia: 'Premium media',
          floorPlan: 'Floor plan',
          report: 'Report this listing',
            reviewedByLux: 'Reviewed before publishing',
            reviewedByLuxText:
              'lux.om shows published listings after a basic content and media review before they appear publicly.',
            fastInquiry: 'Fast inquiry path',
            fastInquiryText: 'Use WhatsApp or the contact form and lux.om will help route the request to the right party.',
            mediaConfidence: 'Media and facts ready to review',
            mediaConfidenceText: 'Check photos, floor plan, and walkthrough media before requesting a viewing or details.',
            requestTour: 'Request viewing or details',
            compareReviews: 'Read reviews',
            safeNextStepText: 'Request details, review eligibility and documents, and avoid sending money outside agreed channels.',
          relatedEyebrow: 'Related picks',
          relatedTitle: 'Similar properties you may like',
          relatedText: 'Matched by location, property type, price band, developer, and trust signals.',
          relatedLoading: 'Loading related listings...',
          viewAllRelated: 'View all listings',
          noRelated: 'No strong related listings are available yet.',
          loading: 'Loading listing...',
          error: 'Could not load listing details. Make sure the backend is running and try again.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadListing() {
      if (!slug) {
        setLoading(false);
        setListing(null);
        return;
      }

      try {
        setLoading(true);
        setLoadError('');

        const apiListing = await getListingBySlug(slug, language);

        if (!isMounted) return;

        setListing(apiListing);
        setRelatedLoading(true);
      } catch (error) {
        if (!isMounted) return;

        console.error(error);
        setListing(null);
        setLoadError(copy.error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadListing();

    return () => {
      isMounted = false;
    };
  }, [slug, language, copy.error]);

  useEffect(() => {
    let isMounted = true;

    async function loadRelatedListings() {
      if (!slug || !listing?.id) {
        setRelatedListings([]);
        setRelatedLoading(false);
        return;
      }

      try {
        setRelatedLoading(true);
        const listings = await getRelatedListingsBySlug(slug, language);

        if (!isMounted) return;

        setRelatedListings(listings.filter((item) => item.id !== listing.id));
      } catch (error) {
        if (!isMounted) return;

        console.error(error);
        setRelatedListings([]);
      } finally {
        if (isMounted) {
          setRelatedLoading(false);
        }
      }
    }

    void loadRelatedListings();

    return () => {
      isMounted = false;
    };
  }, [slug, language, listing?.id]);

  if (loading) {
    return (
      <section className="page-section container not-found" aria-labelledby="listing-loading-title">
        <p className="eyebrow">{t.listings.eyebrow}</p>
        <h1 id="listing-loading-title">{copy.loading}</h1>
      </section>
    );
  }

  if (!listing || loadError) {
    return (
      <section className="page-section container not-found" aria-labelledby="listing-not-found-title">
        <p className="eyebrow">{copy.notFoundEyebrow}</p>
        <h1 id="listing-not-found-title">{loadError || copy.notFoundTitle}</h1>
        <ButtonLink to="/listings">{t.common.backToListings}</ButtonLink>
      </section>
    );
  }

  const buyerEligibilityLabel =
    listing.transaction === 'Sale' && listing.buyerEligibility?.length
      ? formatListingBuyerEligibilityList(listing.buyerEligibility, language)
      : '';

  const listingGalleryImages = (
    listing.images?.length
      ? listing.images.map((image, imageIndex) => ({
          url: image.url,
          alt: image.altEn || image.altAr || `${listing.title} ${imageIndex + 1}`
        }))
      : [
          {
            url: listing.image,
            alt: listing.title
          }
        ]
  ).filter((image) => image.url);

  const primaryListingImage = listingGalleryImages[0] ?? {
    url: listing.image,
    alt: listing.title
  };

  const premiumMediaLinks = [
    listing.videoWalkthroughUrl
      ? { type: 'VIDEO_WALKTHROUGH', url: listing.videoWalkthroughUrl, title: 'Video walkthrough' }
      : null,
    listing.tour360Url
      ? { type: 'TOUR_360', url: listing.tour360Url, title: '360 tour' }
      : null,
    listing.virtualTourUrl
      ? { type: 'VIRTUAL_TOUR', url: listing.virtualTourUrl, title: 'Virtual tour' }
      : null,
    ...(listing.premiumMedia ?? []).map((media) => ({
      type: media.type,
      url: media.url,
      title: media.titleEn || media.titleAr || media.type.replace(/_/g, ' ')
    }))
  ].filter((media): media is { type: string; url: string; title: string } => Boolean(media?.url));

  const embeddableMedia = premiumMediaLinks
    .map((media) => ({ ...media, embedUrl: getSafeEmbedUrl(media.url) }))
    .filter((media) => Boolean(media.embedUrl));

  const floorPlanUrl =
    listing.floorPlanUrl ||
    listing.premiumMedia?.find((media) => media.type === 'FLOOR_PLAN')?.url;

  const specItems = [
  {
    label: t.addListing.bedrooms,
    value: `${listing.beds}`,
    icon: BedDouble
  },
  {
    label: t.addListing.bathrooms,
    value: `${listing.baths}`,
    icon: Bath
  },
  {
    label: t.addListing.area,
    value: `${listing.sqm} ${copy.sqm}`,
    icon: Ruler
  },
  {
    label: t.addListing.maxGuests,
    value: listing.maxGuests ? `${listing.maxGuests}` : copy.notSpecified,
    icon: Users
  },
  {
    label: copy.minStay,
    value: listing.minStayNights
      ? `${listing.minStayNights} ${copy.nights}`
      : copy.notSpecified,
    icon: Home
  },
  {
    label: copy.parking,
    value: listing.parkingSpaces ? copy.available : copy.notSpecified,
    icon: Car
  },
  {
    label: copy.floor,
    value: listing.floorNumber ? `${listing.floorNumber}` : copy.notSpecified,
    icon: Building2
  },
  {
    label: t.addListing.furnishing,
    value: listing.furnishing ?? copy.notSpecified,
    icon: Home
  },
  {
    label: t.addListing.view,
    value: listing.view ?? copy.notSpecified,
    icon: Sparkles
  },
  {
    label: t.addListing.paymentFrequency,
    value: listing.paymentFrequency ?? copy.notSpecified,
    icon: Building2
  },
    ...(listing.transaction === 'Sale'
      ? [
          {
            label: copy.buyerEligibility,
            value: buyerEligibilityLabel || copy.eligibilityNotSpecified,
            icon: ShieldCheck
          }
        ]
      : [])
];

  return (
    <article className="details-page details-page--listing-detail">
      <section className="details-hero details-hero--listing">
        <div className="container">
          <Link className="back-link" to="/listings">
            {t.common.backToListings}
          </Link>

          <div className="details-hero__content">
            <p className="eyebrow">
              {listing.transaction} · {listing.type}
            </p>

            <h1>{listing.title}</h1>

            <p>
              <MapPin size={18} aria-hidden="true" />
              {listing.location}
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
                  src={primaryListingImage.url}
                  alt={primaryListingImage.alt}
                />


            {listing.featured ? (
              <span className="details-image-badge">
                <Sparkles size={15} aria-hidden="true" />
                {copy.featured}
              </span>
            ) : null}
              </div>

              {listingGalleryImages.length > 1 ? (
                <div className="details-gallery-grid">
                  {listingGalleryImages.slice(1).map((image, imageIndex) => (
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

          {embeddableMedia.length > 0 || floorPlanUrl ? (
            <section className="premium-media-section" aria-labelledby="listing-premium-media-title">
              <div className="details-section-heading">
                <p className="eyebrow">lux.om media</p>
                <h2 id="listing-premium-media-title">{copy.premiumMedia}</h2>
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

                {floorPlanUrl ? (
                  <a className="premium-media-link" href={floorPlanUrl} target="_blank" rel="noreferrer">
                    {copy.floorPlan}
                    <MoveRight size={16} aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="details-content">
            <div className="details-section-heading">
              <p className="eyebrow">{listing.type}</p>
              <h2>{t.listings.aboutProperty}</h2>
            </div>

            <p>{listing.description}</p>

            <TrustBadges
              verificationStatus={listing.verificationStatus}
              verificationSource={listing.verificationSource}
              mediaQualityStatus={listing.mediaQualityStatus}
              buyerEligibility={listing.buyerEligibility}
              variant="full"
            />

            <div className="stage8-detail-actions">
              <SavedButton targetId={listing.id} targetType="listing" />
              <WhatsAppActions
                phone={listing.owner?.phone}
                title={listing.title}
                location={listing.location}
                label={language === 'ar' ? 'استفسار واتساب' : 'WhatsApp inquiry'}
              />
              <ReportModal
                targetType="LISTING"
                targetId={listing.id}
                targetTitle={listing.title}
                token={token}
                triggerLabel={copy.report}
              />
            </div>

              <div className="detail-conversion-strip" aria-label={copy.reviewedByLux}>
                <article>
                  <ShieldCheck size={18} aria-hidden="true" />
                  <div>
                    <strong>{copy.reviewedByLux}</strong>
                    <span>{copy.reviewedByLuxText}</span>
                  </div>
                </article>

                <article>
                  <MoveRight size={18} aria-hidden="true" />
                  <div>
                    <strong>{copy.fastInquiry}</strong>
                    <span>{copy.fastInquiryText}</span>
                  </div>
                </article>

                <article>
                  <Sparkles size={18} aria-hidden="true" />
                  <div>
                    <strong>{copy.mediaConfidence}</strong>
                    <span>{copy.mediaConfidenceText}</span>
                  </div>
                </article>
              </div>

              <MediaQualityGuidance item={listing} itemType="listing" language={language} />

            <div className="details-highlight-strip">
              <span>
                <BedDouble size={17} aria-hidden="true" />
                {listing.beds} {copy.beds}
              </span>

              <span>
                <Bath size={17} aria-hidden="true" />
                {listing.baths} {copy.baths}
              </span>

              <span>
                <Ruler size={17} aria-hidden="true" />
                {listing.sqm} {copy.sqm}
              </span>

              {buyerEligibilityLabel ? (
                <span>
                  <ShieldCheck size={17} aria-hidden="true" />
                  {buyerEligibilityLabel}
                </span>
              ) : null}

              {listing.nearestLandmarkName ? (
                <span>
                  <MapPin size={17} aria-hidden="true" />
                  {copy.near} {listing.nearestLandmarkName}
                </span>
              ) : null}
            </div>

            {listing.transaction === 'Sale' ? (
              <section className="investor-eligibility-panel" aria-labelledby="listing-investor-title">
                <p className="eyebrow">lux.om investor note</p>
                <h2 id="listing-investor-title">{copy.investorReadiness}</h2>
                <strong>{buyerEligibilityLabel || copy.eligibilityNotSpecified}</strong>
                {listing.eligibilityNotes ? <p>{listing.eligibilityNotes}</p> : null}
                {listing.investorHighlights?.length ? (
                  <ul>
                    {listing.investorHighlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
                <InvestorWatchlistForm
                  listingId={listing.id}
                  listingTitle={listing.title}
                  token={token}
                  suggestedPrice={listing.priceAmount}
                  language={language}
                />

                <p className="trust-note">
                  {listing.eligibilityDisclaimer || copy.eligibilityDisclaimer}
                </p>
              </section>
            ) : null}

            {listing.developer ? (
              <section className="developer-detail-card" aria-labelledby="listing-developer-title">
                {listing.developer.logo ? (
                  <div className="developer-detail-card__logo">
                    <img
                      src={listing.developer.logo}
                      alt={`${listing.developer.name} logo`}
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className="developer-detail-card__content">
                  <p className="eyebrow">{copy.developmentCompany}</p>

                  <div className="developer-detail-card__title">
                    <h2 id="listing-developer-title">
                      {copy.developedBy} {listing.developer.name}
                    </h2>

                    {listing.developer.verified ? (
                      <span>
                        <ShieldCheck size={15} aria-hidden="true" />
                        {copy.verifiedDeveloper}
                      </span>
                    ) : null}
                  </div>

                  <p>{listing.developer.shortDescription}</p>

                  <div className="developer-detail-card__actions">
                    <Link
                      to={`/developers/${listing.developer.slug}`}
                      className="button-link button-link--soft"
                    >
                      {copy.viewCompanyProfile}
                      <MoveRight size={16} aria-hidden="true" />
                    </Link>

                    <Link
                      to={`/listings?developer=${listing.developer.slug}`}
                      className="text-link"
                    >
                      {copy.viewDeveloperListings}
                      <MoveRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </section>
            ) : listing.developerName ? (
              <section className="developer-detail-card" aria-labelledby="listing-developer-title">
                <div className="developer-detail-card__content">
                  <p className="eyebrow">{copy.developmentCompany}</p>

                  <div className="developer-detail-card__title">
                    <h2 id="listing-developer-title">
                      {copy.developedBy} {listing.developerName}
                    </h2>
                  </div>
                </div>
              </section>
            ) : null}

            <h2>{t.addListing.searchableSpecs}</h2>

            <div className="details-spec-grid">
              {specItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div className="details-spec-card" key={item.label}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                );
              })}
            </div>

            <h2>{t.listings.amenities}</h2>

            <ul className="amenity-list">
              {listing.amenities.map((amenity) => (
                <li key={amenity}>{amenity}</li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="booking-panel booking-panel--premium" aria-label={t.listings.summary}>
          <div>
            <span className="booking-panel__label">{listing.transaction}</span>
            <strong className="price">
                {formatMarketplacePrice({
                  price: listing.price,
                  priceAmount: listing.priceAmount,
                  priceCurrency: listing.priceCurrency,
                  priceQualifier: listing.priceQualifier,
                  priceUnit: listing.priceUnit,
                  language
                })}
              </strong>
          </div>

          <div className="listing-card__facts listing-card__facts--large">
            <span>
              <BedDouble size={18} aria-hidden="true" />
              {listing.beds} {copy.beds}
            </span>

            <span>
              <Bath size={18} aria-hidden="true" />
              {listing.baths} {copy.baths}
            </span>

            <span>
              <Ruler size={18} aria-hidden="true" />
              {listing.sqm} {copy.sqm}
            </span>
          </div>

          <div className="booking-panel-specs">
            <span>{listing.type}</span>
            {listing.view ? <span>{listing.view}</span> : null}
            {listing.furnishing ? <span>{listing.furnishing}</span> : null}
            {listing.transaction === 'Sale' ? (
              <span>
                {copy.buyerEligibility}: {buyerEligibilityLabel || copy.eligibilityNotSpecified}
              </span>
            ) : null}
            {listing.parkingSpaces ? <span>{copy.parking}</span> : null}
            {listing.nearestLandmarkName ? (
              <span>
                {copy.near} {listing.nearestLandmarkName}
              </span>
            ) : null}
            {listing.distanceFromLandmark ? <span>{listing.distanceFromLandmark}</span> : null}

{listing.minStayNights ? (
  <span>
    {copy.minStay}: {listing.minStayNights} {copy.nights}
  </span>
) : null}
          </div>

          {listing.developer ? (
            <Link
              to={`/developers/${listing.developer.slug}`}
              className="booking-panel-developer"
              aria-label={`${copy.viewCompanyProfile}: ${listing.developer.name}`}
            >
              {listing.developer.logo ? (
                <img
                  src={listing.developer.logo}
                  alt={`${listing.developer.name} logo`}
                  loading="lazy"
                />
              ) : null}

              <span>
                <small>{copy.developedBy}</small>
                <strong>
                  {listing.developer.name}
                  {listing.developer.verified ? <ShieldCheck size={14} aria-hidden="true" /> : null}
                </strong>
              </span>
            </Link>
          ) : listing.developerName ? (
            <div className="booking-panel-developer">
              <span>
                <small>{copy.developedBy}</small>
                <strong>{listing.developerName}</strong>
              </span>
            </div>
          ) : null}

            <div className="booking-panel-trust-note">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>{copy.safeNextStepText}</span>
            </div>

            <div className="booking-panel-actions">
              <ButtonLink to={`/contact?type=PROPERTY&listingId=${listing.id}`} isFullWidth>
                {copy.requestTour}
                <MoveRight size={16} aria-hidden="true" />
              </ButtonLink>

              <WhatsAppActions
                phone={listing.owner?.phone}
                title={listing.title}
                location={listing.location}
                label={language === 'ar' ? 'استفسار واتساب' : 'WhatsApp inquiry'}
              />

              <a className="button-link button-link--secondary button-link--full" href="#listing-reviews">
                {copy.compareReviews}
              </a>
            </div>

            <p>{t.listings.contactHint}</p>
        </aside>
      </section>

      <section className="container related-results-section" aria-labelledby="related-listings-title">
        <div className="related-results-header">
          <div>
            <p className="eyebrow">{copy.relatedEyebrow}</p>
            <h2 id="related-listings-title">{copy.relatedTitle}</h2>
            <p>{copy.relatedText}</p>
          </div>

          <ButtonLink to="/listings" variant="secondary">
            {copy.viewAllRelated}
            <MoveRight size={16} aria-hidden="true" />
          </ButtonLink>
        </div>

        {relatedLoading ? (
          <p className="related-results-status">{copy.relatedLoading}</p>
        ) : relatedListings.length > 0 ? (
          <div className="listing-grid related-results-grid">
            {relatedListings.map((relatedListing) => (
              <ListingCard key={relatedListing.id} listing={relatedListing} />
            ))}
          </div>
        ) : (
          <div className="related-results-empty">
            <Sparkles size={20} aria-hidden="true" />
            <p>{copy.noRelated}</p>
          </div>
        )}
      </section>

      <section className="container stage8-review-wrap" id="listing-reviews">
        <ReviewSection targetType="LISTING" targetId={listing.id} />
      </section>
    </article>
  );
}
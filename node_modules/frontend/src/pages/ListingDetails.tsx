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

import { getListingBySlug } from '../api/marketplace';
import ButtonLink from '../components/ButtonLink';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { Listing } from '../types';

export default function ListingDetails() {
  const { t, language } = useLanguage();
  const { slug } = useParams();

  const [listing, setListing] = useState<Listing | null>(null);
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
          parking: 'موقف',
          developmentCompany: 'شركة التطوير',
          developedBy: 'تم تطويره بواسطة',
          verifiedDeveloper: 'مطور موثق',
          viewCompanyProfile: 'عرض ملف الشركة',
          viewDeveloperListings: 'عرض عقارات هذا المطور',
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
          parking: 'parking',
          developmentCompany: 'Development company',
          developedBy: 'Developed by',
          verifiedDeveloper: 'Verified developer',
          viewCompanyProfile: 'View company profile',
          viewDeveloperListings: 'View properties by this developer',
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
      value: listing.maxGuests ? `${listing.maxGuests}` : t.common.any,
      icon: Users
    },
    {
      label: t.addListing.parkingSpaces,
      value: listing.parkingSpaces ? `${listing.parkingSpaces}` : t.common.any,
      icon: Car
    },
    {
      label: t.addListing.furnishing,
      value: listing.furnishing ?? 'Not specified',
      icon: Home
    },
    {
      label: t.addListing.view,
      value: listing.view ?? 'Not specified',
      icon: Sparkles
    },
    {
      label: t.addListing.paymentFrequency,
      value: listing.paymentFrequency ?? 'Not specified',
      icon: Building2
    }
  ];

  return (
    <article className="details-page">
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
          <div className="details-image-wrap">
            <img className="details-image" src={listing.image} alt={listing.title} />

            {listing.featured ? (
              <span className="details-image-badge">
                <Sparkles size={15} aria-hidden="true" />
                {copy.featured}
              </span>
            ) : null}
          </div>

          <div className="details-content">
            <div className="details-section-heading">
              <p className="eyebrow">{listing.type}</p>
              <h2>{t.listings.aboutProperty}</h2>
            </div>

            <p>{listing.description}</p>

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

              {listing.nearestLandmarkName ? (
                <span>
                  <MapPin size={17} aria-hidden="true" />
                  {copy.near} {listing.nearestLandmarkName}
                </span>
              ) : null}
            </div>

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
            <strong className="price">{listing.price}</strong>
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
            {listing.parkingSpaces ? (
              <span>
                {listing.parkingSpaces} {copy.parking}
              </span>
            ) : null}
            {listing.nearestLandmarkName ? (
              <span>
                {copy.near} {listing.nearestLandmarkName}
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
          ) : null}

          <ButtonLink to="/contact" isFullWidth>
            {t.common.requestDetails}
            <MoveRight size={16} aria-hidden="true" />
          </ButtonLink>

          <ButtonLink to="/contact" variant="secondary" isFullWidth>
            {t.common.contactOwner}
          </ButtonLink>

          <p>{t.listings.contactHint}</p>
        </aside>
      </section>
    </article>
  );
}
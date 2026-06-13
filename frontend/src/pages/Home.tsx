import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Crown,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  getActivities,
  getDevelopers,
  getLandmarks,
  getListings,
  getTravelAgencies
} from '../api/marketplace';
import ButtonLink from '../components/ButtonLink';
import { ActivityCard, ListingCard } from '../components/Cards';
import PartnerCard from '../components/PartnerCard';
import SectionHeader from '../components/SectionHeader';
import {
  buildDiscoveryPath,
  heroImages,
  homepageQuickSearches,
  marketplaceDiscoveryCategories,
  type DiscoveryCategoryValue
} from '../config/marketplace';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity, DevelopmentCompany, Landmark, Listing, TravelAgency } from '../types';

function prioritizeFeaturedItems<T extends { featured?: boolean }>(
  items: T[],
  limit = 3
): T[] {
  return [
    ...items.filter((item) => item.featured === true),
    ...items.filter((item) => item.featured !== true)
  ].slice(0, limit);
}

function prioritizePartners<
  T extends { featured?: boolean; verified?: boolean }
>(
  partners: T[],
  limit = 3
): T[] {
  return [
    ...partners.filter((partner) => partner.featured === true),
    ...partners.filter(
      (partner) => partner.featured !== true && partner.verified === true
    ),
    ...partners.filter(
      (partner) => partner.featured !== true && partner.verified !== true
    )
  ].slice(0, limit);
}

export default function Home() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  useDocumentTitle('Premium Oman marketplace');

  const [listings, setListings] = useState<Listing[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [developmentCompanies, setDevelopmentCompanies] = useState<DevelopmentCompany[]>([]);
  const [travelAgencies, setTravelAgencies] = useState<TravelAgency[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedLandmark, setSelectedLandmark] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DiscoveryCategoryValue>('all');

  const homepageListings = useMemo(
    () => prioritizeFeaturedItems(listings),
    [listings]
  );

  const homepageActivities = useMemo(
    () => prioritizeFeaturedItems(activities),
    [activities]
  );

  const homepageDevelopers = useMemo(
    () => prioritizePartners(developmentCompanies),
    [developmentCompanies]
  );

  const homepageTravelAgencies = useMemo(
    () => prioritizePartners(travelAgencies),
    [travelAgencies]
  );

  const localizedQuickSearches =
    language === 'ar'
      ? [
          { label: 'فلل على البحر', to: '/listings?near=mall-of-oman&type=Sale' },
          { label: 'إيجارات فاخرة', to: '/listings?type=Rent' },
          { label: 'أنشطة بحرية', to: '/activities?near=mall-of-oman' },
          { label: 'وكالات سفر موثقة', to: '/travel-agencies' }
        ]
      : [
          ...homepageQuickSearches.slice(0, 3),
          { label: 'Verified travel agencies', to: '/travel-agencies' }
        ];

  const localizedStats =
    language === 'ar'
      ? [
          { value: `${activities.length}+`, label: 'أنشطة مختارة' },
          { value: `${landmarks.length}`, label: 'معالم ومناطق مفهرسة' },
          { value: `${listings.length}+`, label: 'عقارات وإقامات مميزة' },
          {
            value: `${travelAgencies.filter((agency) => agency.verified).length}`,
            label: 'وكالات سفر موثقة'
          }
        ]
      : [
          { value: `${activities.length}+`, label: 'Curated activities' },
          { value: `${landmarks.length}`, label: 'Indexed landmarks' },
          { value: `${listings.length}+`, label: 'Premium properties' },
          {
            value: `${travelAgencies.filter((agency) => agency.verified).length}`,
            label: 'Verified travel agencies'
          }
        ];

  const localizedDiscoveryCategories =
    language === 'ar'
      ? [
          { value: 'all', label: 'كل شيء' },
          { value: 'Sale', label: 'عقارات للبيع' },
          { value: 'Rent', label: 'إيجارات' },
          { value: 'Short stay', label: 'إقامات قصيرة' },
          { value: 'activities', label: 'أنشطة' }
        ]
      : marketplaceDiscoveryCategories;

  const discoveryCopy =
    language === 'ar'
      ? {
          eyebrow: 'ابحث بالقرب من',
          title: 'اكتشف أفضل الأماكن حول أشهر المعالم والمناطق في عُمان.',
          description:
            'ابحث عن عقارات للبيع، إيجارات، إقامات قصيرة، وأنشطة بالقرب من أهم الوجهات والمناطق في عُمان.',
          landmarkLabel: 'المعلم أو المنطقة',
          categoryLabel: 'ماذا تبحث عنه؟',
          submit: 'استكشف القريب',
          properties: 'عقارات قريبة',
          activities: 'أنشطة قريبة',
          searchLabel: 'بحث الصفحة الرئيسية',
          popularSearches: 'عمليات بحث شائعة',
          heroGallery: 'إقامات وأنشطة مميزة في عُمان',
          owners: 'ملاك موثقون',
          oman: 'في أنحاء عُمان',
          curated: 'مجموعة مختارة',
          developersEyebrow: 'المطورون العقاريون',
          developersTitle: 'استكشف أبرز المطورين والمشاريع الجديدة في عُمان.',
          developersDescription:
            'تساعد lux.om المشترين والمستأجرين على اكتشاف العقارات المرتبطة بمطورين موثوقين ومجتمعات سكنية ومشاريع مميزة.',
          viewDevelopers: 'تصفح المطورين',
          verifiedDeveloper: 'مطور موثق',
developer: 'مطور',
featured: 'مميز',
headquarters: 'المقر',
phone: 'الهاتف',
email: 'البريد الإلكتروني',
website: 'الموقع الإلكتروني',
listedProperties: 'عقارات منشورة',
viewProfile: 'عرض ملف الشركة',
          agenciesEyebrow: 'شركاء الأنشطة',
          agenciesTitle: 'وكالات سفر موثقة تنظم تجارب عُمان المختارة.',
          agenciesDescription:
            'اكتشف منظمي الأنشطة والرحلات الذين يقدمون تجارب بحرية، صحراوية، ثقافية وفاخرة على lux.om.',
          viewAgencies: 'تصفح وكالات السفر',
          verifiedAgency: 'وكالة موثقة',
          agency: 'وكالة سفر',
          agencyActivities: 'أنشطة منشورة',
          viewAgency: 'عرض الوكالة',
          loading: 'جاري تحميل بيانات السوق...',
          error: 'تعذر تحميل بيانات الصفحة الرئيسية. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.'
        }
      : {
          eyebrow: 'Find places near',
          title: 'Search by Oman’s most important landmarks and lifestyle areas.',
          description:
            'Discover properties for sale, rentals, short stays, and activities near key destinations across Oman.',
          landmarkLabel: 'Landmark or area',
          categoryLabel: 'What are you looking for?',
          submit: 'Explore nearby',
          properties: 'properties nearby',
          activities: 'activities nearby',
          searchLabel: 'Homepage search',
          popularSearches: 'Popular searches',
          heroGallery: 'Featured Oman stays and activities',
          owners: 'Verified owners',
          oman: 'Across Oman',
          curated: 'Curated collection',
          developersEyebrow: 'Development companies',
          developersTitle: 'Explore leading developers and new projects in Oman.',
          developersDescription:
            'lux.om helps buyers and renters discover properties connected to trusted development companies, master communities, and premium project pipelines.',
          viewDevelopers: 'View developers',
          verifiedDeveloper: 'Verified developer',
developer: 'Developer',
featured: 'Featured',
headquarters: 'Headquarters',
phone: 'Phone',
email: 'Email',
website: 'Website',
listedProperties: 'listed properties',
viewProfile: 'View company profile',
          agenciesEyebrow: 'Activity operators',
          agenciesTitle: 'Trusted travel agencies organizing curated Oman experiences.',
          agenciesDescription:
            'Discover verified operators behind sea, desert, cultural, wellness, and luxury activities on lux.om.',
          viewAgencies: 'View travel agencies',
          verifiedAgency: 'Verified agency',
          agency: 'Travel agency',
          agencyActivities: 'published activities',
          viewAgency: 'View agency',
          loading: 'Loading marketplace data...',
          error: 'Could not load homepage data. Make sure the backend is running and try again.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadHomeData() {
      try {
        setLoading(true);
        setLoadError('');

        const [apiListings, apiActivities, apiDevelopers, apiTravelAgencies, apiLandmarks] =
          await Promise.all([
            getListings(language, { take: 100 }),
            getActivities(language, { take: 100 }),
            getDevelopers(language, { take: 100 }),
            getTravelAgencies(language, { take: 100 }),
            getLandmarks(language, { take: 100 })
          ]);

        if (!isMounted) return;

        setListings(apiListings);
        setActivities(apiActivities);
        setDevelopmentCompanies(apiDevelopers);
        setTravelAgencies(apiTravelAgencies);
        setLandmarks(apiLandmarks);

        if (!selectedLandmark && apiLandmarks[0]) {
          setSelectedLandmark(apiLandmarks[0].slug);
        }
      } catch (error) {
        if (!isMounted) return;

        console.error(error);
        setLoadError(discoveryCopy.error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadHomeData();

    return () => {
      isMounted = false;
    };
  }, [language, discoveryCopy.error, selectedLandmark]);

  const discoveryPreview = useMemo(() => {
    const landmark = landmarks.find((item) => item.slug === selectedLandmark);

    if (!landmark) {
      return {
        landmarkName: '',
        properties: 0,
        activities: 0
      };
    }

    const propertiesCount = listings.filter(
      (listing) => listing.nearestLandmarkId === landmark.id
    ).length;

    const activitiesCount = activities.filter(
      (activity) => activity.nearestLandmarkId === landmark.id
    ).length;

    return {
      landmarkName: landmark.name,
      properties: propertiesCount,
      activities: activitiesCount
    };
  }, [activities, landmarks, listings, selectedLandmark]);

  function handleDiscoverySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLandmark) return;

    navigate(buildDiscoveryPath(selectedLandmark, selectedCategory));
  }

  return (
    <>
      <section className="lux-hero">
        <div className="container lux-hero__grid">
          <div className="lux-hero__content">
            <div className="lux-hero__badge">
              <Crown size={16} aria-hidden="true" />
              <span>{t.home.eyebrow}</span>
            </div>

            <h1>{t.home.title}</h1>

            <p className="lux-hero__lead">{t.home.description}</p>

            <div className="lux-hero__actions">
              <ButtonLink to="/listings">
                {t.common.exploreListings}
                <ArrowRight size={17} aria-hidden="true" />
              </ButtonLink>

              <ButtonLink to="/activities" variant="secondary">
                {t.common.viewActivities}
              </ButtonLink>
            </div>

            <div className="lux-search-console" role="search" aria-label={discoveryCopy.searchLabel}>
              <div className="lux-search-console__main">
                <Search size={20} aria-hidden="true" />
                <span>{t.home.searchPlaceholder}</span>
              </div>

              <Link to="/listings" aria-label={t.common.exploreListings}>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>

            <div className="lux-chip-row" aria-label={discoveryCopy.popularSearches}>
              {localizedQuickSearches.map((item) => (
                <Link key={item.label} to={item.to}>
                  <Sparkles size={14} aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="lux-hero-collage" aria-label={discoveryCopy.heroGallery}>
            <div className="lux-hero-collage__main">
              <img src={heroImages[0].src} alt={heroImages[0].alt} />
              <div className="lux-hero-collage__overlay">
                <span>{t.home.verified}</span>
                <strong>{t.home.verifiedText}</strong>
              </div>
            </div>

            <div className="lux-hero-collage__side lux-hero-collage__side--top">
              <img src={heroImages[1].src} alt={heroImages[1].alt} />
            </div>

            <div className="lux-hero-collage__side lux-hero-collage__side--bottom">
              <img src={heroImages[2].src} alt={heroImages[2].alt} />
            </div>

            <div className="lux-floating-proof lux-floating-proof--one">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>{discoveryCopy.owners}</span>
            </div>

            <div className="lux-floating-proof lux-floating-proof--two">
              <MapPin size={18} aria-hidden="true" />
              <span>{discoveryCopy.oman}</span>
            </div>

            <div className="lux-floating-rating">
              <Star size={16} aria-hidden="true" />
              <span>{discoveryCopy.curated}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lux-stats-wrap">
        <div className="container lux-stats-grid">
          {localizedStats.map((item) => (
            <div key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {loading ? (
        <section className="page-section container">
          <div className="empty-state empty-state--premium">
            <Sparkles size={34} aria-hidden="true" />
            <h2>{discoveryCopy.loading}</h2>
          </div>
        </section>
      ) : null}

      {!loading && loadError ? (
        <section className="page-section container">
          <div className="empty-state empty-state--premium">
            <Sparkles size={34} aria-hidden="true" />
            <h2>{loadError}</h2>
          </div>
        </section>
      ) : null}

      {!loading && !loadError ? (
        <>
          <section className="page-section container">
            <div className="landmark-discovery-panel">
              <div>
                <p className="eyebrow">{discoveryCopy.eyebrow}</p>
                <h2>{discoveryCopy.title}</h2>
                <p>{discoveryCopy.description}</p>
              </div>

              <form className="landmark-discovery-form" onSubmit={handleDiscoverySearch}>
                <label htmlFor="homepage-landmark">
                  {discoveryCopy.landmarkLabel}
                  <select
                    id="homepage-landmark"
                    name="landmark"
                    value={selectedLandmark}
                    onChange={(event) => setSelectedLandmark(event.target.value)}
                  >
                    {landmarks.map((landmark) => (
                      <option key={landmark.id} value={landmark.slug}>
                        {landmark.name} · {landmark.city}
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor="homepage-discovery-category">
                  {discoveryCopy.categoryLabel}
                  <select
                    id="homepage-discovery-category"
                    name="discoveryCategory"
                    value={selectedCategory}
                    onChange={(event) =>
                      setSelectedCategory(event.target.value as DiscoveryCategoryValue)
                    }
                  >
                    {localizedDiscoveryCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button className="button-link button-link--primary" type="submit">
                  {discoveryCopy.submit}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>

                <div className="landmark-discovery-summary" aria-live="polite">
                  <span>
                    <strong>{discoveryPreview.properties}</strong>
                    {discoveryCopy.properties}
                  </span>
                  <span>
                    <strong>{discoveryPreview.activities}</strong>
                    {discoveryCopy.activities}
                  </span>
                </div>
              </form>
            </div>
          </section>

          {homepageListings.length > 0 ? (
            <section className="page-section container home-section home-section--featured">
              <SectionHeader
                eyebrow={t.home.featuredHomesEyebrow}
                title={t.home.featuredHomesTitle}
                description={t.home.featuredHomesDescription}
                actions={
                  <ButtonLink to="/listings" variant="soft">
                    {t.common.exploreListings}
                    <ArrowRight size={16} aria-hidden="true" />
                  </ButtonLink>
                }
              />

              <div className="listing-grid listing-grid--featured lux-featured-grid">
                {homepageListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} variant="featured" />
                ))}
              </div>
            </section>
          ) : null}

          {homepageDevelopers.length > 0 ? (
            <section className="page-section container home-section home-section--partners">
              <SectionHeader
                eyebrow={discoveryCopy.developersEyebrow}
                title={discoveryCopy.developersTitle}
                description={discoveryCopy.developersDescription}
                actions={
                  <ButtonLink to="/developers" variant="soft">
                    {discoveryCopy.viewDevelopers}
                    <ArrowRight size={16} aria-hidden="true" />
                  </ButtonLink>
                }
              />

              <div className="travel-agency-grid home-partner-grid">
                {homepageDevelopers.map((developer) => (
                  <PartnerCard
                    key={developer.id}
                    href={`/developers/${developer.slug}`}
                    name={developer.name}
                    image={developer.logo}
                    description={developer.description}
                    headquarters={developer.headquarters || developer.location}
                    phone={developer.phone}
                    email={developer.email}
                    website={developer.website}
                    verified={developer.verified}
                    featured={developer.featured}
                    labels={{
                      verified: discoveryCopy.verifiedDeveloper,
                      featured: discoveryCopy.featured,
                      headquarters: discoveryCopy.headquarters,
                      phone: discoveryCopy.phone,
                      email: discoveryCopy.email,
                      website: discoveryCopy.website,
                      view: discoveryCopy.viewProfile
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {homepageTravelAgencies.length > 0 ? (
            <section className="page-section container home-section home-section--partners home-section--partners-alt">
              <SectionHeader
                eyebrow={discoveryCopy.agenciesEyebrow}
                title={discoveryCopy.agenciesTitle}
                description={discoveryCopy.agenciesDescription}
                actions={
                  <ButtonLink to="/travel-agencies" variant="soft">
                    {discoveryCopy.viewAgencies}
                    <ArrowRight size={16} aria-hidden="true" />
                  </ButtonLink>
                }
              />

              <div className="travel-agency-grid home-partner-grid">
                {homepageTravelAgencies.map((agency) => (
                  <PartnerCard
                    key={agency.id}
                    href={`/travel-agencies/${agency.slug}`}
                    name={agency.name}
                    image={agency.logo}
                    description={agency.description}
                    headquarters={agency.headquarters || agency.location}
                    phone={agency.phone}
                    email={agency.email}
                    website={agency.website}
                    verified={agency.verified}
                    featured={agency.featured}
                    labels={{
                      verified: discoveryCopy.verifiedAgency,
                      featured: discoveryCopy.featured,
                      headquarters: discoveryCopy.headquarters,
                      phone: discoveryCopy.phone,
                      email: discoveryCopy.email,
                      website: discoveryCopy.website,
                      view: discoveryCopy.viewAgency
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="lux-trust-section">
            <div className="container">
              <SectionHeader
                eyebrow={t.home.whyEyebrow}
                title={t.home.whyTitle}
                align="center"
              />

              <div className="benefit-grid lux-benefit-grid">
                {t.home.benefits.map((item, index) => (
                  <article
                    className="benefit-card lux-benefit-card home-benefit-card"
                    key={item}
                  >
                    {index === 0 ? (
                      <ShieldCheck aria-hidden="true" />
                    ) : index === 1 ? (
                      <CalendarDays aria-hidden="true" />
                    ) : index === 2 ? (
                      <Sparkles aria-hidden="true" />
                    ) : (
                      <CheckCircle2 aria-hidden="true" />
                    )}
                    <h3>{item}</h3>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {homepageActivities.length > 0 ? (
            <section className="page-section container home-section home-section--activities">
              <SectionHeader
                eyebrow={t.home.activitiesEyebrow}
                title={t.home.activitiesTitle}
                description={t.home.activitiesDescription}
                actions={
                  <ButtonLink to="/activities" variant="soft">
                    {t.common.viewActivities}
                    <ArrowRight size={16} aria-hidden="true" />
                  </ButtonLink>
                }
              />

              <div className="activity-grid lux-activity-row">
                {homepageActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} variant="featured" />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
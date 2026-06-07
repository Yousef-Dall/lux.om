import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Crown,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ButtonLink from '../components/ButtonLink';
import { ActivityCard, ListingCard } from '../components/Cards';
import SectionHeader from '../components/SectionHeader';
import {
  buildDiscoveryPath,
  heroImages,
  homepageQuickSearches,
  marketplaceDiscoveryCategories,
  type DiscoveryCategoryValue
} from '../config/marketplace';
import { activities, developmentCompanies, landmarks, listings, stats } from '../data/mockData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

export default function Home() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  useDocumentTitle('Premium Oman marketplace');

  const [selectedLandmark, setSelectedLandmark] = useState(landmarks[0]?.slug ?? '');
  const [selectedCategory, setSelectedCategory] = useState<DiscoveryCategoryValue>('all');

  const featuredListings = listings.filter((listing) => listing.featured);
  const featuredActivities = activities.filter((activity) => activity.featured).slice(0, 3);
  const featuredDevelopers = developmentCompanies
    .filter((developer) => developer.featured)
    .slice(0, 3);

  const localizedQuickSearches =
    language === 'ar'
      ? [
          { label: 'فلل على البحر', to: '/listings?near=al-mouj-muscat&type=Sale' },
          { label: 'شاليهات نهاية الأسبوع', to: '/listings?near=jebel-sifah&type=Short%20stay' },
          { label: 'أنشطة قرب مطرح', to: '/activities?near=mutrah-corniche' },
          { label: 'مشاريع جديدة', to: '/developers' }
        ]
      : homepageQuickSearches;

  const localizedStats =
    language === 'ar'
      ? [
          { value: '+8', label: 'أنشطة مختارة' },
          { value: '16', label: 'معالم ومناطق مفهرسة' },
          { value: '+6', label: 'عقارات وإقامات مميزة' },
          { value: '4', label: 'شركاء موثقون' }
        ]
      : stats;

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
            'ابحث عن عقارات للبيع، إيجارات، إقامات قصيرة، وأنشطة بالقرب من وجهات مثل مول عُمان، الموج، مسقط هيلز، كورنيش مطرح، وجبل السيفة.',
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
          listedProperties: 'عقارات منشورة',
          viewProfile: 'عرض ملف الشركة'
        }
      : {
          eyebrow: 'Find places near',
          title: 'Search by Oman’s most important landmarks and lifestyle areas.',
          description:
            'Discover properties for sale, rentals, short stays, and activities near key destinations like Mall of Oman, Al Mouj, Muscat Hills, Mutrah Corniche, and Jebel Sifah.',
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
          listedProperties: 'listed properties',
          viewProfile: 'View company profile'
        };

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
  }, [selectedLandmark]);

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

      <section className="page-section container">
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
          {featuredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} variant="featured" />
          ))}
        </div>
      </section>

      <section className="page-section container">
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

        <div className="developer-preview-grid">
          {featuredDevelopers.map((developer) => (
            <article className="developer-preview-card" key={developer.id}>
              <img src={developer.logo} alt={`${developer.name} logo`} loading="lazy" />

              <div>
                <span className="developer-preview-card__badge">
                  <ShieldCheck size={14} aria-hidden="true" />
                  {developer.verified ? discoveryCopy.verifiedDeveloper : discoveryCopy.developer}
                </span>

                <h3>{developer.name}</h3>
                <p>{developer.description}</p>

                <div className="developer-preview-card__meta">
                  <span>
                    <Building2 size={15} aria-hidden="true" />
                    {developer.listedPropertyIds.length} {discoveryCopy.listedProperties}
                  </span>
                  <span>
                    <MapPin size={15} aria-hidden="true" />
                    {developer.headquarters}
                  </span>
                </div>

                <Link to={`/developers/${developer.slug}`} className="text-link">
                  {discoveryCopy.viewProfile}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lux-trust-section">
        <div className="container">
          <SectionHeader eyebrow={t.home.whyEyebrow} title={t.home.whyTitle} align="center" />

          <div className="benefit-grid lux-benefit-grid">
            {t.home.benefits.map((item, index) => (
              <article className="benefit-card lux-benefit-card" key={item}>
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

      <section className="page-section container">
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
          {featuredActivities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} variant="featured" />
          ))}
        </div>
      </section>
    </>
  );
}
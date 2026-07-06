import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Compass,
  Crown,
  Handshake,
  Home as HomeIcon,
  MapPin,
  PlaneTakeoff,
  Search,
  ShieldCheck,
  Sparkles,
  Star
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
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
import { getRoleAwareHomeReadinessPanel } from '../utils/roleBasedUi';
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
  const { isAuthenticated, user } = useAuth();
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
  const [heroSmartSearch, setHeroSmartSearch] = useState('');

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
          { label: 'مشاريع جديدة موثوقة', to: '/developers' },
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
            value: `${[...developmentCompanies, ...travelAgencies].filter((partner) => partner.verified).length}`,
            label: 'شركاء موثقون'
          }
        ]
      : [
          { value: `${activities.length}+`, label: 'Curated activities' },
          { value: `${landmarks.length}`, label: 'Indexed landmarks' },
          { value: `${listings.length}+`, label: 'Premium properties' },
          {
            value: `${[...developmentCompanies, ...travelAgencies].filter((partner) => partner.verified).length}`,
            label: 'Verified partners'
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
          smartSearchPlaceholder: 'مثال: فلل قابلة للشراء للأجانب في الموج تحت 300 ألف',
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
          listedProperties: 'عناصر منشورة',
          established: 'منذ',
          contactReady: 'تواصل مباشر',
          viewProfile: 'عرض ملف الشركة',
          launchEyebrow: 'تجربة سوق واحدة',
          launchTitle: 'كل مسار في lux.om مصمم ليصل المستخدم إلى قرار أسرع.',
          launchDescription:
            'الصفحة الرئيسية تربط بين العقارات، الأنشطة، المطورين، وكالات السفر، والثقة التشغيلية حتى لا يشعر المستخدم أن كل قسم منفصل عن الآخر.',
          trustEyebrow: 'الثقة قبل التحويل',
          trustTitle: 'إشارات تشغيلية واضحة قبل أن يرسل العميل طلبه.',
          trustDescription:
            'نعرض التحقق، جودة الوسائط، جاهزية الأسعار، ومعلومات الشريك في أماكن مبكرة حتى يكون القرار أوضح قبل الحجز أو التواصل.',
          sellerEyebrow: 'للملاك والشركاء',
          sellerTitle: 'إرشادات جاهزية قبل المراجعة الإدارية.',
          sellerDescription:
            'نماذج الإضافة توضّح للملاك والشركاء ما الذي يقوي فرص الموافقة: السعر، الصور، الموقع، التحقق، تفاصيل النشاط، أو وثائق المشروع.',
          startListing: 'أضف عقاراً',
          startActivity: 'أضف نشاطاً',
          startProject: 'أضف مشروعاً',
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
          smartSearchPlaceholder: 'Try: expat-buyable villas in Al Mouj under 300k',
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
          listedProperties: 'published items',
          established: 'Established',
          contactReady: 'Direct contact ready',
          viewProfile: 'View company profile',
          launchEyebrow: 'One marketplace journey',
          launchTitle: 'Every lux.om path is designed to move users toward a confident decision.',
          launchDescription:
            'The homepage connects properties, activities, developers, travel agencies, and operational trust so the marketplace feels like one launch-ready product instead of separate directories.',
          trustEyebrow: 'Trust before conversion',
          trustTitle: 'Operational signals appear before the customer sends an inquiry or booking request.',
          trustDescription:
            'Verification, media quality, pricing readiness, and partner context are surfaced early so customers understand why an item is credible.',
          sellerEyebrow: 'For owners and partners',
          sellerTitle: 'Submission readiness guidance before admin review.',
          sellerDescription:
            'Creation flows now show owners and partners what strengthens approval: pricing, images, location, verification, activity schedule, package documents, or project inventory.',
          startListing: 'Add a listing',
          startActivity: 'Add an activity',
          startProject: 'Add a project',
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

  const marketplacePathCards =
    language === 'ar'
      ? [
          {
            title: 'عقارات للبيع والإيجار',
            description: 'فلل، شقق، إقامات قصيرة، وفرص قابلة للشراء من الأجانب مع إشارات التحقق والوسائط.',
            metric: `${listings.length}+`,
            label: 'عقار ظاهر',
            to: '/listings',
            icon: HomeIcon
          },
          {
            title: 'أنشطة وباقات سفر',
            description: 'تجارب داخل عُمان وباقات خارجية مع مواعيد، سعة، خدمات مشمولة، ومسار حجز واضح.',
            metric: `${activities.length}+`,
            label: 'نشاط وباقة',
            to: '/activities',
            icon: PlaneTakeoff
          },
          {
            title: 'مطوّرون ومشاريع جديدة',
            description: 'ملفات مطورين موثقة، مشاريع، وحدات مرتبطة، وخطوات ثقة تساعد المشترين على المقارنة.',
            metric: `${developmentCompanies.length}+`,
            label: 'مشروع ومطور',
            to: '/projects',
            icon: Building2
          },
          {
            title: 'وكالات سفر موثقة',
            description: 'منظمون موثوقون خلف التجارب والرحلات مع بيانات تواصل وسجل نشاط واضح.',
            metric: `${travelAgencies.length}`,
            label: 'وكالة',
            to: '/travel-agencies',
            icon: Compass
          }
        ]
      : [
          {
            title: 'Properties for sale, rent, and short stay',
            description: 'Villas, apartments, short stays, and foreign-buyer-ready opportunities with trust and media signals.',
            metric: `${listings.length}+`,
            label: 'visible properties',
            to: '/listings',
            icon: HomeIcon
          },
          {
            title: 'Activities and travel packages',
            description: 'Inside-Oman experiences and outbound packages with dates, capacity, inclusions, and a clear booking path.',
            metric: `${activities.length}+`,
            label: 'activities and packages',
            to: '/activities',
            icon: PlaneTakeoff
          },
          {
            title: 'Developers and new projects',
            description: 'Verified developer profiles, projects, linked units, and trust context for buyer comparison.',
            metric: `${developmentCompanies.length}+`,
            label: 'projects and developers',
            to: '/projects',
            icon: Building2
          },
          {
            title: 'Trusted travel agencies',
            description: 'Operators behind curated trips and experiences with direct contact details and activity history.',
            metric: `${travelAgencies.length}`,
            label: 'agencies',
            to: '/travel-agencies',
            icon: Compass
          }
        ];

  const trustOperations =
    language === 'ar'
      ? [
          {
            title: 'تحقق من الحسابات والمزودين',
            description: 'إشارات التحقق تظهر على العقارات، الأنشطة، المطورين، والوكالات حيثما كانت متاحة.',
            icon: BadgeCheck
          },
          {
            title: 'جودة وسائط قبل النشر المميز',
            description: 'الصور، الفيديو، الجولة، المخطط، والبروشور تساعد المستخدم على تقييم العرض أسرع.',
            icon: Sparkles
          },
          {
            title: 'مراجعة إدارية قابلة للتتبع',
            description: 'لوحات الإدارة تجمع الموافقات، جودة الوسائط، البلاغات، والإشعارات في مسارات واضحة.',
            icon: ShieldCheck
          },
          {
            title: 'حجز أو تواصل بخطوة واضحة',
            description: 'كل صفحة عامة تقود إلى طلب حجز، واتساب، استفسار، أو ملف شريك حسب نوع المحتوى.',
            icon: Handshake
          }
        ]
      : [
          {
            title: 'Verified accounts and providers',
            description: 'Verification signals appear across listings, activities, developers, and agencies where available.',
            icon: BadgeCheck
          },
          {
            title: 'Media quality before premium placement',
            description: 'Images, video, tours, floor plans, masterplans, and brochures help users evaluate faster.',
            icon: Sparkles
          },
          {
            title: 'Traceable admin review',
            description: 'Admin workspaces connect approvals, media quality, reports, and notifications into clear operations.',
            icon: ShieldCheck
          },
          {
            title: 'Clear booking or contact path',
            description: 'Every public detail page leads to booking, WhatsApp, inquiry, or partner profile depending on the content.',
            icon: Handshake
          }
        ];

  const roleAwareReadinessPanel = getRoleAwareHomeReadinessPanel(
    user?.role,
    language,
    isAuthenticated
  );

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

  function handleHeroSmartSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = heroSmartSearch.trim();

    if (!query) {
      navigate('/listings');
      return;
    }

    navigate(`/listings?q=${encodeURIComponent(query)}&smart=1`);
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

            <form
              className="lux-search-console"
              role="search"
              aria-label={discoveryCopy.searchLabel}
              onSubmit={handleHeroSmartSearch}
            >
              <label className="lux-search-console__main">
                <Search size={20} aria-hidden="true" />
                <span className="sr-only">{t.home.searchPlaceholder}</span>
                <input
                  value={heroSmartSearch}
                  placeholder={discoveryCopy.smartSearchPlaceholder}
                  onChange={(event) => setHeroSmartSearch(event.target.value)}
                />
              </label>

              <button type="submit" aria-label={t.common.exploreListings}>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </form>

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

      <section className="page-section container home-section home-section--marketplace-paths">
        <SectionHeader
          eyebrow={discoveryCopy.launchEyebrow}
          title={discoveryCopy.launchTitle}
          description={discoveryCopy.launchDescription}
          align="center"
        />

        <div className="home-path-grid">
          {marketplacePathCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link className="home-path-card" key={card.title} to={card.to}>
                <span className="home-path-card__icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className="home-path-card__metric">
                  <strong>{card.metric}</strong>
                  <small>{card.label}</small>
                </span>
                <span className="home-path-card__copy">
                  <strong>{card.title}</strong>
                  <small>{card.description}</small>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            );
          })}
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

          <section className="page-section container home-section home-section--trust-depth">
            <SectionHeader
              eyebrow={discoveryCopy.trustEyebrow}
              title={discoveryCopy.trustTitle}
              description={discoveryCopy.trustDescription}
              align="center"
            />

            <div className="home-trust-grid">
              {trustOperations.map((item) => {
                const Icon = item.icon;

                return (
                  <article className="home-trust-card" key={item.title}>
                    <span>
                      <Icon size={21} aria-hidden="true" />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                );
              })}
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
                    verificationStatus={developer.verificationStatus}
                    verificationSource={developer.verificationSource}
                    verificationDate={developer.verificationDate}
                    verificationExpiryDate={developer.verificationExpiryDate}
                    establishedYear={developer.establishedYear}
                    publicItemCount={
                      (developer.listingCount ?? developer.listedPropertyIds.length) +
                      (developer.projectCount ?? developer.featuredProjectIds.length)
                    }
                    labels={{
                      verified: discoveryCopy.verifiedDeveloper,
                      featured: discoveryCopy.featured,
                      headquarters: discoveryCopy.headquarters,
                      phone: discoveryCopy.phone,
                      email: discoveryCopy.email,
                      website: discoveryCopy.website,
                      view: discoveryCopy.viewProfile,
                      publicItems: discoveryCopy.listedProperties,
                      established: discoveryCopy.established,
                      contactReady: discoveryCopy.contactReady
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
                    verificationStatus={agency.verificationStatus}
                    verificationSource={agency.verificationSource}
                    verificationDate={agency.verificationDate}
                    verificationExpiryDate={agency.verificationExpiryDate}
                    establishedYear={agency.establishedYear}
                    publicItemCount={agency.activityCount ?? agency.activityIds.length}
                    labels={{
                      verified: discoveryCopy.verifiedAgency,
                      featured: discoveryCopy.featured,
                      headquarters: discoveryCopy.headquarters,
                      phone: discoveryCopy.phone,
                      email: discoveryCopy.email,
                      website: discoveryCopy.website,
                      view: discoveryCopy.viewAgency,
                      publicItems: discoveryCopy.agencyActivities,
                      established: discoveryCopy.established,
                      contactReady: discoveryCopy.contactReady
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

          <section className="page-section container home-section home-section--submit-ready">
            <div className="home-submit-ready home-submit-ready--role-aware">
              <div>
                <p className="eyebrow">{roleAwareReadinessPanel.eyebrow}</p>
                <h2>{roleAwareReadinessPanel.title}</h2>
                <p>{roleAwareReadinessPanel.description}</p>

                <div className="home-submit-ready__actions">
                  {roleAwareReadinessPanel.actions.map((action) => (
                    <ButtonLink
                      key={action.key}
                      to={action.to}
                      variant={action.intent === 'primary' ? 'secondary' : 'soft'}
                    >
                      {action.label}
                    </ButtonLink>
                  ))}
                </div>
              </div>

              <div className="home-submit-ready__checklist">
                {roleAwareReadinessPanel.checklist.map((step) => (
                  <span key={step}>
                    <CheckCircle2 size={17} aria-hidden="true" />
                    {step}
                  </span>
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
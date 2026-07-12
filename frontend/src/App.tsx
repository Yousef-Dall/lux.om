import { Component, type ErrorInfo, type ReactNode, Suspense, lazy, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import Footer from './components/Footer';
import AdminWorkspaceNav from './components/AdminWorkspaceNav';
import AuthenticatedProductNav from './components/AuthenticatedProductNav';
import CrmShell from './features/crm/shell/CrmShell';
import {
  CrmIndexRedirect,
  CrmLegacyLeadRedirect,
  CrmLegacyOperationsRedirect
} from './features/crm/shell/CrmCompatibilityRedirects';
import PmsShell from './features/pms/shell/PmsShell';
import {
  PmsIndexRedirect,
  PmsLegacyLeaseRedirect,
  PmsLegacyPropertyRedirect,
  PmsLegacyRedirect
} from './features/pms/shell/PmsCompatibilityRedirects';
import Navbar from './components/Navbar';

import About from './pages/About';
import Activities from './pages/Activities';
import ActivityDetails from './pages/ActivityDetails';
import Contact from './pages/Contact';
import CancellationPolicy from './pages/CancellationPolicy';
import Privacy from './pages/Privacy';
import RefundPolicy from './pages/RefundPolicy';
import Terms from './pages/Terms';
import TrustSafety from './pages/TrustSafety';
import VerificationPolicy from './pages/VerificationPolicy';
import DeveloperDetails from './pages/DeveloperDetails';
import Developers from './pages/Developers';
import Home from './pages/Home';
import ListingDetails from './pages/ListingDetails';
import MarketInsights from './pages/MarketInsights';
import MapDiscovery from './pages/MapDiscovery';
import Listings from './pages/Listings';
import Projects from './pages/Projects';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import TravelAgencies from './pages/TravelAgencies';
import TravelAgencyDetails from './pages/TravelAgencyDetails';

import { useLanguage } from './i18n/LanguageContext';


const AddActivity = lazy(() => import('./pages/AddActivity'));
const AddListing = lazy(() => import('./pages/AddListing'));
const AddProject = lazy(() => import('./pages/AddProject'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminPmsAccess = lazy(() => import('./pages/AdminPmsAccess'));
const AdminEmailDeliveries = lazy(() => import('./pages/AdminEmailDeliveries'));
const AdminTrustReports = lazy(() => import('./pages/AdminTrustReports'));
const PmsPortal = lazy(() => import('./pages/PmsPortal'));
const TenantPortal = lazy(() => import('./pages/TenantPortal'));
const OwnerPortal = lazy(() => import('./pages/OwnerPortal'));
const VendorPortal = lazy(() => import('./pages/VendorPortal'));
const PmsFinancialOperations = lazy(() => import('./pages/PmsFinancialOperations'));
const PmsAssetsInspections = lazy(() => import('./pages/PmsAssetsInspections'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Crm = lazy(() => import('./pages/Crm'));
const CrmOperations = lazy(() => import('./pages/CrmOperations'));
const DeveloperProjectDetails = lazy(() => import('./pages/DeveloperProjectDetails'));
const Profile = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const GoogleAuthCallback = lazy(() => import('./pages/GoogleAuthCallback'));

function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span>Loading lux.om…</span>
    </div>
  );
}

type RouteErrorBoundaryProps = {
  children: ReactNode;
  language: 'en' | 'ar';
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[lux.om] Route render failed', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const copy =
      this.props.language === 'ar'
        ? {
            eyebrow: 'تعذر تحميل الصفحة',
            title: 'حدث خطأ في هذه المساحة',
            text: 'يمكنك تحديث الصفحة أو العودة للرئيسية. تم عزل الخطأ حتى لا يتعطل باقي الموقع.',
            reload: 'تحديث الصفحة',
            home: 'العودة للرئيسية'
          }
        : {
            eyebrow: 'Page failed to load',
            title: 'Something went wrong in this workspace',
            text: 'Refresh the page or return home. The failure is isolated so the rest of lux.om can keep working.',
            reload: 'Refresh page',
            home: 'Back to home'
          };

    return (
      <section className="page-section container not-found route-error-boundary" role="alert" aria-labelledby="route-error-title">
        <div className="not-found__panel">
          <span className="not-found__code" aria-hidden="true">!</span>
          <div className="not-found__content">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 id="route-error-title">{copy.title}</h1>
            <p>{copy.text}</p>
            <div className="not-found__actions">
              <button className="button-link button-link--primary" type="button" onClick={() => window.location.reload()}>
                {copy.reload}
              </button>
              <Link className="button-link button-link--secondary" to="/">
                {copy.home}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }
}

const SITE_ORIGIN = 'https://lux.om';

const seoCopy = {
  en: {
    home: {
      title: 'lux.om | Premium homes, stays, developments, and experiences in Oman',
      description:
        'Discover premium villas, apartments, short-stay chalets, new developments, travel agencies, and curated experiences across Oman.'
    },
    listings: {
      title: 'Premium properties in Oman | lux.om',
      description:
        'Explore villas, apartments, chalets, short stays, rentals, and properties for sale across Oman.'
    },
    activities: {
      title: 'Curated activities and travel packages in Oman | lux.om',
      description:
        'Book premium Oman activities, local experiences, and selected outbound travel packages from trusted providers.'
    },
    marketInsights: {
      title: 'Oman market insights | lux.om',
      description: 'Explore Oman real estate market signals based on approved lux.om listings and conservative comparable data.'
    },
    map: {
      title: 'Oman property and project map | lux.om',
      description: 'Explore approved lux.om properties and developer projects pinned by Google Maps coordinates across Oman.'
    },
    projects: {
      title: 'Oman property projects and developments | lux.om',
      description:
        'Explore approved developer projects, masterplans, unit inventory, media, and project details across Oman.'
    },
    developers: {
      title: 'Oman real estate developers | lux.om',
      description:
        'Discover trusted real estate developers and premium residential or mixed-use projects across Oman.'
    },
    travelAgencies: {
      title: 'Premium travel agencies in Oman | lux.om',
      description:
        'Find trusted travel agencies offering curated trips, experiences, and holiday packages from Oman.'
    },
    about: {
      title: 'About lux.om | Premium Oman marketplace',
      description:
        'Learn about lux.om, a premium marketplace for Oman properties, stays, developments, travel agencies, and curated experiences.'
    },
    contact: {
      title: 'Contact lux.om',
      description:
        'Contact lux.om for property, activity, development, partnership, and marketplace support.'
    },
    terms: {
      title: 'Terms of Use | lux.om',
      description:
        'Review the lux.om marketplace terms for users, providers, owners, developers, travel agencies, bookings, and platform responsibilities.'
    },
    privacy: {
      title: 'Privacy Policy | lux.om',
      description:
        'Learn how lux.om handles account, marketplace, booking, verification, trust, and operational data.'
    },
    trustSafety: {
      title: 'Trust & Safety | lux.om',
      description:
        'Learn how lux.om reviews reports, verification concerns, unsafe content, and marketplace abuse.'
    },
    cancellationPolicy: {
      title: 'Cancellation Policy | lux.om',
      description:
        'Understand how cancellation requests are handled across property stays, activities, and travel packages on lux.om.'
    },
    refundPolicy: {
      title: 'Refund Policy | lux.om',
      description:
        'Understand how refund requests are reviewed for marketplace bookings and paid activity or travel transactions.'
    },
    verificationPolicy: {
      title: 'Verification Policy | lux.om',
      description:
        'Learn how lux.om reviews verification requests, trust badges, provider snapshots, and verification concerns.'
    },
    dashboard: {
      title: 'Dashboard | lux.om',
      description: 'Manage your lux.om bookings, listings, activities, notifications, and account.'
    },
    crm: {
      title: 'CRM | lux.om',
      description: 'Manage private marketplace and PMS leads, relationships, tasks, and follow-up.'
    },
    admin: {
      title: 'Admin | lux.om',
      description: 'Manage lux.om marketplace publishing, bookings, finance, partners, and inquiries.'
    },
    pms: {
      title: 'lux PMS | Property Management System',
      description: 'Private lux.om Property Management System portal for entitled property companies and managers.'
    },
    tenant: {
      title: 'Tenant portal | lux.om',
      description: 'Secure tenant portal for lease, rent, maintenance, documents, and contact details.'
    },
    ownerPortal: {
      title: 'Owner portal | lux.om',
      description: 'Secure property-owner portal for approved summaries, published statements, maintenance, documents, and payouts.'
    },
    vendorPortal: {
      title: 'Vendor portal | lux.om',
      description: 'Secure maintenance-vendor portal for assigned work orders, quotes, scheduling, progress, and private files.'
    },
    auth: {
      title: 'Account access | lux.om',
      description: 'Sign in or create your lux.om account.'
    },
    fallback: {
      title: 'lux.om',
      description:
        'Premium Oman real estate, short-stay, development, travel agency, and curated activities marketplace.'
    }
  },
  ar: {
    home: {
      title: 'lux.om | عقارات وإقامات وتجارب مختارة في عُمان',
      description:
        'اكتشف فلل وشقق وشاليهات ومشاريع عقارية ووكالات سفر وتجارب مختارة في عُمان.'
    },
    listings: {
      title: 'عقارات مميزة في عُمان | lux.om',
      description: 'استكشف فلل وشقق وشاليهات وإقامات قصيرة وعقارات للبيع والإيجار في عُمان.'
    },
    activities: {
      title: 'أنشطة وباقات سفر مختارة في عُمان | lux.om',
      description: 'احجز أنشطة وتجارب مميزة في عُمان وباقات سفر مختارة من مزودين موثوقين.'
    },
    map: {
      title: 'خريطة عقارات ومشاريع عُمان | lux.om',
      description: 'استكشف العقارات والمشاريع المنشورة على lux.om والمثبتة بإحداثيات Google Maps في عُمان.'
    },
    projects: {
      title: 'مشاريع عقارية في عُمان | lux.om',
      description: 'استكشف مشاريع مطورين معتمدة ومخططات ووحدات وتفاصيل مشاريع في عُمان.'
    },
    developers: {
      title: 'مطورو العقارات في عُمان | lux.om',
      description: 'اكتشف مطورين عقاريين موثوقين ومشاريع سكنية ومتعددة الاستخدامات في عُمان.'
    },
    travelAgencies: {
      title: 'وكالات سفر مميزة في عُمان | lux.om',
      description: 'اعثر على وكالات سفر موثوقة تقدم رحلات وتجارب وباقات مختارة من عُمان.'
    },
    about: {
      title: 'عن lux.om | منصة عُمان المميزة',
      description: 'تعرّف على lux.om، منصة مميزة للعقارات والإقامات والمشاريع والأنشطة في عُمان.'
    },
    contact: {
      title: 'تواصل مع lux.om',
      description: 'تواصل مع lux.om لدعم العقارات والأنشطة والشراكات والخدمات.'
    },
    terms: {
      title: 'شروط الاستخدام | lux.om',
      description: 'راجع شروط سوق lux.om للمستخدمين والمزودين والملاك والمطورين ووكالات السفر والحجوزات.'
    },
    privacy: {
      title: 'سياسة الخصوصية | lux.om',
      description: 'تعرّف على كيفية تعامل lux.om مع بيانات الحساب والسوق والحجوزات والتحقق والثقة.'
    },
    trustSafety: {
      title: 'الثقة والسلامة | lux.om',
      description: 'تعرّف على كيفية مراجعة البلاغات ومخاوف التحقق والمحتوى غير الآمن وإساءة استخدام السوق.'
    },
    cancellationPolicy: {
      title: 'سياسة الإلغاء | lux.om',
      description: 'افهم كيف تتم معالجة طلبات الإلغاء في الإقامات والأنشطة وباقات السفر على lux.om.'
    },
    refundPolicy: {
      title: 'سياسة الاسترداد | lux.om',
      description: 'افهم كيف تتم مراجعة طلبات الاسترداد للحجوزات ومعاملات الأنشطة أو السفر المدفوعة.'
    },
    verificationPolicy: {
      title: 'سياسة التحقق | lux.om',
      description: 'تعرّف على كيفية مراجعة lux.om لطلبات التحقق وشارات الثقة ومخاوف التحقق.'
    },
    dashboard: {
      title: 'لوحة التحكم | lux.om',
      description: 'إدارة حجوزاتك وإعلاناتك وأنشطتك وإشعاراتك وحسابك في lux.om.'
    },
    crm: {
      title: 'CRM | lux.om',
      description: 'إدارة عملاء السوق وPMS والعلاقات والمهام والمتابعة ضمن مساحة خاصة.'
    },
    admin: {
      title: 'الإدارة | lux.om',
      description: 'إدارة النشر والحجوزات والمالية والشركاء والاستفسارات في lux.om.'
    },
    pms: {
      title: 'lux PMS | بوابة إدارة العقارات',
      description: 'بوابة خاصة لإدارة العقارات للشركات والمديرين المخولين في lux.om.'
    },
    tenant: {
      title: 'بوابة المستأجر | lux.om',
      description: 'بوابة آمنة للمستأجرين لعرض العقد والإيجارات والصيانة والبيانات الشخصية.'
    },
    ownerPortal: {
      title: 'بوابة المالك | lux.om',
      description: 'بوابة آمنة للمالك للملخصات المعتمدة والكشوف المنشورة والصيانة والمستندات وحالة الدفعات.'
    },
    vendorPortal: {
      title: 'بوابة المورّد | lux.om',
      description: 'بوابة آمنة للمورّد لأوامر العمل المسندة والعروض والجدولة والتقدم والملفات الخاصة.'
    },
    auth: {
      title: 'الدخول إلى الحساب | lux.om',
      description: 'سجّل الدخول أو أنشئ حسابك في lux.om.'
    },
    marketInsights: {
      title: 'lux.om | مؤشرات سوق العقار في عُمان',
      description:
        'استكشف مؤشرات سوق العقار في عُمان بناءً على بيانات lux.om المتاحة، أسعار العرض، اتجاهات الإيجار، وإشارات المستثمرين.'
    },
    fallback: {
      title: 'lux.om',
      description: 'منصة عُمان المميزة للعقارات والإقامات والمشاريع ووكالات السفر والأنشطة.'
    }
  }
} as const;

function getSeoKey(pathname: string) {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/listings')) return 'listings';
  if (pathname.startsWith('/activities')) return 'activities';
  if (pathname.startsWith('/market-insights')) return 'marketInsights';
  if (pathname.startsWith('/map')) return 'map';
  if (pathname.startsWith('/projects') || pathname.startsWith('/developer-projects')) return 'projects';
  if (pathname.startsWith('/developers')) return 'developers';
  if (pathname.startsWith('/travel-agencies')) return 'travelAgencies';
  if (pathname.startsWith('/about')) return 'about';
  if (pathname.startsWith('/contact')) return 'contact';
  if (pathname.startsWith('/terms')) return 'terms';
  if (pathname.startsWith('/privacy')) return 'privacy';
  if (pathname.startsWith('/trust-safety')) return 'trustSafety';
  if (pathname.startsWith('/cancellation-policy')) return 'cancellationPolicy';
  if (pathname.startsWith('/refund-policy')) return 'refundPolicy';
  if (pathname.startsWith('/verification-policy')) return 'verificationPolicy';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/crm')) return 'crm';
  if (pathname.startsWith('/notifications')) return 'dashboard';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/pms')) return 'pms';
  if (pathname.startsWith('/tenant')) return 'tenant';
  if (pathname.startsWith('/owner')) return 'ownerPortal';
  if (pathname.startsWith('/vendor')) return 'vendorPortal';
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')) return 'auth';

  return 'fallback';
}


const NO_INDEX_ROUTE_PREFIXES = [
  '/admin',
  '/pms',
  '/tenant',
  '/owner',
  '/vendor',
  '/dashboard',
  '/profile',
  '/notifications',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth'
] as const;

function normalizeCanonicalPath(pathname: string) {
  if (pathname === '/') return '/';

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function getRobotsContent(pathname: string) {
  const shouldNoIndex = NO_INDEX_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return shouldNoIndex ? 'noindex, nofollow' : 'index, follow';
}

function setMetaTag(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }

  element.setAttribute('href', url);
}

function SeoManager() {
  const { pathname } = useLocation();
  const { language } = useLanguage();

  useEffect(() => {
    const key = getSeoKey(pathname);
    const meta = seoCopy[language][key];
    const canonicalPath = normalizeCanonicalPath(pathname);
    const canonicalUrl = `${SITE_ORIGIN}${canonicalPath === '/' ? '/' : canonicalPath}`;

    document.documentElement.lang = language === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = meta.title;

    setMetaTag('name', 'description', meta.description);
    setMetaTag('name', 'robots', getRobotsContent(pathname));
    setMetaTag('property', 'og:title', meta.title);
    setMetaTag('property', 'og:description', meta.description);
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:locale', language === 'ar' ? 'ar_OM' : 'en_OM');
    setMetaTag('name', 'twitter:card', 'summary');
    setMetaTag('name', 'twitter:title', meta.title);
    setMetaTag('name', 'twitter:description', meta.description);
    setCanonical(canonicalUrl);
  }, [language, pathname]);

  return null;
}

function LoadingPage() {
  return (
    <section
      aria-labelledby="app-loading-title"
      aria-live="polite"
      className="page-section container not-found"
      role="status"
    >
      <p className="eyebrow">lux.om</p>
      <h1 id="app-loading-title">Loading...</h1>
    </section>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [pathname]);

  return null;
}

function RouteAnnouncer() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const key = getSeoKey(pathname);
    const title = seoCopy[language][key].title.split('|')[0].trim();

    setAnnouncement(language === 'ar' ? `تم الانتقال إلى ${title}` : `Navigated to ${title}`);
  }, [language, pathname]);

  return (
    <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
      {announcement}
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function RequireGuest({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingPage />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RequireOwner({ children }: { children: ReactNode }) {
  const { isAuthenticated, canManageListings, canManageDeveloperProjects, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canManageListings && !canManageDeveloperProjects) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}


function RequireDeveloper({ children }: { children: ReactNode }) {
  const { isAuthenticated, canManageDeveloperProjects, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canManageDeveloperProjects) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RequireActivityProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, canManageActivities, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canManageActivities) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RequireTenantPortal({ children }: { children: ReactNode }) {
  const { canAccessTenantPortal, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessTenantPortal) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RequireOwnerPortal({ children }: { children: ReactNode }) {
  const { canAccessOwnerPortal, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingPage />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessOwnerPortal) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireVendorPortal({ children }: { children: ReactNode }) {
  const { canAccessVendorPortal, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingPage />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessVendorPortal) return <Navigate to="/dashboard" replace />;
  return children;
}

function CrmAccessDenied() {
  const { language } = useLanguage();
  const copy = language === 'ar'
    ? { title: 'لا توجد صلاحية CRM لهذا الحساب.', back: 'العودة إلى مساحة الحساب' }
    : { title: 'CRM access is not enabled for this account.', back: 'Back to account workspace' };

  return (
    <section className="page-section container crm-page">
      <div className="crm-state" role="alert">
        <h1>{copy.title}</h1>
        <Link className="button-link" to="/dashboard">{copy.back}</Link>
      </div>
    </section>
  );
}

function RequireCrm({ children }: { children: ReactNode }) {
  const { canAccessCrm, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingPage />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessCrm) return <CrmAccessDenied />;

  return children;
}

function RequirePms({ children }: { children: ReactNode }) {
  const { canAccessPms, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessPms) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function NotFoundPage() {
  const { language } = useLanguage();

 const copy =
  language === 'ar'
    ? {
        eyebrow: 'خطأ 404',
        title: 'يبدو أنك وصلت إلى مكان غير موجود',
        text:
          'قد يكون الرابط قديمًا أو تم نقل الصفحة. يمكنك العودة للرئيسية أو متابعة اكتشاف العقارات والأنشطة في عُمان.',
        home: 'العودة للرئيسية',
        properties: 'استكشف العقارات',
        activities: 'استكشف الأنشطة'
      }
    : {
        eyebrow: 'Error 404',
        title: 'This destination could not be found',
        text:
          'The link may be outdated or the page may have moved. Return home or continue discovering properties and activities across Oman.',
        home: 'Back to home',
        properties: 'Explore properties',
        activities: 'Explore activities'
      };

  return (
  <section className="page-section container not-found" aria-labelledby="not-found-title">
    <div className="not-found__panel">
      <span className="not-found__code" aria-hidden="true">
        404
      </span>

      <div className="not-found__content">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="not-found-title">{copy.title}</h1>
        <p>{copy.text}</p>

        <div className="not-found__actions">
          <Link className="button-link button-link--primary" to="/">
            {copy.home}
          </Link>

          <Link className="button-link button-link--secondary" to="/listings">
            {copy.properties}
          </Link>

          <Link className="button-link button-link--ghost" to="/activities">
            {copy.activities}
          </Link>
        </div>
      </div>
    </div>
  </section>
);
}

export default function App() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const isAdminRoute = pathname.startsWith('/admin');
  const isPmsRoute = pathname.startsWith('/pms');
  const isTenantRoute = pathname.startsWith('/tenant');
  const isOwnerPortalRoute = pathname.startsWith('/owner');
  const isVendorPortalRoute = pathname.startsWith('/vendor');
  const isWorkspaceRoute =
    isAdminRoute ||
    isPmsRoute ||
    isTenantRoute ||
    isOwnerPortalRoute ||
    isVendorPortalRoute ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/crm') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/add-listing') ||
    pathname.startsWith('/add-project') ||
    pathname.startsWith('/add-activity');

  return (
    <div className={`app-shell ${isWorkspaceRoute ? 'app-shell--workspace' : ''}`}>
      <ScrollToTop />
      <SeoManager />
      <RouteAnnouncer />
      <Navbar />
      {isWorkspaceRoute ? <AuthenticatedProductNav /> : null}

      <main
          id="main-content"
          className={isWorkspaceRoute ? 'app-main app-main--workspace' : 'app-main'}
          tabIndex={-1}
        >
          {isAdminRoute ? <AdminWorkspaceNav /> : null}

          <RouteErrorBoundary key={pathname} language={language}>
            <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />

          <Route path="/listings" element={<Listings />} />
          <Route path="/listings/:slug" element={<ListingDetails />} />
          <Route
            path="/add-listing"
            element={
              <RequireOwner>
                <AddListing />
              </RequireOwner>
            }
          />
          <Route
            path="/add-project"
            element={
              <RequireDeveloper>
                <AddProject />
              </RequireDeveloper>
            }
          />

          <Route path="/activities" element={<Activities />} />
          <Route path="/activities/:slug" element={<ActivityDetails />} />
          <Route
            path="/add-activity"
            element={
              <RequireActivityProvider>
                <AddActivity />
              </RequireActivityProvider>
            }
          />

          <Route path="/market-insights" element={<MarketInsights />} />
          <Route path="/map" element={<MapDiscovery />} />

          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:slug" element={<DeveloperProjectDetails />} />
          <Route path="/developers" element={<Developers />} />
          <Route path="/developers/:slug" element={<DeveloperDetails />} />
          <Route path="/developer-projects/:slug" element={<DeveloperProjectDetails />} />

          <Route path="/travel-agencies" element={<TravelAgencies />} />
          <Route path="/travel-agencies/:slug" element={<TravelAgencyDetails />} />

          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />

          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/trust-safety" element={<TrustSafety />} />
          <Route path="/cancellation-policy" element={<CancellationPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/verification-policy" element={<VerificationPolicy />} />

          <Route
            path="/login"
            element={
              <RequireGuest>
                <Login />
              </RequireGuest>
            }
          />
          <Route
            path="/register"
            element={
              <RequireGuest>
                <Register />
              </RequireGuest>
            }
          />

          <Route
            path="/forgot-password"
            element={
              <RequireGuest>
                <ForgotPassword />
              </RequireGuest>
            }
          />
          <Route
            path="/reset-password"
            element={
              <RequireGuest>
                <ResetPassword />
              </RequireGuest>
            }
          />

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          <Route
            path="/crm"
            element={
              <RequireCrm>
                <CrmShell />
              </RequireCrm>
            }
          >
            <Route index element={<CrmIndexRedirect />} />
            <Route path="overview" element={<Crm section="overview" />} />
            <Route path="leads" element={<Crm section="leads" />} />
            <Route path="leads/:leadId" element={<Crm section="leads" />} />
            <Route path="tasks" element={<Crm section="tasks" />} />
            <Route path="accounts" element={<CrmOperations section="accounts" />} />
            <Route path="accounts/:accountId" element={<CrmOperations section="accounts" />} />
            <Route path="contacts" element={<CrmOperations section="contacts" />} />
            <Route path="contacts/:contactId" element={<CrmOperations section="contacts" />} />
            <Route path="deals" element={<CrmOperations section="deals" />} />
            <Route path="deals/:dealId" element={<CrmOperations section="deals" />} />
            <Route path="communications" element={<CrmOperations section="communications" />} />
            <Route path="analytics" element={<CrmOperations section="analytics" />} />
            <Route path="settings/pipelines" element={<CrmOperations section="pipelines" />} />
            <Route path="settings/scoring" element={<CrmOperations section="scoring" />} />
            <Route path="settings/communications" element={<CrmOperations section="communication-settings" />} />
            <Route path="operations" element={<CrmLegacyOperationsRedirect />} />
            <Route path=":leadId" element={<CrmLegacyLeadRedirect />} />
          </Route>

          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />

          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <Notifications />
              </RequireAuth>
            }
          />

          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />

          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />

          <Route
            path="/admin/users"
            element={
              <RequireAdmin>
                <AdminUsers />
              </RequireAdmin>
            }
          />

          <Route
            path="/admin/email-deliveries"
            element={
              <RequireAdmin>
                <AdminEmailDeliveries />
              </RequireAdmin>
            }
          />

          <Route
            path="/admin/reports"
            element={
              <RequireAdmin>
                <AdminTrustReports />
              </RequireAdmin>
            }
          />

          <Route
            path="/admin/pms"
            element={
              <RequireAdmin>
                <AdminPmsAccess />
              </RequireAdmin>
            }
          />

          <Route
            path="/pms"
            element={
              <RequirePms>
                <PmsShell />
              </RequirePms>
            }
          >
            <Route index element={<PmsIndexRedirect />} />
            <Route path="overview" element={<PmsPortal />} />

            <Route path="portfolio" element={<PmsLegacyRedirect to="/pms/portfolio/properties" />} />
            <Route path="portfolio/properties" element={<PmsPortal />} />
            <Route path="portfolio/properties/:propertyId" element={<PmsPortal />} />
            <Route path="portfolio/units" element={<PmsPortal />} />

            <Route path="leasing" element={<PmsLegacyRedirect to="/pms/leasing/leases" />} />
            <Route path="leasing/tenants" element={<PmsPortal />} />
            <Route path="leasing/leases" element={<PmsPortal />} />
            <Route path="leasing/leases/:leaseId" element={<PmsPortal />} />

            <Route path="operations" element={<PmsLegacyRedirect to="/pms/operations/maintenance" />} />
            <Route path="operations/maintenance" element={<PmsPortal />} />
            <Route path="operations/vendors" element={<PmsPortal />} />
            <Route path="operations/assets-inspections" element={<PmsAssetsInspections />} />
            <Route path="operations/documents" element={<PmsPortal />} />

            <Route path="finance" element={<PmsLegacyRedirect to="/pms/finance/overview" />} />
            <Route path="finance/overview" element={<PmsFinancialOperations section="overview" />} />
            <Route path="finance/charges" element={<PmsFinancialOperations section="charges" />} />
            <Route path="finance/payments" element={<PmsFinancialOperations section="payments" />} />
            <Route path="finance/deposits" element={<PmsFinancialOperations section="deposits" />} />
            <Route path="finance/periods" element={<PmsFinancialOperations section="periods" />} />
            <Route path="finance/reconciliation" element={<PmsFinancialOperations section="reconciliation" />} />
            <Route path="finance/records" element={<PmsPortal />} />

            <Route path="reports" element={<PmsPortal />} />

            <Route path="administration" element={<PmsLegacyRedirect to="/pms/administration/settings" />} />
            <Route path="administration/staff-access" element={<PmsPortal />} />
            <Route path="administration/import-export" element={<PmsPortal />} />
            <Route path="administration/settings" element={<PmsPortal />} />

            <Route path="properties" element={<PmsLegacyRedirect to="/pms/portfolio/properties" />} />
            <Route path="properties/:propertyId" element={<PmsLegacyPropertyRedirect />} />
            <Route path="units" element={<PmsLegacyRedirect to="/pms/portfolio/units" />} />
            <Route path="tenants" element={<PmsLegacyRedirect to="/pms/leasing/tenants" />} />
            <Route path="rentals" element={<PmsLegacyRedirect to="/pms/leasing/leases" />} />
            <Route path="rentals/:leaseId" element={<PmsLegacyLeaseRedirect />} />
            <Route path="documents" element={<PmsLegacyRedirect to="/pms/operations/documents" />} />
            <Route path="maintenance" element={<PmsLegacyRedirect to="/pms/operations/maintenance" />} />
            <Route path="assets-inspections" element={<PmsLegacyRedirect to="/pms/operations/assets-inspections" />} />
            <Route path="accounting" element={<PmsLegacyRedirect to="/pms/finance/records" />} />
            <Route path="financial-operations" element={<PmsLegacyRedirect to="/pms/finance/overview" />} />
            <Route path="import-export" element={<PmsLegacyRedirect to="/pms/administration/import-export" />} />
            <Route path="staff" element={<PmsLegacyRedirect to="/pms/administration/staff-access" />} />
            <Route path="settings" element={<PmsLegacyRedirect to="/pms/administration/settings" />} />
          </Route>

          <Route path="/owner" element={<RequireOwnerPortal><OwnerPortal /></RequireOwnerPortal>} />
          <Route path="/vendor" element={<RequireVendorPortal><VendorPortal /></RequireVendorPortal>} />

          {['/tenant', '/tenant/overview', '/tenant/lease', '/tenant/rent', '/tenant/maintenance', '/tenant/documents', '/tenant/profile'].map((path) => (
            <Route
              key={path}
              path={path}
              element={
                <RequireTenantPortal>
                  <TenantPortal />
                </RequireTenantPortal>
              }
            />
          ))}

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
            </Suspense>
          </RouteErrorBoundary>
      </main>

      {!isWorkspaceRoute ? <Footer /> : null}
    </div>
  );
}
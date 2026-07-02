import { type ReactNode, Suspense, lazy, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import Footer from './components/Footer';
import AdminWorkspaceNav from './components/AdminWorkspaceNav';
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
import Listings from './pages/Listings';
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
const Admin = lazy(() => import('./pages/Admin'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminEmailDeliveries = lazy(() => import('./pages/AdminEmailDeliveries'));
const AdminTrustReports = lazy(() => import('./pages/AdminTrustReports'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
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
    admin: {
      title: 'Admin | lux.om',
      description: 'Manage lux.om marketplace publishing, bookings, finance, partners, and inquiries.'
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
    admin: {
      title: 'الإدارة | lux.om',
      description: 'إدارة النشر والحجوزات والمالية والشركاء والاستفسارات في lux.om.'
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
  if (pathname.startsWith('/notifications')) return 'dashboard';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')) return 'auth';

  return 'fallback';
}


const NO_INDEX_ROUTE_PREFIXES = [
  '/admin',
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
  const { isAuthenticated, isOwner, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RequireActivityProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isActivityProvider, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isActivityProvider) {
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
  const isAdminRoute = pathname.startsWith('/admin');
  const isWorkspaceRoute =
    isAdminRoute ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/add-listing') ||
    pathname.startsWith('/add-activity');

  return (
    <div className={`app-shell ${isWorkspaceRoute ? 'app-shell--workspace' : ''}`}>
      <ScrollToTop />
      <SeoManager />
      <RouteAnnouncer />
      <Navbar />

      <main
          id="main-content"
          className={isWorkspaceRoute ? 'app-main app-main--workspace' : 'app-main'}
          tabIndex={-1}
        >
          {isAdminRoute ? <AdminWorkspaceNav /> : null}

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

          <Route path="/developers" element={<Developers />} />
          <Route path="/developers/:slug" element={<DeveloperDetails />} />

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

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>

      {!isWorkspaceRoute ? <Footer /> : null}
    </div>
  );
}
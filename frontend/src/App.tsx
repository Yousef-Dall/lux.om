import { type ReactNode, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import Footer from './components/Footer';
import Navbar from './components/Navbar';

import About from './pages/About';
import Activities from './pages/Activities';
import ActivityDetails from './pages/ActivityDetails';
import AddActivity from './pages/AddActivity';
import AddListing from './pages/AddListing';
import Admin from './pages/Admin';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import DeveloperDetails from './pages/DeveloperDetails';
import Developers from './pages/Developers';
import Home from './pages/Home';
import ListingDetails from './pages/ListingDetails';
import Listings from './pages/Listings';
import Login from './pages/Login';
import Register from './pages/Register';
import TravelAgencies from './pages/TravelAgencies';
import TravelAgencyDetails from './pages/TravelAgencyDetails';

import { useLanguage } from './i18n/LanguageContext';

function LoadingPage() {
  return (
    <section className="page-section container not-found">
      <p className="eyebrow">lux.om</p>
      <h1>Loading...</h1>
    </section>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
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
  return (
    <div className="app-shell">
      <ScrollToTop />
      <Navbar />

      <main id="main-content">
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

          <Route path="/developers" element={<Developers />} />
          <Route path="/developers/:slug" element={<DeveloperDetails />} />

          <Route path="/travel-agencies" element={<TravelAgencies />} />
          <Route path="/travel-agencies/:slug" element={<TravelAgencyDetails />} />

          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />

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
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
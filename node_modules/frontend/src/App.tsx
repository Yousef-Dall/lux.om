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
          eyebrow: '404',
          title: 'الصفحة غير موجودة',
          text: 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
          action: 'الرجوع للرئيسية'
        }
      : {
          eyebrow: '404',
          title: 'Page not found',
          text: 'The page you are looking for does not exist or has been moved.',
          action: 'Back to home'
        };

  return (
    <section className="page-section container not-found" aria-labelledby="not-found-title">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 id="not-found-title">{copy.title}</h1>
      <p>{copy.text}</p>

      <Link className="button-link button-link--primary" to="/">
        {copy.action}
      </Link>
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
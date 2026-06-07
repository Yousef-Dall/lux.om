import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';

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

import { useLanguage } from './i18n/LanguageContext';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
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
          <Route path="/add-listing" element={<AddListing />} />

          <Route path="/activities" element={<Activities />} />
          <Route path="/activities/:slug" element={<ActivityDetails />} />
          <Route path="/add-activity" element={<AddActivity />} />

          <Route path="/developers" element={<Developers />} />
          <Route path="/developers/:slug" element={<DeveloperDetails />} />

          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
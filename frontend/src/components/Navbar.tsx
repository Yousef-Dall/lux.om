import { Globe2, LogOut, Menu, ShieldCheck, UserCircle, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { cn } from '../utils/format';
import ButtonLink from './ButtonLink';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t, toggleLanguage, language } = useLanguage();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const navCopy =
    language === 'ar'
      ? {
          travelAgencies: 'وكالات السفر'
        }
      : {
          travelAgencies: 'Travel agencies'
        };

  const links = useMemo(
    () => [
      { to: '/listings', label: t.nav.listings },
      { to: '/activities', label: t.nav.activities },
      { to: '/developers', label: t.nav.developers },
      { to: '/travel-agencies', label: navCopy.travelAgencies },
      { to: '/about', label: t.nav.about },
      { to: '/contact', label: t.nav.contact }
    ],
    [
      navCopy.travelAgencies,
      t.nav.about,
      t.nav.activities,
      t.nav.contact,
      t.nav.developers,
      t.nav.listings
    ]
  );

  const accessibilityCopy =
    language === 'ar'
      ? {
          skip: 'تخطي إلى المحتوى',
          nav: 'التنقل الرئيسي',
          open: 'فتح قائمة التنقل',
          close: 'إغلاق قائمة التنقل',
          language: 'تغيير اللغة',
          login: 'تسجيل الدخول',
          register: 'إنشاء حساب',
          dashboard: 'لوحة التحكم',
          admin: 'الأدمن',
          logout: 'خروج',
          signedInAs: 'مسجل باسم'
        }
      : {
          skip: 'Skip to content',
          nav: 'Main navigation',
          open: 'Open navigation menu',
          close: 'Close navigation menu',
          language: 'Change language',
          login: 'Login',
          register: 'Register',
          dashboard: 'Dashboard',
          admin: 'Admin',
          logout: 'Logout',
          signedInAs: 'Signed in as'
        };

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleScroll() {
      setHasScrolled(window.scrollY > 10);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function handleLogout() {
    logout();
    setIsOpen(false);
    navigate('/');
  }

  return (
    <header className={cn('site-header', hasScrolled && 'site-header--scrolled')}>
      <a className="skip-link" href="#main-content">
        {accessibilityCopy.skip}
      </a>

      <nav className="navbar container" aria-label={accessibilityCopy.nav}>
        <Link to="/" className="brand" onClick={() => setIsOpen(false)} aria-label="lux.om homepage">
          <span className="brand__mark" aria-hidden="true">
            lux
          </span>

          <span>
            <strong>lux.om</strong>
            <small>Oman, curated</small>
          </span>
        </Link>

        <button
          className="nav-toggle"
          type="button"
          aria-label={isOpen ? accessibilityCopy.close : accessibilityCopy.open}
          aria-expanded={isOpen}
          aria-controls="main-navigation-menu"
          onClick={() => setIsOpen((value) => !value)}
        >
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <div id="main-navigation-menu" className={cn('nav-menu', isOpen && 'nav-menu--open')}>
          <div className="nav-menu__links">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'nav-link',
                    (isActive || pathname.startsWith(`${link.to}/`)) && 'nav-link--active'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="nav-menu__actions nav-menu__actions--auth">
            <button
              className="language-toggle"
              type="button"
              aria-label={accessibilityCopy.language}
              onClick={toggleLanguage}
            >
              <Globe2 size={17} aria-hidden="true" />
              <span>{t.common.language}</span>
              <small>{language.toUpperCase()}</small>
            </button>

            {isAuthenticated ? (
              <>
                <div
                  className="nav-user-pill"
                  title={`${accessibilityCopy.signedInAs} ${user?.email}`}
                >
                  <UserCircle size={16} aria-hidden="true" />
                  <span>{user?.name}</span>
                </div>

                <ButtonLink to="/dashboard" variant="secondary" onClick={() => setIsOpen(false)}>
                  {accessibilityCopy.dashboard}
                </ButtonLink>

                {isAdmin ? (
                  <ButtonLink to="/admin" onClick={() => setIsOpen(false)}>
                    <ShieldCheck size={15} aria-hidden="true" />
                    {accessibilityCopy.admin}
                  </ButtonLink>
                ) : null}

                <button className="nav-logout-button" type="button" onClick={handleLogout}>
                  <LogOut size={15} aria-hidden="true" />
                  {accessibilityCopy.logout}
                </button>
              </>
            ) : (
              <>
                <ButtonLink to="/login" variant="secondary" onClick={() => setIsOpen(false)}>
                  {accessibilityCopy.login}
                </ButtonLink>

                <ButtonLink to="/register" onClick={() => setIsOpen(false)}>
                  {accessibilityCopy.register}
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
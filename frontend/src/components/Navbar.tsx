import {
Bell,
ChevronDown,
Globe2,
LayoutDashboard,
LogOut,
Mail,
Menu,
ShieldCheck,
AlertTriangle,
ArrowUpRight,
Users,
UserCircle,
X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { cn } from '../utils/format';
import {
  getMarketplacePersonaLabel,
  getMarketplacePersonaPrimaryActions
} from '../utils/marketplacePersona';
import ButtonLink from './ButtonLink';
import NotificationBell from './NotificationBell';

export default function Navbar() {
const [isOpen, setIsOpen] = useState(false);
const [hasScrolled, setHasScrolled] = useState(false);
const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

const { pathname } = useLocation();
const navigate = useNavigate();
const { t, toggleLanguage, language } = useLanguage();
const { user, token, isAuthenticated, isAdmin, logout } = useAuth();
const accountRoleLabel = user ? getMarketplacePersonaLabel(user.role, language) : '';
const accountPersonaActions = user ? getMarketplacePersonaPrimaryActions(user.role, language) : [];

const navCopy =
language === 'ar'
? {
investorInsights: 'رؤى المستثمر',
travelAgencies: 'وكالات السفر',
projects: 'المشاريع'
}
: {
investorInsights: 'Investor insights',
travelAgencies: 'Travel agencies',
projects: 'Projects'
};

const links = useMemo(
() => [
{ to: '/listings', label: t.nav.listings },
{ to: '/market-insights', label: navCopy.investorInsights },
{ to: '/projects', label: navCopy.projects },
{ to: '/activities', label: t.nav.activities },
{ to: '/developers', label: t.nav.developers },
{ to: '/travel-agencies', label: navCopy.travelAgencies },
{ to: '/about', label: t.nav.about },
{ to: '/contact', label: t.nav.contact }
],
[
navCopy.investorInsights,
navCopy.projects,
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
profile: 'الملف الشخصي',
notifications: 'الإشعارات',
admin: 'الأدمن',
users: 'المستخدمون',
reports: 'البلاغات',
emailDeliveries: 'سجل البريد',
logout: 'خروج',
signedInAs: 'مسجل باسم',
account: 'قائمة الحساب'
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
profile: 'Profile',
notifications: 'Notifications',
admin: 'Admin',
users: 'Users',
reports: 'Reports',
emailDeliveries: 'Email deliveries',
logout: 'Logout',
signedInAs: 'Signed in as',
account: 'Account menu'
};

useEffect(() => {
setIsOpen(false);
}, [pathname]);

useEffect(() => {
if (!isOpen) return;

function handleKeyDown(event: KeyboardEvent) {
if (event.key === 'Escape') {
setIsOpen(false);
}
}

document.addEventListener('keydown', handleKeyDown);

return () => document.removeEventListener('keydown', handleKeyDown);
}, [isOpen]);


useEffect(() => {
if (!isAuthenticated) {
setNotificationUnreadCount(0);
}
}, [isAuthenticated]);

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
<header className={cn('site-header', hasScrolled && 'site-header--scrolled')}> <a className="skip-link" href="#main-content">
{accessibilityCopy.skip} </a>


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
            <NotificationBell
              token={token}
              language={language}
              onNavigate={() => setIsOpen(false)}
              onUnreadCountChange={setNotificationUnreadCount}
            />

            <details className="nav-account">
            <summary
              className="nav-account__trigger"
              aria-label={accessibilityCopy.account}
              title={`${accessibilityCopy.signedInAs} ${user?.email ?? ''}`}
            >
              <span className="nav-account__avatar" aria-hidden="true">
                <UserCircle size={18} />
              </span>

              <span className="nav-account__identity">
                <strong>{user?.name || accessibilityCopy.dashboard}</strong>
                <small>{isAdmin ? accessibilityCopy.admin : accountRoleLabel}</small>
              </span>

              <ChevronDown className="nav-account__chevron" size={16} aria-hidden="true" />
            </summary>

            <div className="nav-account__menu">
              <div className="nav-account__profile">
                <strong>{user?.name}</strong>
                <span>{user?.email}</span>
              </div>

              <NavLink
                to="/dashboard"
                className="nav-account__item"
                onClick={() => setIsOpen(false)}
              >
                <LayoutDashboard size={17} aria-hidden="true" />
                {accessibilityCopy.dashboard}
              </NavLink>

              {accountPersonaActions.map((action) => (
                <NavLink
                  key={action.key}
                  to={action.to}
                  className="nav-account__item"
                  onClick={() => setIsOpen(false)}
                >
                  <ArrowUpRight size={17} aria-hidden="true" />
                  {action.text}
                </NavLink>
              ))}

              <NavLink
                to="/profile"
                className="nav-account__item"
                onClick={() => setIsOpen(false)}
              >
                <UserCircle size={17} aria-hidden="true" />
                {accessibilityCopy.profile}
              </NavLink>

              <NavLink
                to="/notifications"
                className="nav-account__item"
                onClick={() => setIsOpen(false)}
              >
                <Bell size={17} aria-hidden="true" />
                <span>{accessibilityCopy.notifications}</span>
                {notificationUnreadCount > 0 ? (
                  <span className="nav-account__badge">
                    {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                  </span>
                ) : null}
              </NavLink>

              {isAdmin ? (
                <>
                  <NavLink
                    to="/admin"
                    className="nav-account__item"
                    onClick={() => setIsOpen(false)}
                  >
                    <ShieldCheck size={17} aria-hidden="true" />
                    {accessibilityCopy.admin}
                  </NavLink>

                  <NavLink
                    to="/admin/users"
                    className="nav-account__item"
                    onClick={() => setIsOpen(false)}
                  >
                    <Users size={17} aria-hidden="true" />
                    {accessibilityCopy.users}
                  </NavLink>

                  <NavLink
                    to="/admin/email-deliveries"
                    className="nav-account__item"
                    onClick={() => setIsOpen(false)}
                  >
                    <Mail size={17} aria-hidden="true" />
                    {accessibilityCopy.emailDeliveries}
                  </NavLink>

                  <NavLink
                    to="/admin/reports"
                    className="nav-account__item"
                    onClick={() => setIsOpen(false)}
                  >
                    <AlertTriangle size={17} aria-hidden="true" />
                    {accessibilityCopy.reports}
                  </NavLink>

                </>
              ) : null}

              <button
                className="nav-account__item nav-account__item--danger"
                type="button"
                onClick={handleLogout}
              >
                <LogOut size={17} aria-hidden="true" />
                {accessibilityCopy.logout}
              </button>
            </div>
          </details>
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

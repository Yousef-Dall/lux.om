import { ArrowUpRight, Building2, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getRoleAwareFooterCta, getRoleAwareFooterWorkspaceLinks } from '../utils/roleBasedUi';

export default function Footer() {
  const { t, language } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const currentYear = new Date().getFullYear();
  const roleCta = getRoleAwareFooterCta(user?.role, language, isAuthenticated);
  const workspaceLinks = getRoleAwareFooterWorkspaceLinks(user?.role, language, isAuthenticated);

  const copy =
    language === 'ar'
      ? {
          investorInsights: 'رؤى المستثمر',
          travelAgencies: 'وكالات السفر',
          projects: 'المشاريع',
          partnerAgencies: 'شركاء الأنشطة',
          listAgency: 'انضم كوكالة سفر',
          legal: 'القانون والثقة',
          terms: 'شروط الاستخدام',
          privacy: 'سياسة الخصوصية',
          trustSafety: 'الثقة والسلامة',
          cancellation: 'سياسة الإلغاء',
          refund: 'سياسة الاسترداد',
          verification: 'سياسة التحقق'
        }
      : {
          investorInsights: 'Investor insights',
          travelAgencies: 'Travel agencies',
          projects: 'Projects',
          partnerAgencies: 'Activity partners',
          listAgency: 'Join as travel agency',
          legal: 'Legal & trust',
          terms: 'Terms of Use',
          privacy: 'Privacy Policy',
          trustSafety: 'Trust & Safety',
          cancellation: 'Cancellation Policy',
          refund: 'Refund Policy',
          verification: 'Verification Policy'
        };

  const aria =
    language === 'ar'
      ? {
          explore: 'روابط التصفح في التذييل',
          owners: 'روابط الملاك والشركاء في التذييل',
          legal: 'روابط القانون والثقة في التذييل',
          contact: 'معلومات التواصل',
          home: 'العودة إلى الصفحة الرئيسية'
        }
      : {
          explore: 'Footer explore links',
          owners: 'Footer owner and partner links',
          legal: 'Footer legal and trust links',
          contact: 'Contact information',
          home: 'Back to lux.om homepage'
        };

  return (
    <footer className="site-footer">
      <section className="container footer-cta footer-cta--role-aware" aria-labelledby="footer-cta-title">
        <div>
          <p className="eyebrow">{roleCta.eyebrow}</p>
          <h2 id="footer-cta-title">{roleCta.title}</h2>
          <p>{roleCta.description}</p>
        </div>

        <div className="footer-cta__actions">
          {roleCta.actions.map((action, index) => {
            const Icon = index === 0 ? ArrowUpRight : index === 1 ? Sparkles : Building2;

            return (
              <Link
                key={action.key}
                to={action.to}
                className={`footer-cta__link${action.intent === 'primary' ? '' : ' footer-cta__link--secondary'}`}
              >
                {index === 0 ? null : <Icon size={18} aria-hidden="true" />}
                {action.label}
                {index === 0 ? <ArrowUpRight size={18} aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="container footer-grid">
        <div className="footer-brand-block">
          <Link to="/" className="brand brand--footer" aria-label={aria.home}>
            <span className="brand__mark" aria-hidden="true">
              lux
            </span>

            <span>
              <strong>lux.om</strong>
              <small>{t.footer.tagline}</small>
            </span>
          </Link>

          <p>{t.footer.description}</p>
        </div>

        <nav aria-label={aria.explore}>
          <h2>{t.footer.explore}</h2>
          <Link to="/listings">{t.nav.listings}</Link>
          <Link to="/market-insights">{copy.investorInsights}</Link>
          <Link to="/projects">{copy.projects}</Link>
          <Link to="/activities">{t.nav.activities}</Link>
          <Link to="/developers">{t.nav.developers}</Link>
          <Link to="/travel-agencies">{copy.travelAgencies}</Link>
          <Link to="/about">{t.nav.about}</Link>
          <Link to="/contact">{t.nav.contact}</Link>
        </nav>

        <nav aria-label={aria.owners}>
          <h2>{workspaceLinks.heading}</h2>
          {workspaceLinks.links.map((link) => (
            <Link key={link.key} to={link.to}>{link.label}</Link>
          ))}
        </nav>

        <nav aria-label={aria.legal}>
          <h2>{copy.legal}</h2>
          <Link to="/terms">{copy.terms}</Link>
          <Link to="/privacy">{copy.privacy}</Link>
          <Link to="/trust-safety">{copy.trustSafety}</Link>
          <Link to="/cancellation-policy">{copy.cancellation}</Link>
          <Link to="/refund-policy">{copy.refund}</Link>
          <Link to="/verification-policy">{copy.verification}</Link>
        </nav>

        <address className="footer-contact" aria-label={aria.contact}>
          <h2>{t.footer.contact}</h2>

          <a href="mailto:hello@lux.om">
            <Mail size={16} aria-hidden="true" />
            hello@lux.om
          </a>

          <a href="tel:+96890000000">
            <Phone size={16} aria-hidden="true" />
            +968 9000 0000
          </a>

          <span>
            <MapPin size={16} aria-hidden="true" />
            {t.footer.address}
          </span>
        </address>
      </div>

      <div className="container footer-bottom">
        <span>© {currentYear} lux.om. All rights reserved.</span>
        <span>{t.footer.bottomLine}</span>
      </div>
    </footer>
  );
}

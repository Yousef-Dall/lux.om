import { ArrowUpRight, Building2, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useLanguage } from '../i18n/LanguageContext';

export default function Footer() {
  const { t, language } = useLanguage();

  const currentYear = new Date().getFullYear();

  const copy =
    language === 'ar'
      ? {
          travelAgencies: 'وكالات السفر',
          partnerAgencies: 'شركاء الأنشطة',
          listAgency: 'انضم كوكالة سفر'
        }
      : {
          travelAgencies: 'Travel agencies',
          partnerAgencies: 'Activity partners',
          listAgency: 'Join as travel agency'
        };

  const aria =
    language === 'ar'
      ? {
          explore: 'روابط التصفح في التذييل',
          owners: 'روابط الملاك والشركاء في التذييل',
          contact: 'معلومات التواصل',
          home: 'العودة إلى الصفحة الرئيسية'
        }
      : {
          explore: 'Footer explore links',
          owners: 'Footer owner and partner links',
          contact: 'Contact information',
          home: 'Back to lux.om homepage'
        };

  return (
    <footer className="site-footer">
      <section className="container footer-cta" aria-labelledby="footer-cta-title">
        <div>
          <p className="eyebrow">{t.footer.partnerEyebrow}</p>
          <h2 id="footer-cta-title">{t.footer.partnerTitle}</h2>
          <p>{t.footer.partnerText}</p>
        </div>

        <div className="footer-cta__actions">
          <Link to="/add-listing" className="footer-cta__link">
            {t.common.listProperty}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>

          <Link to="/add-activity" className="footer-cta__link footer-cta__link--secondary">
            <Sparkles size={18} aria-hidden="true" />
            {t.common.listActivity}
          </Link>

          <Link to="/travel-agencies" className="footer-cta__link footer-cta__link--secondary">
            <Building2 size={18} aria-hidden="true" />
            {copy.partnerAgencies}
          </Link>

          <Link to="/developers" className="footer-cta__link footer-cta__link--secondary">
            <Building2 size={18} aria-hidden="true" />
            {t.footer.partnerWithLux}
          </Link>
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
          <Link to="/activities">{t.nav.activities}</Link>
          <Link to="/developers">{t.nav.developers}</Link>
          <Link to="/travel-agencies">{copy.travelAgencies}</Link>
          <Link to="/about">{t.nav.about}</Link>
          <Link to="/contact">{t.nav.contact}</Link>
        </nav>

        <nav aria-label={aria.owners}>
          <h2>{t.footer.owners}</h2>
          <Link to="/add-listing">{t.common.listProperty}</Link>
          <Link to="/add-activity">{t.common.listActivity}</Link>
          <Link to="/travel-agencies">{copy.listAgency}</Link>
          <Link to="/developers">{t.footer.partnerWithLux}</Link>
          <Link to="/dashboard">{t.footer.dashboard}</Link>
          <Link to="/admin">{t.footer.admin}</Link>
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
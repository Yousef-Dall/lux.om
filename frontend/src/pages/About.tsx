import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  Globe2,
  Home,
  Plane,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users
} from 'lucide-react';

import ButtonLink from '../components/ButtonLink';
import SectionHeader from '../components/SectionHeader';
import { siteStats } from '../data/siteStats';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

export default function About() {
  const { t, language } = useLanguage();

  useDocumentTitle('About');

  const discoveryIcons = [Home, CalendarDays, Sparkles, Building2];

  const marketplaceHighlights =
    language === 'ar'
      ? {
          standardEyebrow: 'معيار lux.om',
          standardTitle: 'اكتشاف واضح يجمع الأماكن والتجارب والشركاء',
          standardText:
            'صُممت lux.om لتجعل اكتشاف العقارات والإقامات والأنشطة والشركات في عُمان أكثر سهولة وتنظيماً وثقة.',
          focusLabel: 'نطاق المنصة',
          focusTitle: 'أماكن للسكن والإقامة والاستثمار، وتجارب لاكتشاف عُمان',
          focusText:
            'تجمع المنصة فرص السوق العقاري والسياحي والترفيهي في تجربة واحدة متناسقة.',
          trustIconLabel: 'الثقة',
          discoverSectionLabel: 'منصة متكاملة'
        }
      : {
          standardEyebrow: 'The lux.om standard',
          standardTitle: 'Clear discovery across places, experiences, and partners',
          standardText:
            'lux.om is designed to make discovering properties, stays, activities, and trusted companies across Oman easier, more organized, and more credible.',
          focusLabel: 'Marketplace scope',
          focusTitle: 'Places to live, stay, and invest — plus experiences that reveal Oman',
          focusText:
            'The platform brings real estate, tourism, and lifestyle opportunities together in one consistent marketplace journey.',
          trustIconLabel: 'Trust',
          discoverSectionLabel: 'Connected marketplace'
        };

  return (
    <section className="page-section container about-page">
      <SectionHeader
        eyebrow={t.about.eyebrow}
        title={t.about.title}
        description={t.about.description}
      />

      <div className="about-hero-panel">
        <div>
          <p className="eyebrow">{marketplaceHighlights.standardEyebrow}</p>
          <h2>{marketplaceHighlights.standardTitle}</h2>
          <p>{marketplaceHighlights.standardText}</p>

          <div className="about-proof-list">
            <span>
              <Home size={18} aria-hidden="true" />
              {language === 'ar' ? 'عقارات وإقامات' : 'Properties and stays'}
            </span>

            <span>
              <Sparkles size={18} aria-hidden="true" />
              {language === 'ar' ? 'أنشطة وتجارب' : 'Activities and experiences'}
            </span>

            <span>
              <ShieldCheck size={18} aria-hidden="true" />
              {language === 'ar' ? 'محتوى بعد المراجعة' : 'Review-first content'}
            </span>
          </div>
        </div>

        <div className="about-hero-card">
          <span>{marketplaceHighlights.focusLabel}</span>
          <strong>{marketplaceHighlights.focusTitle}</strong>
          <p>{marketplaceHighlights.focusText}</p>
        </div>
      </div>

      <div className="about-purpose-grid">
        <article className="about-purpose-card">
          <span className="content-card__icon">
            <Eye size={22} aria-hidden="true" />
          </span>
          <p className="eyebrow">{t.about.visionEyebrow}</p>
          <h2>{t.about.visionTitle}</h2>
          <p>{t.about.visionText}</p>
        </article>

        <article className="about-purpose-card">
          <span className="content-card__icon">
            <Target size={22} aria-hidden="true" />
          </span>
          <p className="eyebrow">{t.about.missionEyebrow}</p>
          <h2>{t.about.missionTitle}</h2>
          <p>{t.about.missionText}</p>
        </article>
      </div>

      <div className="about-section-heading">
        <p className="eyebrow">{t.about.discoverEyebrow}</p>
        <h2>{t.about.discoverTitle}</h2>
      </div>

      <div className="content-grid content-grid--premium">
        {t.about.cards.map((card, index) => {
          const Icon = discoveryIcons[index] ?? Globe2;

          return (
            <article className="content-card content-card--interactive" key={card.title}>
              <span className="content-card__icon">
                <Icon size={22} aria-hidden="true" />
              </span>

              <h2>{card.title}</h2>
              <p>{card.text}</p>
            </article>
          );
        })}
      </div>

      <div className="about-trust-panel">
        <div>
          <p className="eyebrow">{t.about.trustEyebrow}</p>
          <h2>{t.about.trustTitle}</h2>
          <p>{t.about.trustText}</p>
        </div>

        <div className="about-trust-list">
          {t.about.trustItems.map((item) => (
            <span key={item}>
              <CheckCircle2 size={17} aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="about-audience-panel">
        <span className="content-card__icon">
          <Users size={22} aria-hidden="true" />
        </span>

        <div>
          <p className="eyebrow">{t.about.audienceEyebrow}</p>
          <h2>{t.about.audienceTitle}</h2>
          <p>{t.about.audienceText}</p>
        </div>

        <div className="about-audience-icons" aria-hidden="true">
          <Home size={20} />
          <Plane size={20} />
          <Building2 size={20} />
          <Search size={20} />
        </div>
      </div>

      <div className="about-stats-strip">
        {siteStats.map((item) => (
          <div key={item.labelEn}>
            <strong>{item.value}</strong>
            <span>{language === 'ar' ? item.labelAr : item.labelEn}</span>
          </div>
        ))}
      </div>

      <div className="about-cta-panel">
        <div>
          <p className="eyebrow">{t.about.ctaEyebrow}</p>
          <h2>{t.about.ctaTitle}</h2>
          <p>{t.about.ctaText}</p>
        </div>

        <div className="about-cta-actions">
          <ButtonLink to="/listings">
            <Home size={16} aria-hidden="true" />
            {t.about.exploreProperties}
          </ButtonLink>

          <ButtonLink to="/activities" variant="secondary">
            <Sparkles size={16} aria-hidden="true" />
            {t.about.exploreActivities}
          </ButtonLink>

          <ButtonLink to="/contact" variant="ghost">
            {t.about.becomePartner}
            <ArrowUpRight size={16} aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
import { Building2, CheckCircle2, Compass, Crown, ShieldCheck, Sparkles } from 'lucide-react';

import SectionHeader from '../components/SectionHeader';
import { stats } from '../data/mockData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

export default function About() {
  const { t, language } = useLanguage();

  useDocumentTitle('About');

  const icons = [Compass, Building2, Sparkles];

  const copy =
    language === 'ar'
      ? {
          standardEyebrow: 'معيار lux.om',
          title: 'اختيارات منظمة، بحث أوضح، وثقة أعلى.',
          description:
            'تجمع lux.om العقارات، الإقامات القصيرة، الأنشطة، وشركات التطوير في تجربة واحدة راقية تساعد الناس على اكتشاف عُمان بثقة ووضوح.',
          approval: 'النشر بعد المراجعة',
          premium: 'عرض بصري راقٍ',
          filters: 'فلاتر بحث واضحة',
          focusLabel: 'تركيز المنصة',
          focusTitle: 'عقارات + إقامات قصيرة + أنشطة + مطورون',
          focusText:
            'مصممة للضيوف، المشترين، المستأجرين، الملاك، الوكلاء، مزودي الأنشطة، وشركات التطوير العقاري.'
        }
      : {
          standardEyebrow: 'lux.om standard',
          title: 'Curated supply, clearer discovery, better trust.',
          description:
            'lux.om brings properties, short stays, activities, and development companies into one premium journey, helping people discover Oman through polished, credible, and easy-to-compare marketplace experiences.',
          approval: 'Approval-first publishing',
          premium: 'Premium presentation',
          filters: 'Clear search filters',
          focusLabel: 'Marketplace focus',
          focusTitle: 'Properties + short stays + curated activities + developers',
          focusText:
            'Built for guests, buyers, renters, owners, agents, local activity providers, and real estate development companies.'
        };

  return (
    <section className="page-section container">
      <SectionHeader
        eyebrow={t.about.eyebrow}
        title={t.about.title}
        description={t.about.description}
      />

      <div className="about-hero-panel">
        <div>
          <p className="eyebrow">{copy.standardEyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>

          <div className="about-proof-list">
            <span>
              <ShieldCheck size={18} aria-hidden="true" />
              {copy.approval}
            </span>

            <span>
              <Crown size={18} aria-hidden="true" />
              {copy.premium}
            </span>

            <span>
              <CheckCircle2 size={18} aria-hidden="true" />
              {copy.filters}
            </span>
          </div>
        </div>

        <div className="about-hero-card">
          <span>{copy.focusLabel}</span>
          <strong>{copy.focusTitle}</strong>
          <p>{copy.focusText}</p>
        </div>
      </div>

      <div className="content-grid content-grid--premium">
        {t.about.cards.map((card, index) => {
          const Icon = icons[index] ?? Sparkles;

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

      <div className="about-stats-strip">
        {stats.map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
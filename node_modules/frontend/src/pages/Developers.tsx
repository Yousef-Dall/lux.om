import { ArrowRight, Building2, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import ButtonLink from '../components/ButtonLink';
import SectionHeader from '../components/SectionHeader';
import { developmentCompanies, listings } from '../data/mockData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

export default function Developers() {
  const { language } = useLanguage();

  useDocumentTitle('Development companies');

  const featuredDevelopers = developmentCompanies.filter((developer) => developer.featured);
  const linkedPropertyCount = listings.filter((listing) => listing.developerId).length;

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'المطورون',
          title: 'اكتشف المطورين الموثوقين والمشاريع العقارية الجديدة في عُمان.',
          description:
            'تصفح شركات التطوير، المجتمعات السكنية، المشاريع المميزة، والعقارات المرتبطة بأهم مناطق النمو العقاري في عُمان.',
          partner: 'كن شريكاً مع lux.om',
          network: 'شبكة المطورين',
          heroTitle:
            'مصمم لشركات التطوير العقاري والإنشاءات والمشترين الجادين.',
          heroText:
            'تمنح lux.om شركات التطوير حضوراً واضحاً يساعد المشترين والمستأجرين على فهم الشركة، استكشاف عقاراتها، ومتابعة مشاريعها القادمة.',
          developerProfiles: 'ملفات المطورين',
          featuredPartners: 'شركاء مميزون',
          linkedProperties: 'عقارات مرتبطة',
          verifiedDeveloper: 'مطور موثق',
          developer: 'مطور',
          featured: 'مميز',
          listedProperties: 'عقارات منشورة',
          viewProfile: 'عرض الملف',
          cardAria: 'عرض ملف المطور'
        }
      : {
          eyebrow: 'Developers',
          title: 'Discover trusted developers and new property projects in Oman.',
          description:
            'Browse development companies, master communities, premium projects, and properties connected to Oman’s most important real estate growth areas.',
          partner: 'Partner with lux.om',
          network: 'Developer network',
          heroTitle:
            'Built for construction companies, real estate developers, and serious buyers.',
          heroText:
            'lux.om gives development companies a dedicated presence where buyers and renters can understand the company, explore its listed properties, and discover project pipelines.',
          developerProfiles: 'developer profiles',
          featuredPartners: 'featured partners',
          linkedProperties: 'linked properties',
          verifiedDeveloper: 'Verified developer',
          developer: 'Developer',
          featured: 'Featured',
          listedProperties: 'listed properties',
          viewProfile: 'View profile',
          cardAria: 'View developer profile'
        };

  return (
    <section className="page-section container">
      <SectionHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <ButtonLink to="/contact" variant="soft">
            {copy.partner}
            <ArrowRight size={16} aria-hidden="true" />
          </ButtonLink>
        }
      />

      <section className="developer-hero-panel" aria-labelledby="developer-network-title">
        <div>
          <p className="eyebrow">{copy.network}</p>
          <h2 id="developer-network-title">{copy.heroTitle}</h2>
          <p>{copy.heroText}</p>
        </div>

        <div className="developer-hero-stats" aria-label="Developer marketplace statistics">
          <span>
            <strong>{developmentCompanies.length}</strong>
            {copy.developerProfiles}
          </span>

          <span>
            <strong>{featuredDevelopers.length}</strong>
            {copy.featuredPartners}
          </span>

          <span>
            <strong>{linkedPropertyCount}</strong>
            {copy.linkedProperties}
          </span>
        </div>
      </section>

      <div className="developer-grid">
        {developmentCompanies.map((developer) => {
          const developerListings = listings.filter(
            (listing) => listing.developerId === developer.id
          );

          return (
            <article className="developer-card" key={developer.id}>
              <img src={developer.logo} alt={`${developer.name} logo`} loading="lazy" />

              <div className="developer-card__body">
                <div className="developer-card__topline">
                  {developer.verified ? (
                    <span>
                      <ShieldCheck size={14} aria-hidden="true" />
                      {copy.verifiedDeveloper}
                    </span>
                  ) : (
                    <span>
                      <Building2 size={14} aria-hidden="true" />
                      {copy.developer}
                    </span>
                  )}

                  {developer.featured ? (
                    <span>
                      <Sparkles size={14} aria-hidden="true" />
                      {copy.featured}
                    </span>
                  ) : null}
                </div>

                <h2>{developer.name}</h2>

                <p className="developer-card__location">
                  <MapPin size={16} aria-hidden="true" />
                  {developer.headquarters}
                </p>

                <p>{developer.description}</p>

                <div className="developer-card__specialties">
                  {developer.specialties.slice(0, 3).map((specialty) => (
                    <span key={specialty}>{specialty}</span>
                  ))}
                </div>

                <div className="developer-card__footer">
                  <strong>
                    {developerListings.length} {copy.listedProperties}
                  </strong>

                  <Link
                    to={`/developers/${developer.slug}`}
                    className="text-link"
                    aria-label={`${copy.cardAria}: ${developer.name}`}
                  >
                    {copy.viewProfile}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
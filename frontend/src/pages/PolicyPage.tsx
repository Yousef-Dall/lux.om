import { ArrowRight, FileText, Mail, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useLanguage } from '../i18n/LanguageContext';

export type PolicySection = {
  title: string;
  body: string;
  bullets?: string[];
  note?: string;
};

export type PolicyRelatedLink = {
  to: string;
  label: string;
  description: string;
};

export type PolicyPageCopy = {
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated: string;
  reviewNote: string;
  contactCta: string;
  contactText: string;
  relatedTitle: string;
  sections: PolicySection[];
  relatedLinks: PolicyRelatedLink[];
};

type PolicyPageProps = {
  en: PolicyPageCopy;
  ar: PolicyPageCopy;
  icon?: LucideIcon;
};

export default function PolicyPage({ en, ar, icon }: PolicyPageProps) {
  const { language } = useLanguage();
  const copy = language === 'ar' ? ar : en;
  const Icon = icon ?? FileText;

  return (
    <section className="page-section container policy-page">
      <div className="policy-hero">
        <div className="policy-hero__icon" aria-hidden="true">
          <Icon size={28} />
        </div>

        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>

          <div className="policy-hero__meta">
            <span>
              <ShieldCheck size={16} aria-hidden="true" />
              {copy.lastUpdated}
            </span>
            <span>{copy.reviewNote}</span>
          </div>
        </div>
      </div>

      <div className="policy-page__layout">
        <div className="policy-page__content">
          {copy.sections.map((section) => (
            <article className="policy-card" key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>

              {section.bullets?.length ? (
                <ul>
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}

              {section.note ? <p className="policy-card__note">{section.note}</p> : null}
            </article>
          ))}
        </div>

        <aside className="policy-page__side" aria-label={copy.relatedTitle}>
          <div className="policy-side-card">
            <h2>{copy.relatedTitle}</h2>

            <div className="policy-related-links">
              {copy.relatedLinks.map((link) => (
                <Link to={link.to} key={link.to}>
                  <span>
                    <strong>{link.label}</strong>
                    <small>{link.description}</small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <div className="policy-side-card policy-side-card--contact">
            <Mail size={20} aria-hidden="true" />
            <h2>{copy.contactCta}</h2>
            <p>{copy.contactText}</p>
            <Link className="button-link button-link--primary" to="/contact">
              {copy.contactCta}
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

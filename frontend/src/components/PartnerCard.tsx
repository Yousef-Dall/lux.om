import {
  BadgeCheck,
  Building2,
  Globe,
  Mail,
  MapPin,
  MoveRight,
  Phone,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

type PartnerCardLabels = {
  verified: string;
  featured?: string;
  headquarters: string;
  phone: string;
  email: string;
  website: string;
  view: string;
};

type PartnerCardProps = {
  href: string;
  name: string;
  image?: string;
  description?: string;
  headquarters?: string;
  phone?: string;
  email?: string;
  website?: string;
  verified?: boolean;
  featured?: boolean;
  labels: PartnerCardLabels;
};

function getWebsiteHref(website: string) {
  return /^https?:\/\//i.test(website)
    ? website
    : `https://${website}`;
}

export default function PartnerCard({
  href,
  name,
  image,
  description,
  headquarters,
  phone,
  email,
  website,
  verified = false,
  featured = false,
  labels
}: PartnerCardProps) {
  return (
    <article className="travel-agency-card">
      <div className="travel-agency-card__media">
        {image ? (
          <img src={image} alt={name} loading="lazy" />
        ) : (
          <span className="travel-agency-card__placeholder">
            <Building2 size={34} aria-hidden="true" />
          </span>
        )}

        {verified || featured ? (
          <div className="travel-agency-card__badges">
            {verified ? (
              <span className="travel-agency-card__badge">
                <BadgeCheck size={16} aria-hidden="true" />
                {labels.verified}
              </span>
            ) : null}

            {featured && labels.featured ? (
              <span className="travel-agency-card__badge travel-agency-card__badge--featured">
                <Sparkles size={16} aria-hidden="true" />
                {labels.featured}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="travel-agency-card__body">
        <div className="travel-agency-card__content">
          <h2>
            <Link to={href}>{name}</Link>
          </h2>

          {description ? (
            <p className="travel-agency-card__description">
              {description}
            </p>
          ) : null}

          {headquarters ? (
            <div className="travel-agency-card__headquarters">
              <span className="travel-agency-card__contact-icon">
                <MapPin size={17} aria-hidden="true" />
              </span>

              <span>
                <small>{labels.headquarters}</small>
                <strong>{headquarters}</strong>
              </span>
            </div>
          ) : null}

          <div className="travel-agency-card__contacts">
            {phone ? (
              <a
                className="travel-agency-card__contact"
                href={`tel:${phone}`}
              >
                <span className="travel-agency-card__contact-icon">
                  <Phone size={16} aria-hidden="true" />
                </span>

                <span className="travel-agency-card__contact-copy">
                  <small>{labels.phone}</small>
                  <strong dir="ltr">{phone}</strong>
                </span>
              </a>
            ) : null}

            {email ? (
              <a
                className="travel-agency-card__contact"
                href={`mailto:${email}`}
              >
                <span className="travel-agency-card__contact-icon">
                  <Mail size={16} aria-hidden="true" />
                </span>

                <span className="travel-agency-card__contact-copy">
                  <small>{labels.email}</small>
                  <strong>{email}</strong>
                </span>
              </a>
            ) : null}

            {website ? (
              <a
                className="travel-agency-card__contact"
                href={getWebsiteHref(website)}
                target="_blank"
                rel="noreferrer"
              >
                <span className="travel-agency-card__contact-icon">
                  <Globe size={16} aria-hidden="true" />
                </span>

                <span className="travel-agency-card__contact-copy">
                  <small>{labels.website}</small>
                  <strong>{website}</strong>
                </span>
              </a>
            ) : null}
          </div>
        </div>

        <Link className="travel-agency-card__cta" to={href}>
          <span>{labels.view}</span>
          <MoveRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
import { ExternalLink, MapPin, Navigation } from 'lucide-react';

import { useLanguage } from '../i18n/LanguageContext';
import {
  getGoogleMapsEmbedUrl,
  getGoogleMapsSearchUrl
} from '../utils/mapLocation';

type MapLocationPanelProps = {
  title: string;
  location: string;
  placeLabel?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
};

export default function MapLocationPanel({
  title,
  location,
  placeLabel,
  address,
  googleMapsUrl,
  latitude,
  longitude
}: MapLocationPanelProps) {
  const { language } = useLanguage();
  const copy =
    language === 'ar'
      ? {
          eyebrow: 'موقع الخريطة',
          title: 'موقع Google Maps',
          description: 'استخدم الخريطة لفهم المنطقة قبل طلب الزيارة أو التفاصيل.',
          open: 'فتح في Google Maps',
          coordinates: 'الإحداثيات',
          address: 'العنوان',
          place: 'النقطة'
        }
      : {
          eyebrow: 'Map location',
          title: 'Google Maps location',
          description: 'Use the map context to understand the area before requesting a viewing or details.',
          open: 'Open in Google Maps',
          coordinates: 'Coordinates',
          address: 'Address',
          place: 'Pin label'
        };

  const hasCoordinates = latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null;
  const hasMapSignal = Boolean(placeLabel || address || googleMapsUrl || hasCoordinates);

  if (!hasMapSignal) {
    return null;
  }

  const embedUrl = getGoogleMapsEmbedUrl({
    latitude,
    longitude,
    label: placeLabel ?? title,
    fallbackQuery: address || googleMapsUrl || `${title}, ${location}`
  });
  const openUrl = googleMapsUrl || getGoogleMapsSearchUrl({
    latitude,
    longitude,
    label: placeLabel ?? title,
    fallbackQuery: address || `${title}, ${location}`
  });

  return (
    <section className="map-location-panel" aria-labelledby="map-location-title">
      <div className="details-section-heading">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id="map-location-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </div>

      <div className="map-location-panel__grid">
        {embedUrl ? (
          <iframe
            className="map-location-panel__frame"
            src={embedUrl}
            title={`${copy.title}: ${title}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : null}

        <div className="map-location-panel__details">
          <div>
            <MapPin size={18} aria-hidden="true" />
            <span>{copy.place}</span>
            <strong>{placeLabel || title}</strong>
          </div>

          <div>
            <Navigation size={18} aria-hidden="true" />
            <span>{copy.address}</span>
            <strong>{address || location}</strong>
          </div>

          {hasCoordinates ? (
            <div>
              <MapPin size={18} aria-hidden="true" />
              <span>{copy.coordinates}</span>
              <strong>{latitude}, {longitude}</strong>
            </div>
          ) : null}

          <a className="button-link button-link--secondary" href={openUrl} target="_blank" rel="noreferrer">
            {copy.open}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

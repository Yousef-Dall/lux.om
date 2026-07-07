import { Building2, ExternalLink, Home, MapPin, Navigation, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getMapMarkers } from '../api/map';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { MapDiscoveryMarker, MapMarkerKind } from '../types';
import { getGoogleMapsSearchUrl, getMapPinPosition } from '../utils/mapLocation';

type MarkerFilter = 'ALL' | MapMarkerKind;

export default function MapDiscovery() {
  const { language } = useLanguage();
  const [markers, setMarkers] = useState<MapDiscoveryMarker[]>([]);
  const [activeMarkerId, setActiveMarkerId] = useState<string>('');
  const [filter, setFilter] = useState<MarkerFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentTitle(language === 'ar' ? 'خريطة العقارات والمشاريع' : 'Property and project map');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'خريطة lux.om',
          title: 'استكشف العقارات والمشاريع على الخريطة',
          description: 'كل دبوس يمثل عقاراً أو مشروعاً منشوراً بإحداثيات Google Maps. استخدم الخريطة لاختيار المنطقة ثم افتح التفاصيل.',
          all: 'الكل',
          listings: 'العقارات',
          projects: 'المشاريع',
          loading: 'جاري تحميل الخريطة...',
          error: 'تعذر تحميل بيانات الخريطة. تأكد أن الخادم يعمل ثم حاول مرة أخرى.',
          empty: 'لا توجد عقارات أو مشاريع بإحداثيات منشورة بعد.',
          openDetails: 'فتح التفاصيل',
          openGoogle: 'فتح في Google Maps',
          verified: 'موثق',
          units: 'وحدات',
          listing: 'عقار',
          project: 'مشروع',
          mapNote: 'الخريطة تستخدم الإحداثيات المحفوظة داخل lux.om وتوفر رابطاً مباشراً إلى Google Maps لكل دبوس.'
        }
      : {
          eyebrow: 'lux.om map',
          title: 'Explore properties and projects on the map',
          description: 'Every pin represents an approved listing or project with Google Maps coordinates. Use the map to choose an area, then open the full detail page.',
          all: 'All',
          listings: 'Listings',
          projects: 'Projects',
          loading: 'Loading map...',
          error: 'Could not load map data. Make sure the backend is running and try again.',
          empty: 'No approved listings or projects have saved coordinates yet.',
          openDetails: 'Open details',
          openGoogle: 'Open in Google Maps',
          verified: 'Verified',
          units: 'units',
          listing: 'Listing',
          project: 'Project',
          mapNote: 'This map uses coordinates stored in lux.om and provides a direct Google Maps link for every pin.'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadMarkers() {
      try {
        setLoading(true);
        setError('');
        const results = await getMapMarkers(language);

        if (!isMounted) return;

        setMarkers(results);
        setActiveMarkerId((current) => current || results[0]?.id || '');
      } catch (loadError) {
        if (!isMounted) return;

        console.error(loadError);
        setError(copy.error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadMarkers();

    return () => {
      isMounted = false;
    };
  }, [language, copy.error]);

  const filteredMarkers = useMemo(
    () => markers.filter((marker) => filter === 'ALL' || marker.kind === filter),
    [markers, filter]
  );

  const activeMarker = filteredMarkers.find((marker) => marker.id === activeMarkerId) ?? filteredMarkers[0];

  useEffect(() => {
    if (!activeMarker && filteredMarkers[0]) {
      setActiveMarkerId(filteredMarkers[0].id);
    }
  }, [activeMarker, filteredMarkers]);

  const counts = {
    all: markers.length,
    listings: markers.filter((marker) => marker.kind === 'LISTING').length,
    projects: markers.filter((marker) => marker.kind === 'PROJECT').length
  };

  return (
    <section className="page-section map-discovery-page">
      <div className="container">
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

        <div className="map-discovery-toolbar" aria-label="Map filters">
          {[
            { value: 'ALL' as const, label: copy.all, count: counts.all },
            { value: 'LISTING' as const, label: copy.listings, count: counts.listings },
            { value: 'PROJECT' as const, label: copy.projects, count: counts.projects }
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className={filter === item.value ? 'active' : ''}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>

        {loading ? <p className="related-results-status">{copy.loading}</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}

        {!loading && !error && filteredMarkers.length === 0 ? (
          <div className="related-results-empty">
            <MapPin size={22} aria-hidden="true" />
            <strong>{copy.empty}</strong>
          </div>
        ) : null}

        {filteredMarkers.length > 0 ? (
          <div className="map-discovery-layout">
            <div className="map-discovery-board" aria-label={copy.title}>
              <div className="map-discovery-board__surface">
                <span className="map-region-label map-region-label--muscat">Muscat</span>
                <span className="map-region-label map-region-label--salalah">Salalah</span>
                <span className="map-region-label map-region-label--sohar">Sohar</span>

                {filteredMarkers.map((marker) => {
                  const position = getMapPinPosition(marker.latitude, marker.longitude);
                  const isActive = activeMarker?.id === marker.id;
                  const Icon = marker.kind === 'PROJECT' ? Building2 : Home;

                  return (
                    <button
                      key={marker.id}
                      type="button"
                      className={`map-pin map-pin--${marker.kind.toLowerCase()}${isActive ? ' active' : ''}`}
                      style={position}
                      onClick={() => setActiveMarkerId(marker.id)}
                      aria-label={`${marker.title} · ${marker.location}`}
                    >
                      <Icon size={15} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <p>{copy.mapNote}</p>
            </div>

            <aside className="map-discovery-sidebar" aria-label="Map results">
              {activeMarker ? (
                <article className="map-active-card">
                  {activeMarker.image ? <img src={activeMarker.image} alt={activeMarker.title} /> : null}
                  <div>
                    <p className="eyebrow">{activeMarker.kind === 'PROJECT' ? copy.project : copy.listing}</p>
                    <h2>{activeMarker.title}</h2>
                    <p>
                      <MapPin size={16} aria-hidden="true" />
                      {activeMarker.mapPlaceLabel || activeMarker.location}
                    </p>
                    {activeMarker.price ? <strong>{activeMarker.price}</strong> : null}
                    <div className="map-active-card__meta">
                      {activeMarker.category ? <span>{activeMarker.category}</span> : null}
                      {activeMarker.unitCount ? <span>{activeMarker.unitCount} {copy.units}</span> : null}
                      {activeMarker.verified ? <span><ShieldCheck size={14} aria-hidden="true" /> {copy.verified}</span> : null}
                    </div>
                    <div className="map-active-card__actions">
                      <Link className="button-link button-link--primary" to={activeMarker.detailPath}>
                        {copy.openDetails}
                      </Link>
                      <a
                        className="button-link button-link--secondary"
                        href={activeMarker.mapGoogleUrl || getGoogleMapsSearchUrl({ latitude: activeMarker.latitude, longitude: activeMarker.longitude, label: activeMarker.title })}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.openGoogle}
                        <ExternalLink size={16} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </article>
              ) : null}

              <div className="map-result-list">
                {filteredMarkers.map((marker) => (
                  <button
                    key={marker.id}
                    type="button"
                    className={activeMarker?.id === marker.id ? 'active' : ''}
                    onClick={() => setActiveMarkerId(marker.id)}
                  >
                    <Navigation size={16} aria-hidden="true" />
                    <span>
                      <strong>{marker.title}</strong>
                      <small>{marker.mapPlaceLabel || marker.location}</small>
                    </span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </section>
  );
}

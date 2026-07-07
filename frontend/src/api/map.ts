import { apiClient } from './client';
import { resolveAssetUrl } from './assets';

import type { ApiMapMarker, Language, MapDiscoveryMarker } from '../types';

function pickLocalized(language: Language, english?: string | null, arabic?: string | null, fallback = '') {
  if (language === 'ar') {
    return arabic || english || fallback;
  }

  return english || arabic || fallback;
}

export async function getMapMarkers(language: Language): Promise<MapDiscoveryMarker[]> {
  const response = await apiClient.get<{ markers: ApiMapMarker[] }>('/api/map/markers');

  return response.markers.map((marker) => ({
    id: marker.id,
    kind: marker.kind,
    slug: marker.slug,
    title: pickLocalized(language, marker.titleEn, marker.titleAr),
    location: pickLocalized(language, marker.locationEn, marker.locationAr),
    mapPlaceLabel: marker.mapPlaceLabel ?? undefined,
    mapAddress: marker.mapAddress ?? undefined,
    mapGoogleUrl: marker.mapGoogleUrl ?? undefined,
    latitude: Number(marker.latitude),
    longitude: Number(marker.longitude),
    price: marker.price ?? undefined,
    image: marker.image ? resolveAssetUrl(marker.image) : undefined,
    transaction: marker.transaction ?? undefined,
    category: pickLocalized(language, marker.categoryEn, marker.categoryAr),
    partnerName: pickLocalized(language, marker.partnerNameEn, marker.partnerNameAr),
    verified: marker.verified,
    unitCount: marker.unitCount,
    detailPath: marker.detailPath,
    createdAt: marker.createdAt
  }));
}

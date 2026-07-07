const OMAN_BOUNDS = {
  minLat: 16.4,
  maxLat: 26.7,
  minLng: 51.9,
  maxLng: 60.4
};

type ParsedCoordinates = {
  latitude: string;
  longitude: string;
};

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function normalizeCoordinate(value: number) {
  return value.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
}

export function parseCoordinatesFromMapInput(value: string): ParsedCoordinates | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  let decoded = trimmed;

  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(^|\s)(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(\s|$)/
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;

    const latitude = Number(match.length === 5 ? match[2] : match[1]);
    const longitude = Number(match.length === 5 ? match[3] : match[2]);

    if (isValidCoordinate(latitude, longitude)) {
      return {
        latitude: normalizeCoordinate(latitude),
        longitude: normalizeCoordinate(longitude)
      };
    }
  }

  return null;
}

export function getGoogleMapsSearchUrl(options: {
  latitude?: string | number | null;
  longitude?: string | number | null;
  label?: string;
  fallbackQuery?: string;
}) {
  const latitude = Number(options.latitude);
  const longitude = Number(options.longitude);

  if (isValidCoordinate(latitude, longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  const query = options.label || options.fallbackQuery || 'Oman';

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function getGoogleMapsEmbedUrl(options: {
  latitude?: string | number | null;
  longitude?: string | number | null;
  label?: string;
  fallbackQuery?: string;
}) {
  const latitude = Number(options.latitude);
  const longitude = Number(options.longitude);

  if (isValidCoordinate(latitude, longitude)) {
    return `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
  }

  const query = options.label || options.fallbackQuery;

  return query
    ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
    : undefined;
}

export function getMapPinPosition(latitude: number, longitude: number) {
  const boundedLatitude = Math.min(Math.max(latitude, OMAN_BOUNDS.minLat), OMAN_BOUNDS.maxLat);
  const boundedLongitude = Math.min(Math.max(longitude, OMAN_BOUNDS.minLng), OMAN_BOUNDS.maxLng);
  const x = ((boundedLongitude - OMAN_BOUNDS.minLng) / (OMAN_BOUNDS.maxLng - OMAN_BOUNDS.minLng)) * 100;
  const y = (1 - (boundedLatitude - OMAN_BOUNDS.minLat) / (OMAN_BOUNDS.maxLat - OMAN_BOUNDS.minLat)) * 100;

  return {
    left: `${Math.min(Math.max(x, 4), 96)}%`,
    top: `${Math.min(Math.max(y, 4), 96)}%`
  };
}

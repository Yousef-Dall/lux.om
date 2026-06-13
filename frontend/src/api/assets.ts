export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

const ABSOLUTE_ASSET_PATTERN = /^(?:https?:|data:|blob:)/i;

export function normalizeAssetReference(value?: string | null) {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return '';
  }

  if (ABSOLUTE_ASSET_PATTERN.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  return `/${normalized}`;
}

export function resolveAssetUrl(value?: string | null) {
  const normalized = normalizeAssetReference(value);

  if (!normalized || ABSOLUTE_ASSET_PATTERN.test(normalized)) {
    return normalized;
  }

  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

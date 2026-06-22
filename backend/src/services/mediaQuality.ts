import { EnhancementStatus, MediaQualityStatus } from '@prisma/client';

export type MediaQualityInput = {
  mainImage?: string | null;
  images?: Array<{
    url?: string | null;
    width?: number | null;
    height?: number | null;
  }>;
  videoWalkthroughUrl?: string | null;
  tour360Url?: string | null;
  virtualTourUrl?: string | null;
  floorPlanUrl?: string | null;
  listingType?: string | null;
  activityType?: string | null;
  transaction?: string | null;
};

export type MediaQualityResult = {
  status: MediaQualityStatus;
  notes: string;
  suggestions: string[];
  checks: {
    hasMainImage: boolean;
    imageCount: number;
    hasEnoughImages: boolean;
    hasLowResolutionImage: boolean;
    hasVideoOrTour: boolean;
    hasFloorPlan: boolean;
  };
};

const MIN_IMAGE_COUNT = 4;
const MIN_IMAGE_WIDTH = 900;
const MIN_IMAGE_HEIGHT = 650;

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function hasValue(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}

function getImageCount(input: MediaQualityInput) {
  const urls = new Set<string>();

  if (hasValue(input.mainImage)) {
    urls.add(input.mainImage!.trim());
  }

  for (const image of input.images ?? []) {
    if (hasValue(image.url)) {
      urls.add(image.url!.trim());
    }
  }

  return urls.size;
}

function hasLowResolutionImage(input: MediaQualityInput) {
  return (input.images ?? []).some((image) => {
    if (!image.width || !image.height) {
      return false;
    }

    return image.width < MIN_IMAGE_WIDTH || image.height < MIN_IMAGE_HEIGHT;
  });
}

function createSuggestions(input: MediaQualityInput, checks: MediaQualityResult['checks']) {
  const suggestions: string[] = [];
  const listingType = normalizeText(input.listingType);
  const activityType = normalizeText(input.activityType);
  const transaction = normalizeText(input.transaction);

  if (!checks.hasMainImage) {
    suggestions.push('Add a clear main image.');
  }

  if (!checks.hasEnoughImages) {
    suggestions.push('Add more high-quality photos before publishing.');
  }

  if (checks.hasLowResolutionImage) {
    suggestions.push('Replace low-resolution images with sharper versions.');
  }

  if (!checks.hasVideoOrTour) {
    suggestions.push('Add a video walkthrough or 360 tour for stronger buyer confidence.');
  }

  if (transaction === 'sale' && !checks.hasFloorPlan) {
    suggestions.push('Add a floor plan for sale listings when available.');
  }

  if (
    listingType.includes('villa') ||
    listingType.includes('house') ||
    listingType.includes('chalet')
  ) {
    suggestions.push('Add exterior, living area, kitchen, bedroom, bathroom, and outdoor space photos.');
  } else if (listingType.includes('apartment') || listingType.includes('flat')) {
    suggestions.push('Add building exterior, living area, kitchen, bedroom, bathroom, and view photos.');
  } else if (activityType) {
    suggestions.push('Add photos that show the experience, meeting point, safety setup, and group size.');
  } else {
    suggestions.push('Add brighter images and key detail photos.');
  }

  return Array.from(new Set(suggestions));
}

export function evaluateMediaQuality(input: MediaQualityInput): MediaQualityResult {
  const imageCount = getImageCount(input);

  const checks = {
    hasMainImage: hasValue(input.mainImage),
    imageCount,
    hasEnoughImages: imageCount >= MIN_IMAGE_COUNT,
    hasLowResolutionImage: hasLowResolutionImage(input),
    hasVideoOrTour:
      hasValue(input.videoWalkthroughUrl) ||
      hasValue(input.tour360Url) ||
      hasValue(input.virtualTourUrl),
    hasFloorPlan: hasValue(input.floorPlanUrl)
  };

  const suggestions = createSuggestions(input, checks);

  let status: MediaQualityStatus = 'EXCELLENT';

  if (!checks.hasMainImage || checks.imageCount === 0) {
    status = 'NEEDS_REVIEW';
  } else if (
    !checks.hasEnoughImages ||
    checks.hasLowResolutionImage ||
    !checks.hasVideoOrTour
  ) {
    status = 'ACCEPTABLE';
  }

  const notes = suggestions.length
    ? suggestions.join(' ')
    : 'Media looks ready for launch review.';

  return {
    status,
    notes,
    suggestions,
    checks
  };
}

export function getDefaultEnhancementStatus(): EnhancementStatus {
  return process.env.IMAGE_ENHANCEMENT_PROVIDER ? 'NOT_REQUESTED' : 'NOT_CONFIGURED';
}

export function getEnhancementServiceMessage(status?: EnhancementStatus | null) {
  if (status === 'NOT_CONFIGURED') {
    return 'Enhancement service is not configured.';
  }

  if (status === 'QUEUED') {
    return 'Image enhancement request is queued.';
  }

  if (status === 'PROCESSING') {
    return 'Image enhancement is processing.';
  }

  if (status === 'COMPLETED') {
    return 'Enhanced image is available.';
  }

  if (status === 'FAILED') {
    return 'Image enhancement failed. Please review the uploaded media manually.';
  }

  return 'Image enhancement has not been requested.';
}

export function getMediaQualityStatusLabel(status?: MediaQualityStatus | null) {
  switch (status) {
    case 'EXCELLENT':
      return 'Excellent media';
    case 'ACCEPTABLE':
      return 'Acceptable media';
    case 'NEEDS_REVIEW':
      return 'Needs media review';
    case 'BLOCKED':
      return 'Media blocked';
    default:
      return 'Not checked';
  }
}

export function createMediaQualityUpdate(input: MediaQualityInput) {
  const result = evaluateMediaQuality(input);

  return {
    mediaQualityStatus: result.status,
    mediaQualityNotes: result.notes,
    enhancementStatus: getDefaultEnhancementStatus()
  };
}
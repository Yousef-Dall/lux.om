import { normalizeAssetReference } from './assets';
import { apiClient } from './client';

export const MAX_IMAGE_UPLOAD_MB = 5;
export const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_COUNT = 8;

export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const;

export const ACCEPTED_IMAGE_INPUT_TYPES = ACCEPTED_IMAGE_MIME_TYPES.join(',');

const acceptedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

type ImageValidationMessages = {
  invalidType?: string;
  tooLarge?: string;
};

function hasAcceptedImageExtension(filename: string) {
  const lowerCaseFilename = filename.toLowerCase();

  return acceptedImageExtensions.some((extension) =>
    lowerCaseFilename.endsWith(extension)
  );
}

export function getImageUploadValidationError(
  file: File,
  messages: ImageValidationMessages = {}
) {
  const hasAcceptedMimeType = ACCEPTED_IMAGE_MIME_TYPES.includes(
    file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number]
  );

  if (!hasAcceptedMimeType || !hasAcceptedImageExtension(file.name)) {
    return (
      messages.invalidType ??
      'Only JPG, PNG, WEBP, and GIF images are allowed.'
    );
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return (
      messages.tooLarge ??
      `Image is too large. Maximum size is ${MAX_IMAGE_UPLOAD_MB}MB.`
    );
  }

  return '';
}

type UploadResponse = {
  url?: string;
  fileUrl?: string;
  imageUrl?: string;
  path?: string;
  file?: {
    url?: string;
  };
};

function getUploadedUrl(payload: UploadResponse) {
  return (
    payload.url ??
    payload.fileUrl ??
    payload.imageUrl ??
    payload.path ??
    payload.file?.url ??
    null
  );
}

export async function uploadImage(file: File, token: string) {
  const validationError = getImageUploadValidationError(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append('image', file);

  const payload = await apiClient.upload<UploadResponse>('/api/uploads', formData, {
    token
  });

  const uploadedUrl = getUploadedUrl(payload);

  if (!uploadedUrl) {
    throw new Error('Upload succeeded, but no image URL was returned');
  }

  return normalizeAssetReference(uploadedUrl);
}
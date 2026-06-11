import { apiClient } from './client';

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
  const formData = new FormData();
  formData.append('image', file);

  const payload = await apiClient.upload<UploadResponse>('/api/uploads', formData, {
    token
  });

  const uploadedUrl = getUploadedUrl(payload);

  if (!uploadedUrl) {
    throw new Error('Upload succeeded, but no image URL was returned');
  }

  return uploadedUrl.startsWith('/') ? uploadedUrl : `/${uploadedUrl}`;
}
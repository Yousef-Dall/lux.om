import { apiClient } from './client';

export type AdminMediaQualityStatus =
  | 'NOT_CHECKED'
  | 'NEEDS_REVIEW'
  | 'ACCEPTABLE'
  | 'EXCELLENT'
  | 'BLOCKED';

export type AdminEnhancementStatus =
  | 'NOT_REQUESTED'
  | 'NOT_CONFIGURED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export type AdminMediaQualityItem = Record<string, unknown> & {
  id: string;
  itemType: 'LISTING' | 'ACTIVITY';
  title: string;
  slug: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
  status: string;
  mediaQualityStatus: AdminMediaQualityStatus;
  mediaQualityNotes?: string | null;
  enhancementStatus: AdminEnhancementStatus;
  imageCount: number;
  hasMainImage: boolean;
  hasVideoOrTour: boolean;
  hasFloorPlan: boolean;
  updatedAt: string;
  publicPath: string;
};

export type AdminMediaQualityQueueResponse = {
  items: AdminMediaQualityItem[];
  total: number;
};

export type AdminMediaQualityQueueParams = {
  itemType?: 'LISTING' | 'ACTIVITY';
  mediaQualityStatus?: AdminMediaQualityStatus;
  take?: number;
};

export type UpdateAdminMediaQualityPayload = {
  mediaQualityStatus?: AdminMediaQualityStatus;
  mediaQualityNotes?: string | null;
  enhancementStatus?: AdminEnhancementStatus;
};

function toQueryString(params?: AdminMediaQualityQueueParams) {
  const searchParams = new URLSearchParams();

  if (params?.itemType) searchParams.set('itemType', params.itemType);
  if (params?.mediaQualityStatus) {
    searchParams.set('mediaQualityStatus', params.mediaQualityStatus);
  }
  if (typeof params?.take === 'number') {
    searchParams.set('take', String(params.take));
  }

  const queryString = searchParams.toString();

  return queryString ? `?${queryString}` : '';
}

export async function getAdminMediaQualityQueue(
  token: string,
  params?: AdminMediaQualityQueueParams
) {
  return apiClient.get<AdminMediaQualityQueueResponse>(
    `/api/media-quality/admin/queue${toQueryString(params)}`,
    {
      token
    }
  );
}

export async function updateAdminMediaQualityItem(
  token: string,
  itemType: 'LISTING' | 'ACTIVITY',
  itemId: string,
  payload: UpdateAdminMediaQualityPayload
) {
  return apiClient.patch<{ item: AdminMediaQualityItem }>(
    `/api/media-quality/admin/${itemType}/${itemId}`,
    payload,
    {
      token
    }
  );
}

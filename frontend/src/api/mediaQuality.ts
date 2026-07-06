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

export type AdminMediaQualityItemType = 'LISTING' | 'ACTIVITY' | 'PROJECT';

export type AdminMediaQualityWarning =
  | 'MISSING_HERO'
  | 'WEAK_IMAGE_COUNT'
  | 'MISSING_VIDEO_TOUR'
  | 'MISSING_FLOOR_PLAN';

export type AdminMediaQualityItem = Record<string, unknown> & {
  id: string;
  itemType: AdminMediaQualityItemType;
  title: string;
  slug: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  status: string;
  mediaQualityStatus: AdminMediaQualityStatus;
  mediaQualityNotes?: string | null;
  enhancementStatus: AdminEnhancementStatus;
  enhancementNotes?: string | null;
  imageCount: number;
  hasMainImage: boolean;
  hasVideoOrTour: boolean;
  hasFloorPlan: boolean;
  thumbnailUrl?: string | null;
  warnings: AdminMediaQualityWarning[];
  updatedAt: string;
  publicPath: string;
};

export type AdminMediaQualityQueueResponse = {
  items: AdminMediaQualityItem[];
  total: number;
  pagination?: {
    take: number;
    skip: number;
    count: number;
  };
};

export type AdminMediaQualityQueueParams = {
  itemType?: AdminMediaQualityItemType;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  mediaQualityStatus?: AdminMediaQualityStatus;
  warning?: AdminMediaQualityWarning;
  take?: number;
  skip?: number;
};

export type UpdateAdminMediaQualityPayload = {
  mediaQualityStatus?: AdminMediaQualityStatus;
  mediaQualityNotes?: string | null;
  enhancementStatus?: AdminEnhancementStatus;
  enhancementNotes?: string | null;
};

function toQueryString(params?: AdminMediaQualityQueueParams) {
  const searchParams = new URLSearchParams();

  if (params?.itemType) searchParams.set('itemType', params.itemType);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.mediaQualityStatus) {
    searchParams.set('mediaQualityStatus', params.mediaQualityStatus);
  }
  if (params?.warning) searchParams.set('warning', params.warning);
  if (typeof params?.take === 'number') {
    searchParams.set('take', String(params.take));
  }
  if (typeof params?.skip === 'number') {
    searchParams.set('skip', String(params.skip));
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
  itemType: AdminMediaQualityItemType,
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

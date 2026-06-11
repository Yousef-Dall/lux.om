import { apiClient } from './client';
import type { ApiActivity, DayName } from '../types';

export type CreateActivityPayload = {
  titleEn: string;
  titleAr?: string;
  descriptionEn: string;
  descriptionAr?: string;
  locationEn: string;
  locationAr?: string;
  categoryEn: string;
  categoryAr?: string;

  travelAgencyId?: string;
  providerEn?: string;
  providerAr?: string;

  price: string;
  durationMinutes?: number;
  durationLabelEn?: string;
  durationLabelAr?: string;
  durationType?: string;
  groupSize?: string;
  language?: string;
  difficulty?: string;
  activityType?: string;

  availabilityDays: DayName[];
  availabilityStartTime: string;
  availabilityEndTime: string;

  familyFriendly: boolean;
  includesTransfer: boolean;
  mealIncluded: boolean;
  outdoor: boolean;

  nearestLandmarkId?: string;
  distanceFromLandmarkEn?: string;
  distanceFromLandmarkAr?: string;

  images: Array<{
    url: string;
    altEn?: string;
    altAr?: string;
    sortOrder?: number;
  }>;

  highlights: Array<{
    textEn: string;
    textAr?: string;
  }>;
};

export async function createActivity(payload: CreateActivityPayload, token: string) {
  return apiClient.post<{ activity: ApiActivity }>('/api/activities', payload, { token });
}
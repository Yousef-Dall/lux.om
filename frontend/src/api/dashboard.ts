import { apiClient } from './client';
import { mapActivity, mapListing } from './mappers';

import type { Activity, ApiActivity, ApiListing, Language, Listing } from '../types';

export type DashboardStats = {
  totalListings: number;
  pendingListings: number;
  approvedListings: number;
  rejectedListings: number;
  totalActivities: number;
  pendingActivities: number;
  approvedActivities: number;
  rejectedActivities: number;
  submittedInquiries: number;
  receivedInquiries: number;
};

type ApiDashboardResponse = {
  stats: DashboardStats;
  listings: ApiListing[];
  activities: ApiActivity[];
};

export type DashboardData = {
  stats: DashboardStats;
  listings: Listing[];
  activities: Activity[];
};

export async function getDashboardData(
  token: string,
  language: Language
): Promise<DashboardData> {
  const response = await apiClient.get<ApiDashboardResponse>('/api/dashboard', {
    token
  });

  return {
    stats: response.stats,
    listings: response.listings.map((listing) => mapListing(listing, language)),
    activities: response.activities.map((activity) => mapActivity(activity, language))
  };
}
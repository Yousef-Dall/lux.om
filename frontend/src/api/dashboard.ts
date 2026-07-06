import { apiClient } from './client';
import { mapActivity, mapListing } from './mappers';

import type { Activity, ApiActivity, ApiListing, Language, Listing } from '../types';
import type { ApiBooking } from './bookings';

export type ApiNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  bookingId: string | null;
  createdAt: string;
};



export type DashboardHealthAttentionPriority = 'critical' | 'high' | 'medium' | 'low';

export type DashboardHealthAttentionItem = {
  key: string;
  priority: DashboardHealthAttentionPriority;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  actionTo?: string;
};

export type DashboardHealth = {
  readinessScore: number;
  attentionCount: number;
  urgentCount: number;
  nextBestAction: DashboardHealthAttentionItem | null;
  attentionItems: DashboardHealthAttentionItem[];
  breakdown: {
    emailVerified: boolean;
    hasInventory: boolean;
    hasDemand: boolean;
    pendingReviewCount: number;
    pendingPayments: number;
    receivedPendingBookings: number;
    unreadNotifications: number;
    verificationGaps: number;
    mediaGaps: number;
  };
};

const emptyDashboardHealth: DashboardHealth = {
  readinessScore: 0,
  attentionCount: 0,
  urgentCount: 0,
  nextBestAction: null,
  attentionItems: [],
  breakdown: {
    emailVerified: false,
    hasInventory: false,
    hasDemand: false,
    pendingReviewCount: 0,
    pendingPayments: 0,
    receivedPendingBookings: 0,
    unreadNotifications: 0,
    verificationGaps: 0,
    mediaGaps: 0
  }
};

export type DashboardBookingOperationDay = {
  date: string;
  totalBookings: number;
  totalGuests: number;
  pendingBookings: number;
  approvedBookings: number;
  cancellationRequests: number;
  paidBookings: number;
  capacityGuests: number | null;
  availableGuests: number | null;
  bookingIds: string[];
  bookings: ApiBooking[];
};

export type DashboardStats = {
  totalListings: number;
  pendingListings: number;
  approvedListings: number;
  rejectedListings: number;
  totalActivities: number;
  pendingActivities: number;
  approvedActivities: number;
  rejectedActivities: number;
  totalProjects: number;
  pendingProjects: number;
  approvedProjects: number;
  rejectedProjects: number;
  submittedInquiries: number;
  receivedInquiries: number;
  submittedBookings: number;
  receivedBookings: number;
  receivedPendingBookings: number;
  pendingPayments: number;
  pendingReviewCount: number;
  verificationGaps: number;
  mediaGaps: number;
  unreadNotifications: number;
  savedListings: number;
  savedActivities: number;
  savedSearches: number;
  savedItems: number;
  totalTravelPackages: number;
  totalLocalActivities: number;
};

type ApiDashboardResponse = {
  health?: DashboardHealth;
  stats: DashboardStats;
  listings: ApiListing[];
  activities: ApiActivity[];
  bookings: ApiBooking[];
  receivedBookings: ApiBooking[];
  receivedBookingOperations: DashboardBookingOperationDay[];
  notifications: ApiNotification[];
};

export type DashboardData = {
  health: DashboardHealth;
  stats: DashboardStats;
  listings: Listing[];
  activities: Activity[];
  bookings: ApiBooking[];
  receivedBookings: ApiBooking[];
  receivedBookingOperations: DashboardBookingOperationDay[];
  notifications: ApiNotification[];
};

export async function getDashboardData(
  token: string,
  language: Language
): Promise<DashboardData> {
  const response = await apiClient.get<ApiDashboardResponse>('/api/dashboard', {
    token
  });

  return {
    health: response.health ?? emptyDashboardHealth,
    stats: response.stats,
    listings: response.listings.map((listing) => mapListing(listing, language)),
    activities: response.activities.map((activity) => mapActivity(activity, language)),
    bookings: response.bookings ?? [],
    receivedBookings: response.receivedBookings ?? [],
    receivedBookingOperations: response.receivedBookingOperations ?? [],
    notifications: response.notifications ?? []
  };
}

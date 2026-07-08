import { apiClient } from './client';
import type { ApiNotification } from './dashboard';

export type NotificationActionContext =
  | 'ACCOUNT_SECURITY'
  | 'BOOKING'
  | 'APPROVAL_LISTING'
  | 'APPROVAL_ACTIVITY'
  | 'APPROVAL_DEVELOPER_PROJECT'
  | 'PUBLISHING'
  | 'REPORT'
  | 'VERIFICATION'
  | 'RENT_PAYMENT'
  | 'PMS'
  | 'TRANSACTION'
  | 'SAVED_SEARCH'
  | 'DASHBOARD';

export type ActionableNotification = ApiNotification & {
  actionUrl?: string | null;
  actionLabel?: string | null;
  actionContext?: NotificationActionContext | null;
  targetType?: string | null;
  targetId?: string | null;
  booking?: {
    id: string;
    status?: string | null;
    listingId?: string | null;
    activityId?: string | null;
    payment?: {
      status?: string | null;
    } | null;
  } | null;
};

export type NotificationsResponse = {
  notifications: ActionableNotification[];
  unreadCount: number;
  pagination: {
    take: number;
    skip: number;
    count: number;
    total: number;
  };
};

export async function getNotifications(token: string, take = 20, skip = 0) {
  const params = new URLSearchParams({
    take: String(take),
    skip: String(skip)
  });

  return apiClient.get<NotificationsResponse>(
    `/api/notifications?${params.toString()}`,
    {
      token
    }
  );
}

export async function markNotificationRead(notificationId: string, token: string) {
  return apiClient.patch<{ notification: ActionableNotification }>(
    `/api/notifications/${notificationId}/read`,
    {},
    {
      token
    }
  );
}

export async function markAllNotificationsRead(token: string) {
  return apiClient.patch<{ count: number }>(
    '/api/notifications/read-all',
    {},
    {
      token
    }
  );
}

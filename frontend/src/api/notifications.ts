import { apiClient } from './client';
import type { ApiNotification } from './dashboard';

export type NotificationsResponse = {
  notifications: ApiNotification[];
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
  return apiClient.patch<{ notification: ApiNotification }>(
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

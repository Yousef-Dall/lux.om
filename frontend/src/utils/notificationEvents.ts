export const NOTIFICATION_UNREAD_COUNT_EVENT = 'lux:notification-unread-count';

export type NotificationUnreadCountEventDetail = {
  unreadCount: number;
};

export function announceNotificationUnreadCount(unreadCount: number) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<NotificationUnreadCountEventDetail>(
      NOTIFICATION_UNREAD_COUNT_EVENT,
      {
        detail: {
          unreadCount: Math.max(0, unreadCount)
        }
      }
    )
  );
}

export function readNotificationUnreadCountEvent(event: Event) {
  if (!(event instanceof CustomEvent)) return null;

  const detail = event.detail as Partial<NotificationUnreadCountEventDetail> | undefined;

  if (!detail || typeof detail.unreadCount !== 'number') return null;

  return Math.max(0, detail.unreadCount);
}

import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../api/notifications';
import type { Language } from '../types';

type NotificationBellProps = {
  token: string | null;
  language: Language;
  onNavigate?: () => void;
};

type NotificationItem = {
  id: string;
  type?: string;
  title?: string;
  message?: string;
  readAt?: string | null;
  createdAt?: string;
};

function normalizeNotification(value: unknown): NotificationItem | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;

  if (typeof record.id !== 'string') return null;

  return {
    id: record.id,
    type: typeof record.type === 'string' ? record.type : undefined,
    title: typeof record.title === 'string' ? record.title : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
    readAt:
      typeof record.readAt === 'string' || record.readAt === null
        ? record.readAt
        : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined
  };
}

function formatNotificationDate(value?: string, language: Language = 'en') {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatType(type?: string) {
  if (!type) return '';

  const labels: Record<string, string> = {
    BOOKING_CREATED: 'booking',
    BOOKING_OWNER_APPROVED: 'booking approved',
    BOOKING_OWNER_REJECTED: 'booking rejected',
    BOOKING_ADMIN_CONFIRMED: 'booking confirmed',
    BOOKING_CANCELLATION_REQUESTED: 'cancellation requested',
    BOOKING_CANCELLED: 'booking cancelled',
    BOOKING_PAYMENT_PAID: 'payment paid',
    BOOKING_PAYMENT_FAILED: 'payment failed',
    RENT_PAYMENT_DUE: 'rent payment',
    TRANSACTION_STATUS_UPDATED: 'contract / transaction',
    REVIEW_STATUS_UPDATED: 'review / status',
    VERIFICATION_STATUS_UPDATED: 'verification',
    SAVED_SEARCH_MATCH: 'saved search'
  };

  return labels[type] ?? type.replace(/_/g, ' ').toLowerCase();
}

export default function NotificationBell({
  token,
  language,
  onNavigate
}: NotificationBellProps) {
  const copy =
    language === 'ar'
      ? {
          label: 'الإشعارات',
          loading: 'جاري تحميل الإشعارات...',
          empty: 'لا توجد إشعارات بعد.',
          markRead: 'تحديد كمقروء',
          markAll: 'تحديد الكل كمقروء',
          openDashboard: 'فتح مركز الإشعارات',
          unread: 'إشعارات غير مقروءة',
          error: 'تعذر تحميل الإشعارات حالياً.'
        }
      : {
          label: 'Notifications',
          loading: 'Loading notifications...',
          empty: 'No notifications yet.',
          markRead: 'Mark read',
          markAll: 'Mark all read',
          openDashboard: 'Open notification center',
          unread: 'Unread notifications',
          error: 'Could not load notifications right now.'
        };

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  async function loadNotifications(options?: { silent?: boolean }) {
    if (!token) return;

    try {
      if (!options?.silent) setLoading(true);
      setErrorMessage('');

      const response = await getNotifications(token, 8, 0);

      setNotifications(
        response.notifications
          .map((notification) => normalizeNotification(notification))
          .filter((notification): notification is NotificationItem => Boolean(notification))
      );
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error(error);
      if (!options?.silent) setErrorMessage(copy.error);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setIsOpen(false);
      return;
    }

    void loadNotifications({ silent: true });

    const intervalId = window.setInterval(() => {
      void loadNotifications({ silent: true });
    }, 60000);

    function handleFocus() {
      void loadNotifications({ silent: true });
    }

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);

    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  async function handleToggle() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      await loadNotifications();
    }
  }

  async function handleMarkRead(notificationId: string) {
    if (!token || actionId) return;

    try {
      setActionId(notificationId);
      await markNotificationRead(notificationId, token);
      await loadNotifications({ silent: true });
    } catch (error) {
      console.error(error);
      setErrorMessage(copy.error);
    } finally {
      setActionId('');
    }
  }

  async function handleMarkAllRead() {
    if (!token || actionId) return;

    try {
      setActionId('all');
      await markAllNotificationsRead(token);
      await loadNotifications({ silent: true });
    } catch (error) {
      console.error(error);
      setErrorMessage(copy.error);
    } finally {
      setActionId('');
    }
  }

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-label={`${copy.label}${unreadCount > 0 ? `, ${unreadCount} ${copy.unread}` : ''}`}
        className="notification-bell__trigger"
        type="button"
        onClick={() => void handleToggle()}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="notification-bell__badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="notification-bell__panel">
          <div className="notification-bell__header">
            <div>
              <strong>{copy.label}</strong>
              {unreadCount > 0 ? (
                <span>
                  {unreadCount} {copy.unread}
                </span>
              ) : null}
            </div>

            <button
              className="notification-bell__text-button"
              type="button"
              disabled={unreadCount === 0 || actionId === 'all'}
              onClick={() => void handleMarkAllRead()}
            >
              {actionId === 'all' ? (
                <Loader2 size={14} aria-hidden="true" />
              ) : (
                <CheckCheck size={14} aria-hidden="true" />
              )}
              {copy.markAll}
            </button>
          </div>

          {loading ? (
            <p className="notification-bell__state">{copy.loading}</p>
          ) : null}

          {errorMessage ? (
            <p className="notification-bell__error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {!loading && notifications.length === 0 ? (
            <p className="notification-bell__state">{copy.empty}</p>
          ) : null}

          <div className="notification-bell__list">
            {notifications.map((notification) => {
              const isUnread = !notification.readAt;

              return (
                <article
                  className={`notification-bell__item${
                    isUnread ? ' notification-bell__item--unread' : ''
                  }`}
                  key={notification.id}
                >
                  <div>
                    <span>{formatType(notification.type)}</span>
                    <strong>{notification.title ?? copy.label}</strong>
                    {notification.message ? <p>{notification.message}</p> : null}
                    {notification.createdAt ? (
                      <small>{formatNotificationDate(notification.createdAt, language)}</small>
                    ) : null}
                  </div>

                  {isUnread ? (
                    <button
                      aria-label={copy.markRead}
                      className="notification-bell__mark"
                      type="button"
                      disabled={Boolean(actionId)}
                      onClick={() => void handleMarkRead(notification.id)}
                    >
                      {actionId === notification.id ? (
                        <Loader2 size={14} aria-hidden="true" />
                      ) : (
                        <Check size={14} aria-hidden="true" />
                      )}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>

          <Link
            className="notification-bell__footer"
            to="/notifications"
            onClick={() => {
              setIsOpen(false);
              onNavigate?.();
            }}
          >
            {copy.openDashboard}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ActionableNotification
} from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { announceNotificationUnreadCount } from '../utils/notificationEvents';

type NotificationRecord = ActionableNotification;
type ReadFilter = 'ALL' | 'UNREAD' | 'READ';

const PAGE_SIZE = 25;

function formatNotificationDate(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function getNotificationRoute(notification: NotificationRecord, isAdmin: boolean) {
  if (notification.actionUrl) return notification.actionUrl;

  if (notification.type === 'ACCOUNT_SECURITY') return '/profile';

  if (notification.type === 'REVIEW_STATUS_UPDATED') {
    return isAdmin ? '/admin?workspace=reviewDetails' : '/notifications';
  }

  if (notification.type === 'VERIFICATION_STATUS_UPDATED') {
    return isAdmin
      ? '/admin?workspace=health&section=admin-health'
      : '/dashboard?workspace=verification';
  }

  return '/dashboard';
}

function getNotificationIcon(type: string) {
  if (type === 'ACCOUNT_SECURITY') {
    return <ShieldCheck size={18} aria-hidden="true" />;
  }

  if (type === 'REVIEW_STATUS_UPDATED' || type === 'VERIFICATION_STATUS_UPDATED') {
    return <AlertTriangle size={18} aria-hidden="true" />;
  }

  if (type.startsWith('BOOKING_')) {
    return <Clock3 size={18} aria-hidden="true" />;
  }

  return <Bell size={18} aria-hidden="true" />;
}

export default function Notifications() {
  const { language } = useLanguage();
  const { token, isAdmin } = useAuth();

  useDocumentTitle('Notifications');

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [query, setQuery] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'مركز التنبيهات',
          title: 'كل تنبيهات حسابك',
          text:
            'تابعي تحديثات الحجوزات، الدفع، التحقق، أمان الحساب، وقرارات المراجعة من مكان واحد.',
          search: 'بحث',
          searchPlaceholder: 'ابحثي في العنوان أو الرسالة أو النوع',
          all: 'الكل',
          unread: 'غير مقروء',
          read: 'مقروء',
          unreadCount: 'غير مقروء',
          total: 'إجمالي التنبيهات',
          currentPage: 'المعروضة الآن',
          refresh: 'تحديث',
          markAll: 'تحديد الكل كمقروء',
          markRead: 'تحديد كمقروء',
          open: 'فتح الإجراء',
          targetContext: 'الإجراء',
          actionContextLabels: {
            ACCOUNT_SECURITY: 'أمان الحساب',
            BOOKING: 'حجز',
            APPROVAL_LISTING: 'مراجعة عقار',
            APPROVAL_ACTIVITY: 'مراجعة نشاط',
            APPROVAL_DEVELOPER_PROJECT: 'مراجعة مشروع مطور',
            PUBLISHING: 'مراجعة النشر',
            REPORT: 'بلاغ ثقة وسلامة',
            VERIFICATION: 'تحقق',
            RENT_PAYMENT: 'دفعات الإيجار',
            TRANSACTION: 'معاملة',
            SAVED_SEARCH: 'بحث محفوظ',
            DASHBOARD: 'لوحة التحكم'
          } as Record<string, string>,
          empty: 'لا توجد تنبيهات مطابقة.',
          loading: 'جاري تحميل التنبيهات...',
          previous: 'السابق',
          next: 'التالي',
          page: 'صفحة',
          of: 'من',
          loaded: 'تم تحديث التنبيهات.',
          actionError: 'تعذر تحديث التنبيهات.',
          loadError: 'تعذر تحميل التنبيهات.',
          typeLabels: {
            ACCOUNT_SECURITY: 'أمان الحساب',
            BOOKING_CREATED: 'حجز جديد',
            BOOKING_OWNER_APPROVED: 'موافقة المزود',
            BOOKING_OWNER_REJECTED: 'رفض المزود',
            BOOKING_ADMIN_CONFIRMED: 'تأكيد الإدارة',
            BOOKING_CANCELLATION_REQUESTED: 'طلب إلغاء',
            BOOKING_CANCELLED: 'حجز ملغي',
            BOOKING_PAYMENT_PAID: 'دفع ناجح',
            BOOKING_PAYMENT_FAILED: 'دفع فاشل',
            RENT_PAYMENT_DUE: 'دفعة إيجار',
            TRANSACTION_STATUS_UPDATED: 'تحديث معاملة',
            REVIEW_STATUS_UPDATED: 'تحديث مراجعة',
            VERIFICATION_STATUS_UPDATED: 'تحديث تحقق',
            SAVED_SEARCH_MATCH: 'نتيجة بحث محفوظ'
          } as Record<string, string>
        }
      : {
          eyebrow: 'Notification center',
          title: 'All account notifications',
          text:
            'Track booking, payment, verification, account security, and review updates from one place.',
          search: 'Search',
          searchPlaceholder: 'Search title, message, or type',
          all: 'All',
          unread: 'Unread',
          read: 'Read',
          unreadCount: 'Unread',
          total: 'Total notifications',
          currentPage: 'Showing now',
          refresh: 'Refresh',
          markAll: 'Mark all read',
          markRead: 'Mark read',
          open: 'Open action',
          targetContext: 'Action',
          actionContextLabels: {
            ACCOUNT_SECURITY: 'Account security',
            BOOKING: 'Booking',
            APPROVAL_LISTING: 'Listing approval',
            APPROVAL_ACTIVITY: 'Activity approval',
            APPROVAL_DEVELOPER_PROJECT: 'Developer project approval',
            PUBLISHING: 'Publishing review',
            REPORT: 'Trust report',
            VERIFICATION: 'Verification',
            RENT_PAYMENT: 'Rent payment',
            TRANSACTION: 'Transaction',
            SAVED_SEARCH: 'Saved search',
            DASHBOARD: 'Dashboard'
          } as Record<string, string>,
          empty: 'No matching notifications.',
          loading: 'Loading notifications...',
          previous: 'Previous',
          next: 'Next',
          page: 'Page',
          of: 'of',
          loaded: 'Notifications updated.',
          actionError: 'Could not update notifications.',
          loadError: 'Could not load notifications.',
          typeLabels: {
            ACCOUNT_SECURITY: 'Account security',
            BOOKING_CREATED: 'New booking',
            BOOKING_OWNER_APPROVED: 'Provider approved',
            BOOKING_OWNER_REJECTED: 'Provider rejected',
            BOOKING_ADMIN_CONFIRMED: 'Admin confirmed',
            BOOKING_CANCELLATION_REQUESTED: 'Cancellation requested',
            BOOKING_CANCELLED: 'Booking cancelled',
            BOOKING_PAYMENT_PAID: 'Payment paid',
            BOOKING_PAYMENT_FAILED: 'Payment failed',
            RENT_PAYMENT_DUE: 'Rent payment',
            TRANSACTION_STATUS_UPDATED: 'Transaction update',
            REVIEW_STATUS_UPDATED: 'Review update',
            VERIFICATION_STATUS_UPDATED: 'Verification update',
            SAVED_SEARCH_MATCH: 'Saved search match'
          } as Record<string, string>
        };

  const loadNotifications = useCallback(
    async (nextSkip = skip, options?: { silent?: boolean }) => {
      if (!token) return;

      try {
        if (!options?.silent) {
          setLoading(true);
        }

        setError('');
        const response = await getNotifications(token, PAGE_SIZE, nextSkip);

        setNotifications(response.notifications);
        setUnreadCount(response.unreadCount);
        announceNotificationUnreadCount(response.unreadCount);
        setTotal(response.pagination.total);
        setSkip(response.pagination.skip);
      } catch (loadError) {
        console.error(loadError);
        setError(copy.loadError);
      } finally {
        setLoading(false);
      }
    },
    [copy.loadError, skip, token]
  );

  useEffect(() => {
    void loadNotifications(0);
  }, [loadNotifications]);

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notifications.filter((notification) => {
      if (readFilter === 'UNREAD' && notification.readAt) return false;
      if (readFilter === 'READ' && !notification.readAt) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        notification.type,
        copy.typeLabels[notification.type] ?? notification.type,
        notification.title,
        notification.message,
        notification.actionLabel,
        notification.actionContext,
        notification.targetType,
        notification.targetId
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [copy.typeLabels, notifications, query, readFilter]);

  const pageNumber = Math.floor(skip / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canGoPrevious = skip > 0;
  const canGoNext = skip + PAGE_SIZE < total;

  async function runMarkNotificationRead(notificationId: string) {
    if (!token || actionId) return;

    try {
      setActionId(notificationId);
      setError('');
      setActionMessage('');

      const response = await markNotificationRead(notificationId, token);

      const wasUnread = notifications.some(
        (notification) => notification.id === notificationId && !notification.readAt
      );
      const nextUnreadCount = wasUnread ? Math.max(0, unreadCount - 1) : unreadCount;

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? response.notification : notification
        )
      );

      setUnreadCount(nextUnreadCount);
      announceNotificationUnreadCount(nextUnreadCount);
      setActionMessage(copy.loaded);
    } catch (markError) {
      console.error(markError);
      setError(copy.actionError);
    } finally {
      setActionId('');
    }
  }

  async function runMarkAllNotificationsRead() {
    if (!token || actionId) return;

    try {
      setActionId('all');
      setError('');
      setActionMessage('');

      await markAllNotificationsRead(token);
      await loadNotifications(skip, { silent: true });

      setActionMessage(copy.loaded);
    } catch (markError) {
      console.error(markError);
      setError(copy.actionError);
    } finally {
      setActionId('');
    }
  }

  return (
    <section className="page-section notifications-page" aria-busy={loading}>
      <div className="container">
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} />
        <p className="notifications-page__intro">{copy.text}</p>

        <div className="notifications-summary-grid">
          <article>
            <Bell size={20} aria-hidden="true" />
            <span>{copy.total}</span>
            <strong>{total}</strong>
          </article>

          <article>
            <AlertTriangle size={20} aria-hidden="true" />
            <span>{copy.unreadCount}</span>
            <strong>{unreadCount}</strong>
          </article>

          <article>
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>{copy.currentPage}</span>
            <strong>{notifications.length}</strong>
          </article>
        </div>

        <div className="notifications-toolbar">
          <label>
            <span>{copy.search}</span>
            <div className="notifications-search">
              <Search size={16} aria-hidden="true" />
              <input
                id="notification-search"
                name="notificationSearch"
                value={query}
                placeholder={copy.searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>

          <label>
            <span>{copy.unreadCount}</span>
            <select
              id="notification-read-filter"
              name="notificationReadFilter"
              value={readFilter}
              onChange={(event) => setReadFilter(event.target.value as ReadFilter)}
            >
              <option value="ALL">{copy.all}</option>
              <option value="UNREAD">{copy.unread}</option>
              <option value="READ">{copy.read}</option>
            </select>
          </label>

          <button
            className="button-link button-link--secondary"
            type="button"
            onClick={() => void loadNotifications(skip)}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {copy.refresh}
          </button>

          <button
            className="button-link"
            type="button"
            disabled={unreadCount === 0 || actionId === 'all'}
            onClick={() => void runMarkAllNotificationsRead()}
          >
            {actionId === 'all' ? copy.loading : copy.markAll}
          </button>
        </div>

        {error ? <div className="form-error" role="alert">{error}</div> : null}
        {actionMessage ? <div className="form-success" role="status">{actionMessage}</div> : null}

        {loading ? <p className="notifications-page__state" role="status">{copy.loading}</p> : null}

        {!loading && filteredNotifications.length === 0 ? (
          <p className="notifications-page__state" role="status">{copy.empty}</p>
        ) : null}

        {!loading && filteredNotifications.length > 0 ? (
          <div className="notifications-list">
            {filteredNotifications.map((notification) => {
              const isUnread = !notification.readAt;
              const targetRoute = getNotificationRoute(notification, isAdmin);

              return (
                <article
                  className={`notifications-list__item${
                    isUnread ? ' notifications-list__item--unread' : ''
                  }`}
                  key={notification.id}
                >
                  <div className="notifications-list__icon">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="notifications-list__content">
                    <div className="notifications-list__meta">
                      <span>{copy.typeLabels[notification.type] ?? notification.type}</span>
                      <small>{formatNotificationDate(notification.createdAt, language)}</small>
                    </div>

                    <h2>{notification.title}</h2>
                    <p>{notification.message}</p>

                    {notification.actionContext ? (
                      <small className="notifications-list__target">
                        {copy.targetContext}:{' '}
                        {copy.actionContextLabels[notification.actionContext] ??
                          notification.actionContext}
                        {notification.targetId ? ` · ${notification.targetId}` : ''}
                      </small>
                    ) : null}

                    <div className="notifications-list__actions">
                      <Link className="button-link button-link--ghost" to={targetRoute}>
                        {notification.actionLabel || copy.open}
                      </Link>

                      {isUnread ? (
                        <button
                          className="button-link button-link--secondary"
                          type="button"
                          disabled={actionId === notification.id}
                          onClick={() => void runMarkNotificationRead(notification.id)}
                        >
                          {actionId === notification.id ? copy.loading : copy.markRead}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        <div className="notifications-pagination">
          <button
            className="button-link button-link--secondary"
            type="button"
            disabled={!canGoPrevious || loading}
            onClick={() => void loadNotifications(Math.max(0, skip - PAGE_SIZE))}
          >
            {copy.previous}
          </button>

          <span>
            {copy.page} {pageNumber} {copy.of} {totalPages}
          </span>

          <button
            className="button-link button-link--secondary"
            type="button"
            disabled={!canGoNext || loading}
            onClick={() => void loadNotifications(skip + PAGE_SIZE)}
          >
            {copy.next}
          </button>
        </div>
      </div>
    </section>
  );
}

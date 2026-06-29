import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  SkipForward
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  listAdminEmailDeliveries,
  type AdminEmailDeliveryEvent,
  type AdminEmailDeliveriesQuery,
  type EmailDeliveryStatus
} from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

type StatusFilter = NonNullable<AdminEmailDeliveriesQuery['status']>;

const statusOptions: StatusFilter[] = ['all', 'LOGGED', 'SENT', 'SKIPPED', 'FAILED'];

const notificationTypeOptions = [
  'ACCOUNT_SECURITY',
  'BOOKING_CREATED',
  'BOOKING_OWNER_APPROVED',
  'BOOKING_OWNER_REJECTED',
  'BOOKING_ADMIN_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_PAYMENT_PAID',
  'BOOKING_PAYMENT_FAILED',
  'BOOKING_CANCELLATION_REQUESTED',
  'VERIFICATION_STATUS_UPDATED',
  'REVIEW_STATUS_UPDATED',
  'RENT_PAYMENT_DUE',
  'TRANSACTION_STATUS_UPDATED',
  'SAVED_SEARCH_MATCH'
];

function formatDate(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function getStatusLabel(status: StatusFilter | EmailDeliveryStatus, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    all: {
      en: 'All statuses',
      ar: 'كل الحالات'
    },
    LOGGED: {
      en: 'Logged',
      ar: 'مسجل'
    },
    SENT: {
      en: 'Sent',
      ar: 'مرسل'
    },
    SKIPPED: {
      en: 'Skipped',
      ar: 'تم تخطيه'
    },
    FAILED: {
      en: 'Failed',
      ar: 'فشل'
    }
  };

  return labels[status]?.[language] ?? status;
}

function getStatusClass(status: EmailDeliveryStatus) {
  if (status === 'SENT' || status === 'LOGGED') return 'approved';
  if (status === 'SKIPPED') return 'pending';

  return 'rejected';
}

function getStatusIcon(status: EmailDeliveryStatus) {
  if (status === 'SENT') return <Send size={13} aria-hidden="true" />;
  if (status === 'LOGGED') return <CheckCircle2 size={13} aria-hidden="true" />;
  if (status === 'SKIPPED') return <SkipForward size={13} aria-hidden="true" />;

  return <AlertTriangle size={13} aria-hidden="true" />;
}

function getNotificationTypeLabel(type: string, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    ACCOUNT_SECURITY: {
      en: 'Account security',
      ar: 'أمان الحساب'
    },
    BOOKING_CREATED: {
      en: 'Booking created',
      ar: 'إنشاء حجز'
    },
    BOOKING_OWNER_APPROVED: {
      en: 'Provider approved booking',
      ar: 'موافقة المزود على الحجز'
    },
    BOOKING_OWNER_REJECTED: {
      en: 'Provider rejected booking',
      ar: 'رفض المزود للحجز'
    },
    BOOKING_ADMIN_CONFIRMED: {
      en: 'Admin confirmed booking',
      ar: 'تأكيد الحجز من الإدارة'
    },
    BOOKING_CANCELLED: {
      en: 'Booking cancelled',
      ar: 'إلغاء الحجز'
    },
    BOOKING_PAYMENT_PAID: {
      en: 'Payment completed',
      ar: 'اكتمال الدفع'
    },
    BOOKING_PAYMENT_FAILED: {
      en: 'Payment failed',
      ar: 'فشل الدفع'
    },
    BOOKING_CANCELLATION_REQUESTED: {
      en: 'Cancellation requested',
      ar: 'طلب إلغاء'
    },
    VERIFICATION_STATUS_UPDATED: {
      en: 'Verification update',
      ar: 'تحديث التحقق'
    },
    REVIEW_STATUS_UPDATED: {
      en: 'Trust/report update',
      ar: 'تحديث بلاغ الثقة'
    },
    RENT_PAYMENT_DUE: {
      en: 'Rent payment due',
      ar: 'دفعة إيجار مستحقة'
    },
    TRANSACTION_STATUS_UPDATED: {
      en: 'Transaction update',
      ar: 'تحديث معاملة'
    },
    SAVED_SEARCH_MATCH: {
      en: 'Saved-search match',
      ar: 'نتيجة بحث محفوظ'
    }
  };

  return labels[type]?.[language] ?? type.replaceAll('_', ' ').toLowerCase();
}

export default function AdminEmailDeliveries() {
  const { language } = useLanguage();
  const { token } = useAuth();

  useDocumentTitle('Admin email delivery audit');

  const [records, setRecords] = useState<AdminEmailDeliveryEvent[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AdminEmailDeliveryEvent | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 15,
    total: 0,
    pageCount: 1
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'تشغيل البريد',
          title: 'سجل تسليم رسائل البريد',
          text:
            'راجعي رسائل البريد المسجلة أو المرسلة أو المتخطاة أو الفاشلة لمساعدة المستخدمين والتحقق من مشاكل SMTP.',
          searchPlaceholder: 'ابحثي بالعنوان أو البريد أو السبب أو الخطأ',
          search: 'بحث',
          refresh: 'تحديث',
          allTypes: 'كل أنواع التنبيهات',
          records: 'السجلات',
          loading: 'جاري تحميل سجل البريد...',
          empty: 'لا توجد سجلات بريد مطابقة.',
          recipient: 'المستلم',
          status: 'الحالة',
          mode: 'وضع التسليم',
          type: 'نوع التنبيه',
          titleLabel: 'العنوان',
          created: 'تاريخ الإنشاء',
          details: 'التفاصيل',
          selectRecord: 'اختاري سجل بريد لعرض تفاصيل التسليم.',
          deliveryDetails: 'تفاصيل التسليم',
          actionUrl: 'رابط الإجراء',
          preferencesUrl: 'رابط تفضيلات البريد',
          messageId: 'معرف الرسالة',
          reason: 'السبب',
          error: 'الخطأ',
          userId: 'معرف المستخدم',
          previous: 'السابق',
          next: 'التالي',
          page: 'صفحة',
          copied: 'يمكن فتح الروابط مباشرة من هنا.',
          loadError: 'تعذر تحميل سجل تسليم البريد.'
        }
      : {
          eyebrow: 'Email operations',
          title: 'Email delivery audit trail',
          text:
            'Review logged, sent, skipped, and failed transactional email deliveries to support users and diagnose SMTP issues.',
          searchPlaceholder: 'Search title, recipient, reason, or error',
          search: 'Search',
          refresh: 'Refresh',
          allTypes: 'All notification types',
          records: 'Records',
          loading: 'Loading email delivery events...',
          empty: 'No matching email delivery events found.',
          recipient: 'Recipient',
          status: 'Status',
          mode: 'Mode',
          type: 'Notification type',
          titleLabel: 'Title',
          created: 'Created',
          details: 'Details',
          selectRecord: 'Select a delivery event to inspect the delivery details.',
          deliveryDetails: 'Delivery details',
          actionUrl: 'Action URL',
          preferencesUrl: 'Preferences URL',
          messageId: 'Message ID',
          reason: 'Reason',
          error: 'Error',
          userId: 'User ID',
          previous: 'Previous',
          next: 'Next',
          page: 'Page',
          copied: 'Links can be opened directly from here.',
          loadError: 'Could not load email delivery events.'
        };

  const loadRecords = useCallback(
    async (nextPage = page) => {
      if (!token) return;

      try {
        setLoading(true);
        setLoadError('');

        const response = await listAdminEmailDeliveries(
          {
            query: query.trim() || undefined,
            status: statusFilter,
            type: typeFilter || undefined,
            page: nextPage,
            pageSize: pagination.pageSize
          },
          token
        );

        setRecords(response.records);
        setPagination(response.pagination);

        if (response.records.length > 0) {
          setSelectedRecord((current) => {
            if (current && response.records.some((record) => record.id === current.id)) {
              return current;
            }

            return response.records[0];
          });
        } else {
          setSelectedRecord(null);
        }
      } catch (error) {
        console.error(error);
        setLoadError(error instanceof ApiError ? error.message : copy.loadError);
      } finally {
        setLoading(false);
      }
    },
    [copy.loadError, page, pagination.pageSize, query, statusFilter, token, typeFilter]
  );

  useEffect(() => {
    void loadRecords(page);
  }, [loadRecords, page, statusFilter, typeFilter]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    void loadRecords(1);
  }

  const totalsLabel = useMemo(
    () => `${pagination.total.toLocaleString()} ${copy.records}`,
    [copy.records, pagination.total]
  );

  return (
    <section
      className="page-section container admin-email-deliveries-page"
      aria-labelledby="admin-email-deliveries-title"
    >
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} />
      <p className="admin-users-intro">{copy.text}</p>

      <form className="admin-users-toolbar admin-email-deliveries-toolbar" onSubmit={handleSearchSubmit}>
        <label className="admin-users-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </label>

        <label>
          <span className="sr-only">{copy.status}</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status, language)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">{copy.type}</span>
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{copy.allTypes}</option>
            {notificationTypeOptions.map((type) => (
              <option key={type} value={type}>
                {getNotificationTypeLabel(type, language)}
              </option>
            ))}
          </select>
        </label>

        <button className="button-link button-link--primary" type="submit">
          {copy.search}
        </button>

        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void loadRecords(page)}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.refresh}
        </button>
      </form>

      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="admin-users-layout admin-email-deliveries-layout">
        <section className="admin-users-panel" aria-label={copy.records}>
          <div className="admin-users-panel__header">
            <div>
              <p className="eyebrow">{copy.records}</p>
              <h2>{totalsLabel}</h2>
            </div>

            <span className="status-pill pending">
              {copy.page} {pagination.page} / {Math.max(pagination.pageCount, 1)}
            </span>
          </div>

          {loading ? (
            <p className="trust-note">{copy.loading}</p>
          ) : records.length === 0 ? (
            <p className="trust-note">{copy.empty}</p>
          ) : (
            <div className="admin-users-table-wrap">
              <table className="admin-users-table admin-email-deliveries-table">
                <thead>
                  <tr>
                    <th>{copy.recipient}</th>
                    <th>{copy.status}</th>
                    <th>{copy.type}</th>
                    <th>{copy.titleLabel}</th>
                    <th>{copy.created}</th>
                    <th>{copy.details}</th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.recipientEmail ?? '—'}</strong>
                        <span>{record.recipientUserId ?? '—'}</span>
                      </td>

                      <td>
                        <span className={`status-pill ${getStatusClass(record.status)}`}>
                          {getStatusIcon(record.status)}
                          {getStatusLabel(record.status, language)}
                        </span>
                        <small>{record.deliveryMode}</small>
                      </td>

                      <td>{getNotificationTypeLabel(record.notificationType, language)}</td>

                      <td>
                        <strong>{record.title}</strong>
                        {record.errorMessage ? <span>{record.errorMessage}</span> : null}
                        {record.reason ? <span>{record.reason}</span> : null}
                      </td>

                      <td>{formatDate(record.createdAt, language)}</td>

                      <td>
                        <button
                          className="button-link button-link--ghost"
                          type="button"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <Eye size={15} aria-hidden="true" />
                          {copy.details}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-users-pagination">
            <button
              className="button-link button-link--secondary"
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => {
                const nextPage = Math.max(1, pagination.page - 1);
                setPage(nextPage);
                void loadRecords(nextPage);
              }}
            >
              {copy.previous}
            </button>

            <span>
              {copy.page} {pagination.page} / {Math.max(pagination.pageCount, 1)}
            </span>

            <button
              className="button-link button-link--secondary"
              type="button"
              disabled={pagination.page >= pagination.pageCount || loading}
              onClick={() => {
                const nextPage = pagination.page + 1;
                setPage(nextPage);
                void loadRecords(nextPage);
              }}
            >
              {copy.next}
            </button>
          </div>
        </section>

        <aside className="admin-users-detail" aria-label={copy.deliveryDetails}>
          {!selectedRecord ? (
            <div className="admin-users-empty">
              <Mail size={30} aria-hidden="true" />
              <p>{copy.selectRecord}</p>
            </div>
          ) : (
            <>
              <div className="admin-users-detail__header">
                <div>
                  <p className="eyebrow">{copy.deliveryDetails}</p>
                  <h2>{selectedRecord.title}</h2>
                  <p>{selectedRecord.recipientEmail ?? '—'}</p>
                </div>

                <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                  {getStatusIcon(selectedRecord.status)}
                  {getStatusLabel(selectedRecord.status, language)}
                </span>
              </div>

              <div className="admin-users-security-grid admin-email-delivery-grid">
                <div>
                  <Clock3 size={17} aria-hidden="true" />
                  <span>{copy.created}</span>
                  <strong>{formatDate(selectedRecord.createdAt, language)}</strong>
                </div>

                <div>
                  <Mail size={17} aria-hidden="true" />
                  <span>{copy.mode}</span>
                  <strong>{selectedRecord.deliveryMode}</strong>
                </div>

                <div>
                  <ShieldAlert size={17} aria-hidden="true" />
                  <span>{copy.type}</span>
                  <strong>{getNotificationTypeLabel(selectedRecord.notificationType, language)}</strong>
                </div>

                <div>
                  <Mail size={17} aria-hidden="true" />
                  <span>{copy.userId}</span>
                  <strong>{selectedRecord.recipientUserId ?? '—'}</strong>
                </div>
              </div>

              <div className="admin-email-delivery-detail-list">
                <div>
                  <span>{copy.actionUrl}</span>
                  {selectedRecord.actionUrl ? (
                    <a href={selectedRecord.actionUrl} target="_blank" rel="noreferrer">
                      {selectedRecord.actionUrl}
                    </a>
                  ) : (
                    <strong>—</strong>
                  )}
                </div>

                <div>
                  <span>{copy.preferencesUrl}</span>
                  {selectedRecord.preferencesUrl ? (
                    <a href={selectedRecord.preferencesUrl} target="_blank" rel="noreferrer">
                      {selectedRecord.preferencesUrl}
                    </a>
                  ) : (
                    <strong>—</strong>
                  )}
                </div>

                <div>
                  <span>{copy.messageId}</span>
                  <strong>{selectedRecord.messageId ?? '—'}</strong>
                </div>

                <div>
                  <span>{copy.reason}</span>
                  <strong>{selectedRecord.reason ?? '—'}</strong>
                </div>

                <div>
                  <span>{copy.error}</span>
                  <strong>{selectedRecord.errorMessage ?? '—'}</strong>
                </div>
              </div>

              <p className="trust-note">{copy.copied}</p>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

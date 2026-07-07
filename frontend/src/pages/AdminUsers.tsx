import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Eye,
  MailCheck,
  MailX,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlock,
  UserCheck,
  Users,
  UserX
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import {
  getAdminUserSecurity,
  listAdminUsers,
  updateAdminUserEmailVerification,
  updateAdminUserSuspension,
  type AdminUserAccount,
  type AdminUserSecurityEvent,
  type AdminUsersQuery
} from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { UserRole } from '../types';

type StatusFilter = NonNullable<AdminUsersQuery['status']>;

const roleOptions: UserRole[] = [
  'USER',
  'OWNER',
  'ACTIVITY_PROVIDER',
  'TRAVEL_AGENCY',
  'DEVELOPER',
  'ADMIN'
];

function formatDate(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function getRoleLabel(role: UserRole, language: 'en' | 'ar') {
  const labels: Record<'en' | 'ar', Record<UserRole, string>> = {
    en: {
      USER: 'Customer',
      OWNER: 'Owner',
      ACTIVITY_PROVIDER: 'Activity provider',
      TRAVEL_AGENCY: 'Travel agency',
      DEVELOPER: 'Developer',
      ADMIN: 'Admin'
    },
    ar: {
      USER: 'عميل',
      OWNER: 'مالك',
      ACTIVITY_PROVIDER: 'مزود أنشطة',
      TRAVEL_AGENCY: 'وكالة سفر',
      DEVELOPER: 'مطور',
      ADMIN: 'أدمن'
    }
  };

  return labels[language][role];
}

function getEventLabel(type: string, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    PASSWORD_CHANGED: {
      en: 'Password changed',
      ar: 'تغيير كلمة المرور'
    },
    PASSWORD_RESET_COMPLETED: {
      en: 'Password reset completed',
      ar: 'اكتمال إعادة تعيين كلمة المرور'
    },
    LOGOUT_ALL_SESSIONS: {
      en: 'Logged out sessions',
      ar: 'تسجيل خروج الجلسات'
    },
    EMAIL_CHANGE_REQUESTED: {
      en: 'Email change requested',
      ar: 'طلب تغيير البريد'
    },
    EMAIL_CHANGE_CONFIRMED: {
      en: 'Email changed',
      ar: 'تغيير البريد'
    },
    ADMIN_USER_SUSPENDED: {
      en: 'Admin suspended account',
      ar: 'تعليق الحساب من الأدمن'
    },
    ADMIN_USER_UNSUSPENDED: {
      en: 'Admin unsuspended account',
      ar: 'إلغاء تعليق الحساب من الأدمن'
    },
    ADMIN_EMAIL_VERIFIED: {
      en: 'Admin verified email',
      ar: 'تأكيد البريد من الأدمن'
    },
    ADMIN_EMAIL_UNVERIFIED: {
      en: 'Admin removed email verification',
      ar: 'إزالة تأكيد البريد من الأدمن'
    },
    ACCOUNT_DEACTIVATED: {
      en: 'Account deleted by user',
      ar: 'حذف الحساب من المستخدم'
    }
  };

  return labels[type]?.[language] ?? type;
}

export default function AdminUsers() {
  const { language } = useLanguage();
  const { token, user } = useAuth();

  useDocumentTitle('Admin user management');

  const [records, setRecords] = useState<AdminUserAccount[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    pageCount: 1
  });

  const [selectedUser, setSelectedUser] = useState<AdminUserAccount | null>(null);
  const [securityEvents, setSecurityEvents] = useState<AdminUserSecurityEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [verificationReason, setVerificationReason] = useState('');
  const [updatingAction, setUpdatingAction] = useState<
    'suspend' | 'unsuspend' | 'verify' | 'unverify' | ''
  >('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'إدارة الأدمن',
          title: 'إدارة حسابات المستخدمين بأمان',
          text:
            'ابحث عن المستخدمين، راجع حالة الحساب، اطلع على سجل الأمان، وطبّق إجراءات التعليق أو تأكيد البريد مع سبب واضح.',
          searchPlaceholder: 'ابحث بالاسم أو البريد أو الشركة',
          search: 'بحث',
          reset: 'تحديث',
          allRoles: 'كل الأدوار',
          allStatuses: 'كل الحالات',
          active: 'نشط',
          suspended: 'معلق',
          deleted: 'محذوف',
          verified: 'بريد مؤكد',
          unverified: 'بريد غير مؤكد',
          users: 'المستخدمون',
          loading: 'جاري تحميل المستخدمين...',
          noUsers: 'لا يوجد مستخدمون مطابقون.',
          view: 'عرض الأمان',
          status: 'الحالة',
          role: 'الدور',
          email: 'البريد',
          joined: 'تاريخ الإنشاء',
          counts: 'الملخص',
          listings: 'عقارات',
          activities: 'أنشطة',
          bookings: 'حجوزات',
          notifications: 'إشعارات',
          securityEvents: 'أحداث الأمان',
          selectUser: 'اختاري مستخدماً لعرض تفاصيل الأمان.',
          securitySummary: 'ملخص أمان الحساب',
          accountStatus: 'حالة الحساب',
          authVersion: 'إصدار الجلسات',
          google: 'Google',
          password: 'كلمة مرور',
          connected: 'متصل',
          notConnected: 'غير متصل',
          enabled: 'مفعّل',
          disabled: 'غير مفعّل',
          suspensionReason: 'سبب التعليق / إلغاء التعليق',
          verificationReason: 'سبب تعديل تأكيد البريد',
          suspend: 'تعليق الحساب',
          unsuspend: 'إلغاء التعليق',
          verifyEmail: 'تأكيد البريد',
          unverifyEmail: 'إزالة تأكيد البريد',
          selfGuard: 'لا يمكن تعليق حسابك الحالي من هذه الشاشة.',
          reasonRequired: 'اكتبي سبباً واضحاً لا يقل عن 10 أحرف.',
          actionSuccess: 'تم تنفيذ الإجراء بنجاح.',
          actionError: 'تعذر تنفيذ الإجراء.',
          eventTimeline: 'سجل أحداث الأمان',
          emptyEvents: 'لا توجد أحداث أمان مسجلة بعد.',
          previous: 'السابق',
          next: 'التالي',
          page: 'صفحة'
        }
      : {
          eyebrow: 'Admin controls',
          title: 'Manage user accounts safely',
          text:
            'Search users, review account security, inspect audit history, and apply suspension or email-verification actions with a clear reason.',
          searchPlaceholder: 'Search by name, email, or company',
          search: 'Search',
          reset: 'Refresh',
          allRoles: 'All roles',
          allStatuses: 'All statuses',
          active: 'Active',
          suspended: 'Suspended',
          deleted: 'Deleted',
          verified: 'Email verified',
          unverified: 'Email unverified',
          users: 'Users',
          loading: 'Loading users...',
          noUsers: 'No matching users found.',
          view: 'View security',
          status: 'Status',
          role: 'Role',
          email: 'Email',
          joined: 'Joined',
          counts: 'Summary',
          listings: 'Listings',
          activities: 'Activities',
          bookings: 'Bookings',
          notifications: 'Notifications',
          securityEvents: 'Security events',
          selectUser: 'Select a user to view security details.',
          securitySummary: 'Account security summary',
          accountStatus: 'Account status',
          authVersion: 'Session version',
          google: 'Google',
          password: 'Password',
          connected: 'Connected',
          notConnected: 'Not connected',
          enabled: 'Enabled',
          disabled: 'Disabled',
          suspensionReason: 'Suspension / unsuspension reason',
          verificationReason: 'Email verification change reason',
          suspend: 'Suspend account',
          unsuspend: 'Unsuspend account',
          verifyEmail: 'Verify email',
          unverifyEmail: 'Remove email verification',
          selfGuard: 'You cannot suspend your current admin account from this screen.',
          reasonRequired: 'Enter a clear reason with at least 10 characters.',
          actionSuccess: 'Action completed successfully.',
          actionError: 'Could not complete the action.',
          eventTimeline: 'Security event timeline',
          emptyEvents: 'No security events recorded yet.',
          previous: 'Previous',
          next: 'Next',
          page: 'Page'
        };

  const fetchUsers = useCallback(
    async (nextPage = page) => {
      if (!token) return;

      try {
        setLoading(true);
        setLoadError('');

        const params: AdminUsersQuery = {
          page: nextPage,
          pageSize: 10,
          status: statusFilter
        };

        if (query.trim()) {
          params.query = query.trim();
        }

        if (roleFilter) {
          params.role = roleFilter;
        }

        const response = await listAdminUsers(params, token);

        setRecords(response.records);
        setPagination(response.pagination);
        setPage(response.pagination.page);
      } catch (error) {
        console.error(error);
        setLoadError(error instanceof ApiError ? error.message : copy.actionError);
      } finally {
        setLoading(false);
      }
    },
    [copy.actionError, page, query, roleFilter, statusFilter, token]
  );

  const loadSecurityDetails = useCallback(
    async (userId: string) => {
      if (!token) return;

      try {
        setDetailsLoading(true);
        setActionError('');
        setActionMessage('');

        const response = await getAdminUserSecurity(userId, token);

        setSelectedUser(response.user);
        setSecurityEvents(response.securityEvents);
        setSuspensionReason('');
        setVerificationReason('');
      } catch (error) {
        console.error(error);
        setActionError(error instanceof ApiError ? error.message : copy.actionError);
      } finally {
        setDetailsLoading(false);
      }
    },
    [copy.actionError, token]
  );

  useEffect(() => {
    void fetchUsers(page);
  }, [fetchUsers, page]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    void fetchUsers(1);
  }

  async function handleSuspensionToggle() {
    if (!selectedUser || !token) return;

    if (selectedUser.accountStatus === 'DEACTIVATED') {
      setActionError(copy.actionError);
      return;
    }

    const shouldSuspend = selectedUser.accountStatus !== 'SUSPENDED';
    const reason = suspensionReason.trim();

    if (shouldSuspend && reason.length < 10) {
      setActionError(copy.reasonRequired);
      return;
    }

    try {
      setUpdatingAction(shouldSuspend ? 'suspend' : 'unsuspend');
      setActionError('');
      setActionMessage('');

      const response = await updateAdminUserSuspension(
        selectedUser.id,
        {
          suspended: shouldSuspend,
          reason: reason || undefined
        },
        token
      );

      setSelectedUser(response.user);
      setActionMessage(copy.actionSuccess);
      setSuspensionReason('');
      await Promise.all([fetchUsers(page), loadSecurityDetails(response.user.id)]);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof ApiError ? error.message : copy.actionError);
    } finally {
      setUpdatingAction('');
    }
  }

  async function handleEmailVerificationToggle() {
    if (!selectedUser || !token) return;

    const reason = verificationReason.trim();

    if (reason.length < 10) {
      setActionError(copy.reasonRequired);
      return;
    }

    const nextVerifiedState = !selectedUser.emailVerified;

    try {
      setUpdatingAction(nextVerifiedState ? 'verify' : 'unverify');
      setActionError('');
      setActionMessage('');

      const response = await updateAdminUserEmailVerification(
        selectedUser.id,
        {
          emailVerified: nextVerifiedState,
          reason
        },
        token
      );

      setSelectedUser(response.user);
      setActionMessage(copy.actionSuccess);
      setVerificationReason('');
      await Promise.all([fetchUsers(page), loadSecurityDetails(response.user.id)]);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof ApiError ? error.message : copy.actionError);
    } finally {
      setUpdatingAction('');
    }
  }

  const selectedIsCurrentUser = Boolean(selectedUser && user?.id === selectedUser.id);

  return (
    <section className="page-section container admin-users-page" aria-labelledby="admin-users-title">
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} />
      <p className="admin-users-intro">{copy.text}</p>

      <form className="admin-users-toolbar" onSubmit={handleSearchSubmit}>
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
          <span className="sr-only">{copy.role}</span>
          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as UserRole | '');
              setPage(1);
            }}
          >
            <option value="">{copy.allRoles}</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {getRoleLabel(role, language)}
              </option>
            ))}
          </select>
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
            <option value="all">{copy.allStatuses}</option>
            <option value="active">{copy.active}</option>
            <option value="suspended">{copy.suspended}</option>
            <option value="deactivated">{copy.deleted}</option>
            <option value="verified">{copy.verified}</option>
            <option value="unverified">{copy.unverified}</option>
          </select>
        </label>

        <button className="button-link button-link--primary" type="submit">
          {copy.search}
        </button>

        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void fetchUsers(page)}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.reset}
        </button>
      </form>

      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="admin-users-layout">
        <section className="admin-users-panel" aria-label={copy.users}>
          <div className="admin-users-panel__header">
            <div>
              <p className="eyebrow">{copy.users}</p>
              <h2>{pagination.total.toLocaleString()} {copy.users}</h2>
            </div>

            <span className="status-pill pending">
              {copy.page} {pagination.page} / {Math.max(pagination.pageCount, 1)}
            </span>
          </div>

          {loading ? (
            <p className="trust-note">{copy.loading}</p>
          ) : records.length === 0 ? (
            <p className="trust-note">{copy.noUsers}</p>
          ) : (
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>{copy.email}</th>
                    <th>{copy.role}</th>
                    <th>{copy.status}</th>
                    <th>{copy.counts}</th>
                    <th>{copy.joined}</th>
                    <th>{copy.view}</th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.name}</strong>
                        <span>{record.email}</span>
                      </td>

                      <td>{getRoleLabel(record.role, language)}</td>

                      <td>
                        <span
                          className={`status-pill ${
                            record.accountStatus === 'DEACTIVATED'
                              ? 'rejected'
                              : record.accountStatus === 'SUSPENDED'
                                ? 'rejected'
                                : 'approved'
                          }`}
                        >
                          {record.accountStatus === 'DEACTIVATED' ||
                          record.accountStatus === 'SUSPENDED' ? (
                            <Ban size={13} aria-hidden="true" />
                          ) : (
                            <CheckCircle2 size={13} aria-hidden="true" />
                          )}
                          {record.accountStatus === 'DEACTIVATED'
                            ? copy.deleted
                            : record.accountStatus === 'SUSPENDED'
                              ? copy.suspended
                              : copy.active}
                        </span>

                        <span
                          className={`status-pill ${
                            record.emailVerified ? 'approved' : 'pending'
                          }`}
                        >
                          {record.emailVerified ? (
                            <MailCheck size={13} aria-hidden="true" />
                          ) : (
                            <MailX size={13} aria-hidden="true" />
                          )}
                          {record.emailVerified ? copy.verified : copy.unverified}
                        </span>
                      </td>

                      <td>
                        <small>
                          {copy.listings}: {record.counts?.listings ?? 0}
                        </small>
                        <small>
                          {copy.activities}: {record.counts?.activities ?? 0}
                        </small>
                        <small>
                          {copy.bookings}: {record.counts?.bookings ?? 0}
                        </small>
                      </td>

                      <td>{formatDate(record.createdAt, language)}</td>

                      <td>
                        <button
                          className="button-link button-link--ghost"
                          type="button"
                          onClick={() => void loadSecurityDetails(record.id)}
                        >
                          <Eye size={15} aria-hidden="true" />
                          {copy.view}
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
                void fetchUsers(nextPage);
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
                void fetchUsers(nextPage);
              }}
            >
              {copy.next}
            </button>
          </div>
        </section>

        <aside className="admin-users-detail" aria-label={copy.securitySummary}>
          {!selectedUser ? (
            <div className="admin-users-empty">
              <Users size={30} aria-hidden="true" />
              <p>{copy.selectUser}</p>
            </div>
          ) : (
            <>
              <div className="admin-users-detail__header">
                <div>
                  <p className="eyebrow">{copy.securitySummary}</p>
                  <h2>{selectedUser.name}</h2>
                  <p>{selectedUser.email}</p>
                </div>

                <span
                  className={`status-pill ${
                    selectedUser.accountStatus === 'DEACTIVATED' ||
                    selectedUser.accountStatus === 'SUSPENDED'
                      ? 'rejected'
                      : 'approved'
                  }`}
                >
                  {selectedUser.accountStatus === 'DEACTIVATED'
                    ? copy.deleted
                    : selectedUser.accountStatus === 'SUSPENDED'
                      ? copy.suspended
                      : copy.active}
                </span>
              </div>

              {detailsLoading ? <p className="trust-note">{copy.loading}</p> : null}

              <div className="admin-users-security-grid">
                <div>
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>{copy.role}</span>
                  <strong>{getRoleLabel(selectedUser.role, language)}</strong>
                </div>

                <div>
                  <MailCheck size={18} aria-hidden="true" />
                  <span>{copy.email}</span>
                  <strong>{selectedUser.emailVerified ? copy.verified : copy.unverified}</strong>
                </div>

                <div>
                  <UserCheck size={18} aria-hidden="true" />
                  <span>{copy.google}</span>
                  <strong>{selectedUser.googleConnected ? copy.connected : copy.notConnected}</strong>
                </div>

                <div>
                  <UserX size={18} aria-hidden="true" />
                  <span>{copy.password}</span>
                  <strong>{selectedUser.passwordLoginEnabled ? copy.enabled : copy.disabled}</strong>
                </div>

                <div>
                  <Clock3 size={18} aria-hidden="true" />
                  <span>{copy.authVersion}</span>
                  <strong>{selectedUser.authTokenVersion}</strong>
                </div>

                <div>
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>{copy.securityEvents}</span>
                  <strong>{selectedUser.counts?.accountSecurityEvents ?? securityEvents.length}</strong>
                </div>
              </div>

              {selectedUser.suspendedReason || selectedUser.deactivationReason ? (
                <p className="admin-users-warning">
                  <AlertTriangle size={16} aria-hidden="true" />
                  {selectedUser.deactivationReason ?? selectedUser.suspendedReason}
                </p>
              ) : null}

              <div className="admin-users-actions">
                <label>
                  {copy.suspensionReason}
                  <textarea
                    value={suspensionReason}
                    onChange={(event) => setSuspensionReason(event.target.value)}
                    rows={3}
                  />
                </label>

                {selectedIsCurrentUser ? (
                  <p className="trust-note">{copy.selfGuard}</p>
                ) : null}

                <button
                  className={`button-link ${
                    selectedUser.accountStatus === 'SUSPENDED'
                      ? 'button-link--secondary'
                      : 'button-link--danger'
                  }`}
                  type="button"
                  disabled={
                    selectedIsCurrentUser ||
                    selectedUser.accountStatus === 'DEACTIVATED' ||
                    updatingAction === 'suspend' ||
                    updatingAction === 'unsuspend'
                  }
                  onClick={() => void handleSuspensionToggle()}
                >
                  {selectedUser.accountStatus === 'SUSPENDED' ? (
                    <Unlock size={16} aria-hidden="true" />
                  ) : (
                    <Ban size={16} aria-hidden="true" />
                  )}
                  {selectedUser.accountStatus === 'SUSPENDED' ? copy.unsuspend : copy.suspend}
                </button>

                <label>
                  {copy.verificationReason}
                  <textarea
                    value={verificationReason}
                    onChange={(event) => setVerificationReason(event.target.value)}
                    rows={3}
                  />
                </label>

                <button
                  className="button-link button-link--secondary"
                  type="button"
                  disabled={updatingAction === 'verify' || updatingAction === 'unverify'}
                  onClick={() => void handleEmailVerificationToggle()}
                >
                  {selectedUser.emailVerified ? (
                    <MailX size={16} aria-hidden="true" />
                  ) : (
                    <MailCheck size={16} aria-hidden="true" />
                  )}
                  {selectedUser.emailVerified ? copy.unverifyEmail : copy.verifyEmail}
                </button>
              </div>

              {actionMessage ? (
                <p className="form-success" role="status">
                  {actionMessage}
                </p>
              ) : null}

              {actionError ? (
                <p className="form-error" role="alert">
                  {actionError}
                </p>
              ) : null}

              <div className="admin-users-events">
                <h3>{copy.eventTimeline}</h3>

                {securityEvents.length === 0 ? (
                  <p className="trust-note">{copy.emptyEvents}</p>
                ) : (
                  <ol>
                    {securityEvents.map((event) => (
                      <li key={event.id}>
                        <span className="admin-users-event-icon">
                          <ShieldCheck size={15} aria-hidden="true" />
                        </span>

                        <div>
                          <strong>{getEventLabel(event.type, language)}</strong>
                          <p>{event.message}</p>
                          <small>{formatDate(event.createdAt, language)}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

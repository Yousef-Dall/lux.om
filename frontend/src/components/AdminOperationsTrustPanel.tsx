import {
  AlertTriangle,
  BadgeCheck,
  Clock3,
  ExternalLink,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  getAdminReports,
  type AdminTrustReport,
  type ModerationStatus,
  type ReportReason,
  type ReportTargetType
} from '../api/reports';
import {
  getAdminVerifications,
  type VerificationRecord,
  type VerificationStatus,
  type VerificationTargetType
} from '../api/verification';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

function formatDate(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function isOpenReport(status: ModerationStatus) {
  return status === 'PENDING' || status === 'UNDER_REVIEW';
}

function isHighRiskReason(reason: ReportReason) {
  return reason === 'SUSPECTED_FRAUD' || reason === 'SAFETY_CONCERN';
}

export default function AdminOperationsTrustPanel() {
  const { language } = useLanguage();
  const { token } = useAuth();

  const [reports, setReports] = useState<AdminTrustReport[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'مركز العمليات',
          title: 'رؤية الثقة والسلامة',
          text:
            'تابعي البلاغات المفتوحة وطلبات التحقق من لوحة الإدارة الرئيسية قبل أن تتحول إلى مخاطر على تجربة المستخدم.',
          pendingReports: 'بلاغات مفتوحة',
          underReviewReports: 'قيد المراجعة',
          highRiskReports: 'بلاغات عالية الخطورة',
          pendingVerifications: 'طلبات تحقق بانتظار المراجعة',
          recentReports: 'آخر البلاغات',
          noReports: 'لا توجد بلاغات حديثة.',
          viewReports: 'فتح طابور البلاغات',
          viewAdmin: 'متابعة من لوحة الإدارة',
          refresh: 'تحديث',
          loading: 'جاري تحميل مؤشرات الثقة والسلامة...',
          error: 'تعذر تحميل مؤشرات الثقة والسلامة.',
          target: 'الهدف',
          status: 'الحالة',
          reason: 'السبب',
          submitted: 'أُرسل',
          verificationQueue: 'طابور التحقق',
          submittedVerifications: 'قيد الإرسال',
          rejectedVerifications: 'مرفوضة',
          expiredVerifications: 'منتهية'
        }
      : {
          eyebrow: 'Operations center',
          title: 'Trust and safety visibility',
          text:
            'Monitor open reports and verification workload from the main admin dashboard before they become user-facing risk.',
          pendingReports: 'Open reports',
          underReviewReports: 'Under review',
          highRiskReports: 'High-risk reports',
          pendingVerifications: 'Verification requests pending review',
          recentReports: 'Recent reports',
          noReports: 'No recent reports.',
          viewReports: 'Open report queue',
          viewAdmin: 'Continue in admin',
          refresh: 'Refresh',
          loading: 'Loading trust and safety signals...',
          error: 'Could not load trust and safety signals.',
          target: 'Target',
          status: 'Status',
          reason: 'Reason',
          submitted: 'Submitted',
          verificationQueue: 'Verification queue',
          submittedVerifications: 'Submitted',
          rejectedVerifications: 'Rejected',
          expiredVerifications: 'Expired'
        };

  const statusCopy: Record<ModerationStatus, string> =
    language === 'ar'
      ? {
          PENDING: 'قيد الانتظار',
          UNDER_REVIEW: 'قيد المراجعة',
          APPROVED: 'مقبول',
          REJECTED: 'مرفوض',
          RESOLVED: 'تم الحل',
          DISMISSED: 'تم الإغلاق'
        }
      : {
          PENDING: 'Pending',
          UNDER_REVIEW: 'Under review',
          APPROVED: 'Approved',
          REJECTED: 'Rejected',
          RESOLVED: 'Resolved',
          DISMISSED: 'Dismissed'
        };

  const reasonCopy: Record<ReportReason, string> =
    language === 'ar'
      ? {
          MISLEADING_INFO: 'معلومات مضللة',
          SUSPECTED_FRAUD: 'اشتباه احتيال',
          DUPLICATE: 'مكرر',
          INAPPROPRIATE_CONTENT: 'محتوى غير مناسب',
          WRONG_PRICE: 'سعر غير صحيح',
          UNAVAILABLE: 'غير متاح',
          SAFETY_CONCERN: 'مشكلة سلامة أو ثقة',
          OTHER: 'آخر'
        }
      : {
          MISLEADING_INFO: 'Misleading info',
          SUSPECTED_FRAUD: 'Suspected fraud',
          DUPLICATE: 'Duplicate',
          INAPPROPRIATE_CONTENT: 'Inappropriate content',
          WRONG_PRICE: 'Wrong price',
          UNAVAILABLE: 'Unavailable',
          SAFETY_CONCERN: 'Safety concern',
          OTHER: 'Other'
        };

  const targetCopy: Record<ReportTargetType, string> =
    language === 'ar'
      ? {
          LISTING: 'عقار',
          ACTIVITY: 'نشاط',
          DEVELOPER: 'مطور',
          TRAVEL_AGENCY: 'وكالة سفر',
          REVIEW: 'تقييم',
          USER: 'مستخدم',
          OTHER: 'آخر'
        }
      : {
          LISTING: 'Listing',
          ACTIVITY: 'Activity',
          DEVELOPER: 'Developer',
          TRAVEL_AGENCY: 'Travel agency',
          REVIEW: 'Review',
          USER: 'User',
          OTHER: 'Other'
        };

  const verificationTargetCopy: Record<VerificationTargetType, string> =
    language === 'ar'
      ? {
          LISTING: 'عقار',
          ACTIVITY: 'نشاط',
          DEVELOPER: 'مطور',
          TRAVEL_AGENCY: 'وكالة سفر',
          USER: 'مستخدم',
          CONTRACT: 'عقد',
          TRANSACTION: 'معاملة'
        }
      : {
          LISTING: 'Listing',
          ACTIVITY: 'Activity',
          DEVELOPER: 'Developer',
          TRAVEL_AGENCY: 'Travel agency',
          USER: 'User',
          CONTRACT: 'Contract',
          TRANSACTION: 'Transaction'
        };

  const verificationStatusCopy: Record<VerificationStatus, string> =
    language === 'ar'
      ? {
          UNVERIFIED: 'غير موثق',
          SUBMITTED: 'تم الإرسال',
          ADMIN_VERIFIED: 'موثق إدارياً',
          EXTERNALLY_VERIFIED: 'موثق خارجياً',
          REJECTED: 'مرفوض',
          EXPIRED: 'منتهي'
        }
      : {
          UNVERIFIED: 'Unverified',
          SUBMITTED: 'Submitted',
          ADMIN_VERIFIED: 'Admin verified',
          EXTERNALLY_VERIFIED: 'Externally verified',
          REJECTED: 'Rejected',
          EXPIRED: 'Expired'
        };

  const loadTrustSignals = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');

      const [reportResponse, verificationResponse] = await Promise.all([
        getAdminReports(token),
        getAdminVerifications(token)
      ]);

      setReports(reportResponse.reports);
      setVerifications(verificationResponse.verifications);
    } catch (loadError) {
      console.error(loadError);
      setError(
        language === 'ar'
          ? 'تعذر تحميل مؤشرات الثقة والسلامة.'
          : 'Could not load trust and safety signals.'
      );
    } finally {
      setLoading(false);
    }
  }, [language, token]);

  useEffect(() => {
    void loadTrustSignals();
  }, [loadTrustSignals]);

  const metrics = useMemo(() => {
    const openReports = reports.filter((report) => isOpenReport(report.status));
    const submittedVerifications = verifications.filter(
      (verification) => verification.status === 'SUBMITTED'
    );

    return {
      pendingReports: reports.filter((report) => report.status === 'PENDING').length,
      underReviewReports: reports.filter(
        (report) => report.status === 'UNDER_REVIEW'
      ).length,
      highRiskReports: openReports.filter((report) =>
        isHighRiskReason(report.reason)
      ).length,
      pendingVerifications: submittedVerifications.length,
      rejectedVerifications: verifications.filter(
        (verification) => verification.status === 'REJECTED'
      ).length,
      expiredVerifications: verifications.filter(
        (verification) => verification.status === 'EXPIRED'
      ).length,
      recentReports: reports.slice(0, 5),
      recentVerifications: submittedVerifications.slice(0, 4)
    };
  }, [reports, verifications]);

  return (
    <section className="admin-operations-trust-panel" aria-labelledby="admin-trust-title">
      <div className="admin-operations-trust-panel__header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="admin-trust-title">{copy.title}</h2>
          <p>{copy.text}</p>
        </div>

        <div className="admin-operations-trust-panel__actions">
          <button
            className="button-link button-link--secondary"
            type="button"
            onClick={() => void loadTrustSignals()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {copy.refresh}
          </button>

          <Link className="button-link" to="/admin/reports">
            <ExternalLink size={16} aria-hidden="true" />
            {copy.viewReports}
          </Link>
        </div>
      </div>

      {loading ? <p className="admin-operations-trust-panel__loading">{copy.loading}</p> : null}
      {error ? <div className="form-error">{error}</div> : null}

      <div className="admin-operations-trust-metrics">
        <article>
          <Clock3 size={20} aria-hidden="true" />
          <span>{copy.pendingReports}</span>
          <strong>{metrics.pendingReports}</strong>
        </article>

        <article>
          <ShieldAlert size={20} aria-hidden="true" />
          <span>{copy.underReviewReports}</span>
          <strong>{metrics.underReviewReports}</strong>
        </article>

        <article className={metrics.highRiskReports > 0 ? 'is-urgent' : undefined}>
          <AlertTriangle size={20} aria-hidden="true" />
          <span>{copy.highRiskReports}</span>
          <strong>{metrics.highRiskReports}</strong>
        </article>

        <article>
          <BadgeCheck size={20} aria-hidden="true" />
          <span>{copy.pendingVerifications}</span>
          <strong>{metrics.pendingVerifications}</strong>
        </article>
      </div>

      <div className="admin-operations-trust-columns">
        <div className="admin-operations-trust-card">
          <div className="admin-operations-trust-card__header">
            <h3>{copy.recentReports}</h3>
            <Link to="/admin/reports">{copy.viewReports}</Link>
          </div>

          {metrics.recentReports.length === 0 ? (
            <p className="admin-users-empty">{copy.noReports}</p>
          ) : (
            <ul className="admin-operations-trust-list">
              {metrics.recentReports.map((report) => (
                <li key={report.id}>
                  <div>
                    <strong>{targetCopy[report.targetType]}</strong>
                    <span>{reasonCopy[report.reason]}</span>
                  </div>

                  <div>
                    <span className={`trust-report-status trust-report-status--${report.status.toLowerCase()}`}>
                      {statusCopy[report.status]}
                    </span>
                    <small>{formatDate(report.createdAt, language)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-operations-trust-card">
          <div className="admin-operations-trust-card__header">
            <h3>{copy.verificationQueue}</h3>
            <Link to="/admin">{copy.viewAdmin}</Link>
          </div>

          <div className="admin-operations-verification-summary">
            <span>
              {copy.submittedVerifications}
              <strong>{metrics.pendingVerifications}</strong>
            </span>
            <span>
              {copy.rejectedVerifications}
              <strong>{metrics.rejectedVerifications}</strong>
            </span>
            <span>
              {copy.expiredVerifications}
              <strong>{metrics.expiredVerifications}</strong>
            </span>
          </div>

          {metrics.recentVerifications.length > 0 ? (
            <ul className="admin-operations-trust-list admin-operations-trust-list--compact">
              {metrics.recentVerifications.map((verification) => (
                <li key={verification.id}>
                  <div>
                    <strong>{verificationTargetCopy[verification.targetType]}</strong>
                    <span>{verificationStatusCopy[verification.status]}</span>
                  </div>

                  <small>{formatDate(verification.createdAt, language)}</small>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

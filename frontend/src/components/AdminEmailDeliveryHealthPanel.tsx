import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  RefreshCw,
  Send,
  SkipForward
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  getAdminEmailDeliveryHealthSummary,
  type AdminEmailDeliveryHealthSummary,
  type EmailDeliveryStatus
} from '../api/auth';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';

type MetricConfig = {
  status: EmailDeliveryStatus;
  icon: ReactNode;
  tone: string;
};

const metricConfig: MetricConfig[] = [
  {
    status: 'FAILED',
    icon: <AlertTriangle size={18} aria-hidden="true" />,
    tone: 'rejected'
  },
  {
    status: 'SKIPPED',
    icon: <SkipForward size={18} aria-hidden="true" />,
    tone: 'pending'
  },
  {
    status: 'LOGGED',
    icon: <CheckCircle2 size={18} aria-hidden="true" />,
    tone: 'approved'
  },
  {
    status: 'SENT',
    icon: <Send size={18} aria-hidden="true" />,
    tone: 'approved'
  }
];

function formatDate(value: string, language: 'en' | 'ar') {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function getStatusLabel(status: EmailDeliveryStatus, language: 'en' | 'ar') {
  const labels: Record<EmailDeliveryStatus, { en: string; ar: string }> = {
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

  return labels[status][language];
}

export default function AdminEmailDeliveryHealthPanel({ token }: { token: string }) {
  const { language } = useLanguage();
  const [summary, setSummary] = useState<AdminEmailDeliveryHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'صحة البريد',
          title: 'ملخص تسليم البريد',
          text:
            'راقبي حالة رسائل البريد المهمة خلال آخر ٧ أيام، واكتشفي بسرعة الرسائل الفاشلة أو المتخطاة بسبب التفضيلات.',
          total: 'إجمالي السجلات',
          lastDays: 'آخر ٧ أيام',
          recentFailures: 'آخر حالات الفشل',
          noFailures: 'لا توجد حالات فشل حديثة.',
          viewAll: 'فتح سجل البريد الكامل',
          refresh: 'تحديث',
          loading: 'جاري تحميل صحة البريد...',
          error: 'تعذر تحميل ملخص صحة البريد.'
        }
      : {
          eyebrow: 'Email health',
          title: 'Email delivery health summary',
          text:
            'Monitor critical email delivery health from the last 7 days and quickly spot failed or preference-skipped deliveries.',
          total: 'Total events',
          lastDays: 'Last 7 days',
          recentFailures: 'Recent failures',
          noFailures: 'No recent failures.',
          viewAll: 'Open full email audit',
          refresh: 'Refresh',
          loading: 'Loading email health...',
          error: 'Could not load email health summary.'
        };

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');

      const response = await getAdminEmailDeliveryHealthSummary(token);
      setSummary(response);
    } catch (error) {
      console.error(error);
      setLoadError(error instanceof ApiError ? error.message : copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error, token]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const failureRate = useMemo(() => {
    if (!summary || summary.total === 0) return 0;

    return Math.round((summary.statusCounts.FAILED / summary.total) * 100);
  }, [summary]);

  return (
    <section className="admin-email-health-panel" aria-labelledby="admin-email-health-title">
      <div className="admin-email-health-panel__header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="admin-email-health-title">{copy.title}</h2>
          <p>{copy.text}</p>
        </div>

        <div className="admin-email-health-panel__actions">
          <button
            className="button-link button-link--secondary"
            type="button"
            onClick={() => void loadSummary()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {copy.refresh}
          </button>

          <Link className="button-link button-link--primary" to="/admin/email-deliveries">
            <Mail size={16} aria-hidden="true" />
            {copy.viewAll}
          </Link>
        </div>
      </div>

      {loading ? <p className="trust-note">{copy.loading}</p> : null}

      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : null}

      {summary ? (
        <>
          <div className="admin-email-health-metrics">
            <article className="metric-card metric-card--accent">
              <span>
                <Mail size={18} aria-hidden="true" />
                {copy.total}
              </span>
              <strong>{summary.total.toLocaleString()}</strong>
              <small>
                {copy.lastDays} · {failureRate}% failed
              </small>
            </article>

            {metricConfig.map((metric) => (
              <article className="metric-card" key={metric.status}>
                <span>
                  {metric.icon}
                  {getStatusLabel(metric.status, language)}
                </span>
                <strong>
                  {(summary.statusCounts[metric.status] ?? 0).toLocaleString()}
                </strong>
                <small>{copy.lastDays}</small>
              </article>
            ))}
          </div>

          <div className="admin-email-health-failures">
            <div className="admin-email-health-failures__header">
              <h3>{copy.recentFailures}</h3>
              <span className={`status-pill ${summary.recentFailures.length ? 'rejected' : 'approved'}`}>
                {summary.recentFailures.length}
              </span>
            </div>

            {summary.recentFailures.length === 0 ? (
              <p className="trust-note">{copy.noFailures}</p>
            ) : (
              <div className="admin-email-health-failure-list">
                {summary.recentFailures.map((failure) => (
                  <Link
                    key={failure.id}
                    to={`/admin/email-deliveries?status=FAILED&query=${encodeURIComponent(
                      failure.recipientEmail ?? failure.title
                    )}`}
                    className="admin-email-health-failure"
                  >
                    <AlertTriangle size={17} aria-hidden="true" />
                    <span>
                      <strong>{failure.title}</strong>
                      <small>{failure.recipientEmail ?? '—'}</small>
                      <small>{failure.errorMessage ?? failure.reason ?? '—'}</small>
                    </span>
                    <em>{formatDate(failure.createdAt, language)}</em>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

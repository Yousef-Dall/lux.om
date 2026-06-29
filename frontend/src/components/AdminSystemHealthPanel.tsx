import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Globe2,
  MailCheck,
  RefreshCw,
  Server,
  ShieldCheck
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getAdminSystemHealth,
  type AdminSystemHealth,
  type AdminSystemHealthCheck,
  type AdminSystemHealthStatus
} from '../api/auth';
import { ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';

function getStatusClass(status: AdminSystemHealthStatus) {
  if (status === 'healthy') return 'approved';
  if (status === 'warning') return 'pending';
  return 'rejected';
}

function getStatusIcon(status: AdminSystemHealthStatus) {
  if (status === 'healthy') return <CheckCircle2 size={18} aria-hidden="true" />;
  return <AlertTriangle size={18} aria-hidden="true" />;
}

function getStatusLabel(status: AdminSystemHealthStatus, language: 'en' | 'ar') {
  const labels: Record<AdminSystemHealthStatus, { en: string; ar: string }> = {
    healthy: {
      en: 'Healthy',
      ar: 'سليم'
    },
    warning: {
      en: 'Warning',
      ar: 'تحذير'
    },
    critical: {
      en: 'Critical',
      ar: 'حرج'
    }
  };

  return labels[status][language];
}

function formatDate(value: string, language: 'en' | 'ar') {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function SystemHealthCheckRow({
  check,
  language
}: {
  check: AdminSystemHealthCheck;
  language: 'en' | 'ar';
}) {
  return (
    <article className="admin-system-health-check">
      <span className={`status-pill ${getStatusClass(check.status)}`}>
        {getStatusIcon(check.status)}
        {getStatusLabel(check.status, language)}
      </span>
      <div>
        <strong>{check.label}</strong>
        <p>{check.message}</p>
      </div>
    </article>
  );
}

export default function AdminSystemHealthPanel({ token }: { token: string }) {
  const { language } = useLanguage();
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'صحة النظام',
          title: 'لوحة صحة الإنتاج',
          text:
            'راجعي مؤشرات آمنة عن جاهزية قاعدة البيانات، البريد، الروابط، CORS، التحديد، والاحتفاظ بالسجلات بدون عرض أي أسرار.',
          refresh: 'تحديث',
          loading: 'جاري تحميل صحة النظام...',
          error: 'تعذر تحميل صحة النظام.',
          checkedAt: 'آخر فحص',
          environment: 'البيئة',
          database: 'قاعدة البيانات',
          email: 'البريد',
          urls: 'الروابط',
          retention: 'الاحتفاظ',
          smtpReady: 'SMTP جاهز',
          smtpIncomplete: 'SMTP غير مكتمل',
          frontendReady: 'رابط الواجهة جاهز',
          frontendNeedsReview: 'راجع رابط الواجهة',
          retentionDays: 'أيام الاحتفاظ'
        }
      : {
          eyebrow: 'System health',
          title: 'Production system health',
          text:
            'Review safe production signals for database readiness, email mode, SMTP presence, frontend URLs, CORS, rate limits, and retention without exposing secrets.',
          refresh: 'Refresh',
          loading: 'Loading system health...',
          error: 'Could not load system health.',
          checkedAt: 'Checked',
          environment: 'Environment',
          database: 'Database',
          email: 'Email',
          urls: 'URLs',
          retention: 'Retention',
          smtpReady: 'SMTP ready',
          smtpIncomplete: 'SMTP incomplete',
          frontendReady: 'Frontend ready',
          frontendNeedsReview: 'Review frontend URL',
          retentionDays: 'Retention days'
        };

  const loadHealth = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');

      const response = await getAdminSystemHealth(token);
      setHealth(response);
    } catch (error) {
      console.error(error);
      setLoadError(error instanceof ApiError ? error.message : copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error, token]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const unhealthyChecks = useMemo(() => {
    if (!health) return 0;

    return health.checks.filter((check) => check.status !== 'healthy').length;
  }, [health]);

  return (
    <section className="admin-system-health-panel" aria-labelledby="admin-system-health-title">
      <div className="admin-system-health-panel__header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="admin-system-health-title">{copy.title}</h2>
          <p>{copy.text}</p>
        </div>

        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void loadHealth()}
          disabled={loading}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {copy.refresh}
        </button>
      </div>

      {loading ? <p className="trust-note">{copy.loading}</p> : null}

      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : null}

      {health ? (
        <>
          <div className="admin-system-health-summary">
            <article className="metric-card metric-card--accent">
              <span>
                <Server size={18} aria-hidden="true" />
                {copy.environment}
              </span>
              <strong>{health.environment.nodeEnv}</strong>
              <small>{copy.checkedAt}: {formatDate(health.checkedAt, language)}</small>
            </article>

            <article className="metric-card">
              <span>
                <Database size={18} aria-hidden="true" />
                {copy.database}
              </span>
              <strong>{getStatusLabel(health.database.status, language)}</strong>
              <small>{health.database.latencyMs}ms</small>
            </article>

            <article className="metric-card">
              <span>
                <MailCheck size={18} aria-hidden="true" />
                {copy.email}
              </span>
              <strong>{health.email.deliveryMode}</strong>
              <small>{health.email.smtpConfigured ? copy.smtpReady : copy.smtpIncomplete}</small>
            </article>

            <article className="metric-card">
              <span>
                <Globe2 size={18} aria-hidden="true" />
                {copy.urls}
              </span>
              <strong>{health.urls.corsOriginsCount}</strong>
              <small>
                {health.urls.frontendUrlConfigured
                  ? copy.frontendReady
                  : copy.frontendNeedsReview}
              </small>
            </article>

            <article className="metric-card">
              <span>
                <ShieldCheck size={18} aria-hidden="true" />
                {copy.retention}
              </span>
              <strong>{health.retention.retentionDays ?? '—'}</strong>
              <small>{copy.retentionDays}</small>
            </article>
          </div>

          <div className="admin-system-health-overview">
            <span className={`status-pill ${getStatusClass(health.overallStatus)}`}>
              {getStatusIcon(health.overallStatus)}
              {getStatusLabel(health.overallStatus, language)}
            </span>
            <p>
              {unhealthyChecks === 0
                ? language === 'ar'
                  ? 'كل فحوصات النظام سليمة.'
                  : 'All system checks are healthy.'
                : language === 'ar'
                  ? `${unhealthyChecks} فحص يحتاج مراجعة.`
                  : `${unhealthyChecks} check(s) need review.`}
            </p>
          </div>

          <div className="admin-system-health-checks">
            {health.checks.map((check) => (
              <SystemHealthCheckRow
                key={check.key}
                check={check}
                language={language}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

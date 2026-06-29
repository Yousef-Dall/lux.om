import {
  CheckCircle2,
  Clock3,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  getAdminReports,
  updateAdminReportStatus,
  type AdminTrustReport,
  type ModerationStatus,
  type ReportTargetType
} from '../api/reports';
import { useAuth } from '../auth/AuthContext';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

type StatusFilter = ModerationStatus | 'ALL';
type TargetFilter = ReportTargetType | 'ALL';

const reviewStatusOptions: ModerationStatus[] = [
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED',
  'REJECTED'
];

const targetFilters: TargetFilter[] = [
  'ALL',
  'LISTING',
  'ACTIVITY',
  'DEVELOPER',
  'TRAVEL_AGENCY',
  'REVIEW',
  'USER',
  'OTHER'
];

const statusFilters: StatusFilter[] = [
  'ALL',
  'PENDING',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED',
  'REJECTED',
  'APPROVED'
];

function formatDate(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function getReporterLabel(report: AdminTrustReport) {
  return (
    report.reporter?.name ||
    report.reporterName ||
    report.reporter?.email ||
    report.reporterEmail ||
    'Anonymous'
  );
}

function getContactLabel(report: AdminTrustReport) {
  return report.reporter?.email || report.reporterEmail || report.reporterPhone || '—';
}

export default function AdminTrustReports() {
  const { language } = useLanguage();
  const { token } = useAuth();

  useDocumentTitle('Admin trust reports');

  const [reports, setReports] = useState<AdminTrustReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<AdminTrustReport | null>(
    null
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('ALL');
  const [query, setQuery] = useState('');
  const [decisionStatus, setDecisionStatus] =
    useState<ModerationStatus>('UNDER_REVIEW');
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'الثقة والسلامة',
          title: 'مراجعة بلاغات الثقة والسلامة',
          text:
            'راجع البلاغات الواردة من المستخدمين والزوار، حدد الأولوية، وسجل قرار المراجعة مع ملاحظات واضحة.',
          refresh: 'تحديث',
          search: 'بحث',
          searchPlaceholder: 'ابحث في الرسالة أو المرسل أو رقم الهدف',
          allStatuses: 'كل الحالات',
          allTargets: 'كل الأنواع',
          loading: 'جاري تحميل البلاغات...',
          empty: 'لا توجد بلاغات مطابقة.',
          reports: 'البلاغات',
          details: 'تفاصيل البلاغ',
          selectReport: 'اختاري بلاغاً لعرض تفاصيله.',
          reporter: 'المبلّغ',
          contact: 'وسيلة التواصل',
          reason: 'السبب',
          target: 'الهدف',
          status: 'الحالة',
          submitted: 'تاريخ الإرسال',
          reviewedBy: 'راجعه',
          message: 'رسالة البلاغ',
          notes: 'ملاحظات المراجعة',
          notesPlaceholder:
            'اكتبي قرار المراجعة أو سبب الرفض/الإغلاق بشكل واضح.',
          update: 'تحديث حالة البلاغ',
          updating: 'جاري التحديث...',
          updateSuccess: 'تم تحديث البلاغ بنجاح.',
          updateError: 'تعذر تحديث البلاغ.',
          loadError: 'تعذر تحميل بلاغات الثقة والسلامة.',
          pending: 'مفتوح',
          active: 'قيد المراجعة',
          closed: 'مغلق'
        }
      : {
          eyebrow: 'Trust & safety',
          title: 'Review trust and safety reports',
          text:
            'Review incoming reports from users and visitors, prioritize risk, and record clear moderation decisions.',
          refresh: 'Refresh',
          search: 'Search',
          searchPlaceholder: 'Search message, reporter, or target ID',
          allStatuses: 'All statuses',
          allTargets: 'All target types',
          loading: 'Loading reports...',
          empty: 'No matching reports found.',
          reports: 'Reports',
          details: 'Report details',
          selectReport: 'Select a report to view details.',
          reporter: 'Reporter',
          contact: 'Contact',
          reason: 'Reason',
          target: 'Target',
          status: 'Status',
          submitted: 'Submitted',
          reviewedBy: 'Reviewed by',
          message: 'Report message',
          notes: 'Review notes',
          notesPlaceholder:
            'Record the review decision or why the report was resolved/dismissed.',
          update: 'Update report status',
          updating: 'Updating...',
          updateSuccess: 'Report updated successfully.',
          updateError: 'Could not update report.',
          loadError: 'Could not load trust and safety reports.',
          pending: 'Open',
          active: 'In review',
          closed: 'Closed'
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

  const reasonCopy =
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

  const targetCopy =
    language === 'ar'
      ? {
          ALL: copy.allTargets,
          LISTING: 'عقار',
          ACTIVITY: 'نشاط',
          DEVELOPER: 'مطور',
          TRAVEL_AGENCY: 'وكالة سفر',
          REVIEW: 'تقييم',
          USER: 'مستخدم',
          OTHER: 'آخر'
        }
      : {
          ALL: copy.allTargets,
          LISTING: 'Listing',
          ACTIVITY: 'Activity',
          DEVELOPER: 'Developer',
          TRAVEL_AGENCY: 'Travel agency',
          REVIEW: 'Review',
          USER: 'User',
          OTHER: 'Other'
        };

  const loadReports = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setLoadError('');
      const response = await getAdminReports(token);

      setReports(response.reports);

      setSelectedReport((current) => {
        if (!current) return response.reports[0] ?? null;

        return (
          response.reports.find((report) => report.id === current.id) ??
          response.reports[0] ??
          null
        );
      });
    } catch (error) {
      console.error(error);
      setLoadError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, token]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!selectedReport) return;

    setDecisionStatus(
      selectedReport.status === 'PENDING' ? 'UNDER_REVIEW' : selectedReport.status
    );
    setReviewNotes(selectedReport.reviewNotes ?? '');
    setActionError('');
    setActionMessage('');
  }, [selectedReport]);

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reports.filter((report) => {
      if (statusFilter !== 'ALL' && report.status !== statusFilter) return false;
      if (targetFilter !== 'ALL' && report.targetType !== targetFilter) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        report.targetId,
        report.targetType,
        report.reason,
        report.status,
        report.message,
        report.reporterName,
        report.reporterEmail,
        report.reporterPhone,
        report.reporter?.name,
        report.reporter?.email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [query, reports, statusFilter, targetFilter]);

  const summary = useMemo(
    () => ({
      pending: reports.filter((report) => report.status === 'PENDING').length,
      active: reports.filter((report) => report.status === 'UNDER_REVIEW').length,
      closed: reports.filter((report) =>
        ['RESOLVED', 'DISMISSED', 'REJECTED', 'APPROVED'].includes(report.status)
      ).length
    }),
    [reports]
  );

  async function handleUpdateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedReport || updating) return;

    try {
      setUpdating(true);
      setActionError('');
      setActionMessage('');

      await updateAdminReportStatus(
        selectedReport.id,
        {
          status: decisionStatus,
          reviewNotes: reviewNotes.trim() || undefined
        },
        token
      );

      setActionMessage(copy.updateSuccess);
      await loadReports();
    } catch (error) {
      console.error(error);
      setActionError(copy.updateError);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <section className="page-section admin-trust-reports-page">
      <div className="container">
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} />
        <p className="admin-users-intro">{copy.text}</p>

        <div className="admin-trust-summary-grid">
          <article>
            <Clock3 size={20} aria-hidden="true" />
            <span>{copy.pending}</span>
            <strong>{summary.pending}</strong>
          </article>

          <article>
            <ShieldAlert size={20} aria-hidden="true" />
            <span>{copy.active}</span>
            <strong>{summary.active}</strong>
          </article>

          <article>
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>{copy.closed}</span>
            <strong>{summary.closed}</strong>
          </article>
        </div>

        <div className="admin-users-toolbar">
          <label>
            <span>{copy.search}</span>
            <div className="admin-users-search">
              <Search size={16} aria-hidden="true" />
              <input
                value={query}
                placeholder={copy.searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>

          <label>
            <span>{copy.status}</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              {statusFilters.map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? copy.allStatuses : statusCopy[status]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{copy.target}</span>
            <select
              value={targetFilter}
              onChange={(event) =>
                setTargetFilter(event.target.value as TargetFilter)
              }
            >
              {targetFilters.map((target) => (
                <option key={target} value={target}>
                  {targetCopy[target]}
                </option>
              ))}
            </select>
          </label>

          <button className="button-link button-link--secondary" onClick={loadReports} type="button">
            <RefreshCw size={16} aria-hidden="true" />
            {copy.refresh}
          </button>
        </div>

        {loadError ? <div className="form-error">{loadError}</div> : null}

        <div className="admin-trust-layout">
          <div className="admin-users-card">
            <div className="admin-users-card__header">
              <h2>{copy.reports}</h2>
              <span>{filteredReports.length}</span>
            </div>

            {loading ? <p>{copy.loading}</p> : null}

            {!loading && filteredReports.length === 0 ? (
              <p className="admin-users-empty">{copy.empty}</p>
            ) : null}

            {!loading && filteredReports.length > 0 ? (
              <div className="admin-trust-table-wrap">
                <table className="admin-trust-table">
                  <thead>
                    <tr>
                      <th>{copy.status}</th>
                      <th>{copy.target}</th>
                      <th>{copy.reason}</th>
                      <th>{copy.reporter}</th>
                      <th>{copy.submitted}</th>
                      <th>{copy.details}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((report) => (
                      <tr
                        key={report.id}
                        className={
                          selectedReport?.id === report.id
                            ? 'admin-trust-table__row--selected'
                            : undefined
                        }
                      >
                        <td>
                          <span className={`trust-report-status trust-report-status--${report.status.toLowerCase()}`}>
                            {statusCopy[report.status]}
                          </span>
                        </td>
                        <td>{targetCopy[report.targetType]}</td>
                        <td>{reasonCopy[report.reason]}</td>
                        <td>{getReporterLabel(report)}</td>
                        <td>{formatDate(report.createdAt, language)}</td>
                        <td>
                          <button
                            className="admin-users-link-button"
                            type="button"
                            onClick={() => setSelectedReport(report)}
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
            ) : null}
          </div>

          <aside className="admin-trust-detail">
            <h2>{copy.details}</h2>

            {!selectedReport ? (
              <p className="admin-users-empty">{copy.selectReport}</p>
            ) : (
              <>
                <dl className="admin-trust-detail-list">
                  <div>
                    <dt>{copy.status}</dt>
                    <dd>{statusCopy[selectedReport.status]}</dd>
                  </div>
                  <div>
                    <dt>{copy.target}</dt>
                    <dd>
                      {targetCopy[selectedReport.targetType]} ·{' '}
                      <code>{selectedReport.targetId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.reason}</dt>
                    <dd>{reasonCopy[selectedReport.reason]}</dd>
                  </div>
                  <div>
                    <dt>{copy.reporter}</dt>
                    <dd>{getReporterLabel(selectedReport)}</dd>
                  </div>
                  <div>
                    <dt>{copy.contact}</dt>
                    <dd>{getContactLabel(selectedReport)}</dd>
                  </div>
                  <div>
                    <dt>{copy.reviewedBy}</dt>
                    <dd>
                      {selectedReport.reviewedBy?.name ||
                        selectedReport.reviewedBy?.email ||
                        '—'}
                    </dd>
                  </div>
                </dl>

                {selectedReport.message ? (
                  <div className="admin-trust-message">
                    <h3>{copy.message}</h3>
                    <p>{selectedReport.message}</p>
                  </div>
                ) : null}

                <form className="admin-trust-review-form" onSubmit={handleUpdateReport}>
                  <label>
                    <span>{copy.status}</span>
                    <select
                      value={decisionStatus}
                      onChange={(event) =>
                        setDecisionStatus(event.target.value as ModerationStatus)
                      }
                    >
                      {reviewStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusCopy[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>{copy.notes}</span>
                    <textarea
                      value={reviewNotes}
                      maxLength={3000}
                      placeholder={copy.notesPlaceholder}
                      onChange={(event) => setReviewNotes(event.target.value)}
                    />
                  </label>

                  {actionError ? <div className="form-error">{actionError}</div> : null}
                  {actionMessage ? (
                    <div className="form-success">{actionMessage}</div>
                  ) : null}

                  <button className="button-link" disabled={updating} type="submit">
                    {updating ? copy.updating : copy.update}
                  </button>
                </form>
              </>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

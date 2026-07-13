import { Download, FileCheck2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../../../api/client';
import {
  downloadPmsFinancialCloseReport,
  getPmsFinancialCloseReport,
  listPmsFinancialCloseReports,
  type PmsFinancialCloseReport,
  type PmsFinancialCloseReportListItem,
} from '../../../api/pmsAdvanced';
import { formatFinanceDate, formatFinanceEnum, formatFinanceMoney } from '../finance/copy';

const PAGE_SIZE = 10;

const closeReportCopy = {
  en: {
    eyebrow: 'Governed reporting', title: 'Financial close reports', description: 'Browse immutable month-end revisions, verify snapshot integrity, and export controlled evidence.',
    status: 'Close status', all: 'All', active: 'Active', reopened: 'Reopened', currency: 'Currency', period: 'Period', scope: 'Scope', revision: 'Revision', closedAt: 'Closed at', actions: 'Actions', companyWide: 'Company-wide', viewReport: 'View report', noReports: 'No financial close reports match these filters.', loading: 'Loading close reports…', loadError: 'Could not load financial close reports.', reportError: 'Could not load the close report.', verified: 'Integrity verified', failed: 'Integrity failed', unsupported: 'Unsupported snapshot', verifiedMessage: 'The snapshot hash and supported evidence contract are verified.', mismatchMessage: 'The stored close-pack hash does not match its immutable snapshot.', unsupportedMessage: 'This snapshot version is not supported by the current report renderer.', invalidMessage: 'The close-pack snapshot does not satisfy the supported evidence contract.', closeEvidence: 'Close evidence', reviewedBy: 'Reviewed by', closedBy: 'Closed by', snapshotHash: 'Snapshot hash', totals: 'Snapshot totals', rentPayments: 'Rent payments', vendorInvoices: 'Paid vendor invoices', ownerPayouts: 'Paid owner payouts', ledgerByType: 'Ledger by type', ledgerBySource: 'Ledger by source', reconciliation: 'Reconciliation', deposits: 'Posted deposit transactions', records: 'Included records', ledgerEntries: 'Ledger entries', ownerPayoutBatches: 'Owner payout batches', ownerPayoutLines: 'Owner payout lines', ownerPayoutMatches: 'Owner payout reconciliation matches', reconciliationItems: 'Reconciliation items', depositTransactions: 'Security-deposit transactions', count: 'Count', amount: 'Amount', key: 'Category', exportCsv: 'Export CSV', exportJson: 'Export JSON', downloadError: 'Could not download the close report.', previous: 'Previous', next: 'Next', refresh: 'Refresh', readiness: 'Close readiness', blockers: 'Blockers', unallocatedAmount: 'Unallocated amount', reportRevision: 'Close report revision', activeRevision: 'Active revision', reopenedRevision: 'Reopened revision',
  },
  ar: {
    eyebrow: 'تقارير محكومة', title: 'تقارير إغلاق الفترات المالية', description: 'استعرض نسخ إغلاق نهاية الشهر غير القابلة للتعديل، وتحقق من سلامة اللقطة، وصدّر أدلة محكومة.',
    status: 'حالة الإغلاق', all: 'الكل', active: 'نشط', reopened: 'أعيد فتحه', currency: 'العملة', period: 'الفترة', scope: 'النطاق', revision: 'النسخة', closedAt: 'تاريخ الإغلاق', actions: 'الإجراءات', companyWide: 'كامل الشركة', viewReport: 'عرض التقرير', noReports: 'لا توجد تقارير إغلاق مالية تطابق عوامل التصفية.', loading: 'جارٍ تحميل تقارير الإغلاق…', loadError: 'تعذر تحميل تقارير الإغلاق المالية.', reportError: 'تعذر تحميل تقرير الإغلاق.', verified: 'تم التحقق من السلامة', failed: 'فشل التحقق من السلامة', unsupported: 'نسخة لقطة غير مدعومة', verifiedMessage: 'تم التحقق من بصمة اللقطة وعقد الأدلة المدعوم.', mismatchMessage: 'لا تتطابق بصمة حزمة الإغلاق المخزنة مع اللقطة غير القابلة للتعديل.', unsupportedMessage: 'نسخة هذه اللقطة غير مدعومة في عارض التقارير الحالي.', invalidMessage: 'لا تتوافق لقطة حزمة الإغلاق مع عقد الأدلة المدعوم.', closeEvidence: 'أدلة الإغلاق', reviewedBy: 'راجعها', closedBy: 'أغلقها', snapshotHash: 'بصمة اللقطة', totals: 'إجماليات اللقطة', rentPayments: 'دفعات الإيجار', vendorInvoices: 'فواتير الموردين المدفوعة', ownerPayouts: 'دفعات الملاك المدفوعة', ledgerByType: 'دفتر الأستاذ حسب النوع', ledgerBySource: 'دفتر الأستاذ حسب المصدر', reconciliation: 'المطابقة', deposits: 'معاملات التأمين المرحلة', records: 'السجلات المشمولة', ledgerEntries: 'قيود دفتر الأستاذ', ownerPayoutBatches: 'دفعات الملاك', ownerPayoutLines: 'بنود دفعات الملاك', ownerPayoutMatches: 'مطابقات دفعات الملاك', reconciliationItems: 'سجلات المطابقة', depositTransactions: 'معاملات التأمين', count: 'العدد', amount: 'المبلغ', key: 'الفئة', exportCsv: 'تصدير CSV', exportJson: 'تصدير JSON', downloadError: 'تعذر تنزيل تقرير الإغلاق.', previous: 'السابق', next: 'التالي', refresh: 'تحديث', readiness: 'جاهزية الإغلاق', blockers: 'العوائق', unallocatedAmount: 'المبلغ غير المخصص', reportRevision: 'نسخة تقرير الإغلاق', activeRevision: 'نسخة نشطة', reopenedRevision: 'نسخة أعيد فتحها',
  },
} as const;

function downloadBlob(filename: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function integrityLabel(report: PmsFinancialCloseReport, language: 'en' | 'ar') {
  const copy = closeReportCopy[language];
  if (report.integrity.status === 'VERIFIED') return copy.verified;
  if (report.integrity.status === 'UNSUPPORTED_VERSION') return copy.unsupported;
  return copy.failed;
}

function integrityMessage(report: PmsFinancialCloseReport, language: 'en' | 'ar') {
  const copy = closeReportCopy[language];
  if (report.integrity.status === 'VERIFIED') return copy.verifiedMessage;
  if (report.integrity.status === 'HASH_MISMATCH') return copy.mismatchMessage;
  if (report.integrity.status === 'UNSUPPORTED_VERSION') return copy.unsupportedMessage;
  return copy.invalidMessage;
}

function GroupTable({ currency, rows, title, language }: { currency: string; rows: Array<{ key: string; count: number; amount: string }>; title: string; language: 'en' | 'ar' }) {
  const copy = closeReportCopy[language];
  if (rows.length === 0) return null;
  return (
    <div className="pms-close-report__group">
      <h4>{title}</h4>
      <div className="pms-table-scroll">
        <table className="pms-table">
          <thead><tr><th>{copy.key}</th><th>{copy.count}</th><th>{copy.amount}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.key}><td>{formatFinanceEnum(row.key.replaceAll(':', '_'), language)}</td><td>{row.count}</td><td>{formatFinanceMoney(row.amount, currency, language)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function PmsFinancialCloseReports({ companyId, language, token }: { companyId: string; language: 'en' | 'ar'; token: string }) {
  const copy = closeReportCopy[language];
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [closes, setCloses] = useState<PmsFinancialCloseReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<PmsFinancialCloseReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(null);
    setReport(null);
    setReportError('');
    setPage(1);
  }, [companyId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void listPmsFinancialCloseReports(token, {
      companyId,
      closeStatus: status ? status as 'ACTIVE' | 'REOPENED' : undefined,
      currency: currency || undefined,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      signal: controller.signal,
    }).then((response) => {
      setCloses(response.closes);
      setTotal(response.pagination.total);
      setSelectedId((current) => {
        if (current && !response.closes.some((close) => close.id === current)) {
          setReport(null);
          return null;
        }
        return current;
      });
    }).catch((loadError) => {
      if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) setError(apiMessage(loadError, copy.loadError));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [companyId, copy.loadError, currency, page, refresh, status, token]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setReportLoading(true);
    setReport(null);
    setReportError('');
    void getPmsFinancialCloseReport(token, selectedId, companyId, controller.signal)
      .then((response) => setReport(response.report))
      .catch((loadError) => {
        if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) setReportError(apiMessage(loadError, copy.reportError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setReportLoading(false);
      });
    return () => controller.abort();
  }, [companyId, copy.reportError, refresh, selectedId, token]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const recordCounts = report?.snapshot ? [
    { label: copy.rentPayments, count: report.snapshot.recordIds.rentPaymentIds.length },
    { label: copy.ledgerEntries, count: report.snapshot.recordIds.accountingLedgerEntryIds.length },
    { label: copy.vendorInvoices, count: report.snapshot.recordIds.vendorInvoiceIds.length },
    { label: copy.ownerPayoutBatches, count: report.snapshot.recordIds.ownerPayoutBatchIds.length },
    { label: copy.ownerPayoutLines, count: report.snapshot.recordIds.ownerPayoutLineIds.length },
    { label: copy.ownerPayoutMatches, count: report.snapshot.recordIds.ownerPayoutReconciliationItemIds.length },
    { label: copy.reconciliationItems, count: report.snapshot.recordIds.reconciliationItemIds.length },
    { label: copy.depositTransactions, count: report.snapshot.recordIds.securityDepositTransactionIds.length },
  ] : [];

  async function handleDownload(closeId: string, format: 'csv' | 'json') {
    setDownloading(`${closeId}:${format}`);
    setReportError('');
    try {
      const response = await downloadPmsFinancialCloseReport(token, closeId, format, companyId);
      downloadBlob(response.filename ?? `pms-financial-close-report.${format}`, response.blob);
    } catch (downloadError) {
      setReportError(apiMessage(downloadError, copy.downloadError));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="pms-next-actions pms-unit-table-card pms-close-reports">
      <div className="pms-next-actions__header pms-close-reports__header">
        <div><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2><p>{copy.description}</p></div>
        <button className="button-link" type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw aria-hidden="true" size={16} />{copy.refresh}</button>
      </div>
      <div className="pms-close-reports__filters">
        <label>{copy.status}<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">{copy.all}</option><option value="ACTIVE">{copy.active}</option><option value="REOPENED">{copy.reopened}</option></select></label>
        <label>{copy.currency}<input maxLength={3} value={currency} onChange={(event) => { setCurrency(event.target.value.replace(/[^a-z]/gi, '').toUpperCase()); setPage(1); }} placeholder="OMR" /></label>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {loading ? <p>{copy.loading}</p> : closes.length === 0 ? <div className="pms-empty-card">{copy.noReports}</div> : (
        <div className="pms-table-scroll"><table className="pms-table"><thead><tr><th>{copy.period}</th><th>{copy.scope}</th><th>{copy.revision}</th><th>{copy.closedAt}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{closes.map((close) => <tr key={close.id}><td>{formatFinanceDate(close.period.periodStart, language)} – {formatFinanceDate(close.period.periodEnd, language)} · {close.period.currency}</td><td>{close.period.property?.name ?? copy.companyWide}</td><td>#{close.revision}</td><td>{formatFinanceDate(close.closedAt, language, true)}</td><td>{close.reopenedAt ? copy.reopenedRevision : copy.activeRevision}</td><td><button type="button" onClick={() => setSelectedId(close.id)}>{copy.viewReport}</button></td></tr>)}</tbody></table></div>
      )}
      <div className="pms-close-reports__pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{copy.previous}</button><span>{page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>{copy.next}</button></div>

      {reportLoading ? <p>{copy.loading}</p> : null}
      {reportError ? <p className="form-error" role="alert">{reportError}</p> : null}
      {report ? (
        <article className="pms-close-report" aria-label={`${copy.reportRevision} ${report.close.revision}`}>
          <div className="pms-close-report__title">
            <div>{report.integrity.status === 'VERIFIED' ? <ShieldCheck aria-hidden="true" size={22} /> : <ShieldAlert aria-hidden="true" size={22} />}<div><p className="eyebrow">{copy.closeEvidence}</p><h3>{copy.reportRevision} #{report.close.revision}</h3></div></div>
            <span className={`pms-close-report__integrity pms-close-report__integrity--${report.integrity.status.toLowerCase()}`}>{integrityLabel(report, language)}</span>
          </div>
          <p>{integrityMessage(report, language)}</p>
          <div className="pms-finance-detail__summary">
            <div><span>{copy.scope}</span><strong>{report.period.property?.name ?? copy.companyWide}</strong></div>
            <div><span>{copy.period}</span><strong>{formatFinanceDate(report.period.periodStart, language)} – {formatFinanceDate(report.period.periodEnd, language)}</strong></div>
            <div><span>{copy.reviewedBy}</span><strong>{report.close.reviewedBy.name}</strong></div>
            <div><span>{copy.closedBy}</span><strong>{report.close.closedBy.name}</strong></div>
          </div>
          <p className="pms-close-report__hash"><span>{copy.snapshotHash}</span><code>{report.integrity.storedHash}</code></p>
          <div className="pms-card-actions pms-card-actions--wrap"><button className="button-link" type="button" disabled={downloading !== null || report.integrity.status !== 'VERIFIED'} onClick={() => void handleDownload(report.close.id, 'csv')}><Download aria-hidden="true" size={16} />{copy.exportCsv}</button><button className="button-link" type="button" disabled={downloading !== null || report.integrity.status !== 'VERIFIED'} onClick={() => void handleDownload(report.close.id, 'json')}><FileCheck2 aria-hidden="true" size={16} />{copy.exportJson}</button></div>
          {report.snapshot ? <>
            <h4>{copy.readiness}</h4><div className="pms-finance-detail__summary"><div><span>{copy.blockers}</span><strong>{report.snapshot.readiness.blockerTotal}</strong></div><div><span>{copy.unallocatedAmount}</span><strong>{formatFinanceMoney(report.snapshot.readiness.unallocatedAmount, report.period.currency, language)}</strong></div></div>
            <h4>{copy.totals}</h4><div className="pms-metric-grid"><article className="pms-metric-card"><span>{copy.rentPayments}</span><strong>{formatFinanceMoney(report.snapshot.totals.rentPayments.amount, report.period.currency, language)}</strong><small>{copy.count}: {report.snapshot.totals.rentPayments.count}</small></article><article className="pms-metric-card"><span>{copy.vendorInvoices}</span><strong>{formatFinanceMoney(report.snapshot.totals.paidVendorInvoices.amount, report.period.currency, language)}</strong><small>{copy.count}: {report.snapshot.totals.paidVendorInvoices.count}</small></article><article className="pms-metric-card"><span>{copy.ownerPayouts}</span><strong>{formatFinanceMoney(report.snapshot.totals.paidOwnerPayouts.amount, report.period.currency, language)}</strong><small>{copy.count}: {report.snapshot.totals.paidOwnerPayouts.count}</small></article></div>
            <div className="pms-close-report__groups"><GroupTable currency={report.period.currency} rows={report.snapshot.totals.accountingLedgerByType} title={copy.ledgerByType} language={language} /><GroupTable currency={report.period.currency} rows={report.snapshot.totals.accountingLedgerBySource} title={copy.ledgerBySource} language={language} /><GroupTable currency={report.period.currency} rows={report.snapshot.totals.reconciliation} title={copy.reconciliation} language={language} /><GroupTable currency={report.period.currency} rows={report.snapshot.totals.postedDepositTransactions} title={copy.deposits} language={language} /></div>
            <h4>{copy.records}</h4><div className="pms-close-report__record-grid">{recordCounts.map((record) => <div key={record.label}><span>{record.label}</span><strong>{record.count}</strong></div>)}</div>
          </> : null}
        </article>
      ) : null}
    </section>
  );
}

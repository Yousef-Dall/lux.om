import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Gauge,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  UsersRound
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import type { CrmWorkspaceAccess } from '../../../api/crm';
import {
  getCrmForecast,
  listCrmSourceEvents,
  type CrmForecastResponse,
  type CrmSourceEvent,
  type CrmSourceEventLinkedTo,
  type CrmSourceEventType
} from '../../../api/crmAdvanced';
import type { CrmContactConsentStatus, CrmDealOutcome, CrmScoreBand } from '../../../generated/crmContract';
import { useAuth } from '../../../auth/AuthContext';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useLanguage } from '../../../i18n/LanguageContext';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../WorkspaceSelector';

const PAGE_SIZE = 25;
const sourceEventTypes: CrmSourceEventType[] = [
  'LISTING_INQUIRY',
  'PROJECT_INQUIRY',
  'DEVELOPER_PROFILE_INQUIRY',
  'TRAVEL_AGENCY_INQUIRY',
  'ACTIVITY_INQUIRY',
  'BOOKING_APPROVED',
  'BOOKING_CONFIRMED',
  'BOOKING_PAID',
  'VALUATION_REQUEST',
  'INVESTOR_WATCHLIST',
  'HIGH_INTENT_SAVED_SEARCH',
  'PMS_OWNER_ONBOARDING',
  'PMS_TENANT_ONBOARDING',
  'PMS_VENDOR_ONBOARDING',
  'MANUAL'
];
const consentStatuses: CrmContactConsentStatus[] = ['UNKNOWN', 'CONSENTED', 'LEGITIMATE_INTEREST', 'OPTED_OUT', 'BLOCKED'];
const linkedTargets: CrmSourceEventLinkedTo[] = ['ANY', 'CONTACT', 'LEAD', 'ACCOUNT', 'DEAL', 'UNLINKED'];

type SortBy = 'occurredAt' | 'type' | 'consentStatus';
type Direction = 'asc' | 'desc';

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'CRM analytics could not be loaded.';
}

function workspaceChoices(access: CrmWorkspaceAccess | null | undefined, language: 'en' | 'ar'): CrmWorkspaceChoice[] {
  if (!access) return [];
  const values: CrmWorkspaceChoice[] = [];
  const personal = access.workspaces?.find((item) => item.type === 'PERSONAL');
  if (personal?.workspaceId && personal.canView) {
    values.push({
      key: personal.workspaceId,
      workspaceId: personal.workspaceId,
      label: language === 'ar' ? 'CRM الشخصي' : 'Personal CRM',
      canManage: personal.canManage,
      canManageWorkspace: true,
      propertyScope: personal.propertyScope
    });
  }
  for (const company of access.companyWorkspaces.filter((item) => item.canView)) {
    values.push({
      key: company.workspaceId,
      workspaceId: company.workspaceId,
      companyId: company.companyId,
      label: language === 'ar' ? company.nameAr || company.nameEn : company.nameEn,
      canManage: company.canManage,
      canManageWorkspace: company.canManageWorkspace,
      propertyScope: company.propertyScope
    });
  }
  const platform = access.workspaces?.find((item) => item.type === 'PLATFORM');
  if (platform?.workspaceId && access.isAdmin) {
    values.push({
      key: platform.workspaceId,
      workspaceId: platform.workspaceId,
      label: language === 'ar' ? 'CRM مشغّل lux.om' : 'lux.om operator CRM',
      canManage: true,
      canManageWorkspace: true,
      propertyScope: platform.propertyScope
    });
  }
  return values;
}

function safeType(value: string | null): CrmSourceEventType | '' {
  return sourceEventTypes.includes(value as CrmSourceEventType) ? value as CrmSourceEventType : '';
}

function safeConsent(value: string | null): CrmContactConsentStatus | '' {
  return consentStatuses.includes(value as CrmContactConsentStatus) ? value as CrmContactConsentStatus : '';
}

function safeLinkedTo(value: string | null): CrmSourceEventLinkedTo {
  return linkedTargets.includes(value as CrmSourceEventLinkedTo) ? value as CrmSourceEventLinkedTo : 'ANY';
}

function safeSort(value: string | null): SortBy {
  return value === 'type' || value === 'consentStatus' ? value : 'occurredAt';
}

function safeDirection(value: string | null): Direction {
  return value === 'asc' ? 'asc' : 'desc';
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number | string | null | undefined, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatHours(value: number | null | undefined, copy: { hours: string; days: string }, locale: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (value >= 48) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 24)} ${copy.days}`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${copy.hours}`;
}

function aggregateDimension<T extends string>(
  rows: Array<Record<string, unknown> & { outcome: CrmDealOutcome; _count: { _all: number } }>,
  key: string
) {
  const values = new Map<T, Record<CrmDealOutcome, number>>();
  for (const row of rows) {
    const dimension = row[key] as T | null | undefined;
    if (!dimension) continue;
    const current = values.get(dimension) ?? { OPEN: 0, WON: 0, LOST: 0 };
    current[row.outcome] += row._count._all;
    values.set(dimension, current);
  }
  return Array.from(values, ([dimension, outcomes]) => ({ dimension, outcomes, total: outcomes.OPEN + outcomes.WON + outcomes.LOST }))
    .sort((left, right) => right.total - left.total);
}

function relatedRecord(event: CrmSourceEvent, workspaceId: string) {
  const search = `?workspaceId=${encodeURIComponent(workspaceId)}`;
  if (event.deal) return { label: event.deal.name, to: `/crm/deals/${event.deal.id}${search}` };
  if (event.account) return { label: event.account.name, to: `/crm/accounts/${event.account.id}${search}` };
  if (event.lead) return { label: event.lead.title, to: `/crm/leads/${event.lead.id}${search}` };
  if (event.contact) return { label: event.contact.fullName, to: `/crm/contacts/${event.contact.id}${search}` };
  return null;
}

export default function CrmAnalyticsWorkspace() {
  const { token, crmAccess } = useAuth();
  const { language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const locale = language === 'ar' ? 'ar-OM' : 'en-OM';
  const choices = useMemo(() => workspaceChoices(crmAccess, language), [crmAccess, language]);
  const requestedWorkspaceId = params.get('workspaceId');
  const [workspaceId, setWorkspaceId] = useState('');
  const activeChoice = choices.find((choice) => choice.workspaceId === workspaceId);
  const propertyScoped = Boolean(activeChoice?.propertyScope && !activeChoice.propertyScope.allProperties);

  const page = Math.max(1, Number(params.get('analyticsPage')) || 1);
  const search = params.get('analyticsQ')?.trim() ?? '';
  const type = safeType(params.get('analyticsType'));
  const consentStatus = safeConsent(params.get('analyticsConsent'));
  const linkedTo = safeLinkedTo(params.get('analyticsLinked'));
  const sortBy = safeSort(params.get('analyticsSort'));
  const direction = safeDirection(params.get('analyticsDirection'));

  const [forecast, setForecast] = useState<CrmForecastResponse | null>(null);
  const [events, setEvents] = useState<CrmSourceEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  useDocumentTitle(language === 'ar' ? 'تحليلات CRM | lux.om' : 'CRM analytics | lux.om');

  const copy = language === 'ar'
    ? {
        eyebrow: 'تحليلات كاملة البيانات وقابلة للتفسير',
        title: 'تحليلات CRM ونَسَب المصدر',
        description: 'راجع التحويل والتوقعات حسب العملة وصحة المراحل وسجل إشارات المصدر دون الاعتماد على نتائج واجهة مقتطعة.',
        workspace: 'مساحة العمل',
        refresh: 'تحديث التحليلات',
        propertyScope: 'النطاق العقاري مفعّل',
        propertyScopeBody: 'تعرض هذه الصفحة فقط السجلات المرتبطة بالعقارات المسموح لك بها.',
        completeData: 'تستخدم المقاييس استعلامات قاعدة البيانات الكاملة وليست الصفحة الحالية من السجل.',
        loading: 'جارٍ تحميل تحليلات CRM…',
        errorTitle: 'تعذر تحميل التحليلات',
        leads: 'العملاء المحتملون',
        qualified: 'المؤهلون',
        converted: 'المحوّلون',
        winRate: 'نسبة الفوز',
        overdue: 'متابعات متأخرة',
        leadQualified: 'من عميل محتمل إلى مؤهل',
        qualifiedDeal: 'من مؤهل إلى صفقة',
        decidedDeals: 'صفقات محسومة',
        wonDeals: 'صفقات رابحة',
        forecastTitle: 'توقعات مفصولة حسب العملة',
        forecastBody: 'لا يتم جمع العملات المختلفة في قيمة واحدة مضللة.',
        pipeline: 'قيمة المسار',
        weighted: 'التوقع المرجّح',
        cycle: 'متوسط دورة البيع',
        noForecast: 'لا توجد صفقات مفتوحة ذات قيمة متوقعة.',
        sourcePerformance: 'أداء مصادر العملاء المحتملين',
        source: 'المصدر',
        open: 'مفتوح',
        won: 'رابح',
        lost: 'خاسر',
        stageHealth: 'صحة المراحل',
        stage: 'المرحلة',
        currentDeals: 'الصفقات الحالية',
        averageTime: 'متوسط الوقت',
        scoreBands: 'نتائج شرائح التقييم',
        scoreBand: 'شريحة التقييم',
        outcomes: 'النتائج',
        wonReasons: 'أسباب الفوز',
        lostReasons: 'أسباب الخسارة',
        noReasons: 'لم تُسجّل أسباب بعد.',
        sourceRegister: 'سجل إشارات المصدر',
        sourceRegisterBody: 'سجل تدقيق غير قابل للتخمين يربط الإشارة الأصلية بجهة الاتصال أو العميل أو الحساب أو الصفقة.',
        search: 'بحث في المرجع أو القاعدة أو السجل المرتبط',
        searchPlaceholder: 'مثال: inquiry أو اسم جهة اتصال',
        eventType: 'نوع الإشارة',
        consent: 'حالة الموافقة',
        linkedTo: 'مرتبط بـ',
        sort: 'الترتيب',
        direction: 'الاتجاه',
        all: 'الكل',
        anyRecord: 'أي سجل',
        contact: 'جهة اتصال',
        lead: 'عميل محتمل',
        account: 'حساب',
        deal: 'صفقة',
        unlinked: 'غير مرتبط',
        occurredAt: 'وقت الإشارة',
        newest: 'الأحدث أولاً',
        oldest: 'الأقدم أولاً',
        apply: 'تطبيق عوامل التصفية',
        reset: 'إعادة الضبط',
        rule: 'قاعدة الإدخال',
        record: 'مرجع المصدر',
        related: 'السجل المرتبط',
        noRelated: 'لا يوجد سجل مرتبط',
        emptyTitle: 'لا توجد إشارات مصدر مطابقة',
        emptyBody: 'عدّل عوامل التصفية أو انتظر وصول إشارات محكومة جديدة.',
        previous: 'السابق',
        next: 'التالي',
        page: 'الصفحة',
        of: 'من',
        totalEvents: 'إجمالي الإشارات',
        hours: 'ساعة',
        days: 'يوم'
      }
    : {
        eyebrow: 'Complete-data, explainable analytics',
        title: 'CRM analytics and source attribution',
        description: 'Review conversion, currency-safe forecasts, stage health, and the source-signal audit trail without relying on truncated UI results.',
        workspace: 'Workspace',
        refresh: 'Refresh analytics',
        propertyScope: 'Property scope active',
        propertyScopeBody: 'This page only includes records linked to properties within your assigned scope.',
        completeData: 'Metrics use complete database queries, not the current audit-register page.',
        loading: 'Loading CRM analytics…',
        errorTitle: 'Analytics could not be loaded',
        leads: 'Leads',
        qualified: 'Qualified',
        converted: 'Converted',
        winRate: 'Win rate',
        overdue: 'Overdue follow-ups',
        leadQualified: 'Lead to qualified',
        qualifiedDeal: 'Qualified to deal',
        decidedDeals: 'Decided deals',
        wonDeals: 'Won deals',
        forecastTitle: 'Currency-separated forecast',
        forecastBody: 'Different currencies are never combined into a misleading total.',
        pipeline: 'Pipeline value',
        weighted: 'Weighted forecast',
        cycle: 'Average sales cycle',
        noForecast: 'No open deals currently contribute forecast value.',
        sourcePerformance: 'Lead-source performance',
        source: 'Source',
        open: 'Open',
        won: 'Won',
        lost: 'Lost',
        stageHealth: 'Stage health',
        stage: 'Stage',
        currentDeals: 'Current deals',
        averageTime: 'Average time',
        scoreBands: 'Score-band outcomes',
        scoreBand: 'Score band',
        outcomes: 'Outcomes',
        wonReasons: 'Won reasons',
        lostReasons: 'Lost reasons',
        noReasons: 'No reasons have been recorded yet.',
        sourceRegister: 'Source-signal audit register',
        sourceRegisterBody: 'A governed trail connecting the original signal to its contact, lead, account, or deal.',
        search: 'Search reference, rule, or linked record',
        searchPlaceholder: 'For example: inquiry or a contact name',
        eventType: 'Signal type',
        consent: 'Consent status',
        linkedTo: 'Linked to',
        sort: 'Sort by',
        direction: 'Direction',
        all: 'All',
        anyRecord: 'Any record',
        contact: 'Contact',
        lead: 'Lead',
        account: 'Account',
        deal: 'Deal',
        unlinked: 'Unlinked',
        occurredAt: 'Signal time',
        newest: 'Newest first',
        oldest: 'Oldest first',
        apply: 'Apply filters',
        reset: 'Reset',
        rule: 'Ingestion rule',
        record: 'Source reference',
        related: 'Linked record',
        noRelated: 'No linked record',
        emptyTitle: 'No source signals match',
        emptyBody: 'Adjust the filters or wait for new governed source signals.',
        previous: 'Previous',
        next: 'Next',
        page: 'Page',
        of: 'of',
        totalEvents: 'Total signals',
        hours: 'hours',
        days: 'days'
      };

  useEffect(() => {
    setWorkspaceId((current) => {
      if (requestedWorkspaceId && choices.some((choice) => choice.workspaceId === requestedWorkspaceId)) return requestedWorkspaceId;
      if (choices.some((choice) => choice.workspaceId === current)) return current;
      return choices[0]?.workspaceId ?? '';
    });
  }, [choices, requestedWorkspaceId]);

  useEffect(() => {
    if (!workspaceId || requestedWorkspaceId === workspaceId) return;
    const next = new URLSearchParams(params);
    next.set('workspaceId', workspaceId);
    setParams(next, { replace: true });
  }, [params, requestedWorkspaceId, setParams, workspaceId]);

  useEffect(() => {
    if (!token || !workspaceId) return;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      getCrmForecast(token, workspaceId),
      listCrmSourceEvents(token, {
        workspaceId,
        search: search || undefined,
        type: type || undefined,
        consentStatus: consentStatus || undefined,
        linkedTo,
        sortBy,
        direction,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE
      })
    ])
      .then(([forecastResult, eventResult]) => {
        if (!active) return;
        setForecast(forecastResult);
        setEvents(eventResult.events);
        setTotal(eventResult.pagination.total);
      })
      .catch((cause) => {
        if (!active) return;
        setError(errorMessage(cause));
        setForecast(null);
        setEvents([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [consentStatus, direction, linkedTo, page, refreshVersion, search, sortBy, token, type, workspaceId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const sourceRows = useMemo(
    () => aggregateDimension<string>(forecast?.dimensions.bySource ?? [], 'source'),
    [forecast]
  );
  const scoreRows = useMemo(
    () => aggregateDimension<CrmScoreBand>(forecast?.dimensions.byScoreBand ?? [], 'scoreBand'),
    [forecast]
  );

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateParams({
      analyticsQ: String(form.get('search') ?? '').trim() || null,
      analyticsType: String(form.get('type') ?? '') || null,
      analyticsConsent: String(form.get('consentStatus') ?? '') || null,
      analyticsLinked: String(form.get('linkedTo') ?? '') === 'ANY' ? null : String(form.get('linkedTo')),
      analyticsSort: String(form.get('sortBy') ?? '') === 'occurredAt' ? null : String(form.get('sortBy')),
      analyticsDirection: String(form.get('direction') ?? '') === 'desc' ? null : String(form.get('direction')),
      analyticsPage: null
    });
  }

  function resetFilters() {
    updateParams({
      analyticsQ: null,
      analyticsType: null,
      analyticsConsent: null,
      analyticsLinked: null,
      analyticsSort: null,
      analyticsDirection: null,
      analyticsPage: null
    });
  }

  function changeWorkspace(value: string) {
    const next = new URLSearchParams();
    next.set('workspaceId', value);
    setWorkspaceId(value);
    setParams(next, { replace: true });
  }

  const stageTime = new Map((forecast?.dimensions.timeInStage ?? []).map((row) => [row.stageId, row.averageHours]));
  const wonReasons = forecast?.dimensions.wonReasons.filter((row) => row.wonReason) ?? [];
  const lostReasons = forecast?.dimensions.lostReasons.filter((row) => row.lostReason) ?? [];

  return (
    <section className="crm-analytics-workspace" aria-labelledby="crm-analytics-title">
      <header className="crm-analytics-workspace__hero">
        <div>
          <p className="eyebrow"><BarChart3 aria-hidden="true" size={17} /> {copy.eyebrow}</p>
          <h2 id="crm-analytics-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="crm-analytics-workspace__hero-actions">
          <WorkspaceSelector label={copy.workspace} value={workspaceId} choices={choices} onChange={changeWorkspace} />
          <button
            aria-label={copy.refresh}
            className="button-link button-link--secondary"
            disabled={loading || !workspaceId}
            onClick={() => setRefreshVersion((value) => value + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" className={loading ? 'is-spinning' : ''} size={16} />
            {copy.refresh}
          </button>
        </div>
      </header>

      {propertyScoped ? (
        <aside className="crm-analytics-workspace__scope" role="note">
          <ShieldCheck aria-hidden="true" size={19} />
          <div><strong>{copy.propertyScope}</strong><p>{copy.propertyScopeBody}</p></div>
        </aside>
      ) : null}

      <aside className="crm-analytics-workspace__governance" role="note">
        <DatabaseZap aria-hidden="true" size={19} />
        <p>{copy.completeData}</p>
      </aside>

      {error ? (
        <div className="crm-analytics-workspace__state" role="alert">
          <AlertCircle aria-hidden="true" size={24} />
          <div><h3>{copy.errorTitle}</h3><p>{error}</p></div>
        </div>
      ) : null}

      {loading && !forecast ? (
        <div className="crm-analytics-workspace__state" role="status">
          <RefreshCw aria-hidden="true" className="is-spinning" size={24} />
          <p>{copy.loading}</p>
        </div>
      ) : null}

      {forecast ? (
        <>
          <section className="crm-analytics-workspace__metrics" aria-label={copy.title}>
            <article><UsersRound aria-hidden="true" /><span>{copy.leads}</span><strong>{formatNumber(forecast.snapshot.leads.total, locale)}</strong></article>
            <article><Target aria-hidden="true" /><span>{copy.qualified}</span><strong>{formatNumber(forecast.snapshot.leads.qualified, locale)}</strong></article>
            <article><CheckCircle2 aria-hidden="true" /><span>{copy.converted}</span><strong>{formatNumber(forecast.snapshot.leads.converted, locale)}</strong></article>
            <article><TrendingUp aria-hidden="true" /><span>{copy.winRate}</span><strong>{formatPercent(forecast.snapshot.deals.winRate, locale)}</strong></article>
            <article><Clock3 aria-hidden="true" /><span>{copy.overdue}</span><strong>{formatNumber(forecast.snapshot.overdueFollowUps, locale)}</strong></article>
          </section>

          <section className="crm-analytics-workspace__conversion" aria-label={copy.outcomes}>
            <article><span>{copy.leadQualified}</span><strong>{formatPercent(forecast.snapshot.leads.leadToQualifiedRate, locale)}</strong></article>
            <article><span>{copy.qualifiedDeal}</span><strong>{formatPercent(forecast.snapshot.leads.qualifiedToDealRate, locale)}</strong></article>
            <article><span>{copy.decidedDeals}</span><strong>{formatNumber(forecast.snapshot.deals.decided, locale)}</strong></article>
            <article><span>{copy.wonDeals}</span><strong>{formatNumber(forecast.snapshot.deals.won, locale)}</strong></article>
          </section>

          <section className="crm-analytics-workspace__panel" aria-labelledby="crm-forecast-title">
            <header><div><p className="eyebrow"><TrendingUp aria-hidden="true" size={16} /> {copy.forecastTitle}</p><h3 id="crm-forecast-title">{copy.forecastTitle}</h3><p>{copy.forecastBody}</p></div></header>
            {forecast.snapshot.deals.forecast.length ? (
              <div className="crm-analytics-workspace__currencies">
                {forecast.snapshot.deals.forecast.map((row) => {
                  const cycle = forecast.snapshot.deals.averageSalesCycleByCurrency.find((item) => item.currency === row.currency);
                  return (
                    <article key={row.currency}>
                      <header><strong>{row.currency}</strong><Gauge aria-hidden="true" size={19} /></header>
                      <dl>
                        <div><dt>{copy.pipeline}</dt><dd>{formatCurrency(row.pipelineValue, row.currency, locale)}</dd></div>
                        <div><dt>{copy.weighted}</dt><dd>{formatCurrency(row.weightedForecast, row.currency, locale)}</dd></div>
                        <div><dt>{copy.cycle}</dt><dd>{cycle?.averageSalesCycleDays === null || cycle?.averageSalesCycleDays === undefined ? '—' : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(cycle.averageSalesCycleDays)} ${copy.days}`}</dd></div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            ) : <p className="crm-analytics-workspace__empty-inline">{copy.noForecast}</p>}
          </section>

          <div className="crm-analytics-workspace__dimensions">
            <section className="crm-analytics-workspace__panel" aria-labelledby="crm-source-performance-title">
              <header><h3 id="crm-source-performance-title">{copy.sourcePerformance}</h3></header>
              <div className="crm-analytics-workspace__table-wrap">
                <table>
                  <thead><tr><th scope="col">{copy.source}</th><th scope="col">{copy.open}</th><th scope="col">{copy.won}</th><th scope="col">{copy.lost}</th></tr></thead>
                  <tbody>{sourceRows.map((row) => <tr key={row.dimension}><th scope="row">{humanize(row.dimension)}</th><td>{row.outcomes.OPEN}</td><td>{row.outcomes.WON}</td><td>{row.outcomes.LOST}</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="crm-analytics-workspace__panel" aria-labelledby="crm-stage-health-title">
              <header><h3 id="crm-stage-health-title">{copy.stageHealth}</h3></header>
              <div className="crm-analytics-workspace__table-wrap">
                <table>
                  <thead><tr><th scope="col">{copy.stage}</th><th scope="col">{copy.currentDeals}</th><th scope="col">{copy.averageTime}</th></tr></thead>
                  <tbody>{forecast.dimensions.stages
                    .filter((row) => row.stage)
                    .sort((left, right) => (left.stage?.position ?? 0) - (right.stage?.position ?? 0))
                    .map((row) => <tr key={`${row.stageId}-${row.outcome}`}><th scope="row">{row.stage?.name}</th><td>{row._count._all}</td><td>{formatHours(stageTime.get(row.stageId ?? ''), copy, locale)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="crm-analytics-workspace__panel" aria-labelledby="crm-score-band-title">
              <header><h3 id="crm-score-band-title">{copy.scoreBands}</h3></header>
              <div className="crm-analytics-workspace__table-wrap">
                <table>
                  <thead><tr><th scope="col">{copy.scoreBand}</th><th scope="col">{copy.open}</th><th scope="col">{copy.won}</th><th scope="col">{copy.lost}</th></tr></thead>
                  <tbody>{scoreRows.map((row) => <tr key={row.dimension}><th scope="row">{humanize(row.dimension)}</th><td>{row.outcomes.OPEN}</td><td>{row.outcomes.WON}</td><td>{row.outcomes.LOST}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="crm-analytics-workspace__reasons">
            <section className="crm-analytics-workspace__panel"><header><h3>{copy.wonReasons}</h3></header>{wonReasons.length ? wonReasons.map((row) => <p key={row.wonReason}><span>{row.wonReason}</span><strong>{row._count._all}</strong></p>) : <p>{copy.noReasons}</p>}</section>
            <section className="crm-analytics-workspace__panel"><header><h3>{copy.lostReasons}</h3></header>{lostReasons.length ? lostReasons.map((row) => <p key={row.lostReason}><span>{row.lostReason}</span><strong>{row._count._all}</strong></p>) : <p>{copy.noReasons}</p>}</section>
          </div>
        </>
      ) : null}

      <section className="crm-analytics-workspace__panel crm-analytics-workspace__source-register" aria-labelledby="crm-source-register-title">
        <header>
          <div><p className="eyebrow"><DatabaseZap aria-hidden="true" size={16} /> {copy.sourceRegister}</p><h3 id="crm-source-register-title">{copy.sourceRegister}</h3><p>{copy.sourceRegisterBody}</p></div>
          <div className="crm-analytics-workspace__total"><span>{copy.totalEvents}</span><strong>{formatNumber(total, locale)}</strong></div>
        </header>

        <form className="crm-analytics-workspace__filters" onSubmit={submitFilters}>
          <label className="crm-analytics-workspace__search"><span>{copy.search}</span><div><Search aria-hidden="true" size={17} /><input defaultValue={search} key={search} name="search" placeholder={copy.searchPlaceholder} /></div></label>
          <label><span>{copy.eventType}</span><select defaultValue={type} key={type} name="type"><option value="">{copy.all}</option>{sourceEventTypes.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
          <label><span>{copy.consent}</span><select defaultValue={consentStatus} key={consentStatus} name="consentStatus"><option value="">{copy.all}</option>{consentStatuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
          <label><span>{copy.linkedTo}</span><select defaultValue={linkedTo} key={linkedTo} name="linkedTo"><option value="ANY">{copy.anyRecord}</option><option value="CONTACT">{copy.contact}</option><option value="LEAD">{copy.lead}</option><option value="ACCOUNT">{copy.account}</option><option value="DEAL">{copy.deal}</option><option value="UNLINKED">{copy.unlinked}</option></select></label>
          <label><span>{copy.sort}</span><select defaultValue={sortBy} key={sortBy} name="sortBy"><option value="occurredAt">{copy.occurredAt}</option><option value="type">{copy.eventType}</option><option value="consentStatus">{copy.consent}</option></select></label>
          <label><span>{copy.direction}</span><select defaultValue={direction} key={direction} name="direction"><option value="desc">{copy.newest}</option><option value="asc">{copy.oldest}</option></select></label>
          <div className="crm-analytics-workspace__filter-actions"><button className="button-link button-link--primary" type="submit">{copy.apply}</button><button className="button-link button-link--ghost" onClick={resetFilters} type="button">{copy.reset}</button></div>
        </form>

        {!loading && !error && events.length === 0 ? (
          <div className="crm-analytics-workspace__state">
            <DatabaseZap aria-hidden="true" size={25} />
            <div><h3>{copy.emptyTitle}</h3><p>{copy.emptyBody}</p></div>
          </div>
        ) : null}

        <div className="crm-analytics-workspace__events" aria-label={copy.sourceRegister}>
          {events.map((event) => {
            const related = relatedRecord(event, workspaceId);
            return (
              <article key={event.id}>
                <header><div><span className="status-pill">{humanize(event.type)}</span><h4>{event.contact?.fullName ?? event.lead?.title ?? event.account?.name ?? event.deal?.name ?? event.sourceRecordId}</h4></div><time dateTime={event.occurredAt}>{formatDate(event.occurredAt, locale)}</time></header>
                <dl>
                  <div><dt>{copy.consent}</dt><dd>{humanize(event.consentStatus)}</dd></div>
                  <div><dt>{copy.rule}</dt><dd>{event.ruleKey}</dd></div>
                  <div><dt>{copy.record}</dt><dd>{event.sourceRecordId}</dd></div>
                  <div><dt>{copy.related}</dt><dd>{related ? <Link to={related.to}>{related.label}</Link> : copy.noRelated}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>

        <nav className="crm-analytics-workspace__pagination" aria-label={copy.sourceRegister}>
          <button className="button-link button-link--secondary" disabled={page <= 1 || loading} onClick={() => updateParams({ analyticsPage: page > 2 ? String(page - 1) : null })} type="button"><ChevronLeft aria-hidden="true" size={16} /> {copy.previous}</button>
          <span>{copy.page} <strong>{page}</strong> {copy.of} <strong>{totalPages}</strong></span>
          <button className="button-link button-link--secondary" disabled={page >= totalPages || loading} onClick={() => updateParams({ analyticsPage: String(page + 1) })} type="button">{copy.next} <ChevronRight aria-hidden="true" size={16} /></button>
        </nav>
      </section>
    </section>
  );
}

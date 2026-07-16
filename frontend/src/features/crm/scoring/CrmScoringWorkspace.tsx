import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flame,
  RefreshCw,
  Search,
  ShieldCheck,
  Snowflake,
  Sparkles,
  ThermometerSun,
  TrendingUp
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import { getCrmLead, type CrmLead, type CrmWorkspaceAccess } from '../../../api/crm';
import {
  getCrmLeadScoreHistory,
  listCrmScoringRegister,
  recalculateCrmScores,
  type CrmScoreSnapshot,
  type CrmScoringDirection,
  type CrmScoringRegisterItem,
  type CrmScoringSortBy,
  type CrmScoringStatus
} from '../../../api/crmAdvanced';
import { useAuth } from '../../../auth/AuthContext';
import AccessibleDialog from '../../../components/AccessibleDialog';
import type { CrmScoreBand } from '../../../generated/crmContract';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useLanguage } from '../../../i18n/LanguageContext';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../WorkspaceSelector';

const PAGE_SIZE = 20;
type BandFilter = CrmScoreBand | 'ALL';
type ScoringWorkspaceChoice = CrmWorkspaceChoice & { scope: 'personal' | 'company' | 'admin' };
type ScoringRouteState = { returnFocusLeadId?: string };

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'CRM scoring operation failed.';
}

function workspaceChoices(access: CrmWorkspaceAccess | null | undefined, language: 'en' | 'ar'): ScoringWorkspaceChoice[] {
  if (!access) return [];
  const choices: ScoringWorkspaceChoice[] = [];
  const personal = access.workspaces?.find((item) => item.type === 'PERSONAL');
  if (personal?.workspaceId && personal.canView) {
    choices.push({
      key: personal.workspaceId,
      workspaceId: personal.workspaceId,
      label: language === 'ar' ? 'CRM الشخصي' : 'Personal CRM',
      canManage: personal.canManage,
      canManageWorkspace: true,
      propertyScope: personal.propertyScope,
      scope: 'personal'
    });
  }
  for (const company of access.companyWorkspaces.filter((item) => item.canView)) {
    choices.push({
      key: company.workspaceId,
      workspaceId: company.workspaceId,
      companyId: company.companyId,
      label: language === 'ar' ? company.nameAr || company.nameEn : company.nameEn,
      canManage: company.canManage,
      canManageWorkspace: company.canManageWorkspace,
      propertyScope: company.propertyScope,
      scope: 'company'
    });
  }
  const platform = access.workspaces?.find((item) => item.type === 'PLATFORM');
  if (platform?.workspaceId && access.isAdmin) {
    choices.push({
      key: platform.workspaceId,
      workspaceId: platform.workspaceId,
      label: language === 'ar' ? 'CRM مشغّل lux.om' : 'lux.om operator CRM',
      canManage: true,
      canManageWorkspace: true,
      propertyScope: platform.propertyScope,
      scope: 'admin'
    });
  }
  return choices;
}

function safeBand(value: string | null): BandFilter {
  return value === 'COLD' || value === 'WARM' || value === 'HOT' ? value : 'ALL';
}

function safeStatus(value: string | null): CrmScoringStatus {
  return value === 'ARCHIVED' || value === 'ALL' ? value : 'ACTIVE';
}

function safeSort(value: string | null): CrmScoringSortBy {
  return value === 'scoreCalculatedAt' || value === 'updatedAt' || value === 'title' ? value : 'score';
}

function safeDirection(value: string | null): CrmScoringDirection {
  return value === 'asc' ? 'asc' : 'desc';
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function signalValue(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

export default function CrmScoringWorkspace() {
  const { token, crmAccess } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-OM' : 'en-OM';
  const location = useLocation();
  const navigate = useNavigate();
  const { leadId } = useParams<{ leadId?: string }>();
  const [params, setParams] = useSearchParams();
  const pendingParamsRef = useRef(new URLSearchParams(params));
  const choices = useMemo(() => workspaceChoices(crmAccess, language), [crmAccess, language]);
  const requestedWorkspaceId = params.get('workspaceId');
  const [workspaceId, setWorkspaceId] = useState('');
  const activeChoice = choices.find((choice) => choice.workspaceId === workspaceId);
  const canRecalculate = Boolean(crmAccess?.isAdmin || (activeChoice?.canManage && activeChoice?.canManageWorkspace));

  const page = Math.max(1, Number(params.get('scorePage')) || 1);
  const search = params.get('scoreQ')?.trim() ?? '';
  const band = safeBand(params.get('scoreBand'));
  const status = safeStatus(params.get('scoreStatus'));
  const sortBy = safeSort(params.get('scoreSort'));
  const direction = safeDirection(params.get('scoreDirection'));

  const [searchInput, setSearchInput] = useState(search);
  const [bandInput, setBandInput] = useState<BandFilter>(band);
  const [statusInput, setStatusInput] = useState<CrmScoringStatus>(status);
  const [sortInput, setSortInput] = useState<CrmScoringSortBy>(sortBy);
  const [directionInput, setDirectionInput] = useState<CrmScoringDirection>(direction);
  const [scores, setScores] = useState<CrmScoringRegisterItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, archived: 0, hot: 0, warm: 0, cold: 0, neverCalculated: 0, stale: 0 });
  const [rules, setRules] = useState({ currentVersion: '—', propertyScopeApplied: true as const, editableRules: false as const, immutableSnapshots: true as const });
  const [paginationTotal, setPaginationTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [history, setHistory] = useState<CrmScoreSnapshot[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [recalculateOpen, setRecalculateOpen] = useState(false);
  const [recalculateVersion, setRecalculateVersion] = useState('');
  const [recalculateAcknowledged, setRecalculateAcknowledged] = useState(false);
  const [recalculateBusy, setRecalculateBusy] = useState(false);
  const [recalculateError, setRecalculateError] = useState('');

  const recalculateTriggerRef = useRef<HTMLButtonElement>(null);
  const recalculateVersionRef = useRef<HTMLInputElement>(null);

  useDocumentTitle(language === 'ar' ? 'تقييم CRM | lux.om' : 'CRM scoring | lux.om');

  const copy = language === 'ar'
    ? {
        eyebrow: 'حوكمة الذكاء', title: 'مركز تقييم CRM', description: 'راجع نتائج التقييم القابلة للتفسير ولقطاتها غير القابلة للتعديل من دون اختراع محرر قواعد غير مدعوم.', workspace: 'مساحة العمل', refresh: 'تحديث التقييمات', recalculate: 'إعادة احتساب التقييمات', readOnly: 'عرض فقط', readOnlyBody: 'يمكنك مراجعة نتائج التقييم ضمن نطاق العقارات، لكن إعادة الاحتساب تتطلب صلاحية إدارة مساحة العمل.',
        total: 'إجمالي العملاء', hot: 'ساخن', warm: 'دافئ', cold: 'بارد', stale: 'بحاجة لإعادة احتساب', search: 'البحث في التقييمات', searchPlaceholder: 'العميل أو جهة الاتصال أو الإصدار', band: 'الفئة', state: 'الحالة', sort: 'الترتيب', direction: 'الاتجاه', apply: 'تطبيق عوامل التصفية', reset: 'إعادة الضبط', allBands: 'كل الفئات', activeState: 'نشطة فقط', archivedState: 'مؤرشفة فقط', allStates: 'كل الحالات', scoreSort: 'النتيجة', calculatedSort: 'وقت الاحتساب', updatedSort: 'آخر تحديث', titleSort: 'اسم العميل', ascending: 'تصاعدي', descending: 'تنازلي',
        lead: 'العميل المحتمل', contact: 'جهة الاتصال', score: 'التقييم', trend: 'الاتجاه', version: 'الإصدار', calculated: 'تم الاحتساب', actions: 'الإجراءات', review: 'مراجعة دليل التقييم', loading: 'جارٍ تحميل تقييمات CRM…', emptyTitle: 'لا توجد تقييمات مطابقة', emptyBody: 'عدّل عوامل التصفية أو راجع مساحة عمل أخرى.', previous: 'السابق', next: 'التالي', page: 'صفحة', of: 'من',
        details: 'دليل تقييم العميل', closeDetails: 'إغلاق دليل التقييم', current: 'التقييم الحالي', reasons: 'أسباب النتيجة', signals: 'الإشارات', history: 'سجل اللقطات', noReasons: 'لا توجد أسباب محفوظة.', noSignals: 'لا توجد إشارات محفوظة.', noHistory: 'لا توجد لقطات تقييم.', openLead: 'فتح سجل العميل', archived: 'مؤرشف', active: 'نشط',
        recalculateTitle: 'مراجعة إعادة احتساب تقييمات CRM', recalculateDescription: 'تعيد العملية تقييم كل العملاء في مساحة العمل وتحفظ لقطة جديدة فقط عند تغير النتيجة أو الأدلة أو الإصدار.', closeRecalculate: 'إغلاق مراجعة إعادة الاحتساب', versionLabel: 'إصدار التقييم', acknowledgement: 'أفهم أن قواعد التقييم حتمية وغير قابلة للتعديل من هذه الشاشة وأن اللقطات التاريخية ستبقى محفوظة.', confirmRecalculate: 'تأكيد إعادة الاحتساب', recalculating: 'جارٍ إعادة الاحتساب…', currentVersion: 'الإصدار الحالي', immutable: 'اللقطات غير قابلة للتعديل', rulesLocked: 'قواعد التقييم ليست قابلة للتحرير', recalculated: (leads: number, snapshots: number) => `تمت إعادة احتساب ${leads} عميل وحفظ ${snapshots} لقطة.`
      }
    : {
        eyebrow: 'Intelligence governance', title: 'CRM scoring center', description: 'Review explainable scores and immutable snapshots without inventing a scoring-rule editor the backend does not support.', workspace: 'Workspace', refresh: 'Refresh scores', recalculate: 'Recalculate scores', readOnly: 'Read only', readOnlyBody: 'You can review property-scoped scoring evidence, but recalculation requires workspace-management access.',
        total: 'Total leads', hot: 'Hot', warm: 'Warm', cold: 'Cold', stale: 'Needs recalculation', search: 'Search scores', searchPlaceholder: 'Lead, contact, stage, or version', band: 'Band', state: 'State', sort: 'Sort by', direction: 'Direction', apply: 'Apply filters', reset: 'Reset filters', allBands: 'All bands', activeState: 'Active only', archivedState: 'Archived only', allStates: 'All states', scoreSort: 'Score', calculatedSort: 'Calculated time', updatedSort: 'Updated time', titleSort: 'Lead title', ascending: 'Ascending', descending: 'Descending',
        lead: 'Lead', contact: 'Contact', score: 'Score', trend: 'Trend', version: 'Version', calculated: 'Calculated', actions: 'Actions', review: 'Review scoring evidence', loading: 'Loading CRM scores…', emptyTitle: 'No matching scores', emptyBody: 'Adjust the filters or review another workspace.', previous: 'Previous', next: 'Next', page: 'Page', of: 'of',
        details: 'Lead scoring evidence', closeDetails: 'Close scoring evidence', current: 'Current score', reasons: 'Score reasons', signals: 'Signals', history: 'Snapshot history', noReasons: 'No score reasons are stored.', noSignals: 'No signals are stored.', noHistory: 'No score snapshots are stored.', openLead: 'Open lead record', archived: 'Archived', active: 'Active',
        recalculateTitle: 'Review CRM score recalculation', recalculateDescription: 'This recalculates every lead in the workspace and stores a new snapshot only when the score, evidence, or version changes.', closeRecalculate: 'Close recalculation review', versionLabel: 'Scoring version', acknowledgement: 'I understand scoring rules are deterministic and not editable here, and historical snapshots will remain preserved.', confirmRecalculate: 'Confirm recalculation', recalculating: 'Recalculating…', currentVersion: 'Current version', immutable: 'Snapshots are immutable', rulesLocked: 'Scoring rules are not editable', recalculated: (leads: number, snapshots: number) => `Recalculated ${leads} leads and stored ${snapshots} snapshots.`
      };

  useEffect(() => { pendingParamsRef.current = new URLSearchParams(params); }, [params]);

  function replaceQuery(mutator: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(pendingParamsRef.current);
    mutator(next);
    pendingParamsRef.current = next;
    setParams(next, { replace: true });
  }

  useEffect(() => {
    if (!choices.length) return;
    const requested = choices.find((choice) => choice.workspaceId === requestedWorkspaceId);
    const nextChoice = requested ?? choices[0];
    if (workspaceId !== nextChoice.workspaceId) setWorkspaceId(nextChoice.workspaceId ?? '');
    if (requestedWorkspaceId !== nextChoice.workspaceId) {
      replaceQuery((next) => {
        next.set('workspaceId', nextChoice.workspaceId ?? '');
        next.delete('scorePage');
      });
    }
  }, [choices, requestedWorkspaceId, workspaceId]);

  useEffect(() => {
    setSearchInput(search);
    setBandInput(band);
    setStatusInput(status);
    setSortInput(sortBy);
    setDirectionInput(direction);
  }, [search, band, status, sortBy, direction]);

  async function loadScores() {
    if (!token || !workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const response = await listCrmScoringRegister(token, {
        workspaceId,
        search: search || undefined,
        band: band === 'ALL' ? undefined : band,
        status,
        sortBy,
        direction,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE
      });
      setScores(response.scores);
      setSummary(response.summary);
      setRules(response.rules);
      setPaginationTotal(response.pagination.total);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadScores(); }, [token, workspaceId, search, band, status, sortBy, direction, page]);

  useEffect(() => {
    const returnFocusLeadId = (location.state as ScoringRouteState | null)?.returnFocusLeadId;
    if (leadId || !returnFocusLeadId || loading) return;
    const trigger = document.querySelector<HTMLButtonElement>(`button[data-scoring-review-id="${returnFocusLeadId}"]`);
    if (!trigger) return;
    trigger.focus();
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [leadId, loading, location.pathname, location.search, location.state, navigate, scores]);

  useEffect(() => {
    if (!token || !leadId) {
      setSelectedLead(null);
      setHistory([]);
      setDetailError('');
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    void Promise.all([getCrmLead(token, leadId), getCrmLeadScoreHistory(token, leadId)])
      .then(([leadResponse, historyResponse]) => {
        if (!active) return;
        setSelectedLead(leadResponse.lead);
        setHistory(historyResponse.snapshots);
      })
      .catch((detailLoadError) => { if (active) setDetailError(errorMessage(detailLoadError)); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [leadId, token]);

  function workspaceChanged(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId);
    setSelectedLead(null);
    replaceQuery((next) => {
      next.set('workspaceId', nextWorkspaceId);
      next.delete('scorePage');
    });
    navigate({ pathname: '/crm/settings/scoring', search: `?${pendingParamsRef.current.toString()}` }, { replace: true });
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    replaceQuery((next) => {
      const values: Array<[string, string]> = [
        ['scoreQ', searchInput.trim()],
        ['scoreBand', bandInput === 'ALL' ? '' : bandInput],
        ['scoreStatus', statusInput === 'ACTIVE' ? '' : statusInput],
        ['scoreSort', sortInput === 'score' ? '' : sortInput],
        ['scoreDirection', directionInput === 'desc' ? '' : directionInput]
      ];
      for (const [key, value] of values) value ? next.set(key, value) : next.delete(key);
      next.delete('scorePage');
    });
  }

  function resetFilters() {
    setSearchInput('');
    setBandInput('ALL');
    setStatusInput('ACTIVE');
    setSortInput('score');
    setDirectionInput('desc');
    replaceQuery((next) => {
      ['scoreQ', 'scoreBand', 'scoreStatus', 'scoreSort', 'scoreDirection', 'scorePage'].forEach((key) => next.delete(key));
    });
  }

  function pageChanged(nextPage: number) {
    replaceQuery((next) => {
      nextPage > 1 ? next.set('scorePage', String(nextPage)) : next.delete('scorePage');
    });
  }

  function openDetail(id: string) {
    const query = pendingParamsRef.current.toString();
    navigate(`/crm/settings/scoring/${id}${query ? `?${query}` : ''}`, {
      state: { returnFocusLeadId: id } satisfies ScoringRouteState
    });
  }

  function leadRecordPath(id: string) {
    const workspaceKey = activeChoice?.scope === 'company' && activeChoice.companyId
      ? `company:${activeChoice.companyId}`
      : activeChoice?.scope === 'personal'
        ? 'personal'
        : activeChoice?.scope === 'admin'
          ? 'admin'
          : '';
    return `/crm/leads/${id}${workspaceKey ? `?workspace=${encodeURIComponent(workspaceKey)}` : ''}`;
  }

  function closeDetail() {
    setSelectedLead(null);
    setHistory([]);
    const query = pendingParamsRef.current.toString();
    navigate(`/crm/settings/scoring${query ? `?${query}` : ''}`, { state: location.state as ScoringRouteState | null });
  }

  function openRecalculation() {
    setRecalculateVersion(rules.currentVersion === '—' ? '' : rules.currentVersion);
    setRecalculateAcknowledged(false);
    setRecalculateError('');
    setRecalculateOpen(true);
  }

  async function submitRecalculation(event: FormEvent) {
    event.preventDefault();
    if (!token || !workspaceId || !recalculateAcknowledged) return;
    setRecalculateBusy(true);
    setRecalculateError('');
    try {
      const response = await recalculateCrmScores(token, {
        workspaceId,
        ...(recalculateVersion.trim() ? { version: recalculateVersion.trim() } : {})
      });
      setRecalculateOpen(false);
      setSuccess(copy.recalculated(response.result.leads, response.result.snapshots));
      await loadScores();
      if (leadId) {
        const [leadResponse, historyResponse] = await Promise.all([getCrmLead(token, leadId), getCrmLeadScoreHistory(token, leadId)]);
        setSelectedLead(leadResponse.lead);
        setHistory(historyResponse.snapshots);
      }
    } catch (submitError) {
      setRecalculateError(errorMessage(submitError));
    } finally {
      setRecalculateBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(paginationTotal / PAGE_SIZE));
  const latestSnapshot = history[0] ?? null;

  return (
    <section className="crm-scoring-center" aria-labelledby="crm-scoring-center-title">
      <header className="crm-scoring-center__header">
        <div><p className="eyebrow"><BarChart3 aria-hidden="true" size={17} />{copy.eyebrow}</p><h1 id="crm-scoring-center-title">{copy.title}</h1><p>{copy.description}</p></div>
        <div className="crm-scoring-center__header-actions">
          <WorkspaceSelector label={copy.workspace} choices={choices} value={workspaceId} onChange={workspaceChanged} />
          <button aria-label={copy.refresh} className="button-link button-link--secondary" disabled={loading} onClick={() => void loadScores()} type="button"><RefreshCw aria-hidden="true" size={16} />{copy.refresh}</button>
          {canRecalculate ? <button className="button-link button-link--primary" onClick={openRecalculation} ref={recalculateTriggerRef} type="button"><Sparkles aria-hidden="true" size={16} />{copy.recalculate}</button> : null}
        </div>
      </header>

      {!canRecalculate ? <div className="crm-scoring-center__notice"><ShieldCheck aria-hidden="true" /><div><strong>{copy.readOnly}</strong><p>{copy.readOnlyBody}</p></div></div> : null}
      {success && !leadId ? <div className="crm-scoring-center__state crm-scoring-center__state--success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div> : null}
      {error ? <div className="crm-scoring-center__state crm-scoring-center__state--error" role="alert"><AlertCircle aria-hidden="true" />{error}</div> : null}

      <div className="crm-scoring-center__metrics">
        <article><TrendingUp aria-hidden="true" /><span>{copy.total}</span><strong>{summary.total.toLocaleString(locale)}</strong></article>
        <article><Flame aria-hidden="true" /><span>{copy.hot}</span><strong>{summary.hot.toLocaleString(locale)}</strong></article>
        <article><ThermometerSun aria-hidden="true" /><span>{copy.warm}</span><strong>{summary.warm.toLocaleString(locale)}</strong></article>
        <article><Snowflake aria-hidden="true" /><span>{copy.cold}</span><strong>{summary.cold.toLocaleString(locale)}</strong></article>
        <article><RefreshCw aria-hidden="true" /><span>{copy.stale}</span><strong>{summary.stale.toLocaleString(locale)}</strong></article>
      </div>

      <div className="crm-scoring-center__rules" aria-label="Scoring governance rules">
        <span><ShieldCheck aria-hidden="true" />{copy.currentVersion}: <strong>{rules.currentVersion}</strong></span>
        <span><CheckCircle2 aria-hidden="true" />{copy.immutable}</span>
        <span><CheckCircle2 aria-hidden="true" />{copy.rulesLocked}</span>
      </div>

      <form className="crm-scoring-center__filters" onSubmit={applyFilters}>
        <label><span>{copy.search}</span><span className="crm-scoring-center__search"><Search aria-hidden="true" size={16} /><input aria-label={copy.search} placeholder={copy.searchPlaceholder} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></span></label>
        <label><span>{copy.band}</span><select aria-label={copy.band} value={bandInput} onChange={(event) => setBandInput(event.target.value as BandFilter)}><option value="ALL">{copy.allBands}</option><option value="HOT">HOT</option><option value="WARM">WARM</option><option value="COLD">COLD</option></select></label>
        <label><span>{copy.state}</span><select aria-label={copy.state} value={statusInput} onChange={(event) => setStatusInput(event.target.value as CrmScoringStatus)}><option value="ACTIVE">{copy.activeState}</option><option value="ARCHIVED">{copy.archivedState}</option><option value="ALL">{copy.allStates}</option></select></label>
        <label><span>{copy.sort}</span><select aria-label={copy.sort} value={sortInput} onChange={(event) => setSortInput(event.target.value as CrmScoringSortBy)}><option value="score">{copy.scoreSort}</option><option value="scoreCalculatedAt">{copy.calculatedSort}</option><option value="updatedAt">{copy.updatedSort}</option><option value="title">{copy.titleSort}</option></select></label>
        <label><span>{copy.direction}</span><select aria-label={copy.direction} value={directionInput} onChange={(event) => setDirectionInput(event.target.value as CrmScoringDirection)}><option value="desc">{copy.descending}</option><option value="asc">{copy.ascending}</option></select></label>
        <div className="crm-scoring-center__filter-actions"><button className="button-link button-link--primary" type="submit">{copy.apply}</button><button className="button-link button-link--secondary" onClick={resetFilters} type="button">{copy.reset}</button></div>
      </form>

      {loading && !scores.length ? <div className="crm-scoring-center__state">{copy.loading}</div> : scores.length ? (
        <div className="crm-scoring-center__table-wrap">
          <table className="crm-scoring-center__table">
            <thead><tr><th>{copy.lead}</th><th>{copy.contact}</th><th>{copy.score}</th><th>{copy.trend}</th><th>{copy.version}</th><th>{copy.calculated}</th><th>{copy.actions}</th></tr></thead>
            <tbody>{scores.map((item) => <tr key={item.id}><th scope="row"><strong>{item.title}</strong><span>{item.pipeline?.name || '—'} · {item.stage?.name || item.status}</span></th><td><strong>{item.contact.fullName}</strong><span>{item.contact.email || item.contact.phone || '—'}</span></td><td><strong>{item.score}</strong><span>{item.scoreBand}</span></td><td>{item.latestSnapshot?.trend || '—'}</td><td>{item.scoringVersion}</td><td>{formatDate(item.scoreCalculatedAt, locale)}{item.archivedAt ? <span>{copy.archived}</span> : null}</td><td><button aria-label={`${copy.review}: ${item.title}`} type="button" data-scoring-review-id={item.id} onClick={() => openDetail(item.id)}><Eye aria-hidden="true" size={16} />{copy.review}</button></td></tr>)}</tbody>
          </table>
        </div>
      ) : <div className="crm-scoring-center__empty"><TrendingUp aria-hidden="true" /><h2>{copy.emptyTitle}</h2><p>{copy.emptyBody}</p></div>}

      <nav aria-label="Scoring pagination" className="crm-scoring-center__pagination">
        <button className="button-link button-link--secondary" disabled={page <= 1 || loading} onClick={() => pageChanged(page - 1)} type="button"><ChevronLeft aria-hidden="true" size={16} />{copy.previous}</button>
        <span>{copy.page} <strong>{page.toLocaleString(locale)}</strong> {copy.of} {totalPages.toLocaleString(locale)}</span>
        <button className="button-link button-link--secondary" disabled={page >= totalPages || loading} onClick={() => pageChanged(page + 1)} type="button">{copy.next}<ChevronRight aria-hidden="true" size={16} /></button>
      </nav>

      <AccessibleDialog closeLabel={copy.closeDetails} description={copy.description} onClose={closeDetail} open={Boolean(leadId)} size="large" title={selectedLead ? `${copy.details} · ${selectedLead.title}` : copy.details}>
        {detailLoading ? <div className="crm-scoring-center__state">{copy.loading}</div> : detailError ? <div className="form-error" role="alert">{detailError}</div> : selectedLead ? <div className="crm-scoring-center__detail">
          {success ? <div className="crm-scoring-center__state crm-scoring-center__state--success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div> : null}
          <div className="crm-scoring-center__detail-summary"><div><span>{copy.current}</span><strong>{selectedLead.score ?? 0} · {selectedLead.scoreBand ?? 'COLD'}</strong><p>{selectedLead.contact.fullName} · {selectedLead.archivedAt ? copy.archived : copy.active}</p></div><Link className="button-link button-link--secondary" to={leadRecordPath(selectedLead.id)}>{copy.openLead}</Link></div>
          <section><h2>{copy.reasons}</h2>{latestSnapshot?.reasons?.length ? <div className="crm-scoring-center__reason-list">{latestSnapshot.reasons.map((reason, index) => <article key={`${reason.key ?? reason.label ?? 'reason'}-${index}`}><strong>{reason.label || reason.key || '—'}</strong><span>{reason.points == null ? '—' : `${reason.points > 0 ? '+' : ''}${reason.points}`}</span></article>)}</div> : <p>{copy.noReasons}</p>}</section>
          <section><h2>{copy.signals}</h2>{latestSnapshot && Object.keys(latestSnapshot.signals ?? {}).length ? <dl className="crm-scoring-center__signals">{Object.entries(latestSnapshot.signals).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{signalValue(value)}</dd></div>)}</dl> : <p>{copy.noSignals}</p>}</section>
          <section><h2>{copy.history}</h2>{history.length ? <div className="crm-scoring-center__history">{history.map((snapshot) => <article key={snapshot.id}><div><strong>{snapshot.score} · {snapshot.band}</strong><span>{snapshot.trend}</span></div><p>{snapshot.version}</p><small>{formatDate(snapshot.calculatedAt, locale)} · {snapshot.previousScore == null ? '—' : `${snapshot.previousScore} → ${snapshot.score}`}</small></article>)}</div> : <p>{copy.noHistory}</p>}</section>
        </div> : null}
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.closeRecalculate} description={copy.recalculateDescription} initialFocusRef={recalculateVersionRef} onClose={() => { if (!recalculateBusy) setRecalculateOpen(false); }} open={recalculateOpen} returnFocusRef={recalculateTriggerRef} size="medium" title={copy.recalculateTitle}>
        <form className="crm-scoring-center__dialog-form" onSubmit={submitRecalculation}>{recalculateError ? <div className="form-error" role="alert">{recalculateError}</div> : null}<label><span>{copy.versionLabel}</span><input maxLength={80} minLength={2} ref={recalculateVersionRef} required value={recalculateVersion} onChange={(event) => setRecalculateVersion(event.target.value)} /></label><label className="crm-scoring-center__checkbox"><input checked={recalculateAcknowledged} required type="checkbox" onChange={(event) => setRecalculateAcknowledged(event.target.checked)} /><span>{copy.acknowledgement}</span></label><button className="button-link button-link--primary" disabled={recalculateBusy || !recalculateAcknowledged || recalculateVersion.trim().length < 2} type="submit">{recalculateBusy ? copy.recalculating : copy.confirmRecalculate}</button></form>
      </AccessibleDialog>
    </section>
  );
}

import {
  Archive,
  ArchiveRestore,
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import type { CrmWorkspaceAccess } from '../../../api/crm';
import {
  archiveCrmDeal,
  createCrmDeal,
  getCrmDeal,
  listCrmAccounts,
  listCrmDealRegister,
  listCrmPipelines,
  transitionCrmDeal,
  type CrmAccountSummary,
  type CrmDeal,
  type CrmDealDirection,
  type CrmDealSortBy,
  type CrmDealStatus,
  type CrmPipeline,
  type CrmPipelineStage
} from '../../../api/crmAdvanced';
import { useAuth } from '../../../auth/AuthContext';
import AccessibleDialog from '../../../components/AccessibleDialog';
import type { CrmDealOutcome } from '../../../generated/crmContract';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useLanguage } from '../../../i18n/LanguageContext';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../WorkspaceSelector';
import CrmDealStageTransitionDialog, { type CrmDealTransitionValues } from './CrmDealStageTransitionDialog';

const PAGE_SIZE = 25;
const outcomes: CrmDealOutcome[] = ['OPEN', 'WON', 'LOST'];

type DealWorkspaceChoice = CrmWorkspaceChoice & { scope: 'personal' | 'company' | 'admin' };

type DealForm = {
  name: string;
  description: string;
  accountId: string;
  pipelineId: string;
  stageId: string;
  expectedValue: string;
  currency: string;
  probability: string;
  expectedCloseDate: string;
};

const emptyDealForm: DealForm = {
  name: '',
  description: '',
  accountId: '',
  pipelineId: '',
  stageId: '',
  expectedValue: '',
  currency: 'OMR',
  probability: '',
  expectedCloseDate: ''
};

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'CRM deal operation failed.';
}

function workspaceChoices(access: CrmWorkspaceAccess | null | undefined, language: 'en' | 'ar'): DealWorkspaceChoice[] {
  if (!access) return [];
  const choices: DealWorkspaceChoice[] = [];
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

function safeOutcome(value: string | null): CrmDealOutcome | '' {
  return outcomes.includes(value as CrmDealOutcome) ? value as CrmDealOutcome : '';
}

function safeStatus(value: string | null): CrmDealStatus {
  return value === 'ARCHIVED' || value === 'ALL' ? value : 'ACTIVE';
}

function safeSort(value: string | null): CrmDealSortBy {
  return value === 'name' || value === 'expectedValue' || value === 'updatedAt' || value === 'createdAt'
    ? value
    : 'expectedCloseDate';
}

function safeDirection(value: string | null): CrmDealDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

function formatDate(value: string | null | undefined, locale: string, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value));
}

function money(value: string | number | null | undefined, currency: string, locale: string) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number.isFinite(amount) ? amount : 0);
}

function activeStages(pipeline: CrmPipeline | undefined) {
  return pipeline?.stages.filter((stage) => stage.active) ?? [];
}

export default function CrmDealsWorkspace() {
  const { token, crmAccess } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-OM' : 'en-OM';
  const location = useLocation();
  const navigate = useNavigate();
  const { dealId } = useParams();
  const [params, setParams] = useSearchParams();
  const pendingParamsRef = useRef(new URLSearchParams(params));
  const choices = useMemo(() => workspaceChoices(crmAccess, language), [crmAccess, language]);
  const requestedWorkspaceId = params.get('workspaceId');
  const [workspaceId, setWorkspaceId] = useState('');
  const activeChoice = choices.find((choice) => choice.workspaceId === workspaceId);
  const canManage = Boolean(activeChoice?.canManage);

  const page = Math.max(1, Number(params.get('dealPage')) || 1);
  const search = params.get('dealQ')?.trim() ?? '';
  const pipelineIdFilter = params.get('dealPipeline') ?? '';
  const stageIdFilter = params.get('dealStage') ?? '';
  const outcome = safeOutcome(params.get('dealOutcome'));
  const currency = params.get('dealCurrency')?.trim().toUpperCase() ?? '';
  const status = safeStatus(params.get('dealStatus'));
  const closeFrom = params.get('dealCloseFrom') ?? '';
  const closeTo = params.get('dealCloseTo') ?? '';
  const sortBy = safeSort(params.get('dealSort'));
  const direction = safeDirection(params.get('dealDirection'));

  const [searchInput, setSearchInput] = useState(search);
  const [pipelineInput, setPipelineInput] = useState(pipelineIdFilter);
  const [stageInput, setStageInput] = useState(stageIdFilter);
  const [outcomeInput, setOutcomeInput] = useState<CrmDealOutcome | ''>(outcome);
  const [currencyInput, setCurrencyInput] = useState(currency);
  const [statusInput, setStatusInput] = useState<CrmDealStatus>(status);
  const [closeFromInput, setCloseFromInput] = useState(closeFrom);
  const [closeToInput, setCloseToInput] = useState(closeTo);
  const [sortInput, setSortInput] = useState<CrmDealSortBy>(sortBy);
  const [directionInput, setDirectionInput] = useState<CrmDealDirection>(direction);

  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, archived: 0, open: 0, won: 0, lost: 0 });
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [accounts, setAccounts] = useState<CrmAccountSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<DealForm>(emptyDealForm);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  const [pendingTransition, setPendingTransition] = useState<{ deal: CrmDeal; targetStage: CrmPipelineStage } | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState('');

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveAcknowledged, setArchiveAcknowledged] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const createNameRef = useRef<HTMLInputElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement>(null);
  const transitionTriggerRef = useRef<HTMLSelectElement>(null);
  const archiveTriggerRef = useRef<HTMLButtonElement>(null);
  const archiveReasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (location.state?.focusTarget !== 'crm-deal-create') return;
    const trigger = createTriggerRef.current;
    if (!trigger || trigger.disabled) return;

    const frame = window.requestAnimationFrame(() => {
      trigger.focus();
      if (document.activeElement !== trigger) return;
      void navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: null }
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.search, location.state, navigate]);

  useDocumentTitle(language === 'ar' ? 'صفقات CRM | lux.om' : 'CRM deals | lux.om');

  const copy = language === 'ar'
    ? {
        eyebrow: 'إدارة فرص محكومة', title: 'مركز صفقات CRM', description: 'استعرض الصفقات حسب خط المبيعات والمرحلة والنتيجة، واحتفظ بسجل انتقالات لا يتغير وتوقعات عملات منفصلة.',
        workspace: 'مساحة العمل', refresh: 'تحديث الصفقات', create: 'إنشاء صفقة', readOnly: 'عرض فقط', readOnlyBody: 'يمكنك مراجعة الصفقات، لكن صلاحيتك الحالية لا تسمح بإنشائها أو نقل مراحلها أو أرشفتها.',
        total: 'إجمالي النتائج', active: 'نشطة', archived: 'مؤرشفة', open: 'مفتوحة', won: 'رابحة', lost: 'خاسرة',
        search: 'البحث في الصفقات', searchPlaceholder: 'اسم الصفقة أو الحساب أو جهة الاتصال', pipeline: 'خط المبيعات', allPipelines: 'كل الخطوط', stage: 'المرحلة', allStages: 'كل المراحل', outcome: 'النتيجة', allOutcomes: 'كل النتائج', currency: 'العملة', state: 'الحالة', closeFrom: 'الإغلاق المتوقع من', closeTo: 'الإغلاق المتوقع إلى', sort: 'الترتيب', direction: 'الاتجاه', apply: 'تطبيق عوامل التصفية', reset: 'إعادة الضبط',
        name: 'الصفقة', account: 'الحساب', pipelineStage: 'الخط والمرحلة', value: 'القيمة', result: 'النتيجة', expectedClose: 'الإغلاق المتوقع', actions: 'الإجراءات', review: 'مراجعة الصفقة', loading: 'جارٍ تحميل صفقات CRM…', emptyTitle: 'لا توجد صفقات مطابقة', emptyBody: 'عدّل عوامل التصفية أو أنشئ صفقة محكومة.',
        previous: 'السابق', next: 'التالي', page: 'صفحة', of: 'من', ascending: 'تصاعدي', descending: 'تنازلي', nameSort: 'الاسم', expectedCloseSort: 'الإغلاق المتوقع', expectedValueSort: 'القيمة المتوقعة', updatedAt: 'آخر تحديث', createdAt: 'وقت الإنشاء', activeState: 'النشطة فقط', archivedState: 'المؤرشفة فقط', allStates: 'كل الحالات',
        createTitle: 'إنشاء صفقة CRM محكومة', createDescription: 'تُربط الصفقة بحساب نشط وخط مبيعات ومرحلة داخل مساحة العمل الحالية.', closeCreate: 'إغلاق إنشاء الصفقة', descriptionField: 'الوصف', expectedValue: 'القيمة المتوقعة', probability: 'الاحتمال', expectedCloseDate: 'تاريخ الإغلاق المتوقع', saveDeal: 'حفظ الصفقة', saving: 'جارٍ الحفظ…', created: 'تم إنشاء الصفقة.', accountRequired: 'اختر حساباً نشطاً.', pipelineRequired: 'اختر خط مبيعات ومرحلة صالحين.',
        details: 'تفاصيل الصفقة', back: 'العودة إلى سجل الصفقات', primaryContact: 'جهة الاتصال الأساسية', owner: 'المالك', noContact: 'لا توجد جهة اتصال أساسية', noOwner: 'لا يوجد مالك معيّن', sourceLead: 'العميل المحتمل المصدر', noSourceLead: 'لم يتم تحويل الصفقة من عميل محتمل', stageHistory: 'سجل المراحل الدائم', noHistory: 'لا يوجد سجل مراحل.', reopened: 'إعادة فتح', activities: 'الأنشطة',
        archive: 'أرشفة الصفقة', restore: 'استعادة الصفقة', archiveTitle: 'مراجعة تغيير حالة الصفقة', archiveDescription: 'تتطلب الأرشفة أو الاستعادة سبباً واضحاً وتُسجّل نشاطاً قابلاً للتدقيق.', closeArchive: 'إغلاق مراجعة الحالة', reason: 'سبب التغيير', acknowledge: 'أفهم أن هذا يغيّر الظهور التشغيلي للصفقة من دون حذف تاريخها التجاري.', confirmArchive: 'تأكيد الأرشفة', confirmRestore: 'تأكيد الاستعادة', dealArchived: 'تمت أرشفة الصفقة.', dealRestored: 'تمت استعادة الصفقة.',
        move: 'Move', unknown: 'غير معروف'
      }
    : {
        eyebrow: 'Governed opportunity operations', title: 'CRM deal center', description: 'Browse deals by pipeline, stage, and outcome while preserving immutable transition history and currency-safe forecasting.',
        workspace: 'Workspace', refresh: 'Refresh deals', create: 'Create deal', readOnly: 'Read only', readOnlyBody: 'You can review deals, but your current access cannot create, move, archive, or restore them.',
        total: 'Total results', active: 'Active', archived: 'Archived', open: 'Open', won: 'Won', lost: 'Lost',
        search: 'Search deals', searchPlaceholder: 'Deal, account, contact, pipeline, or stage', pipeline: 'Pipeline', allPipelines: 'All pipelines', stage: 'Stage', allStages: 'All stages', outcome: 'Outcome', allOutcomes: 'All outcomes', currency: 'Currency', state: 'State', closeFrom: 'Expected close from', closeTo: 'Expected close to', sort: 'Sort by', direction: 'Direction', apply: 'Apply filters', reset: 'Reset filters',
        name: 'Deal', account: 'Account', pipelineStage: 'Pipeline and stage', value: 'Value', result: 'Outcome', expectedClose: 'Expected close', actions: 'Actions', review: 'Review deal', loading: 'Loading CRM deals…', emptyTitle: 'No matching deals', emptyBody: 'Adjust the filters or create a governed opportunity.',
        previous: 'Previous', next: 'Next', page: 'Page', of: 'of', ascending: 'Ascending', descending: 'Descending', nameSort: 'Name', expectedCloseSort: 'Expected close', expectedValueSort: 'Expected value', updatedAt: 'Updated time', createdAt: 'Created time', activeState: 'Active only', archivedState: 'Archived only', allStates: 'All states',
        createTitle: 'Create governed CRM deal', createDescription: 'The deal is linked to an active account, pipeline, and stage inside the selected workspace.', closeCreate: 'Close deal creation', descriptionField: 'Description', expectedValue: 'Expected value', probability: 'Probability', expectedCloseDate: 'Expected close date', saveDeal: 'Save deal', saving: 'Saving…', created: 'The deal was created.', accountRequired: 'Select an active account.', pipelineRequired: 'Select a valid pipeline and stage.',
        details: 'Deal details', back: 'Back to deal register', primaryContact: 'Primary contact', owner: 'Owner', noContact: 'No primary contact', noOwner: 'No owner assigned', sourceLead: 'Source lead', noSourceLead: 'This deal was not converted from a lead', stageHistory: 'Immutable stage history', noHistory: 'No stage history is available.', reopened: 'Reopened', activities: 'Activities',
        archive: 'Archive deal', restore: 'Restore deal', archiveTitle: 'Review deal state change', archiveDescription: 'Archiving or restoring requires a clear reason and records an auditable activity.', closeArchive: 'Close state review', reason: 'Change reason', acknowledge: 'I understand this changes the deal’s operational visibility without deleting its commercial history.', confirmArchive: 'Confirm archive', confirmRestore: 'Confirm restore', dealArchived: 'The deal was archived.', dealRestored: 'The deal was restored.',
        move: 'Move', unknown: 'Unknown'
      };

  useEffect(() => {
    pendingParamsRef.current = new URLSearchParams(params);
  }, [params]);

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
        next.delete('dealPage');
      });
    }
  }, [choices, requestedWorkspaceId, workspaceId]);

  useEffect(() => {
    setSearchInput(search);
    setPipelineInput(pipelineIdFilter);
    setStageInput(stageIdFilter);
    setOutcomeInput(outcome);
    setCurrencyInput(currency);
    setStatusInput(status);
    setCloseFromInput(closeFrom);
    setCloseToInput(closeTo);
    setSortInput(sortBy);
    setDirectionInput(direction);
  }, [closeFrom, closeTo, currency, direction, outcome, pipelineIdFilter, search, sortBy, stageIdFilter, status]);

  async function loadReferenceData() {
    if (!token || !workspaceId) return;
    try {
      const [pipelineResponse, accountResponse] = await Promise.all([
        listCrmPipelines(token, workspaceId),
        listCrmAccounts(token, workspaceId)
      ]);
      setPipelines(pipelineResponse.pipelines.filter((pipeline) => pipeline.active));
      setAccounts(accountResponse.accounts.filter((account) => !account.archivedAt));
    } catch {
      setPipelines([]);
      setAccounts([]);
    }
  }

  async function loadDeals() {
    if (!token || !workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const response = await listCrmDealRegister(token, {
        workspaceId,
        search: search || undefined,
        pipelineId: pipelineIdFilter || undefined,
        stageId: stageIdFilter || undefined,
        outcome: outcome || undefined,
        currency: currency || undefined,
        status,
        expectedCloseFrom: closeFrom || undefined,
        expectedCloseTo: closeTo || undefined,
        sortBy,
        direction,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE
      });
      setDeals(response.deals);
      setSummary(response.summary ?? {
        total: response.pagination.total,
        active: response.deals.filter((deal) => !deal.archivedAt).length,
        archived: response.deals.filter((deal) => Boolean(deal.archivedAt)).length,
        open: response.deals.filter((deal) => deal.outcome === 'OPEN' && !deal.archivedAt).length,
        won: response.deals.filter((deal) => deal.outcome === 'WON' && !deal.archivedAt).length,
        lost: response.deals.filter((deal) => deal.outcome === 'LOST' && !deal.archivedAt).length
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void Promise.all([loadDeals(), loadReferenceData()]); }, [token, workspaceId, search, pipelineIdFilter, stageIdFilter, outcome, currency, status, closeFrom, closeTo, sortBy, direction, page]);

  useEffect(() => {
    if (!token || !dealId) {
      setSelectedDeal(null);
      setDetailError('');
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    void getCrmDeal(token, dealId)
      .then((response) => { if (active) setSelectedDeal(response.deal); })
      .catch((detailLoadError) => { if (active) setDetailError(errorMessage(detailLoadError)); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [dealId, token]);

  function workspaceChanged(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId);
    setSelectedDeal(null);
    replaceQuery((next) => {
      next.set('workspaceId', nextWorkspaceId);
      next.delete('dealPage');
    });
    navigate({ pathname: '/crm/deals', search: `?${pendingParamsRef.current.toString()}` }, { replace: true });
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    replaceQuery((next) => {
      const values: Array<[string, string]> = [
        ['dealQ', searchInput.trim()],
        ['dealPipeline', pipelineInput],
        ['dealStage', stageInput],
        ['dealOutcome', outcomeInput],
        ['dealCurrency', currencyInput.trim().toUpperCase()],
        ['dealStatus', statusInput === 'ACTIVE' ? '' : statusInput],
        ['dealCloseFrom', closeFromInput],
        ['dealCloseTo', closeToInput],
        ['dealSort', sortInput === 'expectedCloseDate' ? '' : sortInput],
        ['dealDirection', directionInput === 'asc' ? '' : directionInput]
      ];
      for (const [key, value] of values) value ? next.set(key, value) : next.delete(key);
      next.delete('dealPage');
    });
  }

  function resetFilters() {
    setSearchInput('');
    setPipelineInput('');
    setStageInput('');
    setOutcomeInput('');
    setCurrencyInput('');
    setStatusInput('ACTIVE');
    setCloseFromInput('');
    setCloseToInput('');
    setSortInput('expectedCloseDate');
    setDirectionInput('asc');
    replaceQuery((next) => {
      ['dealQ', 'dealPipeline', 'dealStage', 'dealOutcome', 'dealCurrency', 'dealStatus', 'dealCloseFrom', 'dealCloseTo', 'dealSort', 'dealDirection', 'dealPage'].forEach((key) => next.delete(key));
    });
  }

  function pageChanged(nextPage: number) {
    replaceQuery((next) => {
      nextPage > 1 ? next.set('dealPage', String(nextPage)) : next.delete('dealPage');
    });
  }

  function openCreate() {
    const pipeline = pipelines.find((item) => item.isDefault) ?? pipelines[0];
    const stage = activeStages(pipeline).find((item) => item.type === 'OPEN') ?? activeStages(pipeline)[0];
    setCreateForm({
      ...emptyDealForm,
      accountId: accounts[0]?.id ?? '',
      pipelineId: pipeline?.id ?? '',
      stageId: stage?.id ?? '',
      probability: stage ? String(stage.defaultProbability) : ''
    });
    setCreateError('');
    setCreateOpen(true);
  }

  function createPipelineChanged(pipelineId: string) {
    const pipeline = pipelines.find((item) => item.id === pipelineId);
    const stage = activeStages(pipeline).find((item) => item.type === 'OPEN') ?? activeStages(pipeline)[0];
    setCreateForm((current) => ({
      ...current,
      pipelineId,
      stageId: stage?.id ?? '',
      probability: stage ? String(stage.defaultProbability) : current.probability
    }));
  }

  function createStageChanged(stageId: string) {
    const stage = pipelines.flatMap((pipeline) => pipeline.stages).find((item) => item.id === stageId);
    setCreateForm((current) => ({ ...current, stageId, probability: stage ? String(stage.defaultProbability) : current.probability }));
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!token || !workspaceId) return;
    if (!createForm.accountId) {
      setCreateError(copy.accountRequired);
      return;
    }
    if (!createForm.pipelineId || !createForm.stageId) {
      setCreateError(copy.pipelineRequired);
      return;
    }
    setCreateBusy(true);
    setCreateError('');
    try {
      const response = await createCrmDeal(token, {
        workspaceId,
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        accountId: createForm.accountId,
        pipelineId: createForm.pipelineId,
        stageId: createForm.stageId,
        expectedValue: createForm.expectedValue ? Number(createForm.expectedValue) : null,
        currency: createForm.currency.trim().toUpperCase(),
        probability: createForm.probability ? Number(createForm.probability) : undefined,
        forecastCategory: 'PIPELINE',
        expectedCloseDate: createForm.expectedCloseDate ? `${createForm.expectedCloseDate}T12:00:00.000Z` : null,
        teamUserIds: []
      });
      setCreateOpen(false);
      setSuccess(copy.created);
      await loadDeals();
      const query = pendingParamsRef.current.toString();
      navigate(`/crm/deals/${response.deal.id}${query ? `?${query}` : ''}`, {
        state: { focusTarget: 'crm-deal-create' }
      });
    } catch (submitError) {
      setCreateError(errorMessage(submitError));
    } finally {
      setCreateBusy(false);
    }
  }

  function openDetail(id: string, trigger: HTMLButtonElement) {
    setSuccess('');
    detailTriggerRef.current = trigger;
    const query = pendingParamsRef.current.toString();
    navigate(`/crm/deals/${id}${query ? `?${query}` : ''}`);
  }

  function closeDetail() {
    setSelectedDeal(null);
    setDetailError('');
    const query = pendingParamsRef.current.toString();
    navigate(`/crm/deals${query ? `?${query}` : ''}`);
    window.requestAnimationFrame(() => detailTriggerRef.current?.focus());
  }

  function requestTransition(deal: CrmDeal, stageId: string, trigger: HTMLSelectElement) {
    const pipeline = pipelines.find((item) => item.id === deal.pipelineId);
    const targetStage = pipeline?.stages.find((stage) => stage.id === stageId);
    if (!targetStage || targetStage.id === deal.stageId) return;
    transitionTriggerRef.current = trigger;
    setTransitionError('');
    setPendingTransition({ deal, targetStage });
  }

  async function confirmTransition(values: CrmDealTransitionValues) {
    if (!token || !pendingTransition || transitionBusy) return;
    const { deal, targetStage } = pendingTransition;
    setTransitionBusy(true);
    setTransitionError('');
    try {
      const response = await transitionCrmDeal(token, deal.id, targetStage.id, values);
      setPendingTransition(null);
      setSuccess(language === 'ar' ? `تم نقل ${deal.name} إلى ${targetStage.name}.` : `${deal.name} moved to ${targetStage.name}.`);
      if (selectedDeal?.id === deal.id) setSelectedDeal(response.deal);
      await loadDeals();
    } catch (submitError) {
      setTransitionError(errorMessage(submitError));
    } finally {
      setTransitionBusy(false);
    }
  }

  function openArchive() {
    setArchiveReason('');
    setArchiveAcknowledged(false);
    setArchiveError('');
    setArchiveOpen(true);
  }

  async function submitArchive(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedDeal || !archiveAcknowledged || archiveBusy) return;
    setArchiveBusy(true);
    setArchiveError('');
    try {
      const archived = !selectedDeal.archivedAt;
      await archiveCrmDeal(token, selectedDeal.id, archived, archiveReason.trim());
      const detail = await getCrmDeal(token, selectedDeal.id);
      setSelectedDeal(detail.deal);
      setArchiveOpen(false);
      setSuccess(archived ? copy.dealArchived : copy.dealRestored);
      await loadDeals();
    } catch (submitError) {
      setArchiveError(errorMessage(submitError));
    } finally {
      setArchiveBusy(false);
    }
  }

  const selectedFilterPipeline = pipelines.find((pipeline) => pipeline.id === pipelineInput);
  const filterStages = pipelineInput
    ? activeStages(selectedFilterPipeline)
    : pipelines.flatMap((pipeline) => activeStages(pipeline));
  const selectedCreatePipeline = pipelines.find((pipeline) => pipeline.id === createForm.pipelineId);
  const pageCount = Math.max(1, Math.ceil(summary.total / PAGE_SIZE));

  return (
    <section className="crm-deals" aria-labelledby="crm-deals-title">
      <header className="crm-deals__hero">
        <div>
          <p className="eyebrow"><BriefcaseBusiness aria-hidden="true" size={17} /> {copy.eyebrow}</p>
          <h1 id="crm-deals-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="crm-deals__hero-actions">
          <button aria-label={copy.refresh} className="button-link button-link--ghost" onClick={() => void Promise.all([loadDeals(), loadReferenceData()])} type="button"><RefreshCw aria-hidden="true" size={16} /> {copy.refresh}</button>
          {canManage ? <button className="button-link button-link--primary" onClick={openCreate} ref={createTriggerRef} type="button"><Plus aria-hidden="true" size={16} /> {copy.create}</button> : null}
        </div>
      </header>

      <div className="crm-deals__workspace">
        <WorkspaceSelector choices={choices} label={copy.workspace} onChange={workspaceChanged} value={workspaceId} />
      </div>

      {!canManage ? <div className="crm-deals__readonly" role="note"><ShieldCheck aria-hidden="true" size={20} /><div><strong>{copy.readOnly}</strong><p>{copy.readOnlyBody}</p></div></div> : null}
      {success ? <p className="form-alert form-alert--success" role="status">{success}</p> : null}

      <div className="crm-deals__summary" aria-label={copy.title}>
        <article><BriefcaseBusiness aria-hidden="true" size={18} /><span>{copy.total}</span><strong>{summary.total}</strong></article>
        <article><TrendingUp aria-hidden="true" size={18} /><span>{copy.active}</span><strong>{summary.active}</strong></article>
        <article><Archive aria-hidden="true" size={18} /><span>{copy.archived}</span><strong>{summary.archived}</strong></article>
        <article><CalendarClock aria-hidden="true" size={18} /><span>{copy.open}</span><strong>{summary.open}</strong></article>
        <article><CircleDollarSign aria-hidden="true" size={18} /><span>{copy.won}</span><strong>{summary.won}</strong></article>
        <article><ArchiveRestore aria-hidden="true" size={18} /><span>{copy.lost}</span><strong>{summary.lost}</strong></article>
      </div>

      <form className="crm-deals__filters" onSubmit={applyFilters}>
        <label className="crm-deals__search"><span>{copy.search}</span><div><Search aria-hidden="true" size={16} /><input aria-label={copy.search} onChange={(event) => setSearchInput(event.target.value)} placeholder={copy.searchPlaceholder} value={searchInput} /></div></label>
        <label><span>{copy.pipeline}</span><select aria-label={copy.pipeline} onChange={(event) => { setPipelineInput(event.target.value); setStageInput(''); }} value={pipelineInput}><option value="">{copy.allPipelines}</option>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></label>
        <label><span>{copy.stage}</span><select aria-label={copy.stage} onChange={(event) => setStageInput(event.target.value)} value={stageInput}><option value="">{copy.allStages}</option>{filterStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
        <label><span>{copy.outcome}</span><select aria-label={copy.outcome} onChange={(event) => setOutcomeInput(event.target.value as CrmDealOutcome | '')} value={outcomeInput}><option value="">{copy.allOutcomes}</option>{outcomes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>{copy.currency}</span><input aria-label={copy.currency} maxLength={3} onChange={(event) => setCurrencyInput(event.target.value.toUpperCase())} pattern="[A-Za-z]{0,3}" value={currencyInput} /></label>
        <label><span>{copy.state}</span><select aria-label={copy.state} onChange={(event) => setStatusInput(event.target.value as CrmDealStatus)} value={statusInput}><option value="ACTIVE">{copy.activeState}</option><option value="ARCHIVED">{copy.archivedState}</option><option value="ALL">{copy.allStates}</option></select></label>
        <label><span>{copy.closeFrom}</span><input aria-label={copy.closeFrom} onChange={(event) => setCloseFromInput(event.target.value)} type="date" value={closeFromInput} /></label>
        <label><span>{copy.closeTo}</span><input aria-label={copy.closeTo} onChange={(event) => setCloseToInput(event.target.value)} type="date" value={closeToInput} /></label>
        <label><span>{copy.sort}</span><select aria-label={copy.sort} onChange={(event) => setSortInput(event.target.value as CrmDealSortBy)} value={sortInput}><option value="expectedCloseDate">{copy.expectedCloseSort}</option><option value="name">{copy.nameSort}</option><option value="expectedValue">{copy.expectedValueSort}</option><option value="updatedAt">{copy.updatedAt}</option><option value="createdAt">{copy.createdAt}</option></select></label>
        <label><span>{copy.direction}</span><select aria-label={copy.direction} onChange={(event) => setDirectionInput(event.target.value as CrmDealDirection)} value={directionInput}><option value="asc">{copy.ascending}</option><option value="desc">{copy.descending}</option></select></label>
        <div className="crm-deals__filter-actions"><button className="button-link button-link--primary" type="submit">{copy.apply}</button><button onClick={resetFilters} type="button">{copy.reset}</button></div>
      </form>

      <section className="crm-deals__results" aria-label={copy.title}>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {loading && deals.length === 0 ? <p>{copy.loading}</p> : null}
        {!loading && !error && deals.length === 0 ? <div className="crm-deals__empty"><BriefcaseBusiness aria-hidden="true" size={26} /><h2>{copy.emptyTitle}</h2><p>{copy.emptyBody}</p></div> : null}
        {deals.length ? (
          <div className="crm-deals__table-wrap">
            <table>
              <thead><tr><th scope="col">{copy.name}</th><th scope="col">{copy.account}</th><th scope="col">{copy.pipelineStage}</th><th scope="col">{copy.value}</th><th scope="col">{copy.result}</th><th scope="col">{copy.expectedClose}</th><th scope="col">{copy.actions}</th></tr></thead>
              <tbody>{deals.map((deal) => {
                const pipeline = pipelines.find((item) => item.id === deal.pipelineId);
                return <tr key={deal.id}>
                  <th scope="row"><strong>{deal.name}</strong><span>{deal.description || (deal.archivedAt ? copy.archivedState : copy.activeState)}</span></th>
                  <td><strong>{deal.account.name}</strong><span>{deal.primaryContact?.fullName || copy.noContact}</span></td>
                  <td><strong>{deal.pipeline.name}</strong>{canManage && !deal.archivedAt ? <select aria-label={`Move ${deal.name}`} onChange={(event) => requestTransition(deal, event.target.value, event.currentTarget)} value={deal.stageId}>{activeStages(pipeline).map((stage) => <option disabled={deal.outcome !== 'OPEN' && stage.type !== 'OPEN' && stage.id !== deal.stageId} key={stage.id} value={stage.id}>{stage.name}</option>)}</select> : <span>{deal.stage.name}</span>}</td>
                  <td><strong>{money(deal.expectedValue, deal.currency, locale)}</strong><span>{deal.probability}%</span></td>
                  <td><span className={`crm-deals__outcome crm-deals__outcome--${deal.outcome.toLowerCase()}`}>{deal.outcome}</span></td>
                  <td>{formatDate(deal.expectedCloseDate, locale)}</td>
                  <td><button className="button-link button-link--ghost" onClick={(event) => openDetail(deal.id, event.currentTarget)} type="button"><Eye aria-hidden="true" size={15} /> {copy.review}</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : null}
        <footer className="crm-deals__pagination"><button disabled={page <= 1} onClick={() => pageChanged(page - 1)} type="button"><ChevronLeft aria-hidden="true" size={16} /> {copy.previous}</button><span>{copy.page} {page} {copy.of} {pageCount}</span><button disabled={page >= pageCount} onClick={() => pageChanged(page + 1)} type="button">{copy.next} <ChevronRight aria-hidden="true" size={16} /></button></footer>
      </section>

      {dealId ? <section className="crm-deals__detail" aria-labelledby="crm-deal-detail-title">
        <header><div><p className="eyebrow"><Eye aria-hidden="true" size={15} /> {copy.details}</p><h2 id="crm-deal-detail-title">{selectedDeal?.name || copy.details}</h2></div><button className="button-link button-link--ghost" onClick={closeDetail} type="button">{copy.back}</button></header>
        {detailLoading ? <p>{copy.loading}</p> : null}
        {detailError ? <p className="form-error" role="alert">{detailError}</p> : null}
        {selectedDeal ? <>
          <div className="crm-deals__detail-grid">
            <article><span>{copy.account}</span><strong>{selectedDeal.account.name}</strong></article>
            <article><span>{copy.pipelineStage}</span><strong>{selectedDeal.pipeline.name} · {selectedDeal.stage.name}</strong></article>
            <article><span>{copy.value}</span><strong>{money(selectedDeal.expectedValue, selectedDeal.currency, locale)} · {selectedDeal.probability}%</strong></article>
            <article><span>{copy.result}</span><strong>{selectedDeal.outcome}</strong></article>
            <article><span>{copy.primaryContact}</span><strong>{selectedDeal.primaryContact?.fullName || copy.noContact}</strong></article>
            <article><span>{copy.owner}</span><strong>{selectedDeal.ownerUser?.name || copy.noOwner}</strong></article>
            <article><span>{copy.sourceLead}</span><strong>{selectedDeal.sourceLead?.title || copy.noSourceLead}</strong></article>
            <article><span>{copy.expectedClose}</span><strong>{formatDate(selectedDeal.expectedCloseDate, locale)}</strong></article>
          </div>
          {selectedDeal.description ? <p className="crm-deals__description">{selectedDeal.description}</p> : null}
          <section className="crm-deals__history" aria-labelledby="crm-deal-history-title"><h3 id="crm-deal-history-title">{copy.stageHistory}</h3>{selectedDeal.stageHistory?.length ? selectedDeal.stageHistory.map((history) => <article key={history.id}><div><strong>{history.fromStage?.name || copy.createdAt} → {history.toStage.name}</strong>{history.reopened ? <span>{copy.reopened}</span> : null}</div><p>{history.reason || '—'}</p><small>{formatDate(history.changedAt, locale, true)} · {history.changedBy?.name || copy.unknown}</small></article>) : <p>{copy.noHistory}</p>}</section>
          {canManage ? <div className="crm-deals__detail-actions"><button className="button-link button-link--secondary" onClick={openArchive} ref={archiveTriggerRef} type="button">{selectedDeal.archivedAt ? <ArchiveRestore aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />} {selectedDeal.archivedAt ? copy.restore : copy.archive}</button></div> : null}
        </> : null}
      </section> : null}

      <AccessibleDialog closeLabel={copy.closeCreate} description={copy.createDescription} initialFocusRef={createNameRef} onClose={() => setCreateOpen(false)} open={createOpen} returnFocusRef={createTriggerRef} title={copy.createTitle}>
        <form aria-busy={createBusy} className="crm-deals__dialog-form" onSubmit={submitCreate}>
          {createError ? <p className="form-error" role="alert">{createError}</p> : null}
          <label><span>{copy.name}</span><input onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} ref={createNameRef} required value={createForm.name} /></label>
          <label><span>{copy.descriptionField}</span><textarea onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} rows={3} value={createForm.description} /></label>
          <label><span>{copy.account}</span><select aria-label={copy.account} onChange={(event) => setCreateForm((current) => ({ ...current, accountId: event.target.value }))} required value={createForm.accountId}><option value="">—</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label><span>{copy.pipeline}</span><select aria-label={copy.pipeline} onChange={(event) => createPipelineChanged(event.target.value)} required value={createForm.pipelineId}><option value="">—</option>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></label>
          <label><span>{copy.stage}</span><select aria-label={copy.stage} onChange={(event) => createStageChanged(event.target.value)} required value={createForm.stageId}><option value="">—</option>{activeStages(selectedCreatePipeline).map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
          <label><span>{copy.expectedValue}</span><input min="0" onChange={(event) => setCreateForm((current) => ({ ...current, expectedValue: event.target.value }))} step="0.001" type="number" value={createForm.expectedValue} /></label>
          <label><span>{copy.currency}</span><input maxLength={3} onChange={(event) => setCreateForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} pattern="[A-Za-z]{3}" required value={createForm.currency} /></label>
          <label><span>{copy.probability}</span><input max="100" min="0" onChange={(event) => setCreateForm((current) => ({ ...current, probability: event.target.value }))} type="number" value={createForm.probability} /></label>
          <label><span>{copy.expectedCloseDate}</span><input onChange={(event) => setCreateForm((current) => ({ ...current, expectedCloseDate: event.target.value }))} type="date" value={createForm.expectedCloseDate} /></label>
          <div className="crm-deals__dialog-actions"><button className="button-link button-link--primary" disabled={createBusy} type="submit">{createBusy ? copy.saving : copy.saveDeal}</button></div>
        </form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.closeArchive} description={copy.archiveDescription} initialFocusRef={archiveReasonRef} onClose={() => setArchiveOpen(false)} open={archiveOpen} returnFocusRef={archiveTriggerRef} title={copy.archiveTitle}>
        <form aria-busy={archiveBusy} className="crm-deals__dialog-form" onSubmit={submitArchive}>
          {archiveError ? <p className="form-error" role="alert">{archiveError}</p> : null}
          <label><span>{copy.reason}</span><textarea minLength={3} onChange={(event) => setArchiveReason(event.target.value)} ref={archiveReasonRef} required rows={4} value={archiveReason} /></label>
          <label className="crm-deals__acknowledgement"><input checked={archiveAcknowledged} onChange={(event) => setArchiveAcknowledged(event.target.checked)} type="checkbox" /><span>{copy.acknowledge}</span></label>
          <div className="crm-deals__dialog-actions"><button className="button-link button-link--primary" disabled={archiveBusy || !archiveAcknowledged || archiveReason.trim().length < 3} type="submit">{selectedDeal?.archivedAt ? copy.confirmRestore : copy.confirmArchive}</button></div>
        </form>
      </AccessibleDialog>

      <CrmDealStageTransitionDialog
        busy={transitionBusy}
        deal={pendingTransition?.deal ?? null}
        error={transitionError}
        language={language}
        onClose={() => { setPendingTransition(null); setTransitionError(''); }}
        onConfirm={confirmTransition}
        open={Boolean(pendingTransition)}
        returnFocusRef={transitionTriggerRef}
        targetStage={pendingTransition?.targetStage ?? null}
      />
    </section>
  );
}

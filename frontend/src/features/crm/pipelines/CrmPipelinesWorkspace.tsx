import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import type { CrmWorkspaceAccess } from '../../../api/crm';
import {
  archiveCrmPipeline,
  createCrmPipeline,
  getCrmPipeline,
  listCrmPipelineRegister,
  updateCrmPipeline,
  updateCrmPipelineStage,
  type CrmPipeline,
  type CrmPipelineDirection,
  type CrmPipelineSortBy,
  type CrmPipelineStage,
  type CrmPipelineStatus
} from '../../../api/crmAdvanced';
import { useAuth } from '../../../auth/AuthContext';
import AccessibleDialog from '../../../components/AccessibleDialog';
import type { CrmPipelineStageType } from '../../../generated/crmContract';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useLanguage } from '../../../i18n/LanguageContext';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../WorkspaceSelector';

const PAGE_SIZE = 20;
const requiredFieldOptions = ['accountId', 'primaryContactId', 'ownerUserId', 'expectedValue', 'currency', 'expectedCloseDate', 'pmsPropertyId'] as const;

type PipelineWorkspaceChoice = CrmWorkspaceChoice & { scope: 'personal' | 'company' | 'admin' };
type PipelineForm = { name: string; description: string; isDefault: boolean };
type StageForm = {
  name: string;
  position: string;
  type: CrmPipelineStageType;
  defaultProbability: string;
  slaHours: string;
  active: boolean;
  requiredFields: string[];
};

const emptyPipelineForm: PipelineForm = { name: '', description: '', isDefault: false };

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'CRM pipeline operation failed.';
}

function workspaceChoices(access: CrmWorkspaceAccess | null | undefined, language: 'en' | 'ar'): PipelineWorkspaceChoice[] {
  if (!access) return [];
  const choices: PipelineWorkspaceChoice[] = [];
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

function safeStatus(value: string | null): CrmPipelineStatus {
  return value === 'ARCHIVED' || value === 'ALL' ? value : 'ACTIVE';
}

function safeSort(value: string | null): CrmPipelineSortBy {
  return value === 'updatedAt' || value === 'createdAt' ? value : 'name';
}

function safeDirection(value: string | null): CrmPipelineDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function stageForm(stage: CrmPipelineStage): StageForm {
  return {
    name: stage.name,
    position: String(stage.position),
    type: stage.type,
    defaultProbability: String(stage.defaultProbability),
    slaHours: stage.slaHours == null ? '' : String(stage.slaHours),
    active: stage.active,
    requiredFields: [...(stage.requiredFields ?? [])]
  };
}

function defaultStages() {
  return [
    { key: 'DISCOVERY', name: 'Discovery', position: 10, type: 'OPEN', defaultProbability: 10, requiredFields: [], slaHours: 72 },
    { key: 'QUALIFIED', name: 'Qualified', position: 20, type: 'OPEN', defaultProbability: 40, requiredFields: ['accountId'], slaHours: 72 },
    { key: 'PROPOSAL', name: 'Proposal', position: 30, type: 'OPEN', defaultProbability: 70, requiredFields: ['accountId', 'expectedValue', 'currency'], slaHours: 120 },
    { key: 'WON', name: 'Won', position: 40, type: 'WON', defaultProbability: 100, requiredFields: ['accountId', 'expectedValue', 'currency'], slaHours: null },
    { key: 'LOST', name: 'Lost', position: 50, type: 'LOST', defaultProbability: 0, requiredFields: [], slaHours: null }
  ];
}

export default function CrmPipelinesWorkspace() {
  const { token, crmAccess } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-OM' : 'en-OM';
  const navigate = useNavigate();
  const { pipelineId } = useParams<{ pipelineId?: string }>();
  const [params, setParams] = useSearchParams();
  const pendingParamsRef = useRef(new URLSearchParams(params));
  const choices = useMemo(() => workspaceChoices(crmAccess, language), [crmAccess, language]);
  const requestedWorkspaceId = params.get('workspaceId');
  const [workspaceId, setWorkspaceId] = useState('');
  const activeChoice = choices.find((choice) => choice.workspaceId === workspaceId);
  const canConfigure = Boolean(crmAccess?.isAdmin || (activeChoice?.canManage && activeChoice?.canManageWorkspace));

  const page = Math.max(1, Number(params.get('pipelinePage')) || 1);
  const search = params.get('pipelineQ')?.trim() ?? '';
  const status = safeStatus(params.get('pipelineStatus'));
  const sortBy = safeSort(params.get('pipelineSort'));
  const direction = safeDirection(params.get('pipelineDirection'));

  const [searchInput, setSearchInput] = useState(search);
  const [statusInput, setStatusInput] = useState<CrmPipelineStatus>(status);
  const [sortInput, setSortInput] = useState<CrmPipelineSortBy>(sortBy);
  const [directionInput, setDirectionInput] = useState<CrmPipelineDirection>(direction);
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, archived: 0, defaults: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedPipeline, setSelectedPipeline] = useState<CrmPipeline | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PipelineForm>(emptyPipelineForm);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<PipelineForm>(emptyPipelineForm);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  const [selectedStage, setSelectedStage] = useState<CrmPipelineStage | null>(null);
  const [stageFormState, setStageFormState] = useState<StageForm | null>(null);
  const [stageBusy, setStageBusy] = useState(false);
  const [stageError, setStageError] = useState('');

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveAcknowledged, setArchiveAcknowledged] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const createNameRef = useRef<HTMLInputElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);
  const stageNameRef = useRef<HTMLInputElement>(null);
  const archiveReasonRef = useRef<HTMLTextAreaElement>(null);

  useDocumentTitle(language === 'ar' ? 'مسارات CRM | lux.om' : 'CRM pipelines | lux.om');

  const copy = language === 'ar'
    ? {
        eyebrow: 'إعدادات مساحة العمل', title: 'مركز مسارات CRM', description: 'أدر مسارات المبيعات ومراحلها مع الحفاظ على النتائج التاريخية وصلاحيات التهيئة.',
        workspace: 'مساحة العمل', refresh: 'تحديث المسارات', create: 'إنشاء مسار', readOnly: 'عرض فقط', readOnlyBody: 'يمكنك مراجعة المسارات، لكن إدارة إعدادات مساحة العمل غير متاحة لصلاحيتك الحالية.',
        total: 'إجمالي النتائج', active: 'نشطة', archived: 'مؤرشفة', defaults: 'افتراضية', search: 'البحث في المسارات', searchPlaceholder: 'اسم المسار أو المرحلة', state: 'الحالة', sort: 'الترتيب', direction: 'الاتجاه', apply: 'تطبيق عوامل التصفية', reset: 'إعادة الضبط',
        name: 'المسار', stages: 'المراحل', leads: 'العملاء المحتملون', deals: 'الصفقات', updated: 'آخر تحديث', actions: 'الإجراءات', review: 'مراجعة المسار', default: 'افتراضي', loading: 'جارٍ تحميل مسارات CRM…', emptyTitle: 'لا توجد مسارات مطابقة', emptyBody: 'عدّل عوامل التصفية أو أنشئ مساراً محكوماً.',
        previous: 'السابق', next: 'التالي', page: 'صفحة', of: 'من', ascending: 'تصاعدي', descending: 'تنازلي', nameSort: 'الاسم', createdAt: 'وقت الإنشاء', updatedAt: 'آخر تحديث', activeState: 'نشطة فقط', archivedState: 'مؤرشفة فقط', allStates: 'كل الحالات',
        createTitle: 'إنشاء مسار CRM محكوم', createDescription: 'يُنشأ المسار بخمس مراحل قابلة للتهيئة مع مراحل مفتوحة وفوز وخسارة.', closeCreate: 'إغلاق إنشاء المسار', descriptionLabel: 'الوصف', makeDefault: 'اجعله المسار الافتراضي', savePipeline: 'حفظ المسار', saving: 'جارٍ الحفظ…', created: 'تم إنشاء مسار CRM.',
        details: 'تفاصيل المسار', closeDetails: 'إغلاق تفاصيل المسار', edit: 'تعديل بيانات المسار', editTitle: 'تعديل بيانات المسار', editDescription: 'يظل تغيير المسار الافتراضي محكوماً على مستوى مساحة العمل.', closeEdit: 'إغلاق تعديل المسار', saveChanges: 'حفظ التغييرات', updatedMessage: 'تم تحديث مسار CRM.',
        stage: 'المرحلة', type: 'التصنيف', probability: 'الاحتمال', sla: 'ساعات SLA', required: 'الحقول المطلوبة', position: 'الترتيب', usage: 'الاستخدام', editStage: 'تعديل المرحلة', stageTitle: 'تعديل مرحلة المسار', stageDescription: 'لا يمكن تعطيل أو إعادة تصنيف مرحلة مستخدمة إذا كان ذلك يغيّر التاريخ.', closeStage: 'إغلاق تعديل المرحلة', activeStage: 'المرحلة نشطة', saveStage: 'حفظ المرحلة', stageUpdated: 'تم تحديث مرحلة المسار.', noRequired: 'لا توجد حقول مطلوبة',
        archive: 'أرشفة المسار', restore: 'استعادة المسار', archiveTitle: 'مراجعة تغيير حالة المسار', archiveDescription: 'يتطلب التغيير سبباً واضحاً ويُسجّل كدليل حوكمة. لا يمكن أرشفة المسار الافتراضي.', closeArchive: 'إغلاق مراجعة الحالة', reason: 'سبب التغيير', acknowledge: 'أفهم أن المسار المؤرشف لا يمكن استخدامه لصفقات أو تحويلات جديدة.', confirmArchive: 'تأكيد الأرشفة', confirmRestore: 'تأكيد الاستعادة', archivedMessage: 'تمت أرشفة المسار.', restoredMessage: 'تمت استعادة المسار.',
        lifecycle: 'سجل الحالة', noLifecycle: 'لا توجد تغييرات حالة مسجلة.', statusActive: 'نشط', statusArchived: 'مؤرشف'
      }
    : {
        eyebrow: 'Workspace configuration', title: 'CRM pipeline center', description: 'Manage sales pipelines and stages while preserving historical outcomes and configuration permissions.',
        workspace: 'Workspace', refresh: 'Refresh pipelines', create: 'Create pipeline', readOnly: 'Read only', readOnlyBody: 'You can review pipelines, but your current access cannot manage workspace configuration.',
        total: 'Total results', active: 'Active', archived: 'Archived', defaults: 'Default', search: 'Search pipelines', searchPlaceholder: 'Pipeline or stage name', state: 'State', sort: 'Sort by', direction: 'Direction', apply: 'Apply filters', reset: 'Reset filters',
        name: 'Pipeline', stages: 'Stages', leads: 'Leads', deals: 'Deals', updated: 'Updated', actions: 'Actions', review: 'Review pipeline', default: 'Default', loading: 'Loading CRM pipelines…', emptyTitle: 'No matching pipelines', emptyBody: 'Adjust the filters or create a governed pipeline.',
        previous: 'Previous', next: 'Next', page: 'Page', of: 'of', ascending: 'Ascending', descending: 'Descending', nameSort: 'Name', createdAt: 'Created time', updatedAt: 'Updated time', activeState: 'Active only', archivedState: 'Archived only', allStates: 'All states',
        createTitle: 'Create governed CRM pipeline', createDescription: 'The pipeline starts with five configurable open, won, and lost stages.', closeCreate: 'Close pipeline creation', descriptionLabel: 'Description', makeDefault: 'Make this the default pipeline', savePipeline: 'Save pipeline', saving: 'Saving…', created: 'The CRM pipeline was created.',
        details: 'Pipeline details', closeDetails: 'Close pipeline details', edit: 'Edit pipeline metadata', editTitle: 'Edit pipeline metadata', editDescription: 'Changing the default pipeline remains governed at workspace level.', closeEdit: 'Close pipeline editing', saveChanges: 'Save changes', updatedMessage: 'The CRM pipeline was updated.',
        stage: 'Stage', type: 'Classification', probability: 'Probability', sla: 'SLA hours', required: 'Required fields', position: 'Position', usage: 'Usage', editStage: 'Edit stage', stageTitle: 'Edit pipeline stage', stageDescription: 'A used stage cannot be disabled or reclassified when that would rewrite history.', closeStage: 'Close stage editing', activeStage: 'Stage is active', saveStage: 'Save stage', stageUpdated: 'The pipeline stage was updated.', noRequired: 'No required fields',
        archive: 'Archive pipeline', restore: 'Restore pipeline', archiveTitle: 'Review pipeline state change', archiveDescription: 'A clear reason is required and recorded as governance evidence. The default pipeline cannot be archived.', closeArchive: 'Close state review', reason: 'Change reason', acknowledge: 'I understand an archived pipeline cannot be used for new deals or conversions.', confirmArchive: 'Confirm archive', confirmRestore: 'Confirm restore', archivedMessage: 'The pipeline was archived.', restoredMessage: 'The pipeline was restored.',
        lifecycle: 'Lifecycle evidence', noLifecycle: 'No lifecycle changes are recorded.', statusActive: 'Active', statusArchived: 'Archived'
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
        next.delete('pipelinePage');
      });
    }
  }, [choices, requestedWorkspaceId, workspaceId]);

  useEffect(() => {
    setSearchInput(search);
    setStatusInput(status);
    setSortInput(sortBy);
    setDirectionInput(direction);
  }, [search, status, sortBy, direction]);

  async function loadPipelines() {
    if (!token || !workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const response = await listCrmPipelineRegister(token, {
        workspaceId,
        search: search || undefined,
        status,
        sortBy,
        direction,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE
      });
      setPipelines(response.pipelines);
      setSummary(response.summary ?? {
        total: response.pagination?.total ?? response.pipelines.length,
        active: response.pipelines.filter((pipeline) => pipeline.active && !pipeline.archivedAt).length,
        archived: response.pipelines.filter((pipeline) => !pipeline.active || Boolean(pipeline.archivedAt)).length,
        defaults: response.pipelines.filter((pipeline) => pipeline.isDefault).length
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPipelines(); }, [token, workspaceId, search, status, sortBy, direction, page]);

  useEffect(() => {
    if (!token || !pipelineId) {
      setSelectedPipeline(null);
      setDetailError('');
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    void getCrmPipeline(token, pipelineId)
      .then((response) => { if (active) setSelectedPipeline(response.pipeline); })
      .catch((detailLoadError) => { if (active) setDetailError(errorMessage(detailLoadError)); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [pipelineId, token]);

  function workspaceChanged(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId);
    setSelectedPipeline(null);
    replaceQuery((next) => {
      next.set('workspaceId', nextWorkspaceId);
      next.delete('pipelinePage');
    });
    navigate({ pathname: '/crm/settings/pipelines', search: `?${pendingParamsRef.current.toString()}` }, { replace: true });
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    replaceQuery((next) => {
      const values: Array<[string, string]> = [
        ['pipelineQ', searchInput.trim()],
        ['pipelineStatus', statusInput === 'ACTIVE' ? '' : statusInput],
        ['pipelineSort', sortInput === 'name' ? '' : sortInput],
        ['pipelineDirection', directionInput === 'asc' ? '' : directionInput]
      ];
      for (const [key, value] of values) value ? next.set(key, value) : next.delete(key);
      next.delete('pipelinePage');
    });
  }

  function resetFilters() {
    setSearchInput('');
    setStatusInput('ACTIVE');
    setSortInput('name');
    setDirectionInput('asc');
    replaceQuery((next) => {
      ['pipelineQ', 'pipelineStatus', 'pipelineSort', 'pipelineDirection', 'pipelinePage'].forEach((key) => next.delete(key));
    });
  }

  function pageChanged(nextPage: number) {
    replaceQuery((next) => {
      nextPage > 1 ? next.set('pipelinePage', String(nextPage)) : next.delete('pipelinePage');
    });
  }

  function openDetail(id: string, trigger: HTMLButtonElement) {
    detailTriggerRef.current = trigger;
    const query = pendingParamsRef.current.toString();
    navigate(`/crm/settings/pipelines/${id}${query ? `?${query}` : ''}`);
  }

  function closeDetail() {
    setSelectedPipeline(null);
    setDetailError('');
    const query = pendingParamsRef.current.toString();
    navigate(`/crm/settings/pipelines${query ? `?${query}` : ''}`);
  }

  async function refreshDetail() {
    if (!token || !pipelineId) return;
    const response = await getCrmPipeline(token, pipelineId);
    setSelectedPipeline(response.pipeline);
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!token || !workspaceId) return;
    setCreateBusy(true);
    setCreateError('');
    try {
      await createCrmPipeline(token, {
        workspaceId,
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        isDefault: createForm.isDefault,
        stages: defaultStages()
      });
      setCreateOpen(false);
      setCreateForm(emptyPipelineForm);
      setSuccess(copy.created);
      await loadPipelines();
    } catch (submitError) {
      setCreateError(errorMessage(submitError));
    } finally {
      setCreateBusy(false);
    }
  }

  function openEdit() {
    if (!selectedPipeline) return;
    setEditForm({ name: selectedPipeline.name, description: selectedPipeline.description ?? '', isDefault: selectedPipeline.isDefault });
    setEditError('');
    setEditOpen(true);
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedPipeline) return;
    setEditBusy(true);
    setEditError('');
    try {
      await updateCrmPipeline(token, selectedPipeline.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        ...(editForm.isDefault !== selectedPipeline.isDefault ? { isDefault: editForm.isDefault } : {})
      });
      setEditOpen(false);
      setSuccess(copy.updatedMessage);
      await Promise.all([refreshDetail(), loadPipelines()]);
    } catch (submitError) {
      setEditError(errorMessage(submitError));
    } finally {
      setEditBusy(false);
    }
  }

  function openStage(stage: CrmPipelineStage, trigger: HTMLButtonElement) {
    detailTriggerRef.current = trigger;
    setSelectedStage(stage);
    setStageFormState(stageForm(stage));
    setStageError('');
  }

  async function submitStage(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedStage || !stageFormState) return;
    setStageBusy(true);
    setStageError('');
    try {
      await updateCrmPipelineStage(token, selectedStage.id, {
        name: stageFormState.name.trim(),
        position: Number(stageFormState.position),
        type: stageFormState.type,
        defaultProbability: Number(stageFormState.defaultProbability),
        slaHours: stageFormState.slaHours ? Number(stageFormState.slaHours) : null,
        active: stageFormState.active,
        requiredFields: stageFormState.requiredFields
      });
      setSelectedStage(null);
      setStageFormState(null);
      setSuccess(copy.stageUpdated);
      await Promise.all([refreshDetail(), loadPipelines()]);
    } catch (submitError) {
      setStageError(errorMessage(submitError));
    } finally {
      setStageBusy(false);
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
    if (!token || !selectedPipeline) return;
    const archived = selectedPipeline.active && !selectedPipeline.archivedAt;
    setArchiveBusy(true);
    setArchiveError('');
    try {
      await archiveCrmPipeline(token, selectedPipeline.id, archived, archiveReason.trim());
      setArchiveOpen(false);
      setSuccess(archived ? copy.archivedMessage : copy.restoredMessage);
      await Promise.all([refreshDetail(), loadPipelines()]);
    } catch (submitError) {
      setArchiveError(errorMessage(submitError));
    } finally {
      setArchiveBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(summary.total / PAGE_SIZE));
  const selectedArchived = Boolean(selectedPipeline && (!selectedPipeline.active || selectedPipeline.archivedAt));

  return (
    <section className="crm-pipelines" aria-labelledby="crm-pipelines-title">
      <header className="crm-pipelines__header">
        <div><p className="eyebrow"><SlidersHorizontal aria-hidden="true" size={16} /> {copy.eyebrow}</p><h1 id="crm-pipelines-title">{copy.title}</h1><p>{copy.description}</p></div>
        <div className="crm-pipelines__header-actions">
          <button aria-label={copy.refresh} className="button-link button-link--secondary" disabled={loading} onClick={() => void loadPipelines()} type="button"><RefreshCw aria-hidden="true" className={loading ? 'spin' : ''} size={16} />{copy.refresh}</button>
          {canConfigure ? <button className="button-link button-link--primary" onClick={() => { setCreateForm(emptyPipelineForm); setCreateError(''); setCreateOpen(true); }} ref={createTriggerRef} type="button"><Plus aria-hidden="true" size={16} />{copy.create}</button> : null}
        </div>
      </header>

      <WorkspaceSelector choices={choices} label={copy.workspace} onChange={workspaceChanged} value={workspaceId} />

      {!canConfigure ? <div className="crm-pipelines__notice"><ShieldCheck aria-hidden="true" /><div><strong>{copy.readOnly}</strong><p>{copy.readOnlyBody}</p></div></div> : null}

      <div className="crm-pipelines__metrics" aria-label={copy.total}>
        <article><span>{copy.total}</span><strong>{summary.total.toLocaleString(locale)}</strong></article>
        <article><span>{copy.active}</span><strong>{summary.active.toLocaleString(locale)}</strong></article>
        <article><span>{copy.archived}</span><strong>{summary.archived.toLocaleString(locale)}</strong></article>
        <article><span>{copy.defaults}</span><strong>{summary.defaults.toLocaleString(locale)}</strong></article>
      </div>

      <form className="crm-pipelines__filters" onSubmit={applyFilters}>
        <label><span>{copy.search}</span><div className="crm-pipelines__search"><Search aria-hidden="true" size={16} /><input placeholder={copy.searchPlaceholder} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div></label>
        <label><span>{copy.state}</span><select value={statusInput} onChange={(event) => setStatusInput(event.target.value as CrmPipelineStatus)}><option value="ACTIVE">{copy.activeState}</option><option value="ARCHIVED">{copy.archivedState}</option><option value="ALL">{copy.allStates}</option></select></label>
        <label><span>{copy.sort}</span><select value={sortInput} onChange={(event) => setSortInput(event.target.value as CrmPipelineSortBy)}><option value="name">{copy.nameSort}</option><option value="updatedAt">{copy.updatedAt}</option><option value="createdAt">{copy.createdAt}</option></select></label>
        <label><span>{copy.direction}</span><select value={directionInput} onChange={(event) => setDirectionInput(event.target.value as CrmPipelineDirection)}><option value="asc">{copy.ascending}</option><option value="desc">{copy.descending}</option></select></label>
        <div className="crm-pipelines__filter-actions"><button type="submit">{copy.apply}</button><button type="button" onClick={resetFilters}>{copy.reset}</button></div>
      </form>

      {error ? <div className="crm-pipelines__state crm-pipelines__state--error" role="alert"><AlertCircle aria-hidden="true" />{error}</div> : null}
      {success && !pipelineId ? <div className="crm-pipelines__state crm-pipelines__state--success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div> : null}

      {loading && pipelines.length === 0 ? <div className="crm-pipelines__state"><RefreshCw aria-hidden="true" className="spin" />{copy.loading}</div> : pipelines.length === 0 ? (
        <div className="crm-pipelines__empty"><Layers3 aria-hidden="true" /><h2>{copy.emptyTitle}</h2><p>{copy.emptyBody}</p></div>
      ) : (
        <div className="crm-pipelines__table-wrap">
          <table className="crm-pipelines__table">
            <thead><tr><th scope="col">{copy.name}</th><th scope="col">{copy.stages}</th><th scope="col">{copy.leads}</th><th scope="col">{copy.deals}</th><th scope="col">{copy.updated}</th><th scope="col">{copy.actions}</th></tr></thead>
            <tbody>{pipelines.map((pipeline) => (
              <tr key={pipeline.id}>
                <th scope="row"><strong>{pipeline.name}</strong><span>{pipeline.isDefault ? copy.default : (!pipeline.active || pipeline.archivedAt) ? copy.statusArchived : copy.statusActive}</span></th>
                <td>{pipeline.stages.length}</td><td>{pipeline._count.leads}</td><td>{pipeline._count.deals}</td><td>{formatDate(pipeline.updatedAt, locale)}</td>
                <td><button type="button" onClick={(event) => openDetail(pipeline.id, event.currentTarget)}><Eye aria-hidden="true" size={15} />{copy.review}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <nav aria-label={`${copy.page} ${page}`} className="crm-pipelines__pagination">
        <button className="button-link button-link--secondary" disabled={page <= 1 || loading} onClick={() => pageChanged(page - 1)} type="button"><ChevronLeft aria-hidden="true" size={16} />{copy.previous}</button>
        <span>{copy.page} <strong>{page.toLocaleString(locale)}</strong> {copy.of} {totalPages.toLocaleString(locale)}</span>
        <button className="button-link button-link--secondary" disabled={page >= totalPages || loading} onClick={() => pageChanged(page + 1)} type="button">{copy.next}<ChevronRight aria-hidden="true" size={16} /></button>
      </nav>

      <AccessibleDialog closeLabel={copy.closeDetails} description={copy.description} onClose={closeDetail} open={Boolean(pipelineId)} returnFocusRef={detailTriggerRef} size="large" title={selectedPipeline ? `${copy.details} · ${selectedPipeline.name}` : copy.details}>
        {detailLoading ? <div className="crm-pipelines__state">{copy.loading}</div> : detailError ? <div className="form-error" role="alert">{detailError}</div> : selectedPipeline ? (
          <div className="crm-pipelines__detail">
            {success ? <div className="crm-pipelines__state crm-pipelines__state--success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div> : null}
            <div className="crm-pipelines__detail-summary"><div><strong>{selectedPipeline.isDefault ? copy.default : selectedArchived ? copy.statusArchived : copy.statusActive}</strong><p>{selectedPipeline.description || '—'}</p></div>{canConfigure ? <div><button type="button" onClick={openEdit}><Pencil aria-hidden="true" size={15} />{copy.edit}</button><button disabled={selectedPipeline.isDefault && !selectedArchived} type="button" onClick={openArchive}>{selectedArchived ? <ArchiveRestore aria-hidden="true" size={15} /> : <Archive aria-hidden="true" size={15} />}{selectedArchived ? copy.restore : copy.archive}</button></div> : null}</div>
            <div className="crm-pipelines__metrics"><article><span>{copy.stages}</span><strong>{selectedPipeline.stages.length}</strong></article><article><span>{copy.leads}</span><strong>{selectedPipeline._count.leads}</strong></article><article><span>{copy.deals}</span><strong>{selectedPipeline._count.deals}</strong></article></div>
            <section><h2>{copy.stages}</h2><div className="crm-pipelines__stage-list">{selectedPipeline.stages.map((stage) => <article key={stage.id}><header><div><span>{stage.position}</span><h3>{stage.name}</h3></div>{canConfigure && !selectedArchived ? <button aria-label={`${copy.editStage}: ${stage.name}`} type="button" onClick={(event) => openStage(stage, event.currentTarget)}><Pencil aria-hidden="true" size={15} /></button> : null}</header><p>{copy.type}: <strong>{stage.type}</strong> · {copy.probability}: <strong>{stage.defaultProbability}%</strong> · {copy.sla}: <strong>{stage.slaHours ?? '—'}</strong></p><p>{copy.required}: {stage.requiredFields?.length ? stage.requiredFields.join(', ') : copy.noRequired}</p><small>{copy.usage}: {(stage._count?.leads ?? 0) + (stage._count?.deals ?? 0)}</small></article>)}</div></section>
            <section><h2>{copy.lifecycle}</h2>{selectedPipeline.lifecycleActivities?.length ? <div className="crm-pipelines__timeline">{selectedPipeline.lifecycleActivities.map((activity) => <article key={activity.id}><strong>{activity.subject.includes('archived') ? copy.archive : copy.restore}</strong><p>{activity.body || '—'}</p><small>{formatDate(activity.createdAt, locale)} · {activity.createdBy?.name || '—'}</small></article>)}</div> : <p>{copy.noLifecycle}</p>}</section>
          </div>
        ) : null}
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.closeCreate} description={copy.createDescription} initialFocusRef={createNameRef} onClose={() => { if (!createBusy) setCreateOpen(false); }} open={createOpen} returnFocusRef={createTriggerRef} size="large" title={copy.createTitle}>
        <form className="crm-pipelines__dialog-form" onSubmit={submitCreate}>{createError ? <div className="form-error" role="alert">{createError}</div> : null}<label><span>{copy.name}</span><input ref={createNameRef} required value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></label><label><span>{copy.descriptionLabel}</span><textarea value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} /></label><label className="crm-pipelines__checkbox"><input checked={createForm.isDefault} type="checkbox" onChange={(event) => setCreateForm((current) => ({ ...current, isDefault: event.target.checked }))} /><span>{copy.makeDefault}</span></label><button className="button-link button-link--primary" disabled={createBusy} type="submit">{createBusy ? copy.saving : copy.savePipeline}</button></form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.closeEdit} description={copy.editDescription} initialFocusRef={editNameRef} onClose={() => { if (!editBusy) setEditOpen(false); }} open={editOpen} size="large" title={copy.editTitle}>
        <form className="crm-pipelines__dialog-form" onSubmit={submitEdit}>{editError ? <div className="form-error" role="alert">{editError}</div> : null}<label><span>{copy.name}</span><input ref={editNameRef} required value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /></label><label><span>{copy.descriptionLabel}</span><textarea value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} /></label><label className="crm-pipelines__checkbox"><input checked={editForm.isDefault} disabled={selectedPipeline?.isDefault} type="checkbox" onChange={(event) => setEditForm((current) => ({ ...current, isDefault: event.target.checked }))} /><span>{copy.makeDefault}</span></label><button className="button-link button-link--primary" disabled={editBusy} type="submit">{editBusy ? copy.saving : copy.saveChanges}</button></form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.closeStage} description={copy.stageDescription} initialFocusRef={stageNameRef} onClose={() => { if (!stageBusy) { setSelectedStage(null); setStageFormState(null); } }} open={Boolean(selectedStage && stageFormState)} size="large" title={selectedStage ? `${copy.stageTitle} · ${selectedStage.name}` : copy.stageTitle}>
        {stageFormState ? <form className="crm-pipelines__dialog-form" onSubmit={submitStage}>{stageError ? <div className="form-error" role="alert">{stageError}</div> : null}<div className="crm-pipelines__dialog-grid"><label><span>{copy.stage}</span><input ref={stageNameRef} required value={stageFormState.name} onChange={(event) => setStageFormState((current) => current ? ({ ...current, name: event.target.value }) : current)} /></label><label><span>{copy.position}</span><input min="1" required type="number" value={stageFormState.position} onChange={(event) => setStageFormState((current) => current ? ({ ...current, position: event.target.value }) : current)} /></label><label><span>{copy.type}</span><select value={stageFormState.type} onChange={(event) => setStageFormState((current) => current ? ({ ...current, type: event.target.value as CrmPipelineStageType }) : current)}><option value="OPEN">OPEN</option><option value="WON">WON</option><option value="LOST">LOST</option></select></label><label><span>{copy.probability}</span><input max="100" min="0" required type="number" value={stageFormState.defaultProbability} onChange={(event) => setStageFormState((current) => current ? ({ ...current, defaultProbability: event.target.value }) : current)} /></label><label><span>{copy.sla}</span><input min="1" type="number" value={stageFormState.slaHours} onChange={(event) => setStageFormState((current) => current ? ({ ...current, slaHours: event.target.value }) : current)} /></label></div><fieldset><legend>{copy.required}</legend><div className="crm-pipelines__required-fields">{requiredFieldOptions.map((field) => <label key={field}><input checked={stageFormState.requiredFields.includes(field)} type="checkbox" onChange={(event) => setStageFormState((current) => current ? ({ ...current, requiredFields: event.target.checked ? [...current.requiredFields, field] : current.requiredFields.filter((item) => item !== field) }) : current)} /><span>{field}</span></label>)}</div></fieldset><label className="crm-pipelines__checkbox"><input checked={stageFormState.active} type="checkbox" onChange={(event) => setStageFormState((current) => current ? ({ ...current, active: event.target.checked }) : current)} /><span>{copy.activeStage}</span></label><button className="button-link button-link--primary" disabled={stageBusy} type="submit">{stageBusy ? copy.saving : copy.saveStage}</button></form> : null}
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.closeArchive} description={copy.archiveDescription} initialFocusRef={archiveReasonRef} onClose={() => { if (!archiveBusy) setArchiveOpen(false); }} open={archiveOpen} size="medium" title={copy.archiveTitle}>
        <form className="crm-pipelines__dialog-form" onSubmit={submitArchive}>{archiveError ? <div className="form-error" role="alert">{archiveError}</div> : null}<label><span>{copy.reason}</span><textarea minLength={3} ref={archiveReasonRef} required value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} /></label><label className="crm-pipelines__checkbox"><input checked={archiveAcknowledged} required type="checkbox" onChange={(event) => setArchiveAcknowledged(event.target.checked)} /><span>{copy.acknowledge}</span></label><button className="button-link button-link--primary" disabled={archiveBusy || !archiveAcknowledged || archiveReason.trim().length < 3} type="submit">{archiveBusy ? copy.saving : selectedArchived ? copy.confirmRestore : copy.confirmArchive}</button></form>
      </AccessibleDialog>
    </section>
  );
}

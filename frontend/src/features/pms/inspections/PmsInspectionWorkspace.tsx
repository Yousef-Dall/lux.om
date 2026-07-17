import { CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Columns3, Eye, List, Search, ShieldAlert, Wrench } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import {
  cancelPmsInspectionRun,
  completePmsInspectionRun,
  convertPmsInspectionDefectToWorkOrder,
  createPmsInspectionRun,
  getPmsInspectionRun,
  listPmsAssets,
  listPmsInspectionRuns,
  listPmsInspectionTemplates,
  type PmsAsset,
  type PmsInspectionDefect,
  type PmsInspectionItemResult,
  type PmsInspectionResultPayload,
  type PmsInspectionRun,
  type PmsInspectionStatus,
  type PmsInspectionSummary,
  type PmsInspectionTemplate,
  type PmsInspectionType,
  type PmsMaintenancePriority,
} from '../../../api/pmsAdvanced';
import {
  listPmsProperties,
  listPmsUnits,
  listPmsVendors,
  type PmsProperty,
  type PmsUnit,
  type PmsVendor,
} from '../../../api/pms';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { PortalEmpty } from '../../portal/PortalState';

const PAGE_SIZE = 25;
const types: PmsInspectionType[] = ['GENERAL', 'MOVE_IN', 'MOVE_OUT', 'PERIODIC', 'SAFETY'];
const statuses: PmsInspectionStatus[] = ['SCHEDULED', 'COMPLETED', 'NEEDS_ACTION', 'CANCELLED'];
const outcomes: PmsInspectionItemResult[] = ['PASS', 'FAIL', 'OBSERVATION', 'NOT_APPLICABLE'];
const priorities: PmsMaintenancePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const sortOptions = ['scheduledFor:desc', 'scheduledFor:asc', 'updatedAt:desc', 'title:asc', 'status:asc'] as const;

type Language = 'en' | 'ar';
type SortValue = typeof sortOptions[number];
type ScheduleForm = { templateId: string; propertyId: string; unitId: string; title: string; scheduledFor: string; notes: string };
type ExecutionState = {
  result: PmsInspectionItemResult | '';
  valueText: string;
  notes: string;
  photoUrls: string;
  createDefect: boolean;
  defectTitle: string;
  defectDescription: string;
  defectSeverity: PmsMaintenancePriority;
  defectPhotoUrls: string;
};
type ConversionForm = { vendorId: string; assetId: string; scheduledFor: string; targetDate: string };
type Props = {
  token: string;
  companyId: string;
  language: Language;
  canManage: boolean;
  onSummaryChange?: (summary: PmsInspectionSummary & { total: number }) => void;
};

const copy = {
  en: {
    eyebrow: 'Structured inspections',
    title: 'Inspection runs',
    description: 'Schedule connected inspections, execute mobile-friendly checklists, preserve evidence, and convert defects into governed work orders.',
    schedule: 'Schedule inspection',
    search: 'Search inspection, template, property, unit, or notes',
    property: 'Property',
    allProperties: 'All properties',
    status: 'Status',
    allStatuses: 'All statuses',
    type: 'Type',
    allTypes: 'All types',
    scheduledFrom: 'Scheduled from',
    scheduledTo: 'Scheduled to',
    sort: 'Sort',
    apply: 'Apply filters',
    clear: 'Clear',
    viewMode: 'Inspection planning view',
    listView: 'List',
    calendarView: 'Calendar',
    kanbanView: 'Kanban',
    loading: 'Loading inspection runs…',
    failed: 'Inspection runs could not be loaded.',
    noRuns: 'No inspection runs match this view',
    noRunsMessage: 'Adjust the filters or schedule the first structured inspection.',
    scheduled: 'Scheduled',
    completed: 'Completed',
    defects: 'Defects',
    documents: 'Documents',
    view: 'View inspection',
    execute: 'Execute inspection',
    cancel: 'Cancel inspection',
    previous: 'Previous',
    next: 'Next',
    pageRange: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
    permission: 'You can review inspection records, but your role cannot schedule, execute, cancel, or convert defects.',
    filtersLabel: 'Inspection run filters',
    resultsLabel: 'PMS inspection run results',
    scheduleTitle: 'Schedule structured inspection',
    scheduleDescription: 'Templates remain immutable evidence. Choose a property and optional unit that are inside your workspace scope.',
    template: 'Inspection template',
    chooseTemplate: 'Choose a template',
    unit: 'Unit',
    propertyWide: 'Property-wide inspection',
    runTitle: 'Inspection title',
    scheduledFor: 'Scheduled date and time',
    notes: 'Notes',
    saveSchedule: 'Schedule inspection',
    saving: 'Saving…',
    requiredSchedule: 'Choose a template and property and enter an inspection title.',
    detailsTitle: (title: string) => `Inspection details · ${title}`,
    detailsDescription: 'Template, schedule, results, evidence, and defects remain attached to this run.',
    close: 'Close dialog',
    templateVersion: (version: number) => `Version ${version}`,
    checklist: 'Checklist',
    noResults: 'This inspection has not been executed yet.',
    resultEvidence: 'Recorded results and evidence',
    photos: 'Photo evidence',
    noPhotos: 'No photo evidence',
    openDefects: 'Open defects',
    createWorkOrder: 'Create work order',
    workOrderCreated: 'Work order created',
    executeTitle: 'Execute structured inspection',
    executeDescription: 'Complete every required item. Failure-photo rules are enforced before the run can be completed.',
    outcome: 'Outcome',
    selectOutcome: 'Select outcome',
    value: 'Value or observation',
    resultNotes: 'Result notes',
    photoUrls: 'Photo URLs, one per line',
    addDefect: 'Create a defect from this result',
    defectTitle: 'Defect title',
    defectDescription: 'Defect description',
    severity: 'Severity',
    defectPhotoUrls: 'Defect photo URLs, one per line',
    acknowledgement: 'Inspector acknowledgement name',
    complete: 'Complete inspection',
    completing: 'Completing…',
    requiredResults: 'Complete all required checklist items and provide required failure photos.',
    cancelTitle: 'Cancel scheduled inspection',
    cancelDescription: 'Cancellation is recorded in the domain audit trail. Completed inspections remain immutable.',
    reason: 'Cancellation reason',
    confirmCancel: 'Cancel inspection',
    cancelling: 'Cancelling…',
    conversionTitle: 'Convert defect to work order',
    conversionDescription: 'The conversion is idempotent. Repeating it returns the existing work order rather than creating a duplicate.',
    vendor: 'Vendor',
    noVendor: 'No assigned vendor',
    asset: 'Asset',
    noAsset: 'No linked asset',
    targetDate: 'Target date',
    createOrder: 'Create work order',
    creatingOrder: 'Creating…',
    orderReference: (id: string) => `Work order ${id} is linked to this defect.`,
    offline: 'Inspection execution requires a live connection. Offline queueing is not implemented.',
  },
  ar: {
    eyebrow: 'الفحوصات المنظمة',
    title: 'جولات الفحص',
    description: 'جدولة الفحوصات وتنفيذ قوائم عملية على الهاتف وحفظ الأدلة وتحويل العيوب إلى أوامر عمل محكومة.',
    schedule: 'جدولة فحص',
    search: 'ابحث بالفحص أو القالب أو العقار أو الوحدة أو الملاحظات',
    property: 'العقار',
    allProperties: 'كل العقارات',
    status: 'الحالة',
    allStatuses: 'كل الحالات',
    type: 'النوع',
    allTypes: 'كل الأنواع',
    scheduledFrom: 'مجدول من',
    scheduledTo: 'مجدول حتى',
    sort: 'الترتيب',
    apply: 'تطبيق المرشحات',
    clear: 'مسح',
    viewMode: 'طريقة عرض تخطيط الفحوصات',
    listView: 'قائمة',
    calendarView: 'تقويم',
    kanbanView: 'لوحة',
    loading: 'جارٍ تحميل جولات الفحص…',
    failed: 'تعذر تحميل جولات الفحص.',
    noRuns: 'لا توجد جولات مطابقة',
    noRunsMessage: 'عدّل المرشحات أو جدوِل أول فحص منظم.',
    scheduled: 'الموعد',
    completed: 'الاكتمال',
    defects: 'العيوب',
    documents: 'المستندات',
    view: 'عرض الفحص',
    execute: 'تنفيذ الفحص',
    cancel: 'إلغاء الفحص',
    previous: 'السابق',
    next: 'التالي',
    pageRange: (from: number, to: number, total: number) => `${from}–${to} من ${total}`,
    permission: 'يمكنك مراجعة سجلات الفحص، لكن دورك لا يسمح بالجدولة أو التنفيذ أو الإلغاء أو تحويل العيوب.',
    filtersLabel: 'مرشحات جولات الفحص',
    resultsLabel: 'نتائج جولات الفحص في PMS',
    scheduleTitle: 'جدولة فحص منظم',
    scheduleDescription: 'تبقى القوالب أدلة ثابتة. اختر عقاراً ووحدة اختيارية ضمن نطاق مساحة العمل.',
    template: 'قالب الفحص',
    chooseTemplate: 'اختر قالباً',
    unit: 'الوحدة',
    propertyWide: 'فحص على مستوى العقار',
    runTitle: 'عنوان الفحص',
    scheduledFor: 'تاريخ ووقت الفحص',
    notes: 'ملاحظات',
    saveSchedule: 'جدولة الفحص',
    saving: 'جارٍ الحفظ…',
    requiredSchedule: 'اختر القالب والعقار وأدخل عنوان الفحص.',
    detailsTitle: (title: string) => `تفاصيل الفحص · ${title}`,
    detailsDescription: 'يبقى القالب والموعد والنتائج والأدلة والعيوب مرتبطاً بهذه الجولة.',
    close: 'إغلاق النافذة',
    templateVersion: (version: number) => `الإصدار ${version}`,
    checklist: 'قائمة الفحص',
    noResults: 'لم يتم تنفيذ هذا الفحص بعد.',
    resultEvidence: 'النتائج والأدلة المسجلة',
    photos: 'أدلة الصور',
    noPhotos: 'لا توجد أدلة صور',
    openDefects: 'العيوب المفتوحة',
    createWorkOrder: 'إنشاء أمر عمل',
    workOrderCreated: 'تم إنشاء أمر العمل',
    executeTitle: 'تنفيذ الفحص المنظم',
    executeDescription: 'أكمل كل بند مطلوب. يتم فرض صور الإخفاق المطلوبة قبل إكمال الجولة.',
    outcome: 'النتيجة',
    selectOutcome: 'اختر النتيجة',
    value: 'القيمة أو الملاحظة',
    resultNotes: 'ملاحظات النتيجة',
    photoUrls: 'روابط الصور، رابط في كل سطر',
    addDefect: 'إنشاء عيب من هذه النتيجة',
    defectTitle: 'عنوان العيب',
    defectDescription: 'وصف العيب',
    severity: 'الخطورة',
    defectPhotoUrls: 'روابط صور العيب، رابط في كل سطر',
    acknowledgement: 'اسم إقرار المفتش',
    complete: 'إكمال الفحص',
    completing: 'جارٍ الإكمال…',
    requiredResults: 'أكمل جميع البنود المطلوبة وأضف صور الإخفاق المطلوبة.',
    cancelTitle: 'إلغاء فحص مجدول',
    cancelDescription: 'يُسجل الإلغاء في سجل التدقيق. تبقى الفحوصات المكتملة غير قابلة للتعديل.',
    reason: 'سبب الإلغاء',
    confirmCancel: 'إلغاء الفحص',
    cancelling: 'جارٍ الإلغاء…',
    conversionTitle: 'تحويل العيب إلى أمر عمل',
    conversionDescription: 'التحويل لا ينشئ تكراراً. إعادة الطلب تعيد أمر العمل الموجود.',
    vendor: 'المورد',
    noVendor: 'دون مورد معيّن',
    asset: 'الأصل',
    noAsset: 'دون أصل مرتبط',
    targetDate: 'التاريخ المستهدف',
    createOrder: 'إنشاء أمر عمل',
    creatingOrder: 'جارٍ الإنشاء…',
    orderReference: (id: string) => `أمر العمل ${id} مرتبط بهذا العيب.`,
    offline: 'يتطلب تنفيذ الفحص اتصالاً مباشراً. لا توجد مزامنة دون اتصال حالياً.',
  },
};

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function enumLabel(value: string, language: Language) {
  const labels: Record<string, { en: string; ar: string }> = {
    GENERAL: { en: 'General', ar: 'عام' }, MOVE_IN: { en: 'Move in', ar: 'استلام' }, MOVE_OUT: { en: 'Move out', ar: 'إخلاء' }, PERIODIC: { en: 'Periodic', ar: 'دوري' }, SAFETY: { en: 'Safety', ar: 'سلامة' },
    SCHEDULED: { en: 'Scheduled', ar: 'مجدول' }, COMPLETED: { en: 'Completed', ar: 'مكتمل' }, NEEDS_ACTION: { en: 'Needs action', ar: 'يحتاج إجراء' }, CANCELLED: { en: 'Cancelled', ar: 'ملغى' },
    PASS: { en: 'Pass', ar: 'ناجح' }, FAIL: { en: 'Fail', ar: 'إخفاق' }, OBSERVATION: { en: 'Observation', ar: 'ملاحظة' }, NOT_APPLICABLE: { en: 'Not applicable', ar: 'غير منطبق' },
    LOW: { en: 'Low', ar: 'منخفضة' }, MEDIUM: { en: 'Medium', ar: 'متوسطة' }, HIGH: { en: 'High', ar: 'مرتفعة' }, URGENT: { en: 'Urgent', ar: 'عاجلة' },
    OPEN: { en: 'Open', ar: 'مفتوح' }, WORK_ORDER_CREATED: { en: 'Work order created', ar: 'تم إنشاء أمر عمل' }, RESOLVED: { en: 'Resolved', ar: 'محلول' }, WAIVED: { en: 'Waived', ar: 'معفى' },
    scheduledFor: { en: 'Scheduled date', ar: 'موعد الفحص' }, updatedAt: { en: 'Recently updated', ar: 'آخر تحديث' }, title: { en: 'Title', ar: 'العنوان' }, status: { en: 'Status', ar: 'الحالة' }, asc: { en: 'ascending', ar: 'تصاعدي' }, desc: { en: 'descending', ar: 'تنازلي' },
  };
  return labels[value]?.[language] ?? value.replaceAll('_', ' ').toLowerCase();
}

function formatDate(value: string | null | undefined, language: Language, includeTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-OM', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value));
}

function urls(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function todayTimeInput() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function loadAllProperties(token: string, companyId: string) {
  const items: PmsProperty[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await listPmsProperties(token, { companyId, active: 'ACTIVE', sortBy: 'name', direction: 'asc', take: 100, skip });
    items.push(...page.properties);
    if (items.length >= page.pagination.total || page.properties.length === 0) return items;
  }
}

async function loadAllUnits(token: string, companyId: string) {
  const items: PmsUnit[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await listPmsUnits(token, { companyId, status: 'ALL', sortBy: 'unitNumber', direction: 'asc', take: 100, skip });
    items.push(...page.units);
    if (items.length >= page.pagination.total || page.units.length === 0) return items;
  }
}

async function loadAllVendors(token: string, companyId: string) {
  const items: PmsVendor[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await listPmsVendors(token, { companyId, active: 'ACTIVE', sortBy: 'name', direction: 'asc', take: 100, skip });
    items.push(...page.vendors);
    if (items.length >= page.pagination.total || page.vendors.length === 0) return items;
  }
}

async function loadAllAssets(token: string, companyId: string) {
  const items: PmsAsset[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await listPmsAssets(token, { companyId, sortBy: 'assetCode', direction: 'asc', take: 100, skip });
    items.push(...page.assets);
    if (items.length >= page.pagination.total || page.assets.length === 0) return items;
  }
}

function emptyExecution(template: PmsInspectionTemplate | null | undefined) {
  return Object.fromEntries((template?.sections ?? []).flatMap((section) => section.items).map((item) => [item.id, { result: '', valueText: '', notes: '', photoUrls: '', createDefect: false, defectTitle: '', defectDescription: '', defectSeverity: 'MEDIUM', defectPhotoUrls: '' } satisfies ExecutionState]));
}

export default function PmsInspectionWorkspace({ token, companyId, language, canManage, onSummaryChange }: Props) {
  const text = copy[language];
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<PmsInspectionRun[]>([]);
  const [pagination, setPagination] = useState({ take: PAGE_SIZE, skip: 0, count: 0, total: 0 });
  const [summary, setSummary] = useState<PmsInspectionSummary>({ scheduled: 0, needsAction: 0, openDefects: 0 });
  const [properties, setProperties] = useState<PmsProperty[]>([]);
  const [units, setUnits] = useState<PmsUnit[]>([]);
  const [assets, setAssets] = useState<PmsAsset[]>([]);
  const [vendors, setVendors] = useState<PmsVendor[]>([]);
  const [templates, setTemplates] = useState<PmsInspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({ templateId: '', propertyId: '', unitId: '', title: '', scheduledFor: todayTimeInput(), notes: '' });
  const [scheduleError, setScheduleError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PmsInspectionRun | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [executeOpen, setExecuteOpen] = useState(false);
  const [execution, setExecution] = useState<Record<string, ExecutionState>>({});
  const [acknowledgement, setAcknowledgement] = useState('');
  const [executionError, setExecutionError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [conversionDefect, setConversionDefect] = useState<PmsInspectionDefect | null>(null);
  const [conversionForm, setConversionForm] = useState<ConversionForm>({ vendorId: '', assetId: '', scheduledFor: '', targetDate: '' });
  const [conversionError, setConversionError] = useState('');
  const [converting, setConverting] = useState(false);
  const [conversionNotice, setConversionNotice] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const acknowledgementRef = useRef<HTMLInputElement>(null);
  const cancelReasonRef = useRef<HTMLTextAreaElement>(null);
  const vendorRef = useRef<HTMLSelectElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const page = Math.max(1, Number(searchParams.get('inspectionPage') ?? '1') || 1);
  const appliedSearch = searchParams.get('inspectionQ') ?? '';
  const appliedProperty = searchParams.get('inspectionProperty') ?? '';
  const appliedStatus = (searchParams.get('inspectionStatus') ?? '') as PmsInspectionStatus | '';
  const appliedType = (searchParams.get('inspectionType') ?? '') as PmsInspectionType | '';
  const appliedFrom = searchParams.get('inspectionFrom') ?? '';
  const appliedTo = searchParams.get('inspectionTo') ?? '';
  const appliedSort = (searchParams.get('inspectionSort') ?? 'scheduledFor:desc') as SortValue;
  const viewMode = searchParams.get('inspectionView') === 'calendar' || searchParams.get('inspectionView') === 'kanban' ? searchParams.get('inspectionView')! : 'list';
  const [sortBy, direction] = appliedSort.split(':') as ['scheduledFor' | 'updatedAt' | 'title' | 'status', 'asc' | 'desc'];
  const [searchDraft, setSearchDraft] = useState(appliedSearch);
  const [propertyDraft, setPropertyDraft] = useState(appliedProperty);
  const [statusDraft, setStatusDraft] = useState<PmsInspectionStatus | ''>(appliedStatus);
  const [typeDraft, setTypeDraft] = useState<PmsInspectionType | ''>(appliedType);
  const [fromDraft, setFromDraft] = useState(appliedFrom);
  const [toDraft, setToDraft] = useState(appliedTo);
  const [sortDraft, setSortDraft] = useState<SortValue>(appliedSort);

  useEffect(() => {
    setSearchDraft(appliedSearch); setPropertyDraft(appliedProperty); setStatusDraft(appliedStatus); setTypeDraft(appliedType); setFromDraft(appliedFrom); setToDraft(appliedTo); setSortDraft(appliedSort);
  }, [appliedFrom, appliedProperty, appliedSearch, appliedSort, appliedStatus, appliedTo, appliedType]);

  useEffect(() => {
    let active = true;
    void Promise.all([loadAllProperties(token, companyId), loadAllUnits(token, companyId), loadAllAssets(token, companyId), loadAllVendors(token, companyId), listPmsInspectionTemplates(token, { companyId })])
      .then(([propertyItems, unitItems, assetItems, vendorItems, templateResult]) => {
        if (!active) return;
        setProperties(propertyItems); setUnits(unitItems); setAssets(assetItems); setVendors(vendorItems); setTemplates(templateResult.templates);
      }).catch(() => undefined);
    return () => { active = false; };
  }, [companyId, token]);

  const loadRuns = useCallback(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void listPmsInspectionRuns(token, { companyId, propertyId: appliedProperty || undefined, status: appliedStatus || undefined, type: appliedType || undefined, search: appliedSearch || undefined, scheduledFrom: appliedFrom || undefined, scheduledTo: appliedTo || undefined, sortBy, direction, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, signal: controller.signal })
      .then((result) => {
        setRuns(result.inspections); setPagination(result.pagination); setSummary(result.summary); onSummaryChange?.({ ...result.summary, total: result.pagination.total });
        if (page > 1 && result.inspections.length === 0 && result.pagination.total > 0) {
          const next = new URLSearchParams(searchParams); next.set('inspectionPage', String(Math.max(1, Math.ceil(result.pagination.total / PAGE_SIZE)))); setSearchParams(next, { replace: true });
        }
      }).catch((loadError) => { if ((loadError as { name?: string }).name !== 'AbortError') setError(apiMessage(loadError, text.failed)); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [appliedFrom, appliedProperty, appliedSearch, appliedStatus, appliedTo, appliedType, companyId, direction, onSummaryChange, page, searchParams, setSearchParams, sortBy, text.failed, token]);

  useEffect(() => loadRuns(), [loadRuns, reloadKey]);

  const scheduleUnits = useMemo(() => units.filter((unit) => unit.propertyId === scheduleForm.propertyId), [scheduleForm.propertyId, units]);
  const scheduleTemplates = useMemo(() => templates.filter((template) => !template.propertyId || template.propertyId === scheduleForm.propertyId), [scheduleForm.propertyId, templates]);
  const conversionAssets = useMemo(() => assets.filter((asset) => asset.propertyId === selectedRun?.property.id && (!selectedRun?.unit?.id || !asset.unitId || asset.unitId === selectedRun.unit.id)), [assets, selectedRun]);

  function rememberTrigger(target: EventTarget | null) { returnFocusRef.current = target instanceof HTMLElement ? target : null; }
  function setPage(nextPage: number) { const next = new URLSearchParams(searchParams); if (nextPage <= 1) next.delete('inspectionPage'); else next.set('inspectionPage', String(nextPage)); setSearchParams(next); }
  function setViewMode(mode: 'list' | 'calendar' | 'kanban') { const next = new URLSearchParams(searchParams); if (mode === 'list') next.delete('inspectionView'); else next.set('inspectionView', mode); setSearchParams(next, { replace: true }); }
  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const fields: Array<[string, string | null]> = [['inspectionQ', searchDraft.trim() || null], ['inspectionProperty', propertyDraft || null], ['inspectionStatus', statusDraft || null], ['inspectionType', typeDraft || null], ['inspectionFrom', fromDraft || null], ['inspectionTo', toDraft || null], ['inspectionSort', sortDraft === 'scheduledFor:desc' ? null : sortDraft]];
    fields.forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); next.delete('inspectionPage'); setSearchParams(next);
  }
  function clearFilters() { const next = new URLSearchParams(searchParams); ['inspectionQ', 'inspectionProperty', 'inspectionStatus', 'inspectionType', 'inspectionFrom', 'inspectionTo', 'inspectionSort', 'inspectionPage'].forEach((key) => next.delete(key)); setSearchParams(next); }

  function openSchedule(target: EventTarget | null) {
    rememberTrigger(target);
    const propertyId = appliedProperty || properties[0]?.id || '';
    const availableTemplates = templates.filter((template) => !template.propertyId || template.propertyId === propertyId);
    setScheduleForm({ templateId: availableTemplates[0]?.id ?? '', propertyId, unitId: '', title: '', scheduledFor: todayTimeInput(), notes: '' });
    setScheduleError(''); setScheduleOpen(true);
  }

  async function submitSchedule(event: FormEvent) {
    event.preventDefault();
    if (!scheduleForm.templateId || !scheduleForm.propertyId || !scheduleForm.title.trim()) { setScheduleError(text.requiredSchedule); return; }
    setSaving(true); setScheduleError('');
    try {
      await createPmsInspectionRun(token, { companyId, templateId: scheduleForm.templateId, propertyId: scheduleForm.propertyId, unitId: scheduleForm.unitId || null, title: scheduleForm.title.trim(), scheduledFor: scheduleForm.scheduledFor || null, notes: scheduleForm.notes.trim() || null });
      setScheduleOpen(false); setReloadKey((key) => key + 1);
    } catch (saveError) { setScheduleError(apiMessage(saveError, text.failed)); } finally { setSaving(false); }
  }

  async function openDetails(run: PmsInspectionRun, target: EventTarget | null) {
    rememberTrigger(target); setDetailsLoading(true); setDetailsError(''); setSelectedRun(run); setConversionNotice('');
    try { const result = await getPmsInspectionRun(token, run.id, companyId); setSelectedRun(result.inspection); }
    catch (loadError) { setDetailsError(apiMessage(loadError, text.failed)); }
    finally { setDetailsLoading(false); }
  }

  function openExecution(target: EventTarget | null) {
    if (!selectedRun?.template?.sections) return;
    rememberTrigger(target); setExecution(emptyExecution(selectedRun.template)); setAcknowledgement(''); setExecutionError(''); setExecuteOpen(true); setSelectedRun((run) => run);
  }

  function updateExecution(itemId: string, patch: Partial<ExecutionState>) { setExecution((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } })); }

  async function submitExecution(event: FormEvent) {
    event.preventDefault();
    if (!selectedRun?.template?.sections) return;
    const items = selectedRun.template.sections.flatMap((section) => section.items);
    const invalid = items.some((item) => {
      const state = execution[item.id];
      return (item.required && !state?.result) || (state?.result === 'FAIL' && item.requiresPhotoOnFailure && urls(state.photoUrls).length === 0) || (state?.createDefect && !state.defectTitle.trim());
    });
    if (invalid) { setExecutionError(text.requiredResults); return; }
    const results: PmsInspectionResultPayload[] = items.filter((item) => execution[item.id]?.result).map((item) => {
      const state = execution[item.id]!;
      return { templateItemId: item.id, result: state.result as PmsInspectionItemResult, valueText: state.valueText.trim() || null, notes: state.notes.trim() || null, photoUrls: urls(state.photoUrls), acknowledgedByName: acknowledgement.trim() || null, defect: state.createDefect ? { title: state.defectTitle.trim(), description: state.defectDescription.trim() || null, severity: state.defectSeverity, photoUrls: urls(state.defectPhotoUrls) } : null };
    });
    setCompleting(true); setExecutionError('');
    try {
      const response = await completePmsInspectionRun(token, selectedRun.id, { companyId, acknowledgement: acknowledgement.trim() ? { completedByName: acknowledgement.trim() } : null, results });
      setSelectedRun(response.inspection); setExecuteOpen(false); setReloadKey((key) => key + 1);
    } catch (completeError) { setExecutionError(apiMessage(completeError, text.failed)); } finally { setCompleting(false); }
  }

  function openCancel(target: EventTarget | null) { rememberTrigger(target); setCancelReason(''); setCancelOpen(true); }
  async function submitCancel(event: FormEvent) {
    event.preventDefault(); if (!selectedRun || cancelReason.trim().length < 3) return;
    setCancelling(true);
    try { const response = await cancelPmsInspectionRun(token, selectedRun.id, companyId, cancelReason.trim()); setSelectedRun(response.inspection); setCancelOpen(false); setReloadKey((key) => key + 1); }
    catch (cancelError) { setNotice(apiMessage(cancelError, text.failed)); } finally { setCancelling(false); }
  }

  function openConversion(defect: PmsInspectionDefect, target: EventTarget | null) { rememberTrigger(target); setConversionDefect(defect); setConversionForm({ vendorId: '', assetId: '', scheduledFor: '', targetDate: '' }); setConversionError(''); setConversionNotice(''); }
  async function submitConversion(event: FormEvent) {
    event.preventDefault(); if (!conversionDefect) return;
    setConverting(true); setConversionError('');
    try {
      const response = await convertPmsInspectionDefectToWorkOrder(token, conversionDefect.id, { companyId, vendorId: conversionForm.vendorId || null, assetId: conversionForm.assetId || null, scheduledFor: conversionForm.scheduledFor || null, targetDate: conversionForm.targetDate || null });
      setConversionNotice(text.orderReference(response.workOrder.id)); setConversionDefect(null);
      if (selectedRun) { const detail = await getPmsInspectionRun(token, selectedRun.id, companyId); setSelectedRun(detail.inspection); }
      setReloadKey((key) => key + 1);
    } catch (conversionFailure) { setConversionError(apiMessage(conversionFailure, text.failed)); } finally { setConverting(false); }
  }

  const from = pagination.total === 0 ? 0 : pagination.skip + 1;
  const to = pagination.skip + pagination.count;
  const pageCount = Math.max(1, Math.ceil(pagination.total / PAGE_SIZE));
  const hasInspectionDetail = Boolean(
    selectedRun?.template?.sections
    && Array.isArray(selectedRun.results)
    && Array.isArray(selectedRun.defects),
  );
  const selectedSections = selectedRun?.template?.sections ?? [];
  const selectedResults = selectedRun?.results ?? [];
  const selectedDefects = selectedRun?.defects ?? [];

  return <section className="pms-inspection-workspace" aria-labelledby="pms-inspection-title">
    <header className="pms-inspection-workspace__header"><div><p className="eyebrow">{text.eyebrow}</p><h2 id="pms-inspection-title">{text.title}</h2><p>{text.description}</p></div>{canManage ? <button className="button-link" type="button" onClick={(event) => openSchedule(event.currentTarget)}><CalendarPlus aria-hidden="true" size={18} />{text.schedule}</button> : null}</header>
    {!canManage ? <p className="pms-inspection-workspace__permission">{text.permission}</p> : null}
    <p className="pms-inspection-workspace__offline">{text.offline}</p>
    {notice ? <p className="form-alert form-alert--success" role="status">{notice}</p> : null}
    <form aria-label={text.filtersLabel} className="pms-inspection-filters" onSubmit={applyFilters}>
      <label><span>{text.search}</span><div className="pms-inspection-search"><Search aria-hidden="true" size={17} /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /></div></label>
      <label><span>{text.property}</span><select value={propertyDraft} onChange={(event) => setPropertyDraft(event.target.value)}><option value="">{text.allProperties}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
      <label><span>{text.status}</span><select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as PmsInspectionStatus | '')}><option value="">{text.allStatuses}</option>{statuses.map((status) => <option key={status} value={status}>{enumLabel(status, language)}</option>)}</select></label>
      <label><span>{text.type}</span><select value={typeDraft} onChange={(event) => setTypeDraft(event.target.value as PmsInspectionType | '')}><option value="">{text.allTypes}</option>{types.map((type) => <option key={type} value={type}>{enumLabel(type, language)}</option>)}</select></label>
      <label><span>{text.scheduledFrom}</span><input type="date" value={fromDraft} onChange={(event) => setFromDraft(event.target.value)} /></label>
      <label><span>{text.scheduledTo}</span><input type="date" value={toDraft} onChange={(event) => setToDraft(event.target.value)} /></label>
      <label><span>{text.sort}</span><select value={sortDraft} onChange={(event) => setSortDraft(event.target.value as SortValue)}>{sortOptions.map((option) => { const [field, order] = option.split(':'); return <option key={option} value={option}>{enumLabel(field, language)} · {enumLabel(order, language)}</option>; })}</select></label>
      <div className="pms-inspection-filters__actions"><button className="button-link" type="submit">{text.apply}</button><button className="button-link button-link--secondary" type="button" onClick={clearFilters}>{text.clear}</button></div>
    </form>
    <div className="pms-inspection-summary" aria-label={text.title}><article><CalendarPlus aria-hidden="true" size={18} /><span>{enumLabel('SCHEDULED', language)}</span><strong>{summary.scheduled}</strong></article><article><ShieldAlert aria-hidden="true" size={18} /><span>{enumLabel('NEEDS_ACTION', language)}</span><strong>{summary.needsAction}</strong></article><article><Wrench aria-hidden="true" size={18} /><span>{text.openDefects}</span><strong>{summary.openDefects}</strong></article></div>
    <div className="pms-inspection-view-switcher" role="group" aria-label={text.viewMode}>
      <button aria-pressed={viewMode === 'list'} type="button" onClick={() => setViewMode('list')}><List aria-hidden="true" size={17} />{text.listView}</button>
      <button aria-pressed={viewMode === 'calendar'} type="button" onClick={() => setViewMode('calendar')}><CalendarDays aria-hidden="true" size={17} />{text.calendarView}</button>
      <button aria-pressed={viewMode === 'kanban'} type="button" onClick={() => setViewMode('kanban')}><Columns3 aria-hidden="true" size={17} />{text.kanbanView}</button>
    </div>
    {loading ? <p className="pms-inspection-workspace__state">{text.loading}</p> : null}
    {error ? <p className="form-alert form-alert--error" role="alert">{error}</p> : null}
    {!loading && !error && runs.length === 0 ? <PortalEmpty title={text.noRuns} message={text.noRunsMessage} /> : null}
    {!loading && !error && runs.length > 0 && viewMode === 'list' ? <div className="pms-inspection-results" aria-label={text.resultsLabel}>{runs.map((run) => <article className="pms-inspection-card" key={run.id}><header><div><span className={`status-pill status-pill--${run.status.toLowerCase()}`}>{enumLabel(run.status, language)}</span><h3>{run.title}</h3><p>{run.template?.name ?? enumLabel(run.type, language)} · {run.property.name}{run.unit ? ` · ${run.unit.unitNumber}` : ''}</p></div><ClipboardCheck aria-hidden="true" size={24} /></header><dl><div><dt>{text.scheduled}</dt><dd>{formatDate(run.scheduledFor, language, true)}</dd></div><div><dt>{text.completed}</dt><dd>{formatDate(run.completedAt, language, true)}</dd></div><div><dt>{text.defects}</dt><dd>{run._count?.defects ?? run.defects.length}</dd></div><div><dt>{text.documents}</dt><dd>{run._count?.pmsDocuments ?? 0}</dd></div></dl><div className="pms-inspection-card__actions"><button className="button-link button-link--secondary" type="button" onClick={(event) => void openDetails(run, event.currentTarget)}><Eye aria-hidden="true" size={17} />{text.view}</button></div></article>)}</div> : null}
    {!loading && !error && runs.length > 0 && viewMode === 'calendar' ? <div className="pms-inspection-calendar"><table><caption>{text.calendarView} · {text.resultsLabel}</caption><thead><tr><th scope="col">{text.scheduled}</th><th scope="col">{text.runTitle}</th><th scope="col">{text.property}</th><th scope="col">{text.status}</th><th scope="col">{text.view}</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td>{formatDate(run.scheduledFor, language, true)}</td><th scope="row">{run.title}</th><td>{run.property.name}{run.unit ? ` · ${run.unit.unitNumber}` : ''}</td><td>{enumLabel(run.status, language)}</td><td><button className="button-link button-link--secondary" type="button" onClick={(event) => void openDetails(run, event.currentTarget)}>{text.view}</button></td></tr>)}</tbody></table></div> : null}
    {!loading && !error && runs.length > 0 && viewMode === 'kanban' ? <div className="pms-inspection-kanban" aria-label={`${text.kanbanView} · ${text.resultsLabel}`}>{statuses.map((status) => <section key={status} aria-labelledby={`inspection-column-${status}`}><header><h3 id={`inspection-column-${status}`}>{enumLabel(status, language)}</h3><span>{runs.filter((run) => run.status === status).length}</span></header>{runs.filter((run) => run.status === status).map((run) => <article key={run.id}><strong>{run.title}</strong><span>{run.property.name}</span><small>{formatDate(run.scheduledFor, language, true)}</small><button className="button-link button-link--secondary" type="button" onClick={(event) => void openDetails(run, event.currentTarget)}>{text.view}</button></article>)}</section>)}</div> : null}
    <nav aria-label={text.resultsLabel} className="pms-inspection-pagination"><button className="button-link button-link--secondary" disabled={page <= 1} type="button" onClick={() => setPage(page - 1)}>{language === 'ar' ? <ChevronRight aria-hidden="true" size={17} /> : <ChevronLeft aria-hidden="true" size={17} />}{text.previous}</button><span>{text.pageRange(from, to, pagination.total)}</span><button className="button-link button-link--secondary" disabled={page >= pageCount} type="button" onClick={() => setPage(page + 1)}>{text.next}{language === 'ar' ? <ChevronLeft aria-hidden="true" size={17} /> : <ChevronRight aria-hidden="true" size={17} />}</button></nav>

    <AccessibleDialog open={scheduleOpen} title={text.scheduleTitle} description={text.scheduleDescription} closeLabel={text.close} onClose={() => setScheduleOpen(false)} initialFocusRef={titleRef} returnFocusRef={returnFocusRef} size="large"><form className="pms-inspection-form" onSubmit={submitSchedule}>{scheduleError ? <p className="form-alert form-alert--error" role="alert">{scheduleError}</p> : null}<label><span>{text.runTitle}</span><input ref={titleRef} value={scheduleForm.title} onChange={(event) => setScheduleForm((current) => ({ ...current, title: event.target.value }))} required /></label><label><span>{text.property}</span><select value={scheduleForm.propertyId} onChange={(event) => { const propertyId = event.target.value; const available = templates.filter((template) => !template.propertyId || template.propertyId === propertyId); setScheduleForm((current) => ({ ...current, propertyId, unitId: '', templateId: available.some((template) => template.id === current.templateId) ? current.templateId : available[0]?.id ?? '' })); }} required>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label><span>{text.template}</span><select value={scheduleForm.templateId} onChange={(event) => setScheduleForm((current) => ({ ...current, templateId: event.target.value }))} required><option value="">{text.chooseTemplate}</option>{scheduleTemplates.map((template) => <option key={template.id} value={template.id}>{template.name} · {text.templateVersion(template.version)}</option>)}</select></label><label><span>{text.unit}</span><select value={scheduleForm.unitId} onChange={(event) => setScheduleForm((current) => ({ ...current, unitId: event.target.value }))}><option value="">{text.propertyWide}</option>{scheduleUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}</select></label><label><span>{text.scheduledFor}</span><input type="datetime-local" value={scheduleForm.scheduledFor} onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledFor: event.target.value }))} /></label><label className="pms-inspection-form__wide"><span>{text.notes}</span><textarea value={scheduleForm.notes} onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))} /></label><div className="pms-inspection-form__actions"><button className="button-link button-link--secondary" type="button" onClick={() => setScheduleOpen(false)}>{text.close}</button><button className="button-link" disabled={saving} type="submit">{saving ? text.saving : text.saveSchedule}</button></div></form></AccessibleDialog>

    <AccessibleDialog open={Boolean(selectedRun)} title={selectedRun ? text.detailsTitle(selectedRun.title) : text.title} description={text.detailsDescription} closeLabel={text.close} onClose={() => { setSelectedRun(null); setDetailsError(''); }} returnFocusRef={returnFocusRef} size="large">{selectedRun ? <div className="pms-inspection-detail">{detailsLoading || (!detailsError && !hasInspectionDetail) ? <p>{text.loading}</p> : detailsError ? <p className="form-alert form-alert--error" role="alert">{detailsError}</p> : <><header><div><span className={`status-pill status-pill--${selectedRun.status.toLowerCase()}`}>{enumLabel(selectedRun.status, language)}</span><h3>{selectedRun.title}</h3><p>{selectedRun.property.name}{selectedRun.unit ? ` · ${selectedRun.unit.unitNumber}` : ''} · {enumLabel(selectedRun.type, language)}</p></div><div className="pms-inspection-detail__actions">{canManage && selectedRun.status === 'SCHEDULED' ? <><button className="button-link" type="button" onClick={(event) => openExecution(event.currentTarget)}><CheckCircle2 aria-hidden="true" size={17} />{text.execute}</button><button className="button-link button-link--secondary" type="button" onClick={(event) => openCancel(event.currentTarget)}>{text.cancel}</button></> : null}</div></header>{conversionNotice ? <p className="form-alert form-alert--success" role="status">{conversionNotice}</p> : null}<section><h4>{text.checklist}</h4>{selectedSections.map((section) => <article className="pms-inspection-section" key={section.id}><h5>{section.title}</h5>{section.description ? <p>{section.description}</p> : null}<ul>{section.items.map((item) => <li key={item.id}>{item.label}{item.required ? ' *' : ''}{item.requiresPhotoOnFailure ? ' · 📷' : ''}</li>)}</ul></article>)}</section><section><h4>{text.resultEvidence}</h4>{selectedResults.length === 0 ? <p>{text.noResults}</p> : <div className="pms-inspection-records">{selectedResults.map((result) => <article key={result.id}><header><strong>{result.templateItem.label}</strong><span className={`status-pill status-pill--${result.result.toLowerCase()}`}>{enumLabel(result.result, language)}</span></header>{result.valueText ? <p>{result.valueText}</p> : null}{result.notes ? <small>{result.notes}</small> : null}<div><b>{text.photos}</b>{result.photoUrls.length ? <ul>{result.photoUrls.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul> : <span>{text.noPhotos}</span>}</div></article>)}</div>}</section><section><h4>{text.openDefects}</h4>{selectedDefects.length === 0 ? <p>—</p> : <div className="pms-inspection-defects">{selectedDefects.map((defect) => <article key={defect.id}><header><div><strong>{defect.title}</strong><span>{enumLabel(defect.severity, language)} · {enumLabel(defect.status, language)}</span></div><ShieldAlert aria-hidden="true" size={20} /></header>{defect.description ? <p>{defect.description}</p> : null}{defect.workOrder ? <p className="form-alert form-alert--success">{text.orderReference(defect.workOrder.id)}</p> : canManage && defect.status === 'OPEN' ? <button className="button-link button-link--secondary" type="button" onClick={(event) => openConversion(defect, event.currentTarget)}><Wrench aria-hidden="true" size={17} />{text.createWorkOrder}</button> : null}</article>)}</div>}</section></>}</div> : null}</AccessibleDialog>

    <AccessibleDialog open={executeOpen} title={text.executeTitle} description={text.executeDescription} closeLabel={text.close} onClose={() => setExecuteOpen(false)} initialFocusRef={acknowledgementRef} returnFocusRef={returnFocusRef} size="large"><form className="pms-inspection-execution" onSubmit={submitExecution}>{executionError ? <p className="form-alert form-alert--error" role="alert">{executionError}</p> : null}<label><span>{text.acknowledgement}</span><input ref={acknowledgementRef} value={acknowledgement} onChange={(event) => setAcknowledgement(event.target.value)} /></label>{selectedSections.map((section) => <fieldset key={section.id}><legend>{section.title}</legend>{section.items.map((item) => { const state = execution[item.id] ?? emptyExecution({ ...selectedRun!.template!, sections: [{ ...section, items: [item] }] })[item.id]; return <article className="pms-inspection-execution__item" key={item.id}><header><div><strong>{item.label}{item.required ? ' *' : ''}</strong>{item.instructions ? <small>{item.instructions}</small> : null}</div>{item.requiresPhotoOnFailure ? <span>📷</span> : null}</header><div className="pms-inspection-execution__grid"><label><span>{text.outcome}</span><select value={state.result} onChange={(event) => updateExecution(item.id, { result: event.target.value as PmsInspectionItemResult | '' })} required={item.required}><option value="">{text.selectOutcome}</option>{outcomes.map((outcome) => <option key={outcome} value={outcome}>{enumLabel(outcome, language)}</option>)}</select></label><label><span>{text.value}</span><input value={state.valueText} onChange={(event) => updateExecution(item.id, { valueText: event.target.value })} /></label><label><span>{text.resultNotes}</span><textarea value={state.notes} onChange={(event) => updateExecution(item.id, { notes: event.target.value })} /></label><label><span>{text.photoUrls}</span><textarea value={state.photoUrls} onChange={(event) => updateExecution(item.id, { photoUrls: event.target.value })} /></label></div>{state.result === 'FAIL' || state.result === 'OBSERVATION' ? <div className="pms-inspection-execution__defect"><label className="pms-inspection-check"><input type="checkbox" checked={state.createDefect} onChange={(event) => updateExecution(item.id, { createDefect: event.target.checked })} /><span>{text.addDefect}</span></label>{state.createDefect ? <div className="pms-inspection-execution__grid"><label><span>{text.defectTitle}</span><input value={state.defectTitle} onChange={(event) => updateExecution(item.id, { defectTitle: event.target.value })} required /></label><label><span>{text.severity}</span><select value={state.defectSeverity} onChange={(event) => updateExecution(item.id, { defectSeverity: event.target.value as PmsMaintenancePriority })}>{priorities.map((priority) => <option key={priority} value={priority}>{enumLabel(priority, language)}</option>)}</select></label><label><span>{text.defectDescription}</span><textarea value={state.defectDescription} onChange={(event) => updateExecution(item.id, { defectDescription: event.target.value })} /></label><label><span>{text.defectPhotoUrls}</span><textarea value={state.defectPhotoUrls} onChange={(event) => updateExecution(item.id, { defectPhotoUrls: event.target.value })} /></label></div> : null}</div> : null}</article>; })}</fieldset>)}<div className="pms-inspection-form__actions"><button className="button-link button-link--secondary" type="button" onClick={() => setExecuteOpen(false)}>{text.close}</button><button className="button-link" disabled={completing} type="submit">{completing ? text.completing : text.complete}</button></div></form></AccessibleDialog>

    <AccessibleDialog open={cancelOpen} title={text.cancelTitle} description={text.cancelDescription} closeLabel={text.close} onClose={() => setCancelOpen(false)} initialFocusRef={cancelReasonRef} returnFocusRef={returnFocusRef}><form className="pms-inspection-form" onSubmit={submitCancel}><label className="pms-inspection-form__wide"><span>{text.reason}</span><textarea ref={cancelReasonRef} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required minLength={3} /></label><div className="pms-inspection-form__actions"><button className="button-link button-link--secondary" type="button" onClick={() => setCancelOpen(false)}>{text.close}</button><button className="button-link button-link--danger" disabled={cancelling || cancelReason.trim().length < 3} type="submit">{cancelling ? text.cancelling : text.confirmCancel}</button></div></form></AccessibleDialog>

    <AccessibleDialog open={Boolean(conversionDefect)} title={text.conversionTitle} description={text.conversionDescription} closeLabel={text.close} onClose={() => setConversionDefect(null)} initialFocusRef={vendorRef} returnFocusRef={returnFocusRef}><form className="pms-inspection-form" onSubmit={submitConversion}>{conversionError ? <p className="form-alert form-alert--error" role="alert">{conversionError}</p> : null}<label><span>{text.vendor}</span><select ref={vendorRef} value={conversionForm.vendorId} onChange={(event) => setConversionForm((current) => ({ ...current, vendorId: event.target.value }))}><option value="">{text.noVendor}</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label><label><span>{text.asset}</span><select value={conversionForm.assetId} onChange={(event) => setConversionForm((current) => ({ ...current, assetId: event.target.value }))}><option value="">{text.noAsset}</option>{conversionAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetCode} · {asset.name}</option>)}</select></label><label><span>{text.scheduledFor}</span><input type="datetime-local" value={conversionForm.scheduledFor} onChange={(event) => setConversionForm((current) => ({ ...current, scheduledFor: event.target.value }))} /></label><label><span>{text.targetDate}</span><input type="date" value={conversionForm.targetDate} onChange={(event) => setConversionForm((current) => ({ ...current, targetDate: event.target.value }))} /></label><div className="pms-inspection-form__actions"><button className="button-link button-link--secondary" type="button" onClick={() => setConversionDefect(null)}>{text.close}</button><button className="button-link" disabled={converting} type="submit">{converting ? text.creatingOrder : text.createOrder}</button></div></form></AccessibleDialog>
  </section>;
}

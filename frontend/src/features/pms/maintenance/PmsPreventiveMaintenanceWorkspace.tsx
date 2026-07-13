import { CalendarClock, ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search, WandSparkles, Wrench } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import {
  createPmsMaintenancePlan,
  generateDuePmsMaintenanceWorkOrders,
  listPmsAssets,
  listPmsMaintenancePlans,
  updatePmsMaintenancePlan,
  type PmsAsset,
  type PmsMaintenancePlan,
  type PmsMaintenancePlanPayload,
  type PmsMaintenancePlanStatus,
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
const statuses: PmsMaintenancePlanStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];
const priorities: PmsMaintenancePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const sortOptions = ['nextServiceDate:asc', 'priority:desc', 'title:asc', 'updatedAt:desc'] as const;

type Language = 'en' | 'ar';
type SortValue = typeof sortOptions[number];
type FormState = {
  propertyId: string;
  unitId: string;
  assetId: string;
  vendorId: string;
  title: string;
  description: string;
  status: PmsMaintenancePlanStatus;
  recurrence: 'ONCE' | 'INTERVAL';
  intervalDays: string;
  nextServiceDate: string;
  checklist: string;
  slaHours: string;
  priority: PmsMaintenancePriority;
  estimatedCost: string;
  currency: string;
};

type Props = {
  token: string;
  companyId: string;
  language: Language;
  canManage: boolean;
  canGenerateAcrossCompany: boolean;
  onSummaryChange?: (summary: { active: number; due: number; total: number }) => void;
};

const copy = {
  en: {
    eyebrow: 'Preventive maintenance',
    title: 'Preventive-maintenance plans',
    description: 'Schedule recurring or one-time work, preserve generation history, and create due work orders idempotently.',
    add: 'Create plan',
    generate: 'Generate due work orders',
    search: 'Search plan, property, unit, asset, or vendor',
    property: 'Property',
    allProperties: 'All properties',
    status: 'Status',
    allStatuses: 'All statuses',
    dueOnly: 'Due now',
    sort: 'Sort',
    apply: 'Apply filters',
    clear: 'Clear',
    loading: 'Loading preventive-maintenance plans…',
    failed: 'Preventive-maintenance plans could not be loaded.',
    noPlans: 'No plans match this view',
    noPlansMessage: 'Adjust the filters or create the first preventive-maintenance plan.',
    schedule: 'Schedule',
    assignment: 'Assignment',
    recurrence: 'Recurrence',
    generation: 'Generation history',
    actions: 'Actions',
    view: 'View plan',
    edit: 'Edit plan',
    previous: 'Previous',
    next: 'Next',
    pageRange: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
    permission: 'You can inspect preventive schedules, but your role cannot change or generate them.',
    scopedGeneration: 'Company-wide generation is unavailable because your access is property scoped.',
    filtersLabel: 'Preventive-maintenance plan filters',
    tableCaption: 'PMS preventive-maintenance plan results',
    createTitle: 'Create preventive-maintenance plan',
    editTitle: 'Edit preventive-maintenance plan',
    formDescription: 'The next due date, recurrence, checklist, SLA, vendor, asset, and estimated cost remain attached to the plan history.',
    close: 'Close dialog',
    unit: 'Unit',
    propertyWide: 'Property-wide plan',
    asset: 'Asset',
    noAsset: 'No linked asset',
    vendor: 'Vendor',
    noVendor: 'No assigned vendor',
    planTitle: 'Plan title',
    planDescription: 'Description',
    recurrenceMode: 'Recurrence mode',
    oneTime: 'One-time date',
    interval: 'Recurring interval',
    intervalDays: 'Interval in days',
    nextServiceDate: 'Next due date',
    nextAfterGeneration: 'Next date after generation',
    completesAfterGeneration: 'The plan completes after its one-time work order is generated.',
    checklist: 'Checklist, one item per line',
    slaHours: 'SLA in hours',
    priority: 'Priority',
    estimatedCost: 'Estimated cost',
    currency: 'Currency',
    save: 'Save plan',
    saving: 'Saving…',
    required: 'Complete the required plan fields and recurrence values.',
    detailsTitle: 'Plan details',
    detailsDescription: 'Schedule, assignment, checklist, and latest generated work orders.',
    workOrders: 'Generated work orders',
    noWorkOrders: 'No work orders have been generated from this plan.',
    latestCount: (shown: number, total: number) => `Showing latest ${shown} of ${total}`,
    generatedAt: 'Generated',
    target: 'Target',
    lastGenerated: 'Last generated',
    never: 'Never',
    generateTitle: 'Generate due preventive work orders',
    generateDescription: 'Creates at most one work order for each due plan and advances recurring schedules. Repeating the same run is idempotent.',
    asOf: 'Generate plans due on or before',
    confirmGenerate: 'Generate work orders',
    generating: 'Generating…',
    generatedResult: (count: number) => `${count} preventive work order${count === 1 ? '' : 's'} generated.`,
    generatedNone: 'No due plans required a new work order.',
  },
  ar: {
    eyebrow: 'الصيانة الوقائية',
    title: 'خطط الصيانة الوقائية',
    description: 'جدولة الأعمال المتكررة أو لمرة واحدة مع حفظ سجل التوليد وإنشاء أوامر العمل المستحقة دون تكرار.',
    add: 'إنشاء خطة',
    generate: 'توليد أوامر العمل المستحقة',
    search: 'ابحث بالخطة أو العقار أو الوحدة أو الأصل أو المورد',
    property: 'العقار',
    allProperties: 'كل العقارات',
    status: 'الحالة',
    allStatuses: 'كل الحالات',
    dueOnly: 'مستحق الآن',
    sort: 'الترتيب',
    apply: 'تطبيق المرشحات',
    clear: 'مسح',
    loading: 'جارٍ تحميل خطط الصيانة الوقائية…',
    failed: 'تعذر تحميل خطط الصيانة الوقائية.',
    noPlans: 'لا توجد خطط مطابقة',
    noPlansMessage: 'عدّل المرشحات أو أنشئ أول خطة صيانة وقائية.',
    schedule: 'الجدول',
    assignment: 'التعيين',
    recurrence: 'التكرار',
    generation: 'سجل التوليد',
    actions: 'الإجراءات',
    view: 'عرض الخطة',
    edit: 'تعديل الخطة',
    previous: 'السابق',
    next: 'التالي',
    pageRange: (from: number, to: number, total: number) => `${from}–${to} من ${total}`,
    permission: 'يمكنك استعراض الجداول الوقائية، لكن دورك لا يسمح بتعديلها أو توليدها.',
    scopedGeneration: 'التوليد على مستوى الشركة غير متاح لأن صلاحيتك محددة بعقارات معينة.',
    filtersLabel: 'مرشحات خطط الصيانة الوقائية',
    tableCaption: 'نتائج خطط الصيانة الوقائية في PMS',
    createTitle: 'إنشاء خطة صيانة وقائية',
    editTitle: 'تعديل خطة الصيانة الوقائية',
    formDescription: 'يبقى موعد الاستحقاق والتكرار والقائمة واتفاقية الخدمة والمورد والأصل والتكلفة المقدرة مرتبطاً بسجل الخطة.',
    close: 'إغلاق النافذة',
    unit: 'الوحدة',
    propertyWide: 'خطة على مستوى العقار',
    asset: 'الأصل',
    noAsset: 'دون أصل مرتبط',
    vendor: 'المورد',
    noVendor: 'دون مورد معيّن',
    planTitle: 'عنوان الخطة',
    planDescription: 'الوصف',
    recurrenceMode: 'نمط التكرار',
    oneTime: 'موعد لمرة واحدة',
    interval: 'فترة متكررة',
    intervalDays: 'الفترة بالأيام',
    nextServiceDate: 'موعد الاستحقاق القادم',
    nextAfterGeneration: 'الموعد التالي بعد التوليد',
    completesAfterGeneration: 'تكتمل الخطة بعد توليد أمر العمل لمرة واحدة.',
    checklist: 'قائمة الفحص، بند في كل سطر',
    slaHours: 'اتفاقية مستوى الخدمة بالساعات',
    priority: 'الأولوية',
    estimatedCost: 'التكلفة المقدرة',
    currency: 'العملة',
    save: 'حفظ الخطة',
    saving: 'جارٍ الحفظ…',
    required: 'أكمل حقول الخطة وقيم التكرار المطلوبة.',
    detailsTitle: 'تفاصيل الخطة',
    detailsDescription: 'الجدول والتعيين والقائمة وأحدث أوامر العمل المولدة.',
    workOrders: 'أوامر العمل المولدة',
    noWorkOrders: 'لم يتم توليد أوامر عمل من هذه الخطة.',
    latestCount: (shown: number, total: number) => `عرض أحدث ${shown} من ${total}`,
    generatedAt: 'تم التوليد',
    target: 'الموعد المستهدف',
    lastGenerated: 'آخر توليد',
    never: 'لم يتم',
    generateTitle: 'توليد أوامر عمل الصيانة الوقائية المستحقة',
    generateDescription: 'ينشئ أمر عمل واحداً كحد أقصى لكل خطة مستحقة ويقدّم الجداول المتكررة. إعادة التشغيل لن تنشئ تكراراً.',
    asOf: 'توليد الخطط المستحقة حتى تاريخ',
    confirmGenerate: 'توليد أوامر العمل',
    generating: 'جارٍ التوليد…',
    generatedResult: (count: number) => `تم توليد ${count} من أوامر العمل الوقائية.`,
    generatedNone: 'لا توجد خطط مستحقة تحتاج إلى أمر عمل جديد.',
  },
};

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function enumLabel(value: string, language: Language) {
  const labels: Record<string, { en: string; ar: string }> = {
    ACTIVE: { en: 'Active', ar: 'نشطة' },
    PAUSED: { en: 'Paused', ar: 'متوقفة مؤقتاً' },
    COMPLETED: { en: 'Completed', ar: 'مكتملة' },
    CANCELLED: { en: 'Cancelled', ar: 'ملغاة' },
    LOW: { en: 'Low', ar: 'منخفضة' },
    MEDIUM: { en: 'Medium', ar: 'متوسطة' },
    HIGH: { en: 'High', ar: 'مرتفعة' },
    URGENT: { en: 'Urgent', ar: 'عاجلة' },
    OPEN: { en: 'Open', ar: 'مفتوح' },
    IN_PROGRESS: { en: 'In progress', ar: 'قيد التنفيذ' },
    WAITING_VENDOR: { en: 'Waiting vendor', ar: 'بانتظار المورد' },
    RESOLVED: { en: 'Resolved', ar: 'مغلق' },
    nextServiceDate: { en: 'Next due date', ar: 'موعد الاستحقاق' },
    priority: { en: 'Priority', ar: 'الأولوية' },
    title: { en: 'Title', ar: 'العنوان' },
    updatedAt: { en: 'Recently updated', ar: 'آخر تحديث' },
    asc: { en: 'Ascending', ar: 'تصاعدي' },
    desc: { en: 'Descending', ar: 'تنازلي' },
  };
  return labels[value]?.[language] ?? value.replaceAll('_', ' ');
}

function formatDate(value: string | null | undefined, language: Language) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-OM', { dateStyle: 'medium' }).format(new Date(value));
}

function formatMoney(value: string | null | undefined, currency: string, language: Language) {
  if (!value) return '—';
  return new Intl.NumberFormat(language === 'ar' ? 'ar-OM' : 'en-OM', { style: 'currency', currency, maximumFractionDigits: 3 }).format(Number(value));
}

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  if (!value || !Number.isFinite(days)) return '';
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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

function emptyForm(propertyId = ''): FormState {
  return {
    propertyId,
    unitId: '',
    assetId: '',
    vendorId: '',
    title: '',
    description: '',
    status: 'ACTIVE',
    recurrence: 'INTERVAL',
    intervalDays: '90',
    nextServiceDate: todayInput(),
    checklist: '',
    slaHours: '',
    priority: 'MEDIUM',
    estimatedCost: '',
    currency: 'OMR',
  };
}

function planForm(plan: PmsMaintenancePlan): FormState {
  return {
    propertyId: plan.propertyId,
    unitId: plan.unitId ?? '',
    assetId: plan.assetId ?? '',
    vendorId: plan.vendorId ?? '',
    title: plan.title,
    description: plan.description ?? '',
    status: plan.status,
    recurrence: plan.intervalDays ? 'INTERVAL' : 'ONCE',
    intervalDays: plan.intervalDays?.toString() ?? '',
    nextServiceDate: plan.nextServiceDate.slice(0, 10),
    checklist: plan.checklist.join('\n'),
    slaHours: plan.slaHours?.toString() ?? '',
    priority: plan.priority,
    estimatedCost: plan.estimatedCost ?? '',
    currency: plan.currency,
  };
}

export default function PmsPreventiveMaintenanceWorkspace({ token, companyId, language, canManage, canGenerateAcrossCompany, onSummaryChange }: Props) {
  const text = copy[language];
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState<PmsMaintenancePlan[]>([]);
  const [pagination, setPagination] = useState({ take: PAGE_SIZE, skip: 0, count: 0, total: 0 });
  const [summary, setSummary] = useState({ active: 0, due: 0 });
  const [properties, setProperties] = useState<PmsProperty[]>([]);
  const [units, setUnits] = useState<PmsUnit[]>([]);
  const [assets, setAssets] = useState<PmsAsset[]>([]);
  const [vendors, setVendors] = useState<PmsVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PmsMaintenancePlan | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [asOf, setAsOf] = useState(todayInput());
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const asOfInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const page = Math.max(1, Number(searchParams.get('pmPage') ?? '1') || 1);
  const appliedSearch = searchParams.get('pmQ') ?? '';
  const appliedProperty = searchParams.get('pmProperty') ?? '';
  const appliedStatus = (searchParams.get('pmStatus') ?? '') as PmsMaintenancePlanStatus | '';
  const appliedDueOnly = searchParams.get('pmDue') === 'true';
  const appliedSort = (searchParams.get('pmSort') ?? 'nextServiceDate:asc') as SortValue;
  const [sortBy, direction] = appliedSort.split(':') as ['nextServiceDate' | 'priority' | 'title' | 'updatedAt', 'asc' | 'desc'];
  const [searchDraft, setSearchDraft] = useState(appliedSearch);
  const [propertyDraft, setPropertyDraft] = useState(appliedProperty);
  const [statusDraft, setStatusDraft] = useState<PmsMaintenancePlanStatus | ''>(appliedStatus);
  const [dueDraft, setDueDraft] = useState(appliedDueOnly);
  const [sortDraft, setSortDraft] = useState<SortValue>(appliedSort);

  useEffect(() => {
    setSearchDraft(appliedSearch);
    setPropertyDraft(appliedProperty);
    setStatusDraft(appliedStatus);
    setDueDraft(appliedDueOnly);
    setSortDraft(appliedSort);
  }, [appliedDueOnly, appliedProperty, appliedSearch, appliedSort, appliedStatus]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadAllProperties(token, companyId),
      loadAllUnits(token, companyId),
      loadAllAssets(token, companyId),
      loadAllVendors(token, companyId),
    ]).then(([propertyItems, unitItems, assetItems, vendorItems]) => {
      if (!active) return;
      setProperties(propertyItems);
      setUnits(unitItems);
      setAssets(assetItems);
      setVendors(vendorItems);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [companyId, token]);

  const loadPlans = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void listPmsMaintenancePlans(token, {
      companyId,
      propertyId: appliedProperty || undefined,
      status: appliedStatus || undefined,
      dueOnly: appliedDueOnly || undefined,
      search: appliedSearch || undefined,
      sortBy,
      direction,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      signal: controller.signal,
    }).then((result) => {
      setPlans(result.plans);
      setPagination(result.pagination);
      setSummary(result.summary);
      onSummaryChange?.({ ...result.summary, total: result.pagination.total });
      if (page > 1 && result.plans.length === 0 && result.pagination.total > 0) {
        const next = new URLSearchParams(searchParams);
        next.set('pmPage', String(Math.max(1, Math.ceil(result.pagination.total / PAGE_SIZE))));
        setSearchParams(next, { replace: true });
      }
    }).catch((loadError) => {
      if ((loadError as { name?: string }).name !== 'AbortError') setError(apiMessage(loadError, text.failed));
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [appliedDueOnly, appliedProperty, appliedSearch, appliedStatus, companyId, direction, onSummaryChange, page, searchParams, setSearchParams, sortBy, text.failed, token]);

  useEffect(() => loadPlans(), [loadPlans, reloadKey]);

  const filteredUnits = useMemo(() => units.filter((unit) => unit.propertyId === form.propertyId), [form.propertyId, units]);
  const filteredAssets = useMemo(() => assets.filter((asset) => asset.propertyId === form.propertyId && (!form.unitId || !asset.unitId || asset.unitId === form.unitId)), [assets, form.propertyId, form.unitId]);
  const recurrencePreview = form.recurrence === 'INTERVAL' && Number(form.intervalDays) > 0
    ? addDays(form.nextServiceDate, Number(form.intervalDays))
    : '';

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('pmPage'); else next.set('pmPage', String(nextPage));
    setSearchParams(next);
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const fields: Array<[string, string | null]> = [
      ['pmQ', searchDraft.trim() || null],
      ['pmProperty', propertyDraft || null],
      ['pmStatus', statusDraft || null],
      ['pmDue', dueDraft ? 'true' : null],
      ['pmSort', sortDraft === 'nextServiceDate:asc' ? null : sortDraft],
    ];
    fields.forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    next.delete('pmPage');
    setSearchParams(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    ['pmQ', 'pmProperty', 'pmStatus', 'pmDue', 'pmSort', 'pmPage'].forEach((key) => next.delete(key));
    setSearchParams(next);
  }

  function rememberTrigger(target: EventTarget | null) {
    returnFocusRef.current = target instanceof HTMLElement ? target : null;
  }

  function openCreate(target: EventTarget | null) {
    rememberTrigger(target);
    setEditingPlanId(null);
    setForm(emptyForm(appliedProperty || properties[0]?.id || ''));
    setFormError('');
    setFormMode('create');
  }

  function openEdit(plan: PmsMaintenancePlan, target: EventTarget | null) {
    rememberTrigger(target);
    setEditingPlanId(plan.id);
    setSelectedPlan(null);
    setForm(planForm(plan));
    setFormError('');
    setFormMode('edit');
  }

  async function submitPlan(event: FormEvent) {
    event.preventDefault();
    const interval = form.recurrence === 'INTERVAL' ? Number(form.intervalDays) : null;
    if (!form.propertyId || !form.title.trim() || !form.nextServiceDate || !form.currency.trim() || (form.recurrence === 'INTERVAL' && (!Number.isInteger(interval) || Number(interval) <= 0))) {
      setFormError(text.required);
      return;
    }
    const payload: PmsMaintenancePlanPayload = {
      companyId,
      propertyId: form.propertyId,
      unitId: form.unitId || null,
      assetId: form.assetId || null,
      vendorId: form.vendorId || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      intervalDays: interval,
      nextServiceDate: form.nextServiceDate,
      checklist: form.checklist.split('\n').map((item) => item.trim()).filter(Boolean),
      slaHours: form.slaHours ? Number(form.slaHours) : null,
      priority: form.priority,
      estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
      currency: form.currency.trim().toUpperCase(),
    };
    setSaving(true);
    setFormError('');
    try {
      if (formMode === 'edit' && editingPlanId) await updatePmsMaintenancePlan(token, editingPlanId, payload);
      else await createPmsMaintenancePlan(token, payload);
      setFormMode(null);
      setEditingPlanId(null);
      setSelectedPlan(null);
      setReloadKey((value) => value + 1);
    } catch (submitError) {
      setFormError(apiMessage(submitError, text.failed));
    } finally {
      setSaving(false);
    }
  }

  function openDetails(plan: PmsMaintenancePlan, target: EventTarget | null) {
    rememberTrigger(target);
    setSelectedPlan(plan);
  }

  function startEditFromDetails() {
    if (!selectedPlan) return;
    setEditingPlanId(selectedPlan.id);
    setForm(planForm(selectedPlan));
    setFormError('');
    setFormMode('edit');
  }

  async function submitGeneration(event: FormEvent) {
    event.preventDefault();
    setGenerating(true);
    setGenerateError('');
    try {
      const result = await generateDuePmsMaintenanceWorkOrders(token, { companyId, asOf });
      setNotice(result.generated.length ? text.generatedResult(result.generated.length) : text.generatedNone);
      setGenerateOpen(false);
      setReloadKey((value) => value + 1);
    } catch (generationError) {
      setGenerateError(apiMessage(generationError, text.failed));
    } finally {
      setGenerating(false);
    }
  }

  const from = pagination.total === 0 ? 0 : pagination.skip + 1;
  const to = pagination.skip + pagination.count;

  return (
    <section className="pms-plan-register" aria-labelledby="preventive-plans-title">
      <header className="pms-plan-register__header">
        <div><p className="eyebrow">{text.eyebrow}</p><h2 id="preventive-plans-title">{text.title}</h2><p>{text.description}</p></div>
        {canManage ? <div className="pms-plan-register__header-actions">
          <button className="button-link button-link--secondary" onClick={(event) => openCreate(event.currentTarget)} type="button"><Plus aria-hidden="true" size={18} />{text.add}</button>
          {canGenerateAcrossCompany ? <button className="button-link" onClick={(event) => { rememberTrigger(event.currentTarget); setGenerateError(''); setGenerateOpen(true); }} type="button"><WandSparkles aria-hidden="true" size={18} />{text.generate}</button> : null}
        </div> : null}
      </header>
      {!canManage ? <p className="pms-plan-register__permission">{text.permission}</p> : null}
      {canManage && !canGenerateAcrossCompany ? <p className="pms-plan-register__permission">{text.scopedGeneration}</p> : null}
      {notice ? <p className="pms-plan-register__notice" role="status">{notice}</p> : null}

      <form aria-label={text.filtersLabel} className="pms-plan-filters" onSubmit={applyFilters}>
        <label className="pms-plan-filters__search"><span>{text.search}</span><div><Search aria-hidden="true" size={17} /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /></div></label>
        <label><span>{text.property}</span><select value={propertyDraft} onChange={(event) => setPropertyDraft(event.target.value)}><option value="">{text.allProperties}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <label><span>{text.status}</span><select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as PmsMaintenancePlanStatus | '')}><option value="">{text.allStatuses}</option>{statuses.map((status) => <option key={status} value={status}>{enumLabel(status, language)}</option>)}</select></label>
        <label><span>{text.sort}</span><select value={sortDraft} onChange={(event) => setSortDraft(event.target.value as SortValue)}>{sortOptions.map((option) => { const [field, order] = option.split(':'); return <option key={option} value={option}>{enumLabel(field, language)} · {enumLabel(order, language)}</option>; })}</select></label>
        <label className="pms-plan-filters__check"><input checked={dueDraft} onChange={(event) => setDueDraft(event.target.checked)} type="checkbox" /><span>{text.dueOnly}</span></label>
        <div className="pms-plan-filters__actions"><button className="button-link" type="submit">{text.apply}</button><button className="button-link button-link--secondary" onClick={clearFilters} type="button">{text.clear}</button></div>
      </form>

      <div className="pms-plan-summary" aria-label={text.title}>
        <div><span>{enumLabel('ACTIVE', language)}</span><strong>{summary.active}</strong></div>
        <div><span>{text.dueOnly}</span><strong>{summary.due}</strong></div>
        <div><span>{text.generation}</span><strong>{pagination.total}</strong></div>
      </div>

      {loading ? <div className="pms-plan-register__state">{text.loading}</div> : null}
      {error ? <div className="pms-plan-register__state pms-plan-register__state--error" role="alert">{error}</div> : null}
      {!loading && !error && plans.length === 0 ? <PortalEmpty title={text.noPlans} message={text.noPlansMessage} /> : null}
      {!loading && !error && plans.length > 0 ? <>
        <div className="pms-plan-table-wrap"><table className="pms-plan-table"><caption>{text.tableCaption}</caption><thead><tr><th>{text.title}</th><th>{text.schedule}</th><th>{text.assignment}</th><th>{text.recurrence}</th><th>{text.generation}</th><th>{text.actions}</th></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id}>
          <td data-label={text.title}><strong>{plan.title}</strong><small><span className={`pms-plan-status pms-plan-status--${plan.status.toLowerCase()}`}>{enumLabel(plan.status, language)}</span> · {enumLabel(plan.priority, language)}</small></td>
          <td data-label={text.schedule}><strong>{formatDate(plan.nextServiceDate, language)}</strong><small>{plan.slaHours ? `${plan.slaHours}h SLA` : '—'}</small></td>
          <td data-label={text.assignment}><strong>{plan.property.name}{plan.unit ? ` · ${plan.unit.unitNumber}` : ''}</strong><small>{plan.asset ? `${plan.asset.assetCode} · ${plan.asset.name}` : plan.vendor?.name ?? '—'}</small></td>
          <td data-label={text.recurrence}><strong>{plan.intervalDays ? `${plan.intervalDays} ${language === 'ar' ? 'يوم' : 'days'}` : text.oneTime}</strong><small>{formatMoney(plan.estimatedCost, plan.currency, language)}</small></td>
          <td data-label={text.generation}><strong>{plan._count.workOrders}</strong><small>{text.lastGenerated}: {plan.lastGeneratedAt ? formatDate(plan.lastGeneratedAt, language) : text.never}</small></td>
          <td data-label={text.actions}><div className="pms-plan-row-actions"><button aria-label={text.view} onClick={(event) => openDetails(plan, event.currentTarget)} type="button"><Eye aria-hidden="true" size={16} />{text.view}</button>{canManage ? <button aria-label={text.edit} onClick={(event) => { setSelectedPlan(plan); openEdit(plan, event.currentTarget); }} type="button"><Pencil aria-hidden="true" size={16} />{text.edit}</button> : null}</div></td>
        </tr>)}</tbody></table></div>
        <nav aria-label={text.tableCaption} className="pms-plan-pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button"><ChevronLeft aria-hidden="true" size={16} />{text.previous}</button><span>{text.pageRange(from, to, pagination.total)}</span><button disabled={to >= pagination.total} onClick={() => setPage(page + 1)} type="button">{text.next}<ChevronRight aria-hidden="true" size={16} /></button></nav>
      </> : null}

      <AccessibleDialog closeLabel={text.close} description={text.formDescription} initialFocusRef={titleInputRef} onClose={() => { setFormMode(null); setEditingPlanId(null); }} open={formMode !== null} returnFocusRef={returnFocusRef} size="large" title={formMode === 'edit' ? text.editTitle : text.createTitle}>
        <form className="pms-plan-form" onSubmit={submitPlan}>
          {formError ? <p className="pms-plan-form__error" role="alert">{formError}</p> : null}
          <label><span>{text.property}</span><select required value={form.propertyId} onChange={(event) => setForm((current) => ({ ...current, propertyId: event.target.value, unitId: '', assetId: '' }))}><option value="">—</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label><span>{text.unit}</span><select value={form.unitId} onChange={(event) => setForm((current) => ({ ...current, unitId: event.target.value, assetId: current.assetId && filteredAssets.some((asset) => asset.id === current.assetId && (!event.target.value || !asset.unitId || asset.unitId === event.target.value)) ? current.assetId : '' }))}><option value="">{text.propertyWide}</option>{filteredUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}</select></label>
          <label><span>{text.asset}</span><select value={form.assetId} onChange={(event) => setForm((current) => ({ ...current, assetId: event.target.value }))}><option value="">{text.noAsset}</option>{filteredAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetCode} · {asset.name}</option>)}</select></label>
          <label><span>{text.vendor}</span><select value={form.vendorId} onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))}><option value="">{text.noVendor}</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.trade ? ` · ${vendor.trade}` : ''}</option>)}</select></label>
          <label className="pms-plan-form__wide"><span>{text.planTitle}</span><input ref={titleInputRef} required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
          <label className="pms-plan-form__wide"><span>{text.planDescription}</span><textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <label><span>{text.status}</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PmsMaintenancePlanStatus }))}>{statuses.map((status) => <option key={status} value={status}>{enumLabel(status, language)}</option>)}</select></label>
          <label><span>{text.priority}</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as PmsMaintenancePriority }))}>{priorities.map((priority) => <option key={priority} value={priority}>{enumLabel(priority, language)}</option>)}</select></label>
          <label><span>{text.recurrenceMode}</span><select value={form.recurrence} onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value as FormState['recurrence'] }))}><option value="INTERVAL">{text.interval}</option><option value="ONCE">{text.oneTime}</option></select></label>
          {form.recurrence === 'INTERVAL' ? <label><span>{text.intervalDays}</span><input min="1" max="3650" required type="number" value={form.intervalDays} onChange={(event) => setForm((current) => ({ ...current, intervalDays: event.target.value }))} /></label> : <div />}
          <label><span>{text.nextServiceDate}</span><input required type="date" value={form.nextServiceDate} onChange={(event) => setForm((current) => ({ ...current, nextServiceDate: event.target.value }))} /></label>
          <p className="pms-plan-form__context">{form.recurrence === 'INTERVAL' ? `${text.nextAfterGeneration}: ${recurrencePreview ? formatDate(recurrencePreview, language) : '—'}` : text.completesAfterGeneration}</p>
          <label className="pms-plan-form__wide"><span>{text.checklist}</span><textarea rows={5} value={form.checklist} onChange={(event) => setForm((current) => ({ ...current, checklist: event.target.value }))} /></label>
          <label><span>{text.slaHours}</span><input min="1" type="number" value={form.slaHours} onChange={(event) => setForm((current) => ({ ...current, slaHours: event.target.value }))} /></label>
          <label><span>{text.estimatedCost}</span><input min="0" step="0.001" type="number" value={form.estimatedCost} onChange={(event) => setForm((current) => ({ ...current, estimatedCost: event.target.value }))} /></label>
          <label><span>{text.currency}</span><input maxLength={3} required value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label>
          <div className="pms-plan-form__actions"><button className="button-link button-link--secondary" onClick={() => { setFormMode(null); setEditingPlanId(null); }} type="button">{text.close}</button><button className="button-link" disabled={saving} type="submit"><Wrench aria-hidden="true" size={17} />{saving ? text.saving : text.save}</button></div>
        </form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={text.close} description={text.detailsDescription} onClose={() => setSelectedPlan(null)} open={selectedPlan !== null && formMode === null} returnFocusRef={returnFocusRef} size="large" title={text.detailsTitle}>
        {selectedPlan ? <div className="pms-plan-detail">
          <div className="pms-plan-detail__summary"><div><span>{text.title}</span><strong>{selectedPlan.title}</strong></div><div><span>{text.schedule}</span><strong>{formatDate(selectedPlan.nextServiceDate, language)}</strong></div><div><span>{text.assignment}</span><strong>{selectedPlan.property.name}{selectedPlan.unit ? ` · ${selectedPlan.unit.unitNumber}` : ''}</strong></div><div><span>{text.recurrence}</span><strong>{selectedPlan.intervalDays ? `${selectedPlan.intervalDays} ${language === 'ar' ? 'يوم' : 'days'}` : text.oneTime}</strong></div><div><span>{text.lastGenerated}</span><strong>{selectedPlan.lastGeneratedAt ? formatDate(selectedPlan.lastGeneratedAt, language) : text.never}</strong></div><div><span>{text.estimatedCost}</span><strong>{formatMoney(selectedPlan.estimatedCost, selectedPlan.currency, language)}</strong></div></div>
          {selectedPlan.description ? <p>{selectedPlan.description}</p> : null}
          {selectedPlan.checklist.length ? <section><h3>{text.checklist}</h3><ul>{selectedPlan.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
          <section><h3><CalendarClock aria-hidden="true" size={18} />{text.workOrders}</h3>{selectedPlan.workOrders.length ? <><p className="pms-summary-count">{text.latestCount(selectedPlan.workOrders.length, selectedPlan._count.workOrders)}</p><ol className="pms-plan-history">{selectedPlan.workOrders.map((workOrder) => <li key={workOrder.id}><div><strong>{workOrder.title}</strong><span className="pms-plan-status">{enumLabel(workOrder.status, language)}</span></div><p>{text.generatedAt}: {formatDate(workOrder.createdAt, language)} · {text.target}: {formatDate(workOrder.targetDate ?? workOrder.scheduledFor, language)}</p></li>)}</ol></> : <PortalEmpty title={text.workOrders} message={text.noWorkOrders} />}</section>
          {canManage ? <div className="pms-plan-detail__actions"><button className="button-link" onClick={startEditFromDetails} type="button"><Pencil aria-hidden="true" size={17} />{text.edit}</button></div> : null}
        </div> : null}
      </AccessibleDialog>

      <AccessibleDialog closeLabel={text.close} description={text.generateDescription} initialFocusRef={asOfInputRef} onClose={() => setGenerateOpen(false)} open={generateOpen} returnFocusRef={returnFocusRef} title={text.generateTitle}>
        <form className="pms-plan-generate" onSubmit={submitGeneration}>{generateError ? <p className="pms-plan-form__error" role="alert">{generateError}</p> : null}<label><span>{text.asOf}</span><input ref={asOfInputRef} required type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></label><div className="pms-plan-form__actions"><button className="button-link button-link--secondary" onClick={() => setGenerateOpen(false)} type="button">{text.close}</button><button className="button-link" disabled={generating} type="submit"><WandSparkles aria-hidden="true" size={17} />{generating ? text.generating : text.confirmGenerate}</button></div></form>
      </AccessibleDialog>
    </section>
  );
}

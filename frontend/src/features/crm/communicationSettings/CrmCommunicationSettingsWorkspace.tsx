import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileClock,
  MailCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import type { CrmWorkspaceAccess } from '../../../api/crm';
import {
  archiveCrmCommunicationTemplate,
  createCrmCommunicationTemplate,
  createCrmCommunicationTemplateVersion,
  getCrmCommunicationPolicy,
  listCrmCommunicationTemplates,
  listCrmSuppressions,
  updateCrmCommunicationPolicy,
  upsertCrmSuppression,
  type CrmCommunicationPolicy,
  type CrmCommunicationTemplate,
  type CrmCommunicationTemplateStatus,
  type CrmSuppressionEntry,
  type CrmSuppressionReason,
  type CrmSuppressionStatus
} from '../../../api/crmAdvanced';
import type { CrmCommunicationChannel } from '../../../generated/crmContract';
import { useAuth } from '../../../auth/AuthContext';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useLanguage } from '../../../i18n/LanguageContext';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../WorkspaceSelector';

const PAGE_SIZE = 20;
const channels: CrmCommunicationChannel[] = ['EMAIL', 'WHATSAPP', 'PHONE'];
const reasons: CrmSuppressionReason[] = ['OPT_OUT', 'BOUNCE', 'COMPLAINT', 'INVALID_DESTINATION', 'MANUAL', 'LEGAL'];

type GovernanceTab = 'policy' | 'suppressions' | 'templates';
type Direction = 'asc' | 'desc';
type SuppressionSort = 'updatedAt' | 'normalizedDestination' | 'reason';
type TemplateSort = 'name' | 'updatedAt' | 'createdAt';

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'CRM communication governance operation failed.';
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
      label: language === 'ar' ? 'CRM مشغل lux.om' : 'lux.om operator CRM',
      canManage: true,
      canManageWorkspace: true,
      propertyScope: platform.propertyScope
    });
  }
  return values;
}

function safeTab(value: string | null): GovernanceTab {
  return value === 'suppressions' || value === 'templates' ? value : 'policy';
}

function safeDirection(value: string | null, fallback: Direction): Direction {
  return value === 'asc' || value === 'desc' ? value : fallback;
}

function safeSuppressionStatus(value: string | null): CrmSuppressionStatus {
  return value === 'ACTIVE' || value === 'INACTIVE' ? value : 'ALL';
}

function safeTemplateStatus(value: string | null): CrmCommunicationTemplateStatus {
  return value === 'ACTIVE' || value === 'ARCHIVED' ? value : 'ALL';
}

function safeChannel(value: string | null): CrmCommunicationChannel | '' {
  return channels.includes(value as CrmCommunicationChannel) ? value as CrmCommunicationChannel : '';
}

function safeReason(value: string | null): CrmSuppressionReason | '' {
  return reasons.includes(value as CrmSuppressionReason) ? value as CrmSuppressionReason : '';
}

function safeSuppressionSort(value: string | null): SuppressionSort {
  return value === 'normalizedDestination' || value === 'reason' ? value : 'updatedAt';
}

function safeTemplateSort(value: string | null): TemplateSort {
  return value === 'updatedAt' || value === 'createdAt' ? value : 'name';
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatMinute(value: number) {
  const normalized = Math.max(0, Math.min(1439, value));
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const minutes = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function suppressionIsActive(item: CrmSuppressionEntry) {
  return item.active && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now());
}

export default function CrmCommunicationSettingsWorkspace() {
  const { token, crmAccess } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-OM' : 'en-OM';
  const [params, setParams] = useSearchParams();
  const pendingParamsRef = useRef(new URLSearchParams(params));
  const choices = useMemo(() => workspaceChoices(crmAccess, language), [crmAccess, language]);
  const requestedWorkspaceId = params.get('workspaceId');
  const [workspaceId, setWorkspaceId] = useState('');
  const activeChoice = choices.find((choice) => choice.workspaceId === workspaceId);
  const canConfigure = Boolean(crmAccess?.isAdmin || (activeChoice?.canManage && activeChoice.canManageWorkspace));
  const tab = safeTab(params.get('communicationGovernanceTab'));

  const suppressionPage = Math.max(1, Number(params.get('suppressionPage')) || 1);
  const suppressionSearch = params.get('suppressionQ')?.trim() ?? '';
  const suppressionChannel = safeChannel(params.get('suppressionChannel'));
  const suppressionReason = safeReason(params.get('suppressionReason'));
  const suppressionStatus = safeSuppressionStatus(params.get('suppressionStatus'));
  const suppressionSort = safeSuppressionSort(params.get('suppressionSort'));
  const suppressionDirection = safeDirection(params.get('suppressionDirection'), 'desc');

  const templatePage = Math.max(1, Number(params.get('templatePage')) || 1);
  const templateSearch = params.get('templateQ')?.trim() ?? '';
  const templateChannel = safeChannel(params.get('templateChannel'));
  const templateStatus = safeTemplateStatus(params.get('templateStatus'));
  const templateSort = safeTemplateSort(params.get('templateSort'));
  const templateDirection = safeDirection(params.get('templateDirection'), 'asc');

  const [policy, setPolicy] = useState<CrmCommunicationPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState('');

  const [suppressions, setSuppressions] = useState<CrmSuppressionEntry[]>([]);
  const [suppressionSummary, setSuppressionSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [suppressionTotal, setSuppressionTotal] = useState(0);
  const [suppressionsLoading, setSuppressionsLoading] = useState(false);
  const [suppressionsError, setSuppressionsError] = useState('');

  const [templates, setTemplates] = useState<CrmCommunicationTemplate[]>([]);
  const [templateSummary, setTemplateSummary] = useState({ total: 0, active: 0, archived: 0, versions: 0 });
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');

  const [success, setSuccess] = useState('');

  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState({ timezone: '', quietHoursStart: '0', quietHoursEnd: '0', hourlyRateLimit: '50', retentionDays: '365' });
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyDialogError, setPolicyDialogError] = useState('');
  const policyTriggerRef = useRef<HTMLButtonElement>(null);
  const policyTimezoneRef = useRef<HTMLInputElement>(null);

  const [suppressionOpen, setSuppressionOpen] = useState(false);
  const [editingSuppression, setEditingSuppression] = useState<CrmSuppressionEntry | null>(null);
  const [suppressionForm, setSuppressionForm] = useState({
    channel: 'EMAIL' as CrmCommunicationChannel,
    normalizedDestination: '',
    reason: 'MANUAL' as CrmSuppressionReason,
    active: true,
    source: '',
    notes: '',
    expiresAt: ''
  });
  const [suppressionBusy, setSuppressionBusy] = useState(false);
  const [suppressionDialogError, setSuppressionDialogError] = useState('');
  const suppressionTriggerRef = useRef<HTMLButtonElement>(null);
  const suppressionDestinationRef = useRef<HTMLInputElement>(null);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({ key: '', name: '', channel: 'EMAIL' as CrmCommunicationChannel, subject: '', body: '' });
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateDialogError, setTemplateDialogError] = useState('');
  const templateTriggerRef = useRef<HTMLButtonElement>(null);
  const templateKeyRef = useRef<HTMLInputElement>(null);

  const [reviewTemplate, setReviewTemplate] = useState<CrmCommunicationTemplate | null>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);

  const [versionTemplate, setVersionTemplate] = useState<CrmCommunicationTemplate | null>(null);
  const [versionForm, setVersionForm] = useState({ subject: '', body: '' });
  const [versionBusy, setVersionBusy] = useState(false);
  const [versionError, setVersionError] = useState('');
  const versionTriggerRef = useRef<HTMLButtonElement>(null);
  const versionBodyRef = useRef<HTMLTextAreaElement>(null);

  const [archiveTemplate, setArchiveTemplate] = useState<CrmCommunicationTemplate | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveAcknowledged, setArchiveAcknowledged] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const archiveTriggerRef = useRef<HTMLButtonElement>(null);
  const archiveReasonRef = useRef<HTMLTextAreaElement>(null);

  useDocumentTitle(language === 'ar' ? 'حوكمة تواصل CRM | lux.om' : 'CRM communication governance | lux.om');

  const copy = language === 'ar'
    ? {
        eyebrow: 'ضوابط التواصل', title: 'مركز حوكمة تواصل CRM', description: 'أدر ساعات الهدوء والحدود والقمع وقوالب الرسائل مع إبقاء الموافقات الفردية في سجل جهة الاتصال.', workspace: 'مساحة العمل', refresh: 'تحديث الحوكمة', readOnly: 'إعدادات على مستوى مساحة العمل', readOnlyBody: 'لا تكشف هذه الصفحة سياسات أو وجهات قمع على مستوى مساحة العمل للمستخدمين المقيّدين بالعقارات. يلزم إذن إدارة مساحة العمل.', policyTab: 'السياسة', suppressionsTab: 'القمع', templatesTab: 'القوالب',
        policyTitle: 'سياسة مساحة العمل', policyDescription: 'ساعات الهدوء وحد الإرسال والاحتفاظ.', timezone: 'المنطقة الزمنية', quietHours: 'ساعات الهدوء', hourlyLimit: 'الحد في الساعة', retention: 'الاحتفاظ', days: 'يوماً', editPolicy: 'تعديل السياسة', savePolicy: 'حفظ السياسة', policySaved: 'تم تحديث سياسة التواصل.',
        activeSuppressions: 'القمع النشط', inactiveSuppressions: 'غير النشط', activeTemplates: 'القوالب النشطة', versions: 'الإصدارات',
        searchSuppressions: 'البحث في القمع', searchTemplates: 'البحث في القوالب', channel: 'القناة', reason: 'السبب', state: 'الحالة', sort: 'الترتيب', direction: 'الاتجاه', all: 'الكل', active: 'نشط', inactive: 'غير نشط', archived: 'مؤرشف', ascending: 'تصاعدي', descending: 'تنازلي', updated: 'آخر تحديث', destination: 'الوجهة', name: 'الاسم', created: 'الإنشاء', apply: 'تطبيق عوامل التصفية', reset: 'إعادة الضبط',
        addSuppression: 'إضافة قمع', editSuppression: 'مراجعة القمع', source: 'المصدر', notes: 'ملاحظات', expires: 'تاريخ الانتهاء', saveSuppression: 'حفظ القمع', suppressionSaved: 'تم حفظ سجل القمع.', suppressionLoading: 'جارٍ تحميل سجلات القمع…', suppressionEmpty: 'لا توجد سجلات قمع مطابقة.',
        addTemplate: 'إنشاء قالب', templateKey: 'مفتاح القالب', subject: 'الموضوع', body: 'النص', saveTemplate: 'إنشاء القالب', templateCreated: 'تم إنشاء قالب التواصل.', templateLoading: 'جارٍ تحميل قوالب التواصل…', templateEmpty: 'لا توجد قوالب مطابقة.', reviewTemplate: 'مراجعة القالب', newVersion: 'إصدار جديد', archive: 'أرشفة', restore: 'استعادة', templateVersions: 'إصدارات القالب', deliveries: 'محاولات التسليم', noSubject: 'من دون موضوع', versionCreated: 'تم حفظ إصدار قالب غير قابل للتعديل.', archiveReason: 'سبب دورة الحياة', acknowledgeArchive: 'أفهم أن الإصدارات التاريخية ستبقى محفوظة وأن القالب المؤرشف لن يقبل إصدارات جديدة.', confirmArchive: 'تأكيد الأرشفة', confirmRestore: 'تأكيد الاستعادة', templateArchived: 'تمت أرشفة القالب.', templateRestored: 'تمت استعادة القالب.',
        previous: 'السابق', next: 'التالي', page: 'صفحة', of: 'من', loading: 'جارٍ التحميل…', close: 'إغلاق', saving: 'جارٍ الحفظ…', actions: 'الإجراءات', status: 'الحالة'
      }
    : {
        eyebrow: 'Communication controls', title: 'CRM communication governance center', description: 'Manage quiet hours, rate and retention policy, suppression controls, and immutable message-template versions while keeping contact consent on the contact record.', workspace: 'Workspace', refresh: 'Refresh governance', readOnly: 'Workspace-level settings', readOnlyBody: 'This page does not expose workspace-wide policy or suppression destinations to property-restricted users. Workspace-management permission is required.', policyTab: 'Policy', suppressionsTab: 'Suppressions', templatesTab: 'Templates',
        policyTitle: 'Workspace policy', policyDescription: 'Quiet hours, outbound rate limits, and retention.', timezone: 'Timezone', quietHours: 'Quiet hours', hourlyLimit: 'Hourly limit', retention: 'Retention', days: 'days', editPolicy: 'Edit policy', savePolicy: 'Save policy', policySaved: 'The communication policy was updated.',
        activeSuppressions: 'Active suppressions', inactiveSuppressions: 'Inactive suppressions', activeTemplates: 'Active templates', versions: 'Versions',
        searchSuppressions: 'Search suppressions', searchTemplates: 'Search templates', channel: 'Channel', reason: 'Reason', state: 'State', sort: 'Sort by', direction: 'Direction', all: 'All', active: 'Active', inactive: 'Inactive', archived: 'Archived', ascending: 'Ascending', descending: 'Descending', updated: 'Updated', destination: 'Destination', name: 'Name', created: 'Created', apply: 'Apply filters', reset: 'Reset filters',
        addSuppression: 'Add suppression', editSuppression: 'Review suppression', source: 'Source', notes: 'Notes', expires: 'Expires', saveSuppression: 'Save suppression', suppressionSaved: 'The suppression entry was saved.', suppressionLoading: 'Loading suppression entries…', suppressionEmpty: 'No matching suppression entries.',
        addTemplate: 'Create template', templateKey: 'Template key', subject: 'Subject', body: 'Message body', saveTemplate: 'Create template', templateCreated: 'The communication template was created.', templateLoading: 'Loading communication templates…', templateEmpty: 'No matching templates.', reviewTemplate: 'Review template', newVersion: 'New version', archive: 'Archive', restore: 'Restore', templateVersions: 'Template versions', deliveries: 'Delivery attempts', noSubject: 'No subject', versionCreated: 'An immutable template version was stored.', archiveReason: 'Lifecycle reason', acknowledgeArchive: 'I understand historical versions remain preserved and an archived template cannot receive new versions.', confirmArchive: 'Confirm archive', confirmRestore: 'Confirm restore', templateArchived: 'The template was archived.', templateRestored: 'The template was restored.',
        previous: 'Previous', next: 'Next', page: 'Page', of: 'of', loading: 'Loading…', close: 'Close', saving: 'Saving…', actions: 'Actions', status: 'Status'
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
    const next = requested ?? choices[0];
    if (workspaceId !== next.workspaceId) setWorkspaceId(next.workspaceId ?? '');
    if (requestedWorkspaceId !== next.workspaceId) {
      replaceQuery((query) => {
        query.set('workspaceId', next.workspaceId ?? '');
        query.delete('suppressionPage');
        query.delete('templatePage');
      });
    }
  }, [choices, requestedWorkspaceId, workspaceId]);

  async function loadPolicy() {
    if (!token || !workspaceId || !canConfigure) return;
    setPolicyLoading(true);
    setPolicyError('');
    try {
      const response = await getCrmCommunicationPolicy(token, workspaceId);
      setPolicy(response.policy);
    } catch (cause) {
      setPolicyError(errorMessage(cause));
    } finally {
      setPolicyLoading(false);
    }
  }

  async function loadSuppressions() {
    if (!token || !workspaceId || !canConfigure) return;
    setSuppressionsLoading(true);
    setSuppressionsError('');
    try {
      const response = await listCrmSuppressions(token, {
        workspaceId,
        search: suppressionSearch || undefined,
        channel: suppressionChannel || undefined,
        reason: suppressionReason || undefined,
        status: suppressionStatus,
        sortBy: suppressionSort,
        direction: suppressionDirection,
        take: PAGE_SIZE,
        skip: (suppressionPage - 1) * PAGE_SIZE
      });
      setSuppressions(response.suppressions);
      setSuppressionSummary(response.summary);
      setSuppressionTotal(response.pagination.total);
    } catch (cause) {
      setSuppressionsError(errorMessage(cause));
    } finally {
      setSuppressionsLoading(false);
    }
  }

  async function loadTemplates() {
    if (!token || !workspaceId || !canConfigure) return;
    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const response = await listCrmCommunicationTemplates(token, {
        workspaceId,
        search: templateSearch || undefined,
        channel: templateChannel || undefined,
        status: templateStatus,
        sortBy: templateSort,
        direction: templateDirection,
        take: PAGE_SIZE,
        skip: (templatePage - 1) * PAGE_SIZE
      });
      setTemplates(response.templates);
      setTemplateSummary(response.summary);
      setTemplateTotal(response.pagination.total);
    } catch (cause) {
      setTemplatesError(errorMessage(cause));
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    setPolicy(null);
    setSuppressions([]);
    setTemplates([]);
    setSuccess('');
    if (!canConfigure) return;
    void Promise.all([loadPolicy(), loadSuppressions(), loadTemplates()]);
  }, [canConfigure, token, workspaceId]);

  useEffect(() => {
    if (canConfigure) void loadSuppressions();
  }, [suppressionChannel, suppressionDirection, suppressionPage, suppressionReason, suppressionSearch, suppressionSort, suppressionStatus]);

  useEffect(() => {
    if (canConfigure) void loadTemplates();
  }, [templateChannel, templateDirection, templatePage, templateSearch, templateSort, templateStatus]);

  function changeWorkspace(value: string) {
    setWorkspaceId(value);
    replaceQuery((next) => {
      next.set('workspaceId', value);
      next.delete('suppressionPage');
      next.delete('templatePage');
    });
  }

  function changeTab(nextTab: GovernanceTab) {
    replaceQuery((next) => next.set('communicationGovernanceTab', nextTab));
  }

  function applySuppressionFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    replaceQuery((next) => {
      const entries = [
        ['suppressionQ', String(data.get('suppressionQ') ?? '').trim()],
        ['suppressionChannel', String(data.get('suppressionChannel') ?? '')],
        ['suppressionReason', String(data.get('suppressionReason') ?? '')],
        ['suppressionStatus', String(data.get('suppressionStatus') ?? 'ALL')],
        ['suppressionSort', String(data.get('suppressionSort') ?? 'updatedAt')],
        ['suppressionDirection', String(data.get('suppressionDirection') ?? 'desc')]
      ] as const;
      entries.forEach(([key, value]) => value && value !== 'ALL' ? next.set(key, value) : next.delete(key));
      next.delete('suppressionPage');
    });
  }

  function resetSuppressionFilters() {
    replaceQuery((next) => {
      ['suppressionQ', 'suppressionChannel', 'suppressionReason', 'suppressionStatus', 'suppressionSort', 'suppressionDirection', 'suppressionPage'].forEach((key) => next.delete(key));
    });
  }

  function applyTemplateFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    replaceQuery((next) => {
      const entries = [
        ['templateQ', String(data.get('templateQ') ?? '').trim()],
        ['templateChannel', String(data.get('templateChannel') ?? '')],
        ['templateStatus', String(data.get('templateStatus') ?? 'ALL')],
        ['templateSort', String(data.get('templateSort') ?? 'name')],
        ['templateDirection', String(data.get('templateDirection') ?? 'asc')]
      ] as const;
      entries.forEach(([key, value]) => value && value !== 'ALL' ? next.set(key, value) : next.delete(key));
      next.delete('templatePage');
    });
  }

  function resetTemplateFilters() {
    replaceQuery((next) => {
      ['templateQ', 'templateChannel', 'templateStatus', 'templateSort', 'templateDirection', 'templatePage'].forEach((key) => next.delete(key));
    });
  }

  function openPolicy() {
    if (!policy) return;
    setPolicyForm({
      timezone: policy.timezone,
      quietHoursStart: String(policy.quietHoursStart),
      quietHoursEnd: String(policy.quietHoursEnd),
      hourlyRateLimit: String(policy.hourlyRateLimit),
      retentionDays: String(policy.retentionDays)
    });
    setPolicyDialogError('');
    setPolicyOpen(true);
  }

  async function submitPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspaceId) return;
    setPolicyBusy(true);
    setPolicyDialogError('');
    try {
      const response = await updateCrmCommunicationPolicy(token, {
        workspaceId,
        timezone: policyForm.timezone.trim(),
        quietHoursStart: Number(policyForm.quietHoursStart),
        quietHoursEnd: Number(policyForm.quietHoursEnd),
        hourlyRateLimit: Number(policyForm.hourlyRateLimit),
        retentionDays: Number(policyForm.retentionDays)
      });
      setPolicy(response.policy);
      setPolicyOpen(false);
      setSuccess(copy.policySaved);
    } catch (cause) {
      setPolicyDialogError(errorMessage(cause));
    } finally {
      setPolicyBusy(false);
    }
  }

  function openSuppression(item: CrmSuppressionEntry | null, trigger: HTMLButtonElement) {
    suppressionTriggerRef.current = trigger;
    setEditingSuppression(item);
    setSuppressionForm(item ? {
      channel: item.channel,
      normalizedDestination: item.normalizedDestination,
      reason: item.reason,
      active: suppressionIsActive(item),
      source: item.source ?? '',
      notes: item.notes ?? '',
      expiresAt: item.expiresAt ? item.expiresAt.slice(0, 16) : ''
    } : { channel: 'EMAIL', normalizedDestination: '', reason: 'MANUAL', active: true, source: '', notes: '', expiresAt: '' });
    setSuppressionDialogError('');
    setSuppressionOpen(true);
  }

  async function submitSuppression(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspaceId) return;
    setSuppressionBusy(true);
    setSuppressionDialogError('');
    try {
      await upsertCrmSuppression(token, {
        workspaceId,
        channel: suppressionForm.channel,
        normalizedDestination: suppressionForm.normalizedDestination,
        reason: suppressionForm.reason,
        active: suppressionForm.active,
        source: suppressionForm.source.trim() || undefined,
        notes: suppressionForm.notes.trim() || undefined,
        expiresAt: suppressionForm.expiresAt ? new Date(suppressionForm.expiresAt).toISOString() : null
      });
      setSuppressionOpen(false);
      setSuccess(copy.suppressionSaved);
      await loadSuppressions();
    } catch (cause) {
      setSuppressionDialogError(errorMessage(cause));
    } finally {
      setSuppressionBusy(false);
    }
  }

  function openTemplateCreate() {
    setTemplateForm({ key: '', name: '', channel: 'EMAIL', subject: '', body: '' });
    setTemplateDialogError('');
    setTemplateOpen(true);
  }

  async function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspaceId) return;
    setTemplateBusy(true);
    setTemplateDialogError('');
    try {
      await createCrmCommunicationTemplate(token, {
        workspaceId,
        key: templateForm.key.trim(),
        name: templateForm.name.trim(),
        channel: templateForm.channel,
        subject: templateForm.subject.trim() || null,
        body: templateForm.body
      });
      setTemplateOpen(false);
      setSuccess(copy.templateCreated);
      await loadTemplates();
    } catch (cause) {
      setTemplateDialogError(errorMessage(cause));
    } finally {
      setTemplateBusy(false);
    }
  }

  function openReview(item: CrmCommunicationTemplate, trigger: HTMLButtonElement) {
    reviewTriggerRef.current = trigger;
    setReviewTemplate(item);
  }

  function openVersion(item: CrmCommunicationTemplate, trigger: HTMLButtonElement) {
    versionTriggerRef.current = trigger;
    const latest = item.versions[0];
    setVersionTemplate(item);
    setVersionForm({ subject: latest?.subject ?? '', body: latest?.body ?? '' });
    setVersionError('');
  }

  async function submitVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !versionTemplate) return;
    setVersionBusy(true);
    setVersionError('');
    try {
      await createCrmCommunicationTemplateVersion(token, versionTemplate.id, {
        subject: versionForm.subject.trim() || null,
        body: versionForm.body
      });
      setVersionTemplate(null);
      setSuccess(copy.versionCreated);
      await loadTemplates();
    } catch (cause) {
      setVersionError(errorMessage(cause));
    } finally {
      setVersionBusy(false);
    }
  }

  function openArchive(item: CrmCommunicationTemplate, trigger: HTMLButtonElement) {
    archiveTriggerRef.current = trigger;
    setArchiveTemplate(item);
    setArchiveReason('');
    setArchiveAcknowledged(false);
    setArchiveError('');
  }

  async function submitArchive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !archiveTemplate) return;
    setArchiveBusy(true);
    setArchiveError('');
    try {
      const archived = archiveTemplate.active;
      await archiveCrmCommunicationTemplate(token, archiveTemplate.id, archived, archiveReason.trim());
      setArchiveTemplate(null);
      setSuccess(archived ? copy.templateArchived : copy.templateRestored);
      await loadTemplates();
    } catch (cause) {
      setArchiveError(errorMessage(cause));
    } finally {
      setArchiveBusy(false);
    }
  }

  const suppressionPages = Math.max(1, Math.ceil(suppressionTotal / PAGE_SIZE));
  const templatePages = Math.max(1, Math.ceil(templateTotal / PAGE_SIZE));

  return (
    <section className="crm-communication-settings" aria-labelledby="crm-communication-settings-title">
      <header className="crm-communication-settings__header">
        <div>
          <p className="eyebrow"><MailCheck aria-hidden="true" size={17} /> {copy.eyebrow}</p>
          <h2 id="crm-communication-settings-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="crm-communication-settings__actions">
          <WorkspaceSelector choices={choices} label={copy.workspace} onChange={changeWorkspace} value={workspaceId} />
          {canConfigure ? <button className="button-link button-link--secondary" type="button" onClick={() => void Promise.all([loadPolicy(), loadSuppressions(), loadTemplates()])}><RefreshCw aria-hidden="true" size={16} />{copy.refresh}</button> : null}
        </div>
      </header>

      {!canConfigure && workspaceId ? <aside className="crm-communication-settings__readonly" role="note"><ShieldCheck aria-hidden="true" /><div><strong>{copy.readOnly}</strong><p>{copy.readOnlyBody}</p></div></aside> : null}
      {success ? <p className="form-alert form-alert--success" role="status"><CheckCircle2 aria-hidden="true" />{success}</p> : null}

      {canConfigure ? <>
        <nav aria-label={language === 'ar' ? 'أقسام حوكمة التواصل' : 'Communication governance sections'} className="crm-communication-settings__tabs">
          <button className={tab === 'policy' ? 'is-active' : ''} type="button" onClick={() => changeTab('policy')}><SlidersHorizontal aria-hidden="true" size={16} />{copy.policyTab}</button>
          <button className={tab === 'suppressions' ? 'is-active' : ''} type="button" onClick={() => changeTab('suppressions')}><ShieldCheck aria-hidden="true" size={16} />{copy.suppressionsTab}</button>
          <button className={tab === 'templates' ? 'is-active' : ''} type="button" onClick={() => changeTab('templates')}><FileClock aria-hidden="true" size={16} />{copy.templatesTab}</button>
        </nav>

        <div className="crm-communication-settings__metrics" aria-live="polite">
          <article><span>{copy.activeSuppressions}</span><strong>{suppressionSummary.active}</strong></article>
          <article><span>{copy.inactiveSuppressions}</span><strong>{suppressionSummary.inactive}</strong></article>
          <article><span>{copy.activeTemplates}</span><strong>{templateSummary.active}</strong></article>
          <article><span>{copy.versions}</span><strong>{templateSummary.versions}</strong></article>
        </div>

        {tab === 'policy' ? <section className="crm-communication-settings__panel">
          <header><div><p className="eyebrow"><Clock3 aria-hidden="true" size={15} />{copy.policyDescription}</p><h3>{copy.policyTitle}</h3></div>{policy ? <button className="button-link button-link--primary" onClick={openPolicy} ref={policyTriggerRef} type="button">{copy.editPolicy}</button> : null}</header>
          {policyLoading ? <div className="crm-communication-settings__state" role="status"><RefreshCw aria-hidden="true" className="spin" />{copy.loading}</div> : policyError ? <p className="form-alert form-alert--error" role="alert"><AlertCircle aria-hidden="true" />{policyError}</p> : policy ? <div className="crm-communication-settings__policy-grid">
            <article><span>{copy.timezone}</span><strong>{policy.timezone}</strong></article>
            <article><span>{copy.quietHours}</span><strong>{formatMinute(policy.quietHoursStart)}–{formatMinute(policy.quietHoursEnd)}</strong></article>
            <article><span>{copy.hourlyLimit}</span><strong>{policy.hourlyRateLimit}</strong></article>
            <article><span>{copy.retention}</span><strong>{policy.retentionDays} {copy.days}</strong></article>
          </div> : null}
        </section> : null}

        {tab === 'suppressions' ? <section className="crm-communication-settings__panel">
          <header><h3>{copy.suppressionsTab}</h3><button className="button-link button-link--primary" type="button" onClick={(event) => openSuppression(null, event.currentTarget)}><Plus aria-hidden="true" size={16} />{copy.addSuppression}</button></header>
          <form className="crm-communication-settings__filters" onSubmit={applySuppressionFilters}>
            <label className="crm-communication-settings__search"><span>{copy.searchSuppressions}</span><div><Search aria-hidden="true" size={16} /><input defaultValue={suppressionSearch} key={`sq-${suppressionSearch}`} name="suppressionQ" /></div></label>
            <label><span>{copy.channel}</span><select defaultValue={suppressionChannel} key={`sc-${suppressionChannel}`} name="suppressionChannel"><option value="">{copy.all}</option>{channels.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><span>{copy.reason}</span><select defaultValue={suppressionReason} key={`sr-${suppressionReason}`} name="suppressionReason"><option value="">{copy.all}</option>{reasons.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><span>{copy.state}</span><select defaultValue={suppressionStatus} key={`ss-${suppressionStatus}`} name="suppressionStatus"><option value="ALL">{copy.all}</option><option value="ACTIVE">{copy.active}</option><option value="INACTIVE">{copy.inactive}</option></select></label>
            <label><span>{copy.sort}</span><select defaultValue={suppressionSort} key={`so-${suppressionSort}`} name="suppressionSort"><option value="updatedAt">{copy.updated}</option><option value="normalizedDestination">{copy.destination}</option><option value="reason">{copy.reason}</option></select></label>
            <label><span>{copy.direction}</span><select defaultValue={suppressionDirection} key={`sd-${suppressionDirection}`} name="suppressionDirection"><option value="desc">{copy.descending}</option><option value="asc">{copy.ascending}</option></select></label>
            <div><button className="button-link button-link--primary" type="submit">{copy.apply}</button><button className="button-link button-link--ghost" onClick={resetSuppressionFilters} type="button">{copy.reset}</button></div>
          </form>
          {suppressionsLoading ? <div className="crm-communication-settings__state" role="status"><RefreshCw aria-hidden="true" className="spin" />{copy.suppressionLoading}</div> : suppressionsError ? <p className="form-alert form-alert--error" role="alert"><AlertCircle aria-hidden="true" />{suppressionsError}</p> : suppressions.length === 0 ? <div className="crm-communication-settings__empty"><ShieldCheck aria-hidden="true" /><p>{copy.suppressionEmpty}</p></div> : <div className="crm-communication-settings__table-wrap"><table><thead><tr><th>{copy.destination}</th><th>{copy.channel}</th><th>{copy.reason}</th><th>{copy.status}</th><th>{copy.updated}</th><th>{copy.actions}</th></tr></thead><tbody>{suppressions.map((item) => <tr key={item.id}><td><strong>{item.normalizedDestination}</strong><small>{item.source || '—'}</small></td><td>{item.channel}</td><td>{item.reason}</td><td>{suppressionIsActive(item) ? copy.active : copy.inactive}</td><td>{formatDate(item.updatedAt, locale)}</td><td><button aria-label={`${copy.editSuppression}: ${item.normalizedDestination}`} type="button" onClick={(event) => openSuppression(item, event.currentTarget)}>{copy.editSuppression}</button></td></tr>)}</tbody></table></div>}
          <nav aria-label={`${copy.page} ${suppressionPage}`} className="crm-communication-settings__pagination"><button disabled={suppressionPage <= 1} type="button" onClick={() => replaceQuery((next) => next.set('suppressionPage', String(suppressionPage - 1)))}><ChevronLeft aria-hidden="true" />{copy.previous}</button><span>{copy.page} {suppressionPage} {copy.of} {suppressionPages}</span><button disabled={suppressionPage >= suppressionPages} type="button" onClick={() => replaceQuery((next) => next.set('suppressionPage', String(suppressionPage + 1)))}>{copy.next}<ChevronRight aria-hidden="true" /></button></nav>
        </section> : null}

        {tab === 'templates' ? <section className="crm-communication-settings__panel">
          <header><h3>{copy.templatesTab}</h3><button className="button-link button-link--primary" onClick={openTemplateCreate} ref={templateTriggerRef} type="button"><Plus aria-hidden="true" size={16} />{copy.addTemplate}</button></header>
          <form className="crm-communication-settings__filters crm-communication-settings__filters--templates" onSubmit={applyTemplateFilters}>
            <label className="crm-communication-settings__search"><span>{copy.searchTemplates}</span><div><Search aria-hidden="true" size={16} /><input defaultValue={templateSearch} key={`tq-${templateSearch}`} name="templateQ" /></div></label>
            <label><span>{copy.channel}</span><select defaultValue={templateChannel} key={`tc-${templateChannel}`} name="templateChannel"><option value="">{copy.all}</option>{channels.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><span>{copy.state}</span><select defaultValue={templateStatus} key={`ts-${templateStatus}`} name="templateStatus"><option value="ALL">{copy.all}</option><option value="ACTIVE">{copy.active}</option><option value="ARCHIVED">{copy.archived}</option></select></label>
            <label><span>{copy.sort}</span><select defaultValue={templateSort} key={`tso-${templateSort}`} name="templateSort"><option value="name">{copy.name}</option><option value="updatedAt">{copy.updated}</option><option value="createdAt">{copy.created}</option></select></label>
            <label><span>{copy.direction}</span><select defaultValue={templateDirection} key={`td-${templateDirection}`} name="templateDirection"><option value="asc">{copy.ascending}</option><option value="desc">{copy.descending}</option></select></label>
            <div><button className="button-link button-link--primary" type="submit">{copy.apply}</button><button className="button-link button-link--ghost" onClick={resetTemplateFilters} type="button">{copy.reset}</button></div>
          </form>
          {templatesLoading ? <div className="crm-communication-settings__state" role="status"><RefreshCw aria-hidden="true" className="spin" />{copy.templateLoading}</div> : templatesError ? <p className="form-alert form-alert--error" role="alert"><AlertCircle aria-hidden="true" />{templatesError}</p> : templates.length === 0 ? <div className="crm-communication-settings__empty"><FileClock aria-hidden="true" /><p>{copy.templateEmpty}</p></div> : <div className="crm-communication-settings__table-wrap"><table><thead><tr><th>{copy.name}</th><th>{copy.channel}</th><th>{copy.versions}</th><th>{copy.status}</th><th>{copy.updated}</th><th>{copy.actions}</th></tr></thead><tbody>{templates.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.key}</small></td><td>{item.channel}</td><td>{item.versions.length}</td><td>{item.active ? copy.active : copy.archived}</td><td>{formatDate(item.updatedAt, locale)}</td><td><div className="crm-communication-settings__row-actions"><button aria-label={`${copy.reviewTemplate}: ${item.name}`} type="button" onClick={(event) => openReview(item, event.currentTarget)}>{copy.reviewTemplate}</button>{item.active ? <button aria-label={`${copy.newVersion}: ${item.name}`} type="button" onClick={(event) => openVersion(item, event.currentTarget)}>{copy.newVersion}</button> : null}<button aria-label={`${item.active ? copy.archive : copy.restore}: ${item.name}`} type="button" onClick={(event) => openArchive(item, event.currentTarget)}>{item.active ? <Archive aria-hidden="true" size={14} /> : <ArchiveRestore aria-hidden="true" size={14} />}{item.active ? copy.archive : copy.restore}</button></div></td></tr>)}</tbody></table></div>}
          <nav aria-label={`${copy.page} ${templatePage}`} className="crm-communication-settings__pagination"><button disabled={templatePage <= 1} type="button" onClick={() => replaceQuery((next) => next.set('templatePage', String(templatePage - 1)))}><ChevronLeft aria-hidden="true" />{copy.previous}</button><span>{copy.page} {templatePage} {copy.of} {templatePages}</span><button disabled={templatePage >= templatePages} type="button" onClick={() => replaceQuery((next) => next.set('templatePage', String(templatePage + 1)))}>{copy.next}<ChevronRight aria-hidden="true" /></button></nav>
        </section> : null}
      </> : null}

      <AccessibleDialog closeLabel={copy.close} initialFocusRef={policyTimezoneRef} onClose={() => !policyBusy && setPolicyOpen(false)} open={policyOpen} returnFocusRef={policyTriggerRef} title={copy.editPolicy}>
        <form className="crm-communication-settings__dialog-form" onSubmit={submitPolicy}>{policyDialogError ? <p className="form-alert form-alert--error" role="alert">{policyDialogError}</p> : null}<label><span>{copy.timezone}</span><input ref={policyTimezoneRef} required value={policyForm.timezone} onChange={(event) => setPolicyForm((current) => ({ ...current, timezone: event.target.value }))} /></label><div className="crm-communication-settings__dialog-grid"><label><span>{copy.quietHours} · start</span><input min="0" max="1439" required type="number" value={policyForm.quietHoursStart} onChange={(event) => setPolicyForm((current) => ({ ...current, quietHoursStart: event.target.value }))} /></label><label><span>{copy.quietHours} · end</span><input min="0" max="1439" required type="number" value={policyForm.quietHoursEnd} onChange={(event) => setPolicyForm((current) => ({ ...current, quietHoursEnd: event.target.value }))} /></label><label><span>{copy.hourlyLimit}</span><input min="1" max="1000" required type="number" value={policyForm.hourlyRateLimit} onChange={(event) => setPolicyForm((current) => ({ ...current, hourlyRateLimit: event.target.value }))} /></label><label><span>{copy.retention}</span><input min="30" max="3650" required type="number" value={policyForm.retentionDays} onChange={(event) => setPolicyForm((current) => ({ ...current, retentionDays: event.target.value }))} /></label></div><button className="button-link button-link--primary" disabled={policyBusy} type="submit">{policyBusy ? copy.saving : copy.savePolicy}</button></form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.close} initialFocusRef={suppressionDestinationRef} onClose={() => !suppressionBusy && setSuppressionOpen(false)} open={suppressionOpen} returnFocusRef={suppressionTriggerRef} title={editingSuppression ? copy.editSuppression : copy.addSuppression}>
        <form className="crm-communication-settings__dialog-form" onSubmit={submitSuppression}>{suppressionDialogError ? <p className="form-alert form-alert--error" role="alert">{suppressionDialogError}</p> : null}<div className="crm-communication-settings__dialog-grid"><label><span>{copy.channel}</span><select disabled={Boolean(editingSuppression)} value={suppressionForm.channel} onChange={(event) => setSuppressionForm((current) => ({ ...current, channel: event.target.value as CrmCommunicationChannel }))}>{channels.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span>{copy.destination}</span><input readOnly={Boolean(editingSuppression)} ref={suppressionDestinationRef} required value={suppressionForm.normalizedDestination} onChange={(event) => setSuppressionForm((current) => ({ ...current, normalizedDestination: event.target.value }))} /></label><label><span>{copy.reason}</span><select value={suppressionForm.reason} onChange={(event) => setSuppressionForm((current) => ({ ...current, reason: event.target.value as CrmSuppressionReason }))}>{reasons.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span>{copy.expires}</span><input type="datetime-local" value={suppressionForm.expiresAt} onChange={(event) => setSuppressionForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label></div><label><span>{copy.source}</span><input value={suppressionForm.source} onChange={(event) => setSuppressionForm((current) => ({ ...current, source: event.target.value }))} /></label><label><span>{copy.notes}</span><textarea value={suppressionForm.notes} onChange={(event) => setSuppressionForm((current) => ({ ...current, notes: event.target.value }))} /></label><label className="crm-communication-settings__checkbox"><input checked={suppressionForm.active} type="checkbox" onChange={(event) => setSuppressionForm((current) => ({ ...current, active: event.target.checked }))} /><span>{copy.active}</span></label><button className="button-link button-link--primary" disabled={suppressionBusy} type="submit">{suppressionBusy ? copy.saving : copy.saveSuppression}</button></form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.close} initialFocusRef={templateKeyRef} onClose={() => !templateBusy && setTemplateOpen(false)} open={templateOpen} returnFocusRef={templateTriggerRef} title={copy.addTemplate}>
        <form className="crm-communication-settings__dialog-form" onSubmit={submitTemplate}>{templateDialogError ? <p className="form-alert form-alert--error" role="alert">{templateDialogError}</p> : null}<div className="crm-communication-settings__dialog-grid"><label><span>{copy.templateKey}</span><input pattern="[a-z0-9][a-z0-9_-]{1,79}" ref={templateKeyRef} required value={templateForm.key} onChange={(event) => setTemplateForm((current) => ({ ...current, key: event.target.value }))} /></label><label><span>{copy.name}</span><input required value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} /></label><label><span>{copy.channel}</span><select value={templateForm.channel} onChange={(event) => setTemplateForm((current) => ({ ...current, channel: event.target.value as CrmCommunicationChannel }))}>{channels.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span>{copy.subject}</span><input value={templateForm.subject} onChange={(event) => setTemplateForm((current) => ({ ...current, subject: event.target.value }))} /></label></div><label><span>{copy.body}</span><textarea required rows={8} value={templateForm.body} onChange={(event) => setTemplateForm((current) => ({ ...current, body: event.target.value }))} /></label><button className="button-link button-link--primary" disabled={templateBusy} type="submit">{templateBusy ? copy.saving : copy.saveTemplate}</button></form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.close} onClose={() => setReviewTemplate(null)} open={Boolean(reviewTemplate)} returnFocusRef={reviewTriggerRef} size="large" title={reviewTemplate ? `${copy.reviewTemplate} · ${reviewTemplate.name}` : copy.reviewTemplate}>
        {reviewTemplate ? <div className="crm-communication-settings__versions"><p><strong>{reviewTemplate.key}</strong> · {reviewTemplate.channel} · {reviewTemplate.active ? copy.active : copy.archived}</p><h3>{copy.templateVersions}</h3>{reviewTemplate.versions.map((version) => <article key={version.id}><header><strong>v{version.version}</strong><span>{formatDate(version.createdAt, locale)}</span></header><p>{version.subject || copy.noSubject}</p><pre>{version.body}</pre><small>{copy.deliveries}: {version._count?.deliveryAttempts ?? 0}</small></article>)}</div> : null}
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.close} initialFocusRef={versionBodyRef} onClose={() => !versionBusy && setVersionTemplate(null)} open={Boolean(versionTemplate)} returnFocusRef={versionTriggerRef} title={versionTemplate ? `${copy.newVersion} · ${versionTemplate.name}` : copy.newVersion}>
        <form className="crm-communication-settings__dialog-form" onSubmit={submitVersion}>{versionError ? <p className="form-alert form-alert--error" role="alert">{versionError}</p> : null}<label><span>{copy.subject}</span><input value={versionForm.subject} onChange={(event) => setVersionForm((current) => ({ ...current, subject: event.target.value }))} /></label><label><span>{copy.body}</span><textarea ref={versionBodyRef} required rows={8} value={versionForm.body} onChange={(event) => setVersionForm((current) => ({ ...current, body: event.target.value }))} /></label><button className="button-link button-link--primary" disabled={versionBusy} type="submit">{versionBusy ? copy.saving : copy.newVersion}</button></form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.close} initialFocusRef={archiveReasonRef} onClose={() => !archiveBusy && setArchiveTemplate(null)} open={Boolean(archiveTemplate)} returnFocusRef={archiveTriggerRef} title={archiveTemplate ? `${archiveTemplate.active ? copy.archive : copy.restore} · ${archiveTemplate.name}` : copy.archive}>
        <form className="crm-communication-settings__dialog-form" onSubmit={submitArchive}>{archiveError ? <p className="form-alert form-alert--error" role="alert">{archiveError}</p> : null}<label><span>{copy.archiveReason}</span><textarea minLength={3} ref={archiveReasonRef} required value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} /></label><label className="crm-communication-settings__checkbox"><input checked={archiveAcknowledged} required type="checkbox" onChange={(event) => setArchiveAcknowledged(event.target.checked)} /><span>{copy.acknowledgeArchive}</span></label><button className="button-link button-link--primary" disabled={archiveBusy || !archiveAcknowledged || archiveReason.trim().length < 3} type="submit">{archiveBusy ? copy.saving : archiveTemplate?.active ? copy.confirmArchive : copy.confirmRestore}</button></form>
      </AccessibleDialog>
    </section>
  );
}

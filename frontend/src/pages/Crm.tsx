import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Columns3,
  Filter,
  Flame,
  Inbox,
  LayoutList,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserRound,
  UsersRound
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  addCrmActivity,
  createCrmLead,
  getCrmAnalytics,
  getCrmCommunicationTemplates,
  getCrmLead,
  getCrmPipeline,
  listCrmAssignees,
  listCrmLeads,
  listCrmProperties,
  listCrmTasks,
  updateCrmActivity,
  updateCrmLead,
  type CrmActivity,
  type CrmActivityPriority,
  type CrmActivityType,
  type CrmAnalytics,
  type CrmCommunicationOutcome,
  type CrmCommunicationTemplate,
  type CrmLead,
  type CrmLeadPriority,
  type CrmLeadSource,
  type CrmLeadStatus,
  type CrmPerson,
  type CrmPipelineGroup,
  type CrmPipelineGroupBy
} from '../api/crm';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../features/crm/WorkspaceSelector';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

const statuses: CrmLeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'VIEWING_SCHEDULED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
  'LOST',
  'ARCHIVED'
];
const priorities: CrmLeadPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const activityPriorities: CrmActivityPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const sources: CrmLeadSource[] = [
  'LISTING_INQUIRY',
  'PROJECT_INQUIRY',
  'DEVELOPER_PROFILE',
  'TRAVEL_AGENCY_PROFILE',
  'ACTIVITY_INQUIRY',
  'ACTIVITY_BOOKING',
  'MAP_DISCOVERY',
  'CONTACT_FORM',
  'INVESTOR_WATCHLIST',
  'VALUATION_REQUEST',
  'SAVED_SEARCH',
  'PMS_OWNER',
  'PMS_TENANT',
  'PMS_MAINTENANCE_VENDOR',
  'MANUAL',
  'ADMIN_CREATED'
];
const communicationOutcomes: CrmCommunicationOutcome[] = ['CONNECTED', 'REPLIED', 'NO_ANSWER', 'SENT_EXTERNALLY', 'DRAFT_OPENED'];

type ManualActivityType = Exclude<CrmActivityType, 'STATUS_CHANGE' | 'ASSIGNMENT' | 'SYSTEM_NOTIFICATION'>;
type WorkspaceChoice = CrmWorkspaceChoice;
type CrmTask = CrmActivity & { lead: Pick<CrmLead, 'id' | 'title' | 'status' | 'priority' | 'companyId' | 'ownerUserId'> & { contact: CrmLead['contact']; company?: CrmLead['company'] } };

const emptyAnalytics: CrmAnalytics = {
  total: 0,
  newLeads: 0,
  openLeads: 0,
  overdueFollowUps: 0,
  openTasks: 0,
  overdueTasks: 0,
  won: 0,
  lost: 0,
  conversionRate: null,
  byStatus: {},
  bySource: []
};

function humanize(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function sourceRoute(lead: CrmLead) {
  if (lead.listing) return `/listings/${lead.listing.slug}`;
  if (lead.activity) return `/activities/${lead.activity.slug}`;
  if (lead.developerProject) return `/projects/${lead.developerProject.slug}`;
  if (lead.pmsProperty) return `/pms/properties/${lead.pmsProperty.id}?companyId=${lead.companyId}`;
  return null;
}

function isOverdue(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

export type CrmSection = 'overview' | 'leads' | 'tasks';

type CrmQueryUpdates = Record<string, string | null | undefined>;

export default function Crm({ section = 'overview' }: { section?: CrmSection }) {
  const { token, user, crmAccess: access } = useAuth();
  const navigate = useNavigate();
  const { leadId } = useParams<{ leadId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const latestSearchParamsRef = useRef(new URLSearchParams(searchParams));
  const pendingSearchParamsRef = useRef<string[]>([]);
  const { language } = useLanguage();

  useEffect(() => {
    const incomingSearch = searchParams.toString();
    const pendingIndex = pendingSearchParamsRef.current.indexOf(incomingSearch);

    if (pendingIndex >= 0) {
      pendingSearchParamsRef.current = pendingSearchParamsRef.current.slice(pendingIndex + 1);
      if (pendingSearchParamsRef.current.length === 0) {
        latestSearchParamsRef.current = new URLSearchParams(searchParams);
      }
      return;
    }

    pendingSearchParamsRef.current = [];
    latestSearchParamsRef.current = new URLSearchParams(searchParams);
  }, [searchParams]);

  const replaceCrmQuery = useCallback((updates: CrmQueryUpdates, pathname?: string) => {
    const current = latestSearchParamsRef.current;
    const next = new URLSearchParams(current);

    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }

    const nextSearch = next.toString();
    if (!pathname && nextSearch === current.toString()) return;

    latestSearchParamsRef.current = next;
    pendingSearchParamsRef.current.push(nextSearch);

    if (pathname) {
      navigate({ pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true });
      return;
    }

    setSearchParams(next, { replace: true });
  }, [navigate, setSearchParams]);

  const latestCrmSearch = useCallback(() => {
    const search = latestSearchParamsRef.current.toString();
    return search ? `?${search}` : '';
  }, []);
  const locale = language === 'ar' ? 'ar-OM' : 'en-GB';
  const copy = language === 'ar'
    ? {
        eyebrow: 'lux CRM', title: 'مركز المبيعات والعلاقات', description: 'مسار واضح للعملاء المحتملين، مهام المتابعة، سجل التواصل، وتحليلات التحويل عبر السوق وPMS.',
        loading: 'جاري تحميل CRM...', unavailable: 'تعذر تحميل CRM.', noAccess: 'لا توجد صلاحية CRM لهذا الحساب.', back: 'العودة', workspace: 'مساحة العمل', all: 'كل المساحات', personal: 'مساحتي',
        search: 'بحث بالاسم أو البريد أو المصدر', status: 'الحالة', priority: 'الأولوية', source: 'المصدر', assigned: 'المسؤول', allValues: 'الكل', refresh: 'تحديث', newLead: 'عميل محتمل جديد',
        total: 'إجمالي العملاء', newCount: 'جدد', open: 'مفتوحة', overdue: 'متابعات متأخرة', won: 'مغلقة بنجاح', conversion: 'معدل التحويل', empty: 'لا توجد عملاء محتملون في هذا النطاق.', emptyHelp: 'أنشئ سجلاً يدوياً أو أرسل استفساراً من السوق ليظهر تلقائياً.',
        contact: 'بيانات التواصل', timeline: 'الخط الزمني', task: 'مهمة أو تواصل', save: 'تم الحفظ', cancel: 'إلغاء', details: 'تفاصيل العميل', noSelection: 'اختر عميلاً لعرض التفاصيل.',
        titleLabel: 'عنوان الفرصة', name: 'الاسم', email: 'البريد', phone: 'الهاتف', descriptionLabel: 'الوصف', followUp: 'المتابعة القادمة', expectedValue: 'القيمة المتوقعة', property: 'عقار PMS', create: 'إنشاء العميل',
        activitySubject: 'عنوان النشاط', activityBody: 'التفاصيل', activityType: 'نوع النشاط', dueAt: 'موعد الاستحقاق', addActivity: 'إضافة النشاط', complete: 'إكمال', sourceObject: 'فتح المصدر',
        notConfigured: 'لا توجد بيانات كافية بعد.', dateFrom: 'من تاريخ', dateTo: 'إلى تاريخ', propertyRequired: 'اختيار العقار مطلوب لهذا النطاق.',
        pipeline: 'المسار', list: 'القائمة', board: 'اللوحة', groupBy: 'تجميع حسب', score: 'درجة العميل', nextAction: 'الخطوة التالية', why: 'لماذا', communications: 'قوالب التواصل', draftOnly: 'هذه الروابط تفتح مسودة فقط ولا تؤكد الإرسال.',
        openEmail: 'فتح مسودة بريد', openWhatsapp: 'فتح مسودة واتساب', taskPriority: 'أولوية المهمة', outcome: 'نتيجة التواصل', tasks: 'مهام المتابعة', noTasks: 'لا توجد مهام مفتوحة في هذا النطاق.', analytics: 'تحليلات التحويل', sourceConversion: 'التحويل حسب المصدر'
      }
    : {
        eyebrow: 'lux CRM', title: 'Sales and relationship command center', description: 'Run marketplace and PMS opportunities through a clear pipeline with follow-ups, communication history, and conversion insight.',
        loading: 'Loading CRM...', unavailable: 'Could not load CRM.', noAccess: 'CRM access is not enabled for this account.', back: 'Back', workspace: 'Workspace', all: 'All workspaces', personal: 'My marketplace workspace',
        search: 'Search name, email, source', status: 'Status', priority: 'Priority', source: 'Source', assigned: 'Assigned user', allValues: 'All', refresh: 'Refresh', newLead: 'New lead',
        total: 'Total leads', newCount: 'New', open: 'Open', overdue: 'Overdue follow-ups', won: 'Won', conversion: 'Conversion', empty: 'No leads in this scope yet.', emptyHelp: 'Create a manual lead or submit a marketplace inquiry to populate the CRM automatically.',
        contact: 'Contact', timeline: 'Timeline', task: 'Task or communication', save: 'Saved', cancel: 'Cancel', details: 'Lead details', noSelection: 'Select a lead to inspect the relationship.',
        titleLabel: 'Opportunity title', name: 'Full name', email: 'Email', phone: 'Phone', descriptionLabel: 'Description', followUp: 'Next follow-up', expectedValue: 'Expected value', property: 'PMS property', create: 'Create lead',
        activitySubject: 'Activity subject', activityBody: 'Details', activityType: 'Activity type', dueAt: 'Due date', addActivity: 'Add activity', complete: 'Complete', sourceObject: 'Open source',
        notConfigured: 'No reliable data is available yet.', dateFrom: 'Created from', dateTo: 'Created to', propertyRequired: 'A property is required for this scoped workspace.',
        pipeline: 'Pipeline', list: 'List', board: 'Board', groupBy: 'Group by', score: 'Lead score', nextAction: 'Next best action', why: 'Why', communications: 'Communication drafts', draftOnly: 'These actions open a draft only. lux.om does not confirm delivery.',
        openEmail: 'Open email draft', openWhatsapp: 'Open WhatsApp draft', taskPriority: 'Task priority', outcome: 'Communication outcome', tasks: 'Follow-up tasks', noTasks: 'No open tasks in this scope.', analytics: 'Conversion analytics', sourceConversion: 'Conversion by source'
      };

  useDocumentTitle(`${section === 'overview' ? 'CRM' : section === 'leads' ? 'CRM leads' : 'CRM tasks'} | lux.om`);

  const [workspaceKey, setWorkspaceKey] = useState(() => searchParams.get('workspace') ?? '');
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [summary, setSummary] = useState<{ total: number; byStatus: Partial<Record<CrmLeadStatus, number>> }>({ total: 0, byStatus: {} });
  const [analytics, setAnalytics] = useState<CrmAnalytics>(emptyAnalytics);
  const [pipelineGroups, setPipelineGroups] = useState<CrmPipelineGroup[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [templates, setTemplates] = useState<CrmCommunicationTemplate[]>([]);
  const [assignees, setAssignees] = useState<CrmPerson[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const viewMode: 'list' | 'board' = searchParams.get('view') === 'list' ? 'list' : 'board';
  const rawGroupBy = searchParams.get('groupBy');
  const groupBy: CrmPipelineGroupBy = rawGroupBy === 'assignedTo' || rawGroupBy === 'source' || rawGroupBy === 'company' ? rawGroupBy : 'status';
  const search = searchParams.get('q') ?? '';
  const rawStatus = searchParams.get('status') as CrmLeadStatus | null;
  const status: CrmLeadStatus | '' = rawStatus && statuses.includes(rawStatus) ? rawStatus : '';
  const rawPriority = searchParams.get('priority') as CrmLeadPriority | null;
  const priority: CrmLeadPriority | '' = rawPriority && priorities.includes(rawPriority) ? rawPriority : '';
  const rawSource = searchParams.get('source') as CrmLeadSource | null;
  const source: CrmLeadSource | '' = rawSource && sources.includes(rawSource) ? rawSource : '';
  const assignedToId = searchParams.get('assignedTo') ?? '';
  const dateFrom = searchParams.get('from') ?? '';
  const dateTo = searchParams.get('to') ?? '';
  const [createForm, setCreateForm] = useState({ title: '', fullName: '', email: '', phone: '', description: '', priority: 'MEDIUM' as CrmLeadPriority, source: 'MANUAL' as CrmLeadSource, nextFollowUpAt: '', expectedValue: '', pmsPropertyId: '' });
  const [activityForm, setActivityForm] = useState({ type: 'TASK' as ManualActivityType, subject: '', body: '', dueAt: '', priority: 'MEDIUM' as CrmActivityPriority, outcome: '' as CrmCommunicationOutcome | '' });

  const workspaceChoices = useMemo<WorkspaceChoice[]>(() => {
    if (!access) return [];
    const choices: WorkspaceChoice[] = [];
    if (access.isAdmin) choices.push({ key: 'all', label: copy.all, canManage: true }, { key: 'admin', label: 'lux.om admin CRM', canManage: true });
    if (access.personalWorkspace.canView) choices.push({ key: 'personal', label: copy.personal, canManage: access.personalWorkspace.canManage });
    for (const workspace of access.companyWorkspaces.filter((item) => item.canView)) {
      choices.push({ key: `company:${workspace.companyId}`, workspaceId: workspace.workspaceId, companyId: workspace.companyId, label: language === 'ar' ? workspace.nameAr || workspace.nameEn : workspace.nameEn, canManage: workspace.canManage, propertyScope: workspace.propertyScope });
    }
    return choices;
  }, [access, copy.all, copy.personal, language]);

  const activeWorkspace = workspaceChoices.find((item) => item.key === workspaceKey) ?? workspaceChoices[0];
  const canCreate = Boolean(activeWorkspace?.canManage && activeWorkspace.key !== 'all');
  const canManageLead = Boolean((access?.isAdmin && selectedLead) || (activeWorkspace?.canManage && activeWorkspace.key !== 'all'));
  const propertyRequired = Boolean(activeWorkspace?.companyId && activeWorkspace.propertyScope && !activeWorkspace.propertyScope.allProperties);
  const createSources: CrmLeadSource[] = activeWorkspace?.key === 'admin' ? ['ADMIN_CREATED', 'MANUAL'] : activeWorkspace?.companyId ? ['PMS_OWNER', 'PMS_TENANT', 'PMS_MAINTENANCE_VENDOR', 'MANUAL'] : ['MANUAL'];

  function currentFilters() {
    return {
      companyId: activeWorkspace?.companyId,
      workspace: activeWorkspace?.key === 'personal' ? 'personal' as const : activeWorkspace?.key === 'all' ? 'all' as const : activeWorkspace?.key === 'admin' ? 'admin' as const : undefined,
      search: search || undefined,
      status: status || undefined,
      priority: priority || undefined,
      source: source || undefined,
      assignedToId: assignedToId || undefined,
      from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
      to: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined
    };
  }

  useEffect(() => {
    const requested = searchParams.get('workspace');
    setWorkspaceKey((current) => {
      if (requested && workspaceChoices.some((item) => item.key === requested)) return requested;
      if (workspaceChoices.some((item) => item.key === current)) return current;
      return workspaceChoices[0]?.key ?? '';
    });
  }, [workspaceChoices, searchParams]);

  useEffect(() => {
    if (!workspaceKey) return;
    if (latestSearchParamsRef.current.get('workspace') === workspaceKey) return;
    replaceCrmQuery({ workspace: workspaceKey });
  }, [replaceCrmQuery, workspaceKey]);

  async function loadWorkspaceSupport(choice: WorkspaceChoice | undefined) {
    if (!token || !choice) return;
    const [assigneeResponse, propertyResponse] = await Promise.all([
      listCrmAssignees(token, choice.companyId),
      choice.companyId ? listCrmProperties(token, choice.companyId) : Promise.resolve({ properties: [] })
    ]);
    setAssignees(assigneeResponse.assignees);
    setProperties(propertyResponse.properties);
  }

  async function loadWorkspaceData(options: { silent?: boolean } = {}) {
    if (!token || !activeWorkspace) return;
    if (!options.silent) setRefreshing(true);
    try {
      setError('');
      const filters = currentFilters();
      const [leadResponse, analyticsResponse, pipelineResponse, taskResponse] = await Promise.all([
        listCrmLeads(token, { ...filters, take: 80 }),
        getCrmAnalytics(token, filters),
        getCrmPipeline(token, { ...filters, groupBy, take: 160 }),
        listCrmTasks(token, { companyId: filters.companyId, workspace: filters.workspace, assignedToId: assignedToId || undefined, taskStatus: 'OPEN', take: 12 })
      ]);
      setLeads(leadResponse.leads);
      setSummary(leadResponse.summary);
      setAnalytics(analyticsResponse.analytics);
      setPipelineGroups(pipelineResponse.pipeline.groups);
      setTasks(taskResponse.tasks);
      if (selectedLead && !leadResponse.leads.some((lead) => lead.id === selectedLead.id) && !leadId) setSelectedLead(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : copy.unavailable);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!activeWorkspace) return;
    void Promise.all([loadWorkspaceSupport(activeWorkspace), loadWorkspaceData()]);
  }, [workspaceKey, access]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadWorkspaceData({ silent: true }), 250);
    return () => window.clearTimeout(timeout);
  }, [search, status, priority, source, assignedToId, dateFrom, dateTo, groupBy]);

  async function selectLead(lead: CrmLead | string, updateRoute = true) {
    if (!token) return;
    const id = typeof lead === 'string' ? lead : lead.id;
    try {
      setDetailLoading(true);
      setError('');
      const [leadResponse, templateResponse] = await Promise.all([
        getCrmLead(token, id),
        getCrmCommunicationTemplates(token, id)
      ]);
      setSelectedLead(leadResponse.lead);
      setTemplates(templateResponse.templates);
      const companyWorkspaceKey = leadResponse.lead.companyId ? `company:${leadResponse.lead.companyId}` : null;
      if (companyWorkspaceKey && workspaceChoices.some((choice) => choice.key === companyWorkspaceKey)) setWorkspaceKey(companyWorkspaceKey);
      else if (leadResponse.lead.ownerUserId === user?.id && workspaceChoices.some((choice) => choice.key === 'personal')) setWorkspaceKey('personal');
      if (updateRoute) navigate({ pathname: `/crm/leads/${id}`, search: latestCrmSearch() });
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : copy.unavailable);
      if (updateRoute) navigate({ pathname: '/crm/leads', search: latestCrmSearch() });
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (token && leadId && access?.hasAccess) void selectLead(leadId, false);
    if (!leadId) {
      setSelectedLead(null);
      setTemplates([]);
    }
  }, [token, leadId, access?.hasAccess]);

  useEffect(() => {
    if (!token || !selectedLead) return;
    if (!selectedLead.companyId) {
      const requiredPeople = [
        access?.isAdmin && user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
        selectedLead.assignedTo,
        selectedLead.ownerUser
      ].filter((person): person is CrmPerson => Boolean(person));
      setAssignees([...new Map(requiredPeople.map((person) => [person.id, person])).values()]);
      return;
    }
    void listCrmAssignees(token, selectedLead.companyId, selectedLead.pmsProperty?.id)
      .then((response) => {
        const requiredPeople = [selectedLead.assignedTo, selectedLead.ownerUser].filter((person): person is CrmPerson => Boolean(person));
        const unique = new Map(response.assignees.map((person) => [person.id, person]));
        for (const person of requiredPeople) unique.set(person.id, person);
        setAssignees([...unique.values()]);
      })
      .catch((loadError) => setError(loadError instanceof ApiError ? loadError.message : copy.unavailable));
  }, [token, selectedLead?.id, selectedLead?.companyId, selectedLead?.pmsProperty?.id, access?.isAdmin, user?.id]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!token || !activeWorkspace || !canCreate) return;
    if (propertyRequired && !createForm.pmsPropertyId) {
      setError(copy.propertyRequired);
      return;
    }
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const response = await createCrmLead(token, {
        title: createForm.title,
        description: createForm.description || undefined,
        priority: createForm.priority,
        source: createForm.source,
        nextFollowUpAt: createForm.nextFollowUpAt ? new Date(createForm.nextFollowUpAt).toISOString() : null,
        expectedValue: createForm.expectedValue ? Number(createForm.expectedValue) : undefined,
        companyId: activeWorkspace.companyId ?? null,
        ownerUserId: activeWorkspace.key === 'personal' ? user?.id ?? null : null,
        assignedToId: activeWorkspace.companyId ? undefined : user?.id ?? null,
        contact: { fullName: createForm.fullName, email: createForm.email || undefined, phone: createForm.phone || undefined },
        sourceReferences: { pmsPropertyId: createForm.pmsPropertyId || undefined }
      });
      setCreateForm({ title: '', fullName: '', email: '', phone: '', description: '', priority: 'MEDIUM', source: 'MANUAL', nextFollowUpAt: '', expectedValue: '', pmsPropertyId: '' });
      setShowCreate(false);
      setSuccess(copy.save);
      await loadWorkspaceData({ silent: true });
      await selectLead(response.lead.id);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function patchLead(payload: Parameters<typeof updateCrmLead>[2]) {
    if (!token || !selectedLead) return;
    try {
      setSaving(true);
      setError('');
      const response = await updateCrmLead(token, selectedLead.id, payload);
      setSelectedLead(response.lead);
      setLeads((current) => current.map((lead) => lead.id === response.lead.id ? response.lead : lead));
      setSuccess(copy.save);
      await loadWorkspaceData({ silent: true });
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddActivity(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedLead || !activityForm.subject) return;
    const isCommunication = ['CALL', 'EMAIL', 'WHATSAPP', 'MEETING'].includes(activityForm.type);
    try {
      setSaving(true);
      setError('');
      await addCrmActivity(token, selectedLead.id, {
        type: activityForm.type,
        priority: activityForm.priority,
        subject: activityForm.subject,
        body: activityForm.body || undefined,
        dueAt: activityForm.dueAt ? new Date(activityForm.dueAt).toISOString() : null,
        assignedToId: activityForm.type === 'TASK' ? selectedLead.assignedToId : undefined,
        communicationDirection: isCommunication ? 'OUTBOUND' : undefined,
        communicationOutcome: isCommunication && activityForm.outcome ? activityForm.outcome : undefined
      });
      setActivityForm({ type: 'TASK', subject: '', body: '', dueAt: '', priority: 'MEDIUM', outcome: '' });
      await selectLead(selectedLead.id, false);
      await loadWorkspaceData({ silent: true });
      setSuccess(copy.save);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function completeActivity(activityId: string, leadId = selectedLead?.id) {
    if (!token || !leadId) return;
    try {
      await updateCrmActivity(token, leadId, activityId, { status: 'COMPLETED' });
      if (selectedLead?.id === leadId) await selectLead(leadId, false);
      await loadWorkspaceData({ silent: true });
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    }
  }

  async function logDraftOpen(template: CrmCommunicationTemplate, type: 'EMAIL' | 'WHATSAPP') {
    if (!token || !selectedLead || !canManageLead) return;
    try {
      await addCrmActivity(token, selectedLead.id, {
        type,
        status: 'COMPLETED',
        priority: 'MEDIUM',
        subject: `${template.label} draft opened`,
        body: template.body,
        communicationDirection: 'OUTBOUND',
        communicationOutcome: 'DRAFT_OPENED',
        templateKey: template.key
      });
      await selectLead(selectedLead.id, false);
      await loadWorkspaceData({ silent: true });
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    }
  }

  const sectionCopy = language === 'ar'
    ? {
        overview: { title: copy.title, description: copy.description },
        leads: { title: 'العملاء المحتملون ومسار المبيعات', description: 'استعرض العملاء المحتملين وابحث وصفِّ النتائج وافتح السجل الكامل دون فقدان مساحة العمل أو عوامل التصفية.' },
        tasks: { title: 'مهام CRM والمتابعات', description: 'راجع مهام المتابعة المفتوحة والمتأخرة ضمن مساحة العمل المحددة.' }
      }
    : {
        overview: { title: copy.title, description: copy.description },
        leads: { title: 'Leads and sales pipeline', description: 'Browse, filter, and inspect leads without losing the selected workspace or URL-backed view state.' },
        tasks: { title: 'CRM tasks and follow-ups', description: 'Review open and overdue follow-up work in the selected workspace.' }
      };
  const activeSectionCopy = sectionCopy[section];

  if (!access?.hasAccess) return <section className="page-section container crm-page"><div className="crm-state"><AlertCircle /><h1>{copy.noAccess}</h1><Link className="button-link" to="/dashboard">{copy.back}</Link></div></section>;

  return (
    <section className="crm-page" aria-labelledby="crm-title">
      <header className="crm-hero container">
        <div>
          <p className="eyebrow"><UsersRound size={17} /> {copy.eyebrow}</p>
          <h1 id="crm-title">{activeSectionCopy.title}</h1>
          <p>{activeSectionCopy.description}</p>
        </div>
        <div className="crm-hero__actions">
          <Link className="button-link button-link--ghost" to={activeWorkspace?.companyId ? '/pms/overview' : '/dashboard'}><ArrowLeft size={16} /> {copy.back}</Link>
          <button className="button-link button-link--secondary" type="button" onClick={() => void loadWorkspaceData()} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /> {copy.refresh}</button>
          {section === 'leads' && canCreate ? <button className="button-link button-link--primary" type="button" onClick={() => setShowCreate(true)}><Plus size={16} /> {copy.newLead}</button> : null}
        </div>
      </header>

      <div className="crm-shell container">
        <aside className="crm-sidebar">
          <WorkspaceSelector label={copy.workspace} value={workspaceKey} choices={workspaceChoices} onChange={(value) => {
            setWorkspaceKey(value);
            setSelectedLead(null);
            replaceCrmQuery(
              { workspace: value, workspaceId: null },
              section === 'tasks' ? '/crm/tasks' : section === 'overview' ? '/crm/overview' : '/crm/leads'
            );
          }} />
          {section === 'leads' ? <>
            <div className="crm-filter-title"><Filter size={16} /><strong>{copy.allValues}</strong></div>
            <label><span>{copy.search}</span><div className="crm-search"><Search size={15} /><input value={search} onChange={(event) => replaceCrmQuery({ q: event.target.value })} placeholder={copy.search} /></div></label>
            <label><span>{copy.status}</span><select value={status} onChange={(event) => replaceCrmQuery({ status: event.target.value })}><option value="">{copy.allValues}</option>{statuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
            <label><span>{copy.priority}</span><select value={priority} onChange={(event) => replaceCrmQuery({ priority: event.target.value })}><option value="">{copy.allValues}</option>{priorities.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
            <label><span>{copy.source}</span><select value={source} onChange={(event) => replaceCrmQuery({ source: event.target.value })}><option value="">{copy.allValues}</option>{sources.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
            <label><span>{copy.assigned}</span><select value={assignedToId} onChange={(event) => replaceCrmQuery({ assignedTo: event.target.value })}><option value="">{copy.allValues}</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label><span>{copy.dateFrom}</span><input type="date" value={dateFrom} onChange={(event) => replaceCrmQuery({ from: event.target.value })} /></label>
            <label><span>{copy.dateTo}</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => replaceCrmQuery({ to: event.target.value })} /></label>
          </> : null}
        </aside>

        <main className="crm-main">
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {success ? <div className="form-success" role="status">{success}</div> : null}

          {section === 'overview' ? <section className="crm-metrics" aria-label={copy.analytics}>
            <article><Inbox /><span>{copy.total}</span><strong>{analytics.total || summary.total}</strong></article>
            <article><UserRound /><span>{copy.newCount}</span><strong>{analytics.newLeads}</strong></article>
            <article><Target /><span>{copy.open}</span><strong>{analytics.openLeads}</strong></article>
            <article className={analytics.overdueFollowUps > 0 ? 'crm-metric--risk' : ''}><CalendarClock /><span>{copy.overdue}</span><strong>{analytics.overdueFollowUps}</strong></article>
            <article><CheckCircle2 /><span>{copy.won}</span><strong>{analytics.won}</strong></article>
            <article><BarChart3 /><span>{copy.conversion}</span><strong>{analytics.conversionRate === null ? '—' : `${analytics.conversionRate}%`}</strong></article>
          </section> : null}

          {section === 'overview' || section === 'tasks' ? <section className={`crm-productivity-grid${section === 'tasks' ? ' crm-productivity-grid--tasks' : ''}`}>
            <article className="crm-productivity-card">
              <header><div><p className="eyebrow">{copy.tasks}</p><h2>{analytics.openTasks} {copy.open.toLowerCase()}</h2></div>{analytics.overdueTasks > 0 ? <span className="crm-risk-count">{analytics.overdueTasks} {copy.overdue.toLowerCase()}</span> : null}</header>
              <div className="crm-task-queue">
                {tasks.length === 0 ? <p>{copy.noTasks}</p> : tasks.slice(0, 6).map((task) => (
                  <article key={task.id} className={isOverdue(task.dueAt) ? 'crm-task-row crm-task-row--overdue' : 'crm-task-row'}>
                    <button type="button" onClick={() => void selectLead(task.lead.id)}><strong>{task.subject}</strong><span>{task.lead.title} · {task.lead.contact.fullName}</span><small>{formatDate(task.dueAt, locale)} · {humanize(task.priority)}</small></button>
                    <button type="button" className="button-link button-link--ghost" onClick={() => void completeActivity(task.id, task.lead.id)} aria-label={copy.complete}><CheckCircle2 size={16} /></button>
                  </article>
                ))}
              </div>
            </article>
            {section === 'overview' ? <article className="crm-productivity-card">
              <header><div><p className="eyebrow">{copy.sourceConversion}</p><h2>{copy.analytics}</h2></div></header>
              <div className="crm-source-analytics">
                {analytics.bySource.slice(0, 6).map((item) => (
                  <div key={item.source}><span>{humanize(item.source)}</span><strong>{item.total}</strong><small>{item.conversionRate === null ? '—' : `${item.conversionRate}%`}</small></div>
                ))}
                {analytics.bySource.length === 0 ? <p>{copy.notConfigured}</p> : null}
              </div>
            </article> : null}
          </section> : null}

          {section === 'leads' ? <>
          <section className="crm-pipeline-toolbar">
            <div><p className="eyebrow">{copy.pipeline}</p><strong>{summary.total} {copy.total.toLowerCase()}</strong></div>
            <div className="crm-view-toggle" role="group" aria-label={copy.pipeline}>
              <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => replaceCrmQuery({ view: 'list', groupBy: null })}><LayoutList size={16} /> {copy.list}</button>
              <button type="button" className={viewMode === 'board' ? 'is-active' : ''} onClick={() => replaceCrmQuery({ view: 'board', groupBy })}><Columns3 size={16} /> {copy.board}</button>
            </div>
            {viewMode === 'board' ? <label><span>{copy.groupBy}</span><select value={groupBy} onChange={(event) => replaceCrmQuery({ groupBy: event.target.value })}><option value="status">{copy.status}</option><option value="assignedTo">{copy.assigned}</option><option value="source">{copy.source}</option><option value="company">{copy.workspace}</option></select></label> : null}
          </section>

          {viewMode === 'board' ? (
            <section className="crm-pipeline-board" aria-label={copy.pipeline}>
              {pipelineGroups.length === 0 ? <div className="crm-empty"><Inbox /><h2>{copy.empty}</h2><p>{copy.emptyHelp}</p></div> : pipelineGroups.map((group) => (
                <section key={group.key} className="crm-pipeline-column">
                  <header><div><strong>{humanize(group.label)}</strong><span>{group.count}</span></div>{Object.entries(group.valuesByCurrency).map(([currency, value]) => <small key={currency}>{currency} {value.toLocaleString(locale)}</small>)}</header>
                  <div>{group.leads.map((lead) => <LeadCard key={lead.id} lead={lead} selected={selectedLead?.id === lead.id} locale={locale} onSelect={() => void selectLead(lead)} />)}</div>
                </section>
              ))}
            </section>
          ) : (
            <div className="crm-workspace">
              <section className="crm-lead-list" aria-label={copy.total}>
                {leads.length === 0 ? <div className="crm-empty"><Inbox /><h2>{copy.empty}</h2><p>{copy.emptyHelp}</p></div> : leads.map((lead) => <LeadCard key={lead.id} lead={lead} selected={selectedLead?.id === lead.id} locale={locale} onSelect={() => void selectLead(lead)} />)}
              </section>
              <LeadDetail />
            </div>
          )}

          {viewMode === 'board' && selectedLead ? <LeadDetail /> : null}
          </> : null}
        </main>
      </div>

      {section === 'leads' && showCreate ? (
        <div className="crm-modal-backdrop" role="presentation">
          <form className="crm-modal" onSubmit={handleCreate}>
            <header><div><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.newLead}</h2></div><button type="button" className="button-link button-link--ghost" onClick={() => setShowCreate(false)}>{copy.cancel}</button></header>
            <div className="crm-form-grid">
              <label><span>{copy.titleLabel}</span><input required value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label><span>{copy.name}</span><input required value={createForm.fullName} onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
              <label><span>{copy.email}</span><input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <label><span>{copy.phone}</span><input value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label><span>{copy.priority}</span><select value={createForm.priority} onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value as CrmLeadPriority }))}>{priorities.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
              <label><span>{copy.source}</span><select value={createForm.source} onChange={(event) => setCreateForm((current) => ({ ...current, source: event.target.value as CrmLeadSource }))}>{createSources.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
              <label><span>{copy.followUp}</span><input type="datetime-local" value={createForm.nextFollowUpAt} onChange={(event) => setCreateForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))} /></label>
              <label><span>{copy.expectedValue}</span><input type="number" min="0" step="0.001" value={createForm.expectedValue} onChange={(event) => setCreateForm((current) => ({ ...current, expectedValue: event.target.value }))} /></label>
              {activeWorkspace?.companyId && properties.length > 0 ? <label><span>{copy.property}</span><select required={propertyRequired} value={createForm.pmsPropertyId} onChange={(event) => setCreateForm((current) => ({ ...current, pmsPropertyId: event.target.value }))}><option value="">{copy.allValues}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}{property.code ? ` · ${property.code}` : ''}</option>)}</select></label> : null}
            </div>
            <label><span>{copy.descriptionLabel}</span><textarea value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <button className="button-link button-link--primary" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} {copy.create}</button>
          </form>
        </div>
      ) : null}
    </section>
  );

  function LeadDetail() {
    return (
      <section className="crm-detail">
        {detailLoading ? <div className="crm-empty"><Loader2 className="spin" /><h2>{copy.loading}</h2></div> : !selectedLead ? <div className="crm-empty"><ClipboardList /><h2>{copy.noSelection}</h2></div> : (
          <>
            <header className="crm-detail__header">
              <div><p className="eyebrow">{humanize(selectedLead.source)}</p><h2>{selectedLead.title}</h2><p>{selectedLead.description || copy.notConfigured}</p></div>
              {sourceRoute(selectedLead) ? <Link className="button-link button-link--soft" to={sourceRoute(selectedLead)!}>{copy.sourceObject}</Link> : null}
            </header>

            {selectedLead.intelligence ? (
              <section className="crm-intelligence-grid">
                <article className={`crm-score-card crm-score-card--${selectedLead.intelligence.scoreBand.toLowerCase()}`}>
                  <div><Flame size={19} /><span>{copy.score}</span></div><strong>{selectedLead.intelligence.score}</strong><small>{humanize(selectedLead.intelligence.scoreBand)}</small>
                  <ul>{selectedLead.intelligence.scoreReasons.slice(0, 4).map((reason) => <li key={reason.key}><span>{reason.label}</span><strong>+{reason.points}</strong></li>)}</ul>
                </article>
                <article className="crm-next-action">
                  <div><Sparkles size={19} /><span>{copy.nextAction}</span><strong className={`crm-priority crm-priority--${selectedLead.intelligence.nextBestAction.priority.toLowerCase()}`}>{humanize(selectedLead.intelligence.nextBestAction.priority)}</strong></div>
                  <h3>{selectedLead.intelligence.nextBestAction.title}</h3><p>{selectedLead.intelligence.nextBestAction.description}</p><small><strong>{copy.why}:</strong> {selectedLead.intelligence.nextBestAction.reason}</small>
                </article>
              </section>
            ) : null}

            <div className="crm-detail__controls">
              {!selectedLead.convertedAt && selectedLead.status !== 'ARCHIVED' ? <Link className="button-link button-link--secondary" to={`/crm/deals?workspaceId=${selectedLead.workspaceId}&convertLeadId=${selectedLead.id}`}>Convert to deal</Link> : null}
              <label><span>{copy.status}</span><select value={selectedLead.status} disabled={!canManageLead || saving} onChange={(event) => void patchLead({ status: event.target.value as CrmLeadStatus })}>{statuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
              <label><span>{copy.priority}</span><select value={selectedLead.priority} disabled={!canManageLead || saving} onChange={(event) => void patchLead({ priority: event.target.value as CrmLeadPriority })}>{priorities.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
              <label><span>{copy.assigned}</span><select value={selectedLead.assignedToId || ''} disabled={!canManageLead || saving} onChange={(event) => void patchLead({ assignedToId: event.target.value || null })}><option value="">{copy.allValues}</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <label><span>{copy.followUp}</span><input type="datetime-local" disabled={!canManageLead || saving} value={selectedLead.nextFollowUpAt ? new Date(new Date(selectedLead.nextFollowUpAt).getTime() - new Date(selectedLead.nextFollowUpAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={(event) => void patchLead({ nextFollowUpAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
            </div>

            <div className="crm-detail__grid">
              <article className="crm-card"><h3><UserRound size={17} /> {copy.contact}</h3><strong>{selectedLead.contact.fullName}</strong><a href={selectedLead.contact.email ? `mailto:${selectedLead.contact.email}` : undefined}>{selectedLead.contact.email || '—'}</a><a href={selectedLead.contact.phone ? `tel:${selectedLead.contact.phone}` : undefined}>{selectedLead.contact.phone || '—'}</a>{selectedLead.company ? <span><Building2 size={14} /> {language === 'ar' ? selectedLead.company.nameAr || selectedLead.company.nameEn : selectedLead.company.nameEn}</span> : null}</article>
              <article className="crm-card"><h3><CircleDollarSign size={17} /> {copy.details}</h3><span>{copy.expectedValue}: {selectedLead.expectedValue ? `${selectedLead.currency} ${selectedLead.expectedValue}` : '—'}</span><span>{copy.followUp}: {formatDate(selectedLead.nextFollowUpAt, locale)}</span><span>{copy.source}: {selectedLead.sourceLabel || humanize(selectedLead.source)}</span></article>
            </div>

            <section className="crm-communication-panel">
              <header><div><MessageCircle size={18} /><div><h3>{copy.communications}</h3><p>{copy.draftOnly}</p></div></div></header>
              <div className="crm-template-grid">
                {templates.map((template) => (
                  <article key={template.key}><strong>{template.label}</strong><p>{template.description}</p><div>{template.emailHref ? <a href={template.emailHref} onClick={() => void logDraftOpen(template, 'EMAIL')}><Mail size={15} /> {copy.openEmail}</a> : null}{template.whatsappHref ? <a href={template.whatsappHref} target="_blank" rel="noreferrer" onClick={() => void logDraftOpen(template, 'WHATSAPP')}><MessageCircle size={15} /> {copy.openWhatsapp}</a> : null}</div></article>
                ))}
              </div>
            </section>

            {canManageLead ? (
              <form className="crm-activity-form" onSubmit={handleAddActivity}>
                <h3><MessageSquareText size={17} /> {copy.task}</h3>
                <div className="crm-form-grid">
                  <label><span>{copy.activityType}</span><select value={activityForm.type} onChange={(event) => setActivityForm((current) => ({ ...current, type: event.target.value as ManualActivityType }))}><option value="TASK">Task</option><option value="NOTE">Note</option><option value="CALL">Call</option><option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option><option value="MEETING">Meeting</option></select></label>
                  <label><span>{copy.activitySubject}</span><input required value={activityForm.subject} onChange={(event) => setActivityForm((current) => ({ ...current, subject: event.target.value }))} /></label>
                  <label><span>{copy.taskPriority}</span><select value={activityForm.priority} onChange={(event) => setActivityForm((current) => ({ ...current, priority: event.target.value as CrmActivityPriority }))}>{activityPriorities.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
                  <label><span>{copy.dueAt}</span><input type="datetime-local" value={activityForm.dueAt} onChange={(event) => setActivityForm((current) => ({ ...current, dueAt: event.target.value }))} /></label>
                  {['CALL', 'EMAIL', 'WHATSAPP', 'MEETING'].includes(activityForm.type) ? <label><span>{copy.outcome}</span><select value={activityForm.outcome} onChange={(event) => setActivityForm((current) => ({ ...current, outcome: event.target.value as CrmCommunicationOutcome | '' }))}><option value="">{copy.allValues}</option>{communicationOutcomes.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label> : null}
                </div>
                <textarea placeholder={copy.activityBody} value={activityForm.body} onChange={(event) => setActivityForm((current) => ({ ...current, body: event.target.value }))} />
                <button className="button-link button-link--primary" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} {copy.addActivity}</button>
              </form>
            ) : null}

            <section className="crm-timeline">
              <h3>{copy.timeline}</h3>
              {selectedLead.activities?.length ? selectedLead.activities.map((activity) => (
                <article key={activity.id}>
                  <span className="crm-timeline__dot" />
                  <div><div><strong>{activity.subject}</strong><small>{formatDate(activity.createdAt, locale)}</small></div><p>{activity.body || humanize(activity.type)}</p><span>{humanize(activity.type)} · {humanize(activity.status)} · {humanize(activity.priority)}{activity.communicationOutcome ? ` · ${humanize(activity.communicationOutcome)}` : ''}{activity.assignedTo ? ` · ${activity.assignedTo.name}` : ''}</span></div>
                  {canManageLead && activity.status === 'OPEN' ? <button className="button-link button-link--ghost" type="button" onClick={() => void completeActivity(activity.id)}>{copy.complete}</button> : null}
                </article>
              )) : <p>{copy.notConfigured}</p>}
            </section>
          </>
        )}
      </section>
    );
  }
}

function LeadCard({ lead, selected, locale, onSelect }: { lead: CrmLead; selected: boolean; locale: string; onSelect: () => void }) {
  return (
    <button type="button" className={`crm-lead-card${selected ? ' crm-lead-card--active' : ''}`} onClick={onSelect}>
      <div className="crm-lead-card__top"><span className={`crm-priority crm-priority--${lead.priority.toLowerCase()}`}>{humanize(lead.priority)}</span>{lead.intelligence ? <span className={`crm-score-pill crm-score-pill--${lead.intelligence.scoreBand.toLowerCase()}`}>{lead.intelligence.score}</span> : null}<small>{formatDate(lead.updatedAt, locale)}</small></div>
      <strong>{lead.title}</strong>
      <span>{lead.contact.fullName}</span>
      <div className="crm-lead-card__meta"><span>{humanize(lead.status)}</span><span>{humanize(lead.source)}</span></div>
      {lead.intelligence ? <small className="crm-lead-card__action"><Sparkles size={13} /> {lead.intelligence.nextBestAction.title}</small> : null}
      {lead.nextFollowUpAt ? <small className={isOverdue(lead.nextFollowUpAt) ? 'crm-overdue-text' : ''}><CalendarClock size={13} /> {formatDate(lead.nextFollowUpAt, locale)}</small> : null}
    </button>
  );
}

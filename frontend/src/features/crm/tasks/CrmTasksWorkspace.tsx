import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import {
  addCrmActivity,
  listCrmAssignees,
  listCrmLeads,
  listCrmTasks,
  updateCrmActivity,
  type CrmActivityPriority,
  type CrmActivityStatus,
  type CrmLead,
  type CrmPerson,
  type CrmTaskDirection,
  type CrmTaskRecord,
  type CrmTaskSortBy,
  type CrmWorkspaceAccess
} from '../../../api/crm';
import { useAuth } from '../../../auth/AuthContext';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useLanguage } from '../../../i18n/LanguageContext';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../WorkspaceSelector';

const PAGE_SIZE = 25;
const taskStatuses: CrmActivityStatus[] = ['OPEN', 'COMPLETED', 'CANCELLED'];
const taskPriorities: CrmActivityPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

type TaskWorkspaceChoice = CrmWorkspaceChoice & {
  scope: 'personal' | 'company' | 'admin';
};

type TaskForm = {
  subject: string;
  body: string;
  dueAt: string;
  priority: CrmActivityPriority;
  status: CrmActivityStatus;
  assignedToId: string;
};

const emptyTaskForm: TaskForm = {
  subject: '',
  body: '',
  dueAt: '',
  priority: 'MEDIUM',
  status: 'OPEN',
  assignedToId: ''
};

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'CRM task operation failed.';
}

function workspaceChoices(access: CrmWorkspaceAccess | null | undefined, language: 'en' | 'ar'): TaskWorkspaceChoice[] {
  if (!access) return [];
  const choices: TaskWorkspaceChoice[] = [];
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

function safeStatus(value: string | null): CrmActivityStatus | '' {
  return taskStatuses.includes(value as CrmActivityStatus) ? value as CrmActivityStatus : '';
}

function safePriority(value: string | null): CrmActivityPriority | '' {
  return taskPriorities.includes(value as CrmActivityPriority) ? value as CrmActivityPriority : '';
}

function safeSort(value: string | null): CrmTaskSortBy {
  return value === 'priority' || value === 'createdAt' || value === 'status' ? value : 'dueAt';
}

function safeDirection(value: string | null): CrmTaskDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function dateStart(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function dateEnd(value: string) {
  return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : undefined;
}

function isOverdue(task: CrmTaskRecord) {
  return task.status === 'OPEN' && Boolean(task.dueAt) && new Date(task.dueAt!).getTime() < Date.now();
}

export default function CrmTasksWorkspace() {
  const { token, crmAccess } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-OM' : 'en-OM';
  const [params, setParams] = useSearchParams();
  const pendingParamsRef = useRef(new URLSearchParams(params));
  const choices = useMemo(() => workspaceChoices(crmAccess, language), [crmAccess, language]);
  const requestedWorkspaceId = params.get('workspaceId');
  const requestedWorkspaceKey = params.get('workspace');
  const [workspaceId, setWorkspaceId] = useState('');
  const activeChoice = choices.find((choice) => choice.workspaceId === workspaceId);
  const canManage = Boolean(activeChoice?.canManage);

  const page = Math.max(1, Number(params.get('taskPage')) || 1);
  const search = params.get('taskQ')?.trim() ?? '';
  const status = safeStatus(params.get('taskStatus'));
  const priority = safePriority(params.get('taskPriority'));
  const assignedToId = params.get('taskAssignee') ?? '';
  const overdueOnly = params.get('taskOverdue') === 'true';
  const dueFrom = params.get('taskDueFrom') ?? '';
  const dueTo = params.get('taskDueTo') ?? '';
  const sortBy = safeSort(params.get('taskSort'));
  const direction = safeDirection(params.get('taskDirection'));

  const [searchInput, setSearchInput] = useState(search);
  const [statusInput, setStatusInput] = useState<CrmActivityStatus | ''>(status);
  const [priorityInput, setPriorityInput] = useState<CrmActivityPriority | ''>(priority);
  const [assignedToInput, setAssignedToInput] = useState(assignedToId);
  const [dueFromInput, setDueFromInput] = useState(dueFrom);
  const [dueToInput, setDueToInput] = useState(dueTo);
  const [sortInput, setSortInput] = useState<CrmTaskSortBy>(sortBy);
  const [directionInput, setDirectionInput] = useState<CrmTaskDirection>(direction);
  const [overdueInput, setOverdueInput] = useState(overdueOnly);
  const [tasks, setTasks] = useState<CrmTaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [overdueTotal, setOverdueTotal] = useState(0);
  const [assignees, setAssignees] = useState<CrmPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadOptions, setLeadOptions] = useState<CrmLead[]>([]);
  const [leadId, setLeadId] = useState('');
  const [createForm, setCreateForm] = useState<TaskForm>(emptyTaskForm);

  const [selectedTask, setSelectedTask] = useState<CrmTaskRecord | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState('');

  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const createSubjectRef = useRef<HTMLInputElement>(null);
  const taskTriggerRef = useRef<HTMLButtonElement>(null);
  const taskSubjectRef = useRef<HTMLInputElement>(null);

  useDocumentTitle(language === 'ar' ? 'مهام CRM | lux.om' : 'CRM tasks | lux.om');

  const copy = language === 'ar'
    ? {
        eyebrow: 'متابعة محكومة وقابلة للتنفيذ',
        title: 'مركز مهام CRM',
        description: 'استعرض مهام المتابعة وابحث وصفِّ النتائج وحدّث المسؤولية والحالة دون فقدان نطاق مساحة العمل.',
        workspace: 'مساحة العمل',
        refresh: 'تحديث المهام',
        create: 'إنشاء مهمة',
        readOnly: 'عرض فقط',
        readOnlyBody: 'يمكنك مراجعة مهام CRM، لكن صلاحيتك الحالية لا تسمح بإنشائها أو تعديلها.',
        total: 'إجمالي النتائج',
        overdue: 'متأخرة',
        search: 'بحث في المهمة أو العميل أو جهة الاتصال',
        searchPlaceholder: 'مثال: معاينة أو اسم العميل',
        status: 'الحالة',
        priority: 'الأولوية',
        assignee: 'المسؤول',
        all: 'الكل',
        overdueOnly: 'المهام المتأخرة فقط',
        dueFrom: 'الاستحقاق من',
        dueTo: 'الاستحقاق إلى',
        sort: 'الترتيب',
        direction: 'الاتجاه',
        apply: 'تطبيق عوامل التصفية',
        reset: 'إعادة الضبط',
        dueDate: 'موعد الاستحقاق',
        createdAt: 'وقت الإنشاء',
        ascending: 'تصاعدي',
        descending: 'تنازلي',
        loading: 'جارٍ تحميل مهام CRM…',
        emptyTitle: 'لا توجد مهام مطابقة',
        emptyBody: 'عدّل عوامل التصفية أو أنشئ مهمة متابعة محكومة.',
        task: 'المهمة',
        lead: 'العميل المحتمل',
        contact: 'جهة الاتصال',
        actions: 'الإجراءات',
        review: 'مراجعة المهمة',
        complete: 'إكمال المهمة',
        page: 'صفحة',
        of: 'من',
        previous: 'السابق',
        next: 'التالي',
        closeCreate: 'إغلاق إنشاء المهمة',
        createTitle: 'إنشاء مهمة CRM محكومة',
        createDescription: 'ترتبط المهمة بعميل محتمل موجود وتبقى داخل نطاق مساحة العمل وصلاحيات الإسناد.',
        findLead: 'البحث عن عميل محتمل',
        findLeadPlaceholder: 'العنوان أو اسم جهة الاتصال',
        find: 'بحث',
        chooseLead: 'اختر عميلاً محتملاً',
        noLeads: 'لا توجد عملاء محتملون مطابقون داخل النطاق.',
        subject: 'عنوان المهمة',
        notes: 'التفاصيل',
        dueAt: 'موعد الاستحقاق',
        saveTask: 'حفظ المهمة',
        saving: 'جارٍ الحفظ…',
        created: 'تم إنشاء مهمة CRM.',
        closeReview: 'إغلاق مراجعة المهمة',
        reviewDescription: 'راجع سجل المهمة وحدّث الحقول المحكومة فقط عندما تسمح صلاحيتك بذلك.',
        saveChanges: 'حفظ التغييرات',
        saved: 'تم تحديث مهمة CRM.',
        openLead: 'فتح العميل المحتمل',
        assignedTo: 'مسندة إلى',
        createdBy: 'أنشأها',
        open: 'مفتوحة',
        completed: 'مكتملة',
        cancelled: 'ملغاة',
        low: 'منخفضة',
        medium: 'متوسطة',
        high: 'عالية',
        urgent: 'عاجلة'
      }
    : {
        eyebrow: 'Governed and actionable follow-up',
        title: 'CRM task center',
        description: 'Browse, search, filter, assign, and update follow-up work without losing the selected workspace scope.',
        workspace: 'Workspace',
        refresh: 'Refresh tasks',
        create: 'Create task',
        readOnly: 'Read only',
        readOnlyBody: 'You can review CRM tasks, but your current permission does not allow task creation or changes.',
        total: 'Total results',
        overdue: 'Overdue',
        search: 'Search task, lead, or contact',
        searchPlaceholder: 'For example: viewing or contact name',
        status: 'Status',
        priority: 'Priority',
        assignee: 'Assignee',
        all: 'All',
        overdueOnly: 'Overdue tasks only',
        dueFrom: 'Due from',
        dueTo: 'Due to',
        sort: 'Sort by',
        direction: 'Direction',
        apply: 'Apply filters',
        reset: 'Reset',
        dueDate: 'Due date',
        createdAt: 'Created time',
        ascending: 'Ascending',
        descending: 'Descending',
        loading: 'Loading CRM tasks…',
        emptyTitle: 'No matching tasks',
        emptyBody: 'Adjust the filters or create a governed follow-up task.',
        task: 'Task',
        lead: 'Lead',
        contact: 'Contact',
        actions: 'Actions',
        review: 'Review task',
        complete: 'Complete task',
        page: 'Page',
        of: 'of',
        previous: 'Previous',
        next: 'Next',
        closeCreate: 'Close task creation',
        createTitle: 'Create governed CRM task',
        createDescription: 'The task is attached to an existing lead and remains inside workspace and assignment scope.',
        findLead: 'Find lead',
        findLeadPlaceholder: 'Lead title or contact name',
        find: 'Search',
        chooseLead: 'Choose a lead',
        noLeads: 'No matching leads are available inside your scope.',
        subject: 'Task subject',
        notes: 'Details',
        dueAt: 'Due date and time',
        saveTask: 'Save task',
        saving: 'Saving…',
        created: 'The CRM task was created.',
        closeReview: 'Close task review',
        reviewDescription: 'Review the task record and update governed fields only when your permission allows it.',
        saveChanges: 'Save changes',
        saved: 'The CRM task was updated.',
        openLead: 'Open lead',
        assignedTo: 'Assigned to',
        createdBy: 'Created by',
        open: 'Open',
        completed: 'Completed',
        cancelled: 'Cancelled',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent'
      };

  const statusLabels: Record<CrmActivityStatus, string> = {
    OPEN: copy.open,
    COMPLETED: copy.completed,
    CANCELLED: copy.cancelled
  };
  const priorityLabels: Record<CrmActivityPriority, string> = {
    LOW: copy.low,
    MEDIUM: copy.medium,
    HIGH: copy.high,
    URGENT: copy.urgent
  };

  useEffect(() => {
    setWorkspaceId((current) => {
      if (requestedWorkspaceId && choices.some((choice) => choice.workspaceId === requestedWorkspaceId)) return requestedWorkspaceId;
      if (requestedWorkspaceKey === 'personal') return choices.find((choice) => choice.scope === 'personal')?.workspaceId ?? current;
      if (requestedWorkspaceKey === 'admin' || requestedWorkspaceKey === 'all') return choices.find((choice) => choice.scope === 'admin')?.workspaceId ?? current;
      if (requestedWorkspaceKey?.startsWith('company:')) {
        const companyId = requestedWorkspaceKey.slice('company:'.length);
        return choices.find((choice) => choice.companyId === companyId)?.workspaceId ?? current;
      }
      if (choices.some((choice) => choice.workspaceId === current)) return current;
      return choices[0]?.workspaceId ?? '';
    });
  }, [choices, requestedWorkspaceId, requestedWorkspaceKey]);

  useEffect(() => {
    if (!workspaceId || workspaceId === requestedWorkspaceId) return;
    const next = new URLSearchParams(pendingParamsRef.current);
    next.set('workspaceId', workspaceId);
    next.delete('workspace');
    next.delete('taskPage');
    pendingParamsRef.current = next;
    setParams(next, { replace: true });
  }, [requestedWorkspaceId, setParams, workspaceId]);

  useEffect(() => {
    pendingParamsRef.current = new URLSearchParams(params);
  }, [params]);

  useEffect(() => {
    setSearchInput(search);
    setStatusInput(status);
    setPriorityInput(priority);
    setAssignedToInput(assignedToId);
    setDueFromInput(dueFrom);
    setDueToInput(dueTo);
    setSortInput(sortBy);
    setDirectionInput(direction);
    setOverdueInput(overdueOnly);
  }, [assignedToId, direction, dueFrom, dueTo, overdueOnly, priority, search, sortBy, status]);

  function scopeFilters() {
    if (activeChoice?.scope === 'company') return { companyId: activeChoice.companyId };
    if (activeChoice?.scope === 'admin') return { workspace: 'admin' as const };
    return { workspace: 'personal' as const };
  }

  function replaceQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(pendingParamsRef.current);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    pendingParamsRef.current = next;
    setParams(next, { replace: true });
  }

  function changeWorkspace(value: string) {
    setWorkspaceId(value);
    const next = new URLSearchParams(pendingParamsRef.current);
    next.set('workspaceId', value);
    next.delete('workspace');
    next.delete('taskPage');
    pendingParamsRef.current = next;
    setParams(next, { replace: true });
  }

  async function loadTasks() {
    if (!token || !activeChoice) return;
    setLoading(true);
    setError('');
    try {
      const response = await listCrmTasks(token, {
        ...scopeFilters(),
        assignedToId: assignedToId || undefined,
        taskStatus: status || undefined,
        taskPriority: priority || undefined,
        overdue: overdueOnly || undefined,
        dueFrom: dateStart(dueFrom),
        dueTo: dateEnd(dueTo),
        search: search || undefined,
        sortBy,
        direction,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE
      });
      setTasks(response.tasks);
      setTotal(response.pagination.total);
      setOverdueTotal(response.summary.overdue);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, [activeChoice?.key, assignedToId, direction, dueFrom, dueTo, overdueOnly, page, priority, search, sortBy, status, token]);

  useEffect(() => {
    if (!token || !activeChoice) return;
    void listCrmAssignees(token, activeChoice.companyId).then((response) => setAssignees(response.assignees)).catch(() => setAssignees([]));
  }, [activeChoice?.key, token]);

  async function searchLeads(value = leadSearch) {
    if (!token || !activeChoice) return;
    setCreateError('');
    try {
      const response = await listCrmLeads(token, { ...scopeFilters(), search: value.trim() || undefined, take: 50, skip: 0 });
      setLeadOptions(response.leads);
      setLeadId((current) => response.leads.some((lead) => lead.id === current) ? current : response.leads[0]?.id ?? '');
    } catch (cause) {
      setCreateError(errorMessage(cause));
    }
  }

  function openCreate() {
    setCreateOpen(true);
    setCreateError('');
    setLeadSearch('');
    setLeadOptions([]);
    setLeadId('');
    setCreateForm({ ...emptyTaskForm, assignedToId: assignees[0]?.id ?? '' });
    void searchLeads('');
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!token || !leadId || !createForm.subject.trim()) return;
    setCreateBusy(true);
    setCreateError('');
    try {
      await addCrmActivity(token, leadId, {
        type: 'TASK',
        status: 'OPEN',
        priority: createForm.priority,
        subject: createForm.subject.trim(),
        body: createForm.body.trim() || undefined,
        dueAt: createForm.dueAt ? new Date(createForm.dueAt).toISOString() : null,
        assignedToId: createForm.assignedToId || null
      });
      setCreateOpen(false);
      setSuccess(copy.created);
      await loadTasks();
    } catch (cause) {
      setCreateError(errorMessage(cause));
    } finally {
      setCreateBusy(false);
    }
  }

  function openTask(task: CrmTaskRecord, trigger: HTMLButtonElement) {
    taskTriggerRef.current = trigger;
    setSelectedTask(task);
    setTaskError('');
    setTaskForm({
      subject: task.subject,
      body: task.body ?? '',
      dueAt: toDateTimeLocal(task.dueAt),
      priority: task.priority,
      status: task.status,
      assignedToId: task.assignedToId ?? task.assignedTo?.id ?? ''
    });
  }

  async function submitTask(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedTask || !taskForm.subject.trim()) return;
    setTaskBusy(true);
    setTaskError('');
    try {
      await updateCrmActivity(token, selectedTask.lead.id, selectedTask.id, {
        subject: taskForm.subject.trim(),
        body: taskForm.body.trim() || null,
        dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
        priority: taskForm.priority,
        status: taskForm.status,
        assignedToId: taskForm.assignedToId || null
      });
      setSelectedTask(null);
      setSuccess(copy.saved);
      await loadTasks();
    } catch (cause) {
      setTaskError(errorMessage(cause));
    } finally {
      setTaskBusy(false);
    }
  }

  async function completeTask(task: CrmTaskRecord) {
    if (!token || !canManage) return;
    setError('');
    try {
      await updateCrmActivity(token, task.lead.id, task.id, { status: 'COMPLETED' });
      setSuccess(copy.saved);
      await loadTasks();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  function submitFilters(event: FormEvent) {
    event.preventDefault();
    replaceQuery({
      taskQ: searchInput.trim() || null,
      taskStatus: statusInput || null,
      taskPriority: priorityInput || null,
      taskAssignee: assignedToInput || null,
      taskOverdue: overdueInput ? 'true' : null,
      taskDueFrom: dueFromInput || null,
      taskDueTo: dueToInput || null,
      taskSort: sortInput === 'dueAt' ? null : sortInput,
      taskDirection: directionInput === 'asc' ? null : directionInput,
      taskPage: null
    });
  }

  function resetFilters() {
    setSearchInput('');
    setStatusInput('');
    setPriorityInput('');
    setAssignedToInput('');
    setDueFromInput('');
    setDueToInput('');
    setSortInput('dueAt');
    setDirectionInput('asc');
    setOverdueInput(false);
    replaceQuery({
      taskQ: null,
      taskStatus: null,
      taskPriority: null,
      taskAssignee: null,
      taskOverdue: null,
      taskDueFrom: null,
      taskDueTo: null,
      taskSort: null,
      taskDirection: null,
      taskPage: null
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="crm-route-workspace crm-tasks" aria-labelledby="crm-tasks-title">
      <header className="crm-tasks__header">
        <div>
          <p className="eyebrow"><ClipboardCheck aria-hidden="true" size={17} /> {copy.eyebrow}</p>
          <h1 id="crm-tasks-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="crm-tasks__header-actions">
          <WorkspaceSelector label={copy.workspace} value={workspaceId} choices={choices} onChange={changeWorkspace} />
          <button aria-label={copy.refresh} className="button-link button-link--secondary" disabled={loading} onClick={() => void loadTasks()} type="button"><RefreshCw aria-hidden="true" className={loading ? 'spin' : ''} size={16} /> {copy.refresh}</button>
          {canManage ? <button className="button-link button-link--primary" onClick={openCreate} ref={createTriggerRef} type="button"><Plus aria-hidden="true" size={16} /> {copy.create}</button> : null}
        </div>
      </header>

      {!canManage ? <aside className="crm-tasks__permission"><ShieldCheck aria-hidden="true" size={18} /><div><strong>{copy.readOnly}</strong><p>{copy.readOnlyBody}</p></div></aside> : null}

      <section className="crm-tasks__metrics" aria-label={copy.total}>
        <article><ClipboardCheck aria-hidden="true" /><span>{copy.total}</span><strong>{total.toLocaleString(locale)}</strong></article>
        <article className={overdueTotal > 0 ? 'is-risk' : ''}><CalendarClock aria-hidden="true" /><span>{copy.overdue}</span><strong>{overdueTotal.toLocaleString(locale)}</strong></article>
      </section>

      <form className="crm-tasks__filters" onSubmit={submitFilters}>
        <label className="crm-tasks__search"><span>{copy.search}</span><div><Search aria-hidden="true" size={16} /><input placeholder={copy.searchPlaceholder} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div></label>
        <label><span>{copy.status}</span><select value={statusInput} onChange={(event) => setStatusInput(event.target.value as CrmActivityStatus | '')}><option value="">{copy.all}</option>{taskStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        <label><span>{copy.priority}</span><select value={priorityInput} onChange={(event) => setPriorityInput(event.target.value as CrmActivityPriority | '')}><option value="">{copy.all}</option>{taskPriorities.map((value) => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select></label>
        <label><span>{copy.assignee}</span><select value={assignedToInput} onChange={(event) => setAssignedToInput(event.target.value)}><option value="">{copy.all}</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label><span>{copy.dueFrom}</span><input type="date" value={dueFromInput} onChange={(event) => setDueFromInput(event.target.value)} /></label>
        <label><span>{copy.dueTo}</span><input min={dueFromInput || undefined} type="date" value={dueToInput} onChange={(event) => setDueToInput(event.target.value)} /></label>
        <label><span>{copy.sort}</span><select value={sortInput} onChange={(event) => setSortInput(event.target.value as CrmTaskSortBy)}><option value="dueAt">{copy.dueDate}</option><option value="priority">{copy.priority}</option><option value="createdAt">{copy.createdAt}</option><option value="status">{copy.status}</option></select></label>
        <label><span>{copy.direction}</span><select value={directionInput} onChange={(event) => setDirectionInput(event.target.value as CrmTaskDirection)}><option value="asc">{copy.ascending}</option><option value="desc">{copy.descending}</option></select></label>
        <label className="crm-tasks__checkbox"><input checked={overdueInput} type="checkbox" onChange={(event) => setOverdueInput(event.target.checked)} /><span>{copy.overdueOnly}</span></label>
        <div className="crm-tasks__filter-actions"><button type="submit">{copy.apply}</button><button type="button" onClick={resetFilters}>{copy.reset}</button></div>
      </form>

      {error ? <div className="crm-tasks__state crm-tasks__state--error" role="alert"><AlertCircle aria-hidden="true" />{error}</div> : null}
      {success ? <div className="crm-tasks__state crm-tasks__state--success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div> : null}

      {loading && tasks.length === 0 ? <div className="crm-tasks__state"><Clock3 aria-hidden="true" />{copy.loading}</div> : tasks.length === 0 ? (
        <div className="crm-tasks__empty"><ClipboardCheck aria-hidden="true" /><h2>{copy.emptyTitle}</h2><p>{copy.emptyBody}</p></div>
      ) : (
        <div className="crm-tasks__table-wrap">
          <table className="crm-tasks__table">
            <thead><tr><th scope="col">{copy.task}</th><th scope="col">{copy.lead}</th><th scope="col">{copy.contact}</th><th scope="col">{copy.assignee}</th><th scope="col">{copy.dueDate}</th><th scope="col">{copy.status}</th><th scope="col">{copy.actions}</th></tr></thead>
            <tbody>{tasks.map((task) => (
              <tr className={isOverdue(task) ? 'is-overdue' : ''} key={task.id}>
                <th scope="row"><strong>{task.subject}</strong><span className={`crm-tasks__priority crm-tasks__priority--${task.priority.toLowerCase()}`}>{priorityLabels[task.priority]}</span></th>
                <td><Link to={`/crm/leads/${task.lead.id}?${new URLSearchParams({ workspaceId }).toString()}`}>{task.lead.title}</Link></td>
                <td>{task.lead.contact.fullName}<small>{task.lead.contact.email || task.lead.contact.phone || '—'}</small></td>
                <td>{task.assignedTo?.name || '—'}</td>
                <td>{formatDate(task.dueAt, locale)}</td>
                <td><span className={`crm-tasks__status crm-tasks__status--${task.status.toLowerCase()}`}>{statusLabels[task.status]}</span></td>
                <td><div className="crm-tasks__row-actions"><button type="button" onClick={(event) => openTask(task, event.currentTarget)}>{copy.review}</button>{canManage && task.status === 'OPEN' ? <button aria-label={`${copy.complete}: ${task.subject}`} type="button" onClick={() => void completeTask(task)}><CheckCircle2 aria-hidden="true" size={16} /></button> : null}</div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <nav aria-label={`${copy.page} ${page}`} className="crm-tasks__pagination">
        <button className="button-link button-link--secondary" disabled={page <= 1 || loading} onClick={() => replaceQuery({ taskPage: page - 1 <= 1 ? null : String(page - 1) })} type="button"><ChevronLeft aria-hidden="true" size={16} /> {copy.previous}</button>
        <span>{copy.page} <strong>{page.toLocaleString(locale)}</strong> {copy.of} {totalPages.toLocaleString(locale)}</span>
        <button className="button-link button-link--secondary" disabled={page >= totalPages || loading} onClick={() => replaceQuery({ taskPage: String(page + 1) })} type="button">{copy.next} <ChevronRight aria-hidden="true" size={16} /></button>
      </nav>

      <AccessibleDialog closeLabel={copy.closeCreate} description={copy.createDescription} initialFocusRef={createSubjectRef} onClose={() => { if (!createBusy) setCreateOpen(false); }} open={createOpen} returnFocusRef={createTriggerRef} size="large" title={copy.createTitle}>
        <form className="crm-tasks__dialog-form" onSubmit={submitCreate}>
          {createError ? <div className="form-error" role="alert">{createError}</div> : null}
          <div className="crm-tasks__lead-search"><label><span>{copy.findLead}</span><input placeholder={copy.findLeadPlaceholder} value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} /></label><button type="button" onClick={() => void searchLeads()}>{copy.find}</button></div>
          <label><span>{copy.lead}</span><select required value={leadId} onChange={(event) => setLeadId(event.target.value)}><option value="">{copy.chooseLead}</option>{leadOptions.map((lead) => <option key={lead.id} value={lead.id}>{lead.title} · {lead.contact.fullName}</option>)}</select></label>
          {leadOptions.length === 0 ? <p>{copy.noLeads}</p> : null}
          <label><span>{copy.subject}</span><input required ref={createSubjectRef} value={createForm.subject} onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))} /></label>
          <label><span>{copy.notes}</span><textarea value={createForm.body} onChange={(event) => setCreateForm((current) => ({ ...current, body: event.target.value }))} /></label>
          <div className="crm-tasks__dialog-grid"><label><span>{copy.dueAt}</span><input type="datetime-local" value={createForm.dueAt} onChange={(event) => setCreateForm((current) => ({ ...current, dueAt: event.target.value }))} /></label><label><span>{copy.priority}</span><select value={createForm.priority} onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value as CrmActivityPriority }))}>{taskPriorities.map((value) => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select></label><label><span>{copy.assignee}</span><select value={createForm.assignedToId} onChange={(event) => setCreateForm((current) => ({ ...current, assignedToId: event.target.value }))}><option value="">{copy.all}</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>
          <button className="button-link button-link--primary" disabled={createBusy || !leadId} type="submit">{createBusy ? copy.saving : copy.saveTask}</button>
        </form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={copy.closeReview} description={copy.reviewDescription} initialFocusRef={canManage ? taskSubjectRef : undefined} onClose={() => { if (!taskBusy) setSelectedTask(null); }} open={Boolean(selectedTask)} returnFocusRef={taskTriggerRef} size="large" title={selectedTask ? `${copy.review} · ${selectedTask.subject}` : copy.review}>
        {selectedTask ? <form className="crm-tasks__dialog-form" onSubmit={submitTask}>
          {taskError ? <div className="form-error" role="alert">{taskError}</div> : null}
          <div className="crm-tasks__record-summary"><p><strong>{copy.lead}:</strong> {selectedTask.lead.title}</p><p><strong>{copy.contact}:</strong> {selectedTask.lead.contact.fullName}</p><p><strong>{copy.createdBy}:</strong> {selectedTask.createdBy?.name || '—'}</p><Link className="button-link button-link--secondary" to={`/crm/leads/${selectedTask.lead.id}?${new URLSearchParams({ workspaceId }).toString()}`}>{copy.openLead}</Link></div>
          <label><span>{copy.subject}</span><input disabled={!canManage} ref={taskSubjectRef} required value={taskForm.subject} onChange={(event) => setTaskForm((current) => ({ ...current, subject: event.target.value }))} /></label>
          <label><span>{copy.notes}</span><textarea disabled={!canManage} value={taskForm.body} onChange={(event) => setTaskForm((current) => ({ ...current, body: event.target.value }))} /></label>
          <div className="crm-tasks__dialog-grid"><label><span>{copy.dueAt}</span><input disabled={!canManage} type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} /></label><label><span>{copy.priority}</span><select disabled={!canManage} value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value as CrmActivityPriority }))}>{taskPriorities.map((value) => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select></label><label><span>{copy.status}</span><select disabled={!canManage} value={taskForm.status} onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value as CrmActivityStatus }))}>{taskStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><label><span>{copy.assignedTo}</span><select disabled={!canManage} value={taskForm.assignedToId} onChange={(event) => setTaskForm((current) => ({ ...current, assignedToId: event.target.value }))}><option value="">{copy.all}</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>
          {canManage ? <button className="button-link button-link--primary" disabled={taskBusy} type="submit">{taskBusy ? copy.saving : copy.saveChanges}</button> : null}
        </form> : null}
      </AccessibleDialog>
    </section>
  );
}

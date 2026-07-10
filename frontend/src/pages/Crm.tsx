import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Filter,
  Inbox,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  UsersRound
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  addCrmActivity,
  createCrmLead,
  getCrmAccess,
  getCrmLead,
  listCrmAssignees,
  listCrmLeads,
  listCrmProperties,
  updateCrmActivity,
  updateCrmLead,
  type CrmActivityType,
  type CrmLead,
  type CrmLeadPriority,
  type CrmLeadSource,
  type CrmLeadStatus,
  type CrmPerson,
  type CrmWorkspaceAccess
} from '../api/crm';
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

type WorkspaceChoice = { key: string; label: string; companyId?: string; canManage: boolean; propertyScope?: { allProperties: boolean; propertyIds: string[] } };

export default function Crm() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { leadId } = useParams<{ leadId?: string }>();
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-OM' : 'en-GB';
  const copy = language === 'ar'
    ? {
        eyebrow: 'lux CRM', title: 'نظام تشغيل العملاء والعلاقات', description: 'إدارة العملاء المحتملين والمراحل والمتابعة عبر السوق وPMS دون خلط بيانات الشركات.',
        loading: 'جاري تحميل CRM...', unavailable: 'تعذر تحميل CRM.', noAccess: 'لا توجد صلاحية CRM لهذا الحساب.', back: 'العودة', workspace: 'مساحة العمل', all: 'كل المساحات', personal: 'مساحتي',
        search: 'بحث بالاسم أو البريد أو المصدر', status: 'الحالة', priority: 'الأولوية', source: 'المصدر', assigned: 'المسؤول', allValues: 'الكل', refresh: 'تحديث', newLead: 'عميل محتمل جديد',
        total: 'إجمالي العملاء', newCount: 'جدد', qualified: 'مؤهلون', followUps: 'متابعات مفتوحة', empty: 'لا توجد عملاء محتملون في هذا النطاق.', emptyHelp: 'ابدأ بإنشاء سجل يدوي أو أرسل استفساراً من السوق ليظهر تلقائياً.',
        contact: 'بيانات التواصل', timeline: 'الخط الزمني', task: 'مهمة أو ملاحظة', save: 'حفظ', cancel: 'إلغاء', details: 'تفاصيل العميل', noSelection: 'اختر عميلاً لعرض التفاصيل.',
        titleLabel: 'عنوان الفرصة', name: 'الاسم', email: 'البريد', phone: 'الهاتف', descriptionLabel: 'الوصف', followUp: 'المتابعة القادمة', expectedValue: 'القيمة المتوقعة', property: 'عقار PMS', create: 'إنشاء العميل',
        noteSubject: 'عنوان النشاط', noteBody: 'تفاصيل', activityType: 'نوع النشاط', dueAt: 'موعد الاستحقاق', addActivity: 'إضافة النشاط', complete: 'إكمال', sourceObject: 'فتح المصدر',
        lostReason: 'سبب الخسارة', notConfigured: 'لا توجد بيانات كافية بعد.', dateFrom: 'من تاريخ', dateTo: 'إلى تاريخ', propertyRequired: 'اختيار العقار مطلوب لهذا النطاق.'
      }
    : {
        eyebrow: 'lux CRM', title: 'Lead and relationship operating system', description: 'Manage marketplace and PMS opportunities, stages, ownership, and follow-up without crossing workspace boundaries.',
        loading: 'Loading CRM...', unavailable: 'Could not load CRM.', noAccess: 'CRM access is not enabled for this account.', back: 'Back', workspace: 'Workspace', all: 'All workspaces', personal: 'My marketplace workspace',
        search: 'Search name, email, source', status: 'Status', priority: 'Priority', source: 'Source', assigned: 'Assigned user', allValues: 'All', refresh: 'Refresh', newLead: 'New lead',
        total: 'Total leads', newCount: 'New', qualified: 'Qualified', followUps: 'Open follow-ups', empty: 'No leads in this scope yet.', emptyHelp: 'Create a manual lead or submit a marketplace inquiry to populate the CRM automatically.',
        contact: 'Contact', timeline: 'Timeline', task: 'Task or note', save: 'Save', cancel: 'Cancel', details: 'Lead details', noSelection: 'Select a lead to inspect the relationship.',
        titleLabel: 'Opportunity title', name: 'Full name', email: 'Email', phone: 'Phone', descriptionLabel: 'Description', followUp: 'Next follow-up', expectedValue: 'Expected value', property: 'PMS property', create: 'Create lead',
        noteSubject: 'Activity subject', noteBody: 'Details', activityType: 'Activity type', dueAt: 'Due date', addActivity: 'Add activity', complete: 'Complete', sourceObject: 'Open source',
        lostReason: 'Lost reason', notConfigured: 'No reliable data is available yet.', dateFrom: 'Created from', dateTo: 'Created to', propertyRequired: 'A property is required for this scoped workspace.'
      };

  useDocumentTitle(language === 'ar' ? 'CRM | lux.om' : 'CRM | lux.om');

  const [access, setAccess] = useState<CrmWorkspaceAccess | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState('');
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [summary, setSummary] = useState<{ total: number; byStatus: Partial<Record<CrmLeadStatus, number>> }>({ total: 0, byStatus: {} });
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [assignees, setAssignees] = useState<CrmPerson[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CrmLeadStatus | ''>('');
  const [priority, setPriority] = useState<CrmLeadPriority | ''>('');
  const [source, setSource] = useState<CrmLeadSource | ''>('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [createForm, setCreateForm] = useState({ title: '', fullName: '', email: '', phone: '', description: '', priority: 'MEDIUM' as CrmLeadPriority, source: 'MANUAL' as CrmLeadSource, nextFollowUpAt: '', expectedValue: '', pmsPropertyId: '' });
  const [activityForm, setActivityForm] = useState({ type: 'NOTE' as Exclude<CrmActivityType, 'STATUS_CHANGE' | 'ASSIGNMENT'>, subject: '', body: '', dueAt: '' });

  const workspaceChoices = useMemo<WorkspaceChoice[]>(() => {
    if (!access) return [];
    const choices: WorkspaceChoice[] = [];
    if (access.isAdmin) choices.push({ key: 'all', label: copy.all, canManage: true }, { key: 'admin', label: 'lux.om admin CRM', canManage: true });
    if (access.personalWorkspace.canView) choices.push({ key: 'personal', label: copy.personal, canManage: access.personalWorkspace.canManage });
    for (const workspace of access.companyWorkspaces.filter((item) => item.canView)) {
      choices.push({ key: `company:${workspace.companyId}`, companyId: workspace.companyId, label: language === 'ar' ? workspace.nameAr || workspace.nameEn : workspace.nameEn, canManage: workspace.canManage, propertyScope: workspace.propertyScope });
    }
    return choices;
  }, [access, copy.all, copy.personal, language]);

  const activeWorkspace = workspaceChoices.find((item) => item.key === workspaceKey) ?? workspaceChoices[0];
  const canCreate = Boolean(activeWorkspace?.canManage && activeWorkspace.key !== 'all');
  const canManageLead = Boolean((access?.isAdmin && selectedLead) || (activeWorkspace?.canManage && activeWorkspace.key !== 'all'));
  const propertyRequired = Boolean(activeWorkspace?.companyId && activeWorkspace.propertyScope && !activeWorkspace.propertyScope.allProperties);
  const createSources: CrmLeadSource[] = activeWorkspace?.key === 'admin' ? ['ADMIN_CREATED', 'MANUAL'] : activeWorkspace?.companyId ? ['PMS_OWNER', 'MANUAL'] : ['MANUAL'];

  async function loadAccess() {
    if (!token) return;
    const response = await getCrmAccess(token);
    setAccess(response.access);
    const first = response.access.isAdmin
      ? 'all'
      : response.access.personalWorkspace.canView
        ? 'personal'
        : response.access.companyWorkspaces.find((item) => item.canView)
          ? `company:${response.access.companyWorkspaces.find((item) => item.canView)!.companyId}`
          : '';
    setWorkspaceKey((current) => current || first);
  }

  async function loadWorkspaceSupport(choice: WorkspaceChoice | undefined) {
    if (!token || !choice) return;
    const [assigneeResponse, propertyResponse] = await Promise.all([
      listCrmAssignees(token, choice.companyId),
      choice.companyId ? listCrmProperties(token, choice.companyId) : Promise.resolve({ properties: [] })
    ]);
    setAssignees(assigneeResponse.assignees);
    setProperties(propertyResponse.properties);
  }

  async function loadLeads(options: { silent?: boolean } = {}) {
    if (!token || !activeWorkspace) return;
    if (!options.silent) setRefreshing(true);
    try {
      setError('');
      const response = await listCrmLeads(token, {
        companyId: activeWorkspace.companyId,
        workspace: activeWorkspace.key === 'personal' ? 'personal' : activeWorkspace.key === 'all' ? 'all' : activeWorkspace.key === 'admin' ? 'admin' : undefined,
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        source: source || undefined,
        assignedToId: assignedToId || undefined,
        from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
        to: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
        take: 60
      });
      setLeads(response.leads);
      setSummary(response.summary);
      if (selectedLead && !response.leads.some((lead) => lead.id === selectedLead.id) && !leadId) setSelectedLead(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : copy.unavailable);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadAccess().catch((loadError) => setError(loadError instanceof ApiError ? loadError.message : copy.unavailable)).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!activeWorkspace) return;
    void Promise.all([loadWorkspaceSupport(activeWorkspace), loadLeads()]);
  }, [workspaceKey, access]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadLeads({ silent: true }), 250);
    return () => window.clearTimeout(timeout);
  }, [search, status, priority, source, assignedToId, dateFrom, dateTo]);

  async function selectLead(lead: CrmLead | string, updateRoute = true) {
    if (!token) return;
    const id = typeof lead === 'string' ? lead : lead.id;
    try {
      setDetailLoading(true);
      setError('');
      const response = await getCrmLead(token, id);
      setSelectedLead(response.lead);
      const companyWorkspaceKey = response.lead.companyId ? `company:${response.lead.companyId}` : null;
      if (companyWorkspaceKey && workspaceChoices.some((choice) => choice.key === companyWorkspaceKey)) setWorkspaceKey(companyWorkspaceKey);
      else if (response.lead.ownerUserId === user?.id && workspaceChoices.some((choice) => choice.key === 'personal')) setWorkspaceKey('personal');
      if (updateRoute) navigate(`/crm/${id}`);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : copy.unavailable);
      if (updateRoute) navigate('/crm');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (token && leadId && access?.hasAccess) void selectLead(leadId, false);
    if (!leadId) setSelectedLead(null);
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
    if (propertyRequired && !createForm.pmsPropertyId) { setError(copy.propertyRequired); return; }
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
      await loadLeads({ silent: true });
      setSelectedLead(response.lead);
      navigate(`/crm/${response.lead.id}`);
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
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddActivity(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedLead || !activityForm.subject) return;
    try {
      setSaving(true);
      setError('');
      await addCrmActivity(token, selectedLead.id, {
        type: activityForm.type,
        subject: activityForm.subject,
        body: activityForm.body || undefined,
        dueAt: activityForm.dueAt ? new Date(activityForm.dueAt).toISOString() : null,
        assignedToId: selectedLead.assignedToId
      });
      setActivityForm({ type: 'NOTE', subject: '', body: '', dueAt: '' });
      const response = await getCrmLead(token, selectedLead.id);
      setSelectedLead(response.lead);
      setSuccess(copy.save);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : copy.unavailable);
    } finally {
      setSaving(false);
    }
  }

  async function completeActivity(activityId: string) {
    if (!token || !selectedLead) return;
    await updateCrmActivity(token, selectedLead.id, activityId, { status: 'COMPLETED' });
    const response = await getCrmLead(token, selectedLead.id);
    setSelectedLead(response.lead);
  }

  if (loading) return <section className="page-section container crm-page"><div className="crm-state"><Loader2 className="spin" /><p>{copy.loading}</p></div></section>;
  if (!access?.hasAccess) return <section className="page-section container crm-page"><div className="crm-state"><AlertCircle /><h1>{copy.noAccess}</h1><Link className="button-link" to="/dashboard">{copy.back}</Link></div></section>;

  const openFollowUps = leads.reduce((count, lead) => count + (lead._count?.activities ?? 0), 0);

  return (
    <section className="crm-page" aria-labelledby="crm-title">
      <header className="crm-hero container">
        <div>
          <p className="eyebrow"><UsersRound size={17} /> {copy.eyebrow}</p>
          <h1 id="crm-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="crm-hero__actions">
          <Link className="button-link button-link--ghost" to={activeWorkspace?.companyId ? '/pms/overview' : '/dashboard'}><ArrowLeft size={16} /> {copy.back}</Link>
          <button className="button-link button-link--secondary" type="button" onClick={() => void loadLeads()} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /> {copy.refresh}</button>
          {canCreate ? <button className="button-link button-link--primary" type="button" onClick={() => setShowCreate(true)}><Plus size={16} /> {copy.newLead}</button> : null}
        </div>
      </header>

      <div className="crm-shell container">
        <aside className="crm-sidebar">
          <label><span>{copy.workspace}</span><select value={workspaceKey} onChange={(event) => { setWorkspaceKey(event.target.value); setSelectedLead(null); navigate('/crm'); }}>{workspaceChoices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}</select></label>
          <div className="crm-filter-title"><Filter size={16} /><strong>{copy.allValues}</strong></div>
          <label><span>{copy.search}</span><div className="crm-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} /></div></label>
          <label><span>{copy.status}</span><select value={status} onChange={(event) => setStatus(event.target.value as CrmLeadStatus | '')}><option value="">{copy.allValues}</option>{statuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
          <label><span>{copy.priority}</span><select value={priority} onChange={(event) => setPriority(event.target.value as CrmLeadPriority | '')}><option value="">{copy.allValues}</option>{priorities.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
          <label><span>{copy.source}</span><select value={source} onChange={(event) => setSource(event.target.value as CrmLeadSource | '')}><option value="">{copy.allValues}</option>{sources.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
          <label><span>{copy.assigned}</span><select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}><option value="">{copy.allValues}</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <label><span>{copy.dateFrom}</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label><span>{copy.dateTo}</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
        </aside>

        <main className="crm-main">
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {success ? <div className="form-success" role="status">{success}</div> : null}
          <section className="crm-metrics" aria-label="CRM metrics">
            <article><Inbox /><span>{copy.total}</span><strong>{summary.total}</strong></article>
            <article><UserRound /><span>{copy.newCount}</span><strong>{summary.byStatus.NEW ?? 0}</strong></article>
            <article><CheckCircle2 /><span>{copy.qualified}</span><strong>{summary.byStatus.QUALIFIED ?? 0}</strong></article>
            <article><CalendarClock /><span>{copy.followUps}</span><strong>{openFollowUps}</strong></article>
          </section>

          <div className="crm-workspace">
            <section className="crm-lead-list" aria-label={copy.total}>
              {leads.length === 0 ? <div className="crm-empty"><Inbox /><h2>{copy.empty}</h2><p>{copy.emptyHelp}</p></div> : leads.map((lead) => (
                <button key={lead.id} type="button" className={`crm-lead-card${selectedLead?.id === lead.id ? ' crm-lead-card--active' : ''}`} onClick={() => void selectLead(lead)}>
                  <div className="crm-lead-card__top"><span className={`crm-priority crm-priority--${lead.priority.toLowerCase()}`}>{humanize(lead.priority)}</span><small>{formatDate(lead.updatedAt, locale)}</small></div>
                  <strong>{lead.title}</strong>
                  <span>{lead.contact.fullName}</span>
                  <div className="crm-lead-card__meta"><span>{humanize(lead.status)}</span><span>{humanize(lead.source)}</span></div>
                  {lead.nextFollowUpAt ? <small><CalendarClock size={13} /> {formatDate(lead.nextFollowUpAt, locale)}</small> : null}
                </button>
              ))}
            </section>

            <section className="crm-detail">
              {detailLoading ? <div className="crm-empty"><Loader2 className="spin" /><h2>{copy.loading}</h2></div> : !selectedLead ? <div className="crm-empty"><ClipboardList /><h2>{copy.noSelection}</h2></div> : (
                <>
                  <header className="crm-detail__header"><div><p className="eyebrow">{humanize(selectedLead.source)}</p><h2>{selectedLead.title}</h2><p>{selectedLead.description || copy.notConfigured}</p></div>{sourceRoute(selectedLead) ? <Link className="button-link button-link--soft" to={sourceRoute(selectedLead)!}>{copy.sourceObject}</Link> : null}</header>
                  <div className="crm-detail__controls">
                    <label><span>{copy.status}</span><select value={selectedLead.status} disabled={!canManageLead || saving} onChange={(event) => void patchLead({ status: event.target.value as CrmLeadStatus })}>{statuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
                    <label><span>{copy.priority}</span><select value={selectedLead.priority} disabled={!canManageLead || saving} onChange={(event) => void patchLead({ priority: event.target.value as CrmLeadPriority })}>{priorities.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
                    <label><span>{copy.assigned}</span><select value={selectedLead.assignedToId || ''} disabled={!canManageLead || saving} onChange={(event) => void patchLead({ assignedToId: event.target.value || null })}><option value="">{copy.allValues}</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                    <label><span>{copy.followUp}</span><input type="datetime-local" disabled={!canManageLead || saving} value={selectedLead.nextFollowUpAt ? new Date(new Date(selectedLead.nextFollowUpAt).getTime() - new Date(selectedLead.nextFollowUpAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={(event) => void patchLead({ nextFollowUpAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
                  </div>
                  <div className="crm-detail__grid">
                    <article className="crm-card"><h3><UserRound size={17} /> {copy.contact}</h3><strong>{selectedLead.contact.fullName}</strong><a href={selectedLead.contact.email ? `mailto:${selectedLead.contact.email}` : undefined}>{selectedLead.contact.email || '—'}</a><a href={selectedLead.contact.phone ? `tel:${selectedLead.contact.phone}` : undefined}>{selectedLead.contact.phone || '—'}</a>{selectedLead.company ? <span><Building2 size={14} /> {language === 'ar' ? selectedLead.company.nameAr || selectedLead.company.nameEn : selectedLead.company.nameEn}</span> : null}</article>
                    <article className="crm-card"><h3><CircleDollarSign size={17} /> {copy.details}</h3><span>{copy.expectedValue}: {selectedLead.expectedValue ? `${selectedLead.currency} ${selectedLead.expectedValue}` : '—'}</span><span>{copy.followUp}: {formatDate(selectedLead.nextFollowUpAt, locale)}</span><span>{copy.source}: {selectedLead.sourceLabel || humanize(selectedLead.source)}</span></article>
                  </div>

                  {canManageLead ? <form className="crm-activity-form" onSubmit={handleAddActivity}><h3><MessageSquareText size={17} /> {copy.task}</h3><div className="crm-form-grid"><label><span>{copy.activityType}</span><select value={activityForm.type} onChange={(event) => setActivityForm((current) => ({ ...current, type: event.target.value as typeof current.type }))}><option value="NOTE">Note</option><option value="TASK">Task</option><option value="CALL">Call</option><option value="EMAIL">Email</option><option value="MEETING">Meeting</option></select></label><label><span>{copy.noteSubject}</span><input required value={activityForm.subject} onChange={(event) => setActivityForm((current) => ({ ...current, subject: event.target.value }))} /></label><label><span>{copy.dueAt}</span><input type="datetime-local" value={activityForm.dueAt} onChange={(event) => setActivityForm((current) => ({ ...current, dueAt: event.target.value }))} /></label></div><textarea placeholder={copy.noteBody} value={activityForm.body} onChange={(event) => setActivityForm((current) => ({ ...current, body: event.target.value }))} /><button className="button-link button-link--primary" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} {copy.addActivity}</button></form> : null}

                  <section className="crm-timeline"><h3>{copy.timeline}</h3>{selectedLead.activities?.length ? selectedLead.activities.map((activity) => <article key={activity.id}><span className="crm-timeline__dot" /><div><div><strong>{activity.subject}</strong><small>{formatDate(activity.createdAt, locale)}</small></div><p>{activity.body || humanize(activity.type)}</p><span>{humanize(activity.status)}{activity.assignedTo ? ` · ${activity.assignedTo.name}` : ''}</span></div>{canManageLead && activity.status === 'OPEN' ? <button className="button-link button-link--ghost" type="button" onClick={() => void completeActivity(activity.id)}>{copy.complete}</button> : null}</article>) : <p>{copy.notConfigured}</p>}</section>
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      {showCreate ? <div className="crm-modal-backdrop" role="presentation"><form className="crm-modal" onSubmit={handleCreate}><header><div><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.newLead}</h2></div><button type="button" className="button-link button-link--ghost" onClick={() => setShowCreate(false)}>{copy.cancel}</button></header><div className="crm-form-grid"><label><span>{copy.titleLabel}</span><input required value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} /></label><label><span>{copy.name}</span><input required value={createForm.fullName} onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))} /></label><label><span>{copy.email}</span><input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} /></label><label><span>{copy.phone}</span><input value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} /></label><label><span>{copy.priority}</span><select value={createForm.priority} onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value as CrmLeadPriority }))}>{priorities.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label><label><span>{copy.source}</span><select value={createForm.source} onChange={(event) => setCreateForm((current) => ({ ...current, source: event.target.value as CrmLeadSource }))}>{createSources.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label><label><span>{copy.followUp}</span><input type="datetime-local" value={createForm.nextFollowUpAt} onChange={(event) => setCreateForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))} /></label><label><span>{copy.expectedValue}</span><input type="number" min="0" step="0.001" value={createForm.expectedValue} onChange={(event) => setCreateForm((current) => ({ ...current, expectedValue: event.target.value }))} /></label>{activeWorkspace?.companyId && properties.length > 0 ? <label><span>{copy.property}</span><select required={propertyRequired} value={createForm.pmsPropertyId} onChange={(event) => setCreateForm((current) => ({ ...current, pmsPropertyId: event.target.value }))}><option value="">{copy.allValues}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}{property.code ? ` · ${property.code}` : ''}</option>)}</select></label> : null}</div><label><span>{copy.descriptionLabel}</span><textarea value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} /></label><button className="button-link button-link--primary" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} {copy.create}</button></form></div> : null}
    </section>
  );
}

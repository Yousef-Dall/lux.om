import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Eye,
  GitMerge,
  Link2,
  MailCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import { type CrmWorkspaceAccess } from '../../../api/crm';
import {
  archiveCrmContact,
  createCrmAccountContact,
  getCrmContactDetail,
  listCrmAccounts,
  listCrmContactRegister,
  mergeCrmContacts,
  previewCrmContactMerge,
  type CrmAccountSummary,
  type CrmContactDetail,
  type CrmContactDirection,
  type CrmContactMergePreview,
  type CrmContactMergeResolution,
  type CrmContactMergeResult,
  type CrmContactRegisterItem,
  type CrmContactSortBy,
  type CrmContactStatus,
  type CrmDuplicateCandidate
} from '../../../api/crmAdvanced';
import { useAuth } from '../../../auth/AuthContext';
import AccessibleDialog from '../../../components/AccessibleDialog';
import type { CrmContactConsentStatus } from '../../../generated/crmContract';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useLanguage } from '../../../i18n/LanguageContext';
import CrmContactMergeDialog from './CrmContactMergeDialog';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../WorkspaceSelector';

const PAGE_SIZE = 25;
const consentStatuses: CrmContactConsentStatus[] = ['UNKNOWN', 'CONSENTED', 'LEGITIMATE_INTEREST', 'OPTED_OUT', 'BLOCKED'];

type ContactWorkspaceChoice = CrmWorkspaceChoice & { scope: 'personal' | 'company' | 'admin' };
type ContactForm = { accountId: string; fullName: string; email: string; phone: string; notes: string };

const emptyContactForm: ContactForm = { accountId: '', fullName: '', email: '', phone: '', notes: '' };

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'CRM contact operation failed.';
}

function workspaceChoices(access: CrmWorkspaceAccess | null | undefined, language: 'en' | 'ar'): ContactWorkspaceChoice[] {
  if (!access) return [];
  const choices: ContactWorkspaceChoice[] = [];
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

function safeStatus(value: string | null): CrmContactStatus {
  return value === 'ARCHIVED' || value === 'ALL' ? value : 'ACTIVE';
}

function safeSort(value: string | null): CrmContactSortBy {
  return value === 'updatedAt' || value === 'createdAt' ? value : 'fullName';
}

function safeDirection(value: string | null): CrmContactDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

function safeConsent(value: string | null): CrmContactConsentStatus | '' {
  return consentStatuses.includes(value as CrmContactConsentStatus) ? value as CrmContactConsentStatus : '';
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function CrmContactsWorkspace() {
  const { token, crmAccess } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-OM' : 'en-OM';
  const navigate = useNavigate();
  const { contactId } = useParams();
  const [params, setParams] = useSearchParams();
  const pendingParamsRef = useRef(new URLSearchParams(params));
  const choices = useMemo(() => workspaceChoices(crmAccess, language), [crmAccess, language]);
  const requestedWorkspaceId = params.get('workspaceId');
  const [workspaceId, setWorkspaceId] = useState('');
  const activeChoice = choices.find((choice) => choice.workspaceId === workspaceId);
  const canManage = Boolean(activeChoice?.canManage);

  const page = Math.max(1, Number(params.get('contactPage')) || 1);
  const search = params.get('contactQ')?.trim() ?? '';
  const accountIdFilter = params.get('contactAccount') ?? '';
  const consentStatus = safeConsent(params.get('contactConsent'));
  const status = safeStatus(params.get('contactStatus'));
  const sortBy = safeSort(params.get('contactSort'));
  const direction = safeDirection(params.get('contactDirection'));

  const [searchInput, setSearchInput] = useState(search);
  const [accountInput, setAccountInput] = useState(accountIdFilter);
  const [consentInput, setConsentInput] = useState<CrmContactConsentStatus | ''>(consentStatus);
  const [statusInput, setStatusInput] = useState<CrmContactStatus>(status);
  const [sortInput, setSortInput] = useState<CrmContactSortBy>(sortBy);
  const [directionInput, setDirectionInput] = useState<CrmContactDirection>(direction);
  const [contacts, setContacts] = useState<CrmContactRegisterItem[]>([]);
  const [accounts, setAccounts] = useState<CrmAccountSummary[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, archived: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ContactForm>(emptyContactForm);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  const [selectedContact, setSelectedContact] = useState<CrmContactDetail | null>(null);
  const [duplicates, setDuplicates] = useState<CrmDuplicateCandidate[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveAcknowledged, setArchiveAcknowledged] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const [pendingMerge, setPendingMerge] = useState<CrmDuplicateCandidate | null>(null);
  const [mergePreview, setMergePreview] = useState<CrmContactMergePreview | null>(null);
  const [mergeResult, setMergeResult] = useState<CrmContactMergeResult | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState('');

  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const createNameRef = useRef<HTMLInputElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement>(null);
  const archiveReasonRef = useRef<HTMLTextAreaElement>(null);
  const mergeTriggerRef = useRef<HTMLButtonElement>(null);

  useDocumentTitle(language === 'ar' ? 'جهات اتصال CRM | lux.om' : 'CRM contacts | lux.om');

  const copy = language === 'ar'
    ? {
        eyebrow: 'هوية وعلاقة محكومة', title: 'مركز جهات اتصال CRM', description: 'استعرض هويات جهات الاتصال وموافقاتها وعلاقاتها المكررة ضمن مساحة العمل ونطاق العقار.',
        workspace: 'مساحة العمل', refresh: 'تحديث جهات الاتصال', create: 'إضافة جهة اتصال', readOnly: 'عرض فقط', readOnlyBody: 'يمكنك مراجعة جهات الاتصال، لكن صلاحيتك الحالية لا تسمح بإنشائها أو أرشفتها أو دمجها.',
        total: 'إجمالي النتائج', active: 'نشطة', archived: 'مؤرشفة', search: 'البحث في جهات الاتصال', searchPlaceholder: 'الاسم أو البريد أو الهاتف أو الحساب', account: 'الحساب', allAccounts: 'كل الحسابات', consent: 'حالة الموافقة', allConsent: 'كل حالات الموافقة', state: 'الحالة', sort: 'الترتيب', direction: 'الاتجاه', apply: 'تطبيق عوامل التصفية', reset: 'إعادة الضبط',
        name: 'الاسم', identity: 'الهوية', preferences: 'الموافقات', leads: 'العملاء المحتملون', deals: 'الصفقات', updated: 'آخر تحديث', actions: 'الإجراءات', review: 'مراجعة جهة الاتصال', loading: 'جارٍ تحميل جهات اتصال CRM…', emptyTitle: 'لا توجد جهات اتصال مطابقة', emptyBody: 'عدّل عوامل التصفية أو أضف جهة اتصال إلى حساب نشط.',
        previous: 'السابق', next: 'التالي', page: 'صفحة', of: 'من', ascending: 'تصاعدي', descending: 'تنازلي', fullNameSort: 'الاسم الكامل', createdAt: 'وقت الإنشاء', updatedAt: 'آخر تحديث', activeState: 'نشطة فقط', archivedState: 'مؤرشفة فقط', allStates: 'كل الحالات',
        createTitle: 'إضافة جهة اتصال CRM محكومة', createDescription: 'يجب ربط جهة الاتصال بحساب نشط، وتبقى قواعد الهوية المكررة والنطاق مطبقة في الخادم.', closeCreate: 'إغلاق إضافة جهة الاتصال', fullName: 'الاسم الكامل', email: 'البريد الإلكتروني', phone: 'الهاتف', notes: 'ملاحظات', saveContact: 'حفظ جهة الاتصال', saving: 'جارٍ الحفظ…', created: 'تمت إضافة جهة الاتصال إلى الحساب.', identityRequired: 'أدخل بريداً إلكترونياً أو رقم هاتف.', accountRequired: 'اختر حساباً نشطاً.',
        details: 'تفاصيل جهة الاتصال', back: 'العودة إلى سجل جهات الاتصال', statusActive: 'نشطة', statusArchived: 'مؤرشفة', identities: 'الهويات النشطة', noIdentities: 'لا توجد هويات نشطة.', communication: 'تفضيلات التواصل', noPreferences: 'لا توجد تفضيلات تواصل مسجلة.', linked: 'السجلات المرتبطة', noLeads: 'لا توجد عملاء محتملون مرتبطون.', noDeals: 'لا توجد صفقات مرتبطة.', suppressions: 'قيود التواصل', noSuppressions: 'لا توجد قيود تواصل نشطة.', duplicates: 'تحذيرات التكرار', noDuplicates: 'لم يتم اكتشاف جهات اتصال مكررة.', reviewMerge: 'مراجعة الدمج',
        archive: 'أرشفة جهة الاتصال', restore: 'استعادة جهة الاتصال', archiveTitle: 'مراجعة تغيير حالة جهة الاتصال', archiveDescription: 'يتطلب الأرشفة أو الاستعادة سبباً واضحاً ويُسجّل نشاطاً قابلاً للتدقيق.', closeArchive: 'إغلاق مراجعة الحالة', reason: 'سبب التغيير', acknowledge: 'أفهم أن هذا يغيّر ظهور جهة الاتصال التشغيلي دون حذف السجلات المرتبطة.', confirmArchive: 'تأكيد الأرشفة', confirmRestore: 'تأكيد الاستعادة', contactArchived: 'تمت أرشفة جهة الاتصال.', contactRestored: 'تمت استعادة جهة الاتصال.', mergeCompleted: 'اكتمل دمج جهة الاتصال.',
        unknown: 'غير معروف'
      }
    : {
        eyebrow: 'Governed identity and relationship', title: 'CRM contact center', description: 'Browse contact identities, consent, linked records, and duplicate warnings inside the selected workspace and property scope.',
        workspace: 'Workspace', refresh: 'Refresh contacts', create: 'Add contact', readOnly: 'Read only', readOnlyBody: 'You can review contacts, but your current access cannot create, archive, restore, or merge them.',
        total: 'Total results', active: 'Active', archived: 'Archived', search: 'Search contacts', searchPlaceholder: 'Name, email, phone, notes, or account', account: 'Account', allAccounts: 'All accounts', consent: 'Consent status', allConsent: 'All consent states', state: 'State', sort: 'Sort by', direction: 'Direction', apply: 'Apply filters', reset: 'Reset filters',
        name: 'Name', identity: 'Identity', preferences: 'Consent', leads: 'Leads', deals: 'Deals', updated: 'Updated', actions: 'Actions', review: 'Review contact', loading: 'Loading CRM contacts…', emptyTitle: 'No matching contacts', emptyBody: 'Adjust the filters or add a contact to an active account.',
        previous: 'Previous', next: 'Next', page: 'Page', of: 'of', ascending: 'Ascending', descending: 'Descending', fullNameSort: 'Full name', createdAt: 'Created time', updatedAt: 'Updated time', activeState: 'Active only', archivedState: 'Archived only', allStates: 'All states',
        createTitle: 'Add governed CRM contact', createDescription: 'The contact must be linked to an active account. Server-side duplicate identity and scope rules remain enforced.', closeCreate: 'Close contact creation', fullName: 'Full name', email: 'Email', phone: 'Phone', notes: 'Notes', saveContact: 'Save contact', saving: 'Saving…', created: 'The contact was added to the account.', identityRequired: 'Enter an email address or phone number.', accountRequired: 'Select an active account.',
        details: 'Contact details', back: 'Back to contact register', statusActive: 'Active', statusArchived: 'Archived', identities: 'Active identities', noIdentities: 'No active identities are recorded.', communication: 'Communication preferences', noPreferences: 'No communication preferences are recorded.', linked: 'Linked records', noLeads: 'No leads are linked.', noDeals: 'No deals are linked.', suppressions: 'Communication restrictions', noSuppressions: 'No active communication restrictions.', duplicates: 'Duplicate warnings', noDuplicates: 'No duplicate contacts were detected.', reviewMerge: 'Review merge',
        archive: 'Archive contact', restore: 'Restore contact', archiveTitle: 'Review contact state change', archiveDescription: 'Archiving or restoring requires a clear reason and records an auditable activity.', closeArchive: 'Close state review', reason: 'Change reason', acknowledge: 'I understand this changes the contact’s operational visibility without deleting linked records.', confirmArchive: 'Confirm archive', confirmRestore: 'Confirm restore', contactArchived: 'The contact was archived.', contactRestored: 'The contact was restored.', mergeCompleted: 'The contact merge was completed.',
        unknown: 'Unknown'
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
        next.delete('contactPage');
      });
    }
  }, [choices, requestedWorkspaceId, workspaceId]);

  useEffect(() => {
    setSearchInput(search);
    setAccountInput(accountIdFilter);
    setConsentInput(consentStatus);
    setStatusInput(status);
    setSortInput(sortBy);
    setDirectionInput(direction);
  }, [accountIdFilter, consentStatus, direction, search, sortBy, status]);

  async function loadAccounts() {
    if (!token || !workspaceId) return;
    try {
      const response = await listCrmAccounts(token, workspaceId);
      setAccounts(response.accounts.filter((account) => !account.archivedAt));
    } catch {
      setAccounts([]);
    }
  }

  async function loadContacts() {
    if (!token || !workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const response = await listCrmContactRegister(token, {
        workspaceId,
        search: search || undefined,
        accountId: accountIdFilter || undefined,
        consentStatus: consentStatus || undefined,
        status,
        sortBy,
        direction,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE
      });
      setContacts(response.contacts);
      setSummary(response.summary ?? {
        total: response.pagination.total,
        active: response.contacts.filter((contact) => !contact.archivedAt).length,
        archived: response.contacts.filter((contact) => Boolean(contact.archivedAt)).length
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void Promise.all([loadContacts(), loadAccounts()]); }, [token, workspaceId, search, accountIdFilter, consentStatus, status, sortBy, direction, page]);

  async function refreshDetail() {
    if (!token || !contactId) return;
    const response = await getCrmContactDetail(token, contactId);
    setSelectedContact({ ...response.contact, suppressions: response.suppressions });
    setDuplicates(response.duplicates);
  }

  useEffect(() => {
    if (!token || !contactId) {
      setSelectedContact(null);
      setDuplicates([]);
      setDetailError('');
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    void getCrmContactDetail(token, contactId)
      .then((response) => {
        if (!active) return;
        setSelectedContact({ ...response.contact, suppressions: response.suppressions });
        setDuplicates(response.duplicates);
      })
      .catch((detailLoadError) => { if (active) setDetailError(errorMessage(detailLoadError)); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [contactId, token]);

  function workspaceChanged(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId);
    setSelectedContact(null);
    replaceQuery((next) => {
      next.set('workspaceId', nextWorkspaceId);
      next.delete('contactPage');
    });
    navigate({ pathname: '/crm/contacts', search: `?${pendingParamsRef.current.toString()}` }, { replace: true });
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    replaceQuery((next) => {
      const values: Array<[string, string]> = [
        ['contactQ', searchInput.trim()],
        ['contactAccount', accountInput],
        ['contactConsent', consentInput],
        ['contactStatus', statusInput === 'ACTIVE' ? '' : statusInput],
        ['contactSort', sortInput === 'fullName' ? '' : sortInput],
        ['contactDirection', directionInput === 'asc' ? '' : directionInput]
      ];
      for (const [key, value] of values) value ? next.set(key, value) : next.delete(key);
      next.delete('contactPage');
    });
  }

  function resetFilters() {
    setSearchInput('');
    setAccountInput('');
    setConsentInput('');
    setStatusInput('ACTIVE');
    setSortInput('fullName');
    setDirectionInput('asc');
    replaceQuery((next) => {
      ['contactQ', 'contactAccount', 'contactConsent', 'contactStatus', 'contactSort', 'contactDirection', 'contactPage'].forEach((key) => next.delete(key));
    });
  }

  function pageChanged(nextPage: number) {
    replaceQuery((next) => {
      nextPage > 1 ? next.set('contactPage', String(nextPage)) : next.delete('contactPage');
    });
  }

  function openCreate() {
    setCreateForm({ ...emptyContactForm, accountId: accounts[0]?.id ?? '' });
    setCreateError('');
    setCreateOpen(true);
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (!createForm.accountId) {
      setCreateError(copy.accountRequired);
      return;
    }
    if (!createForm.email.trim() && !createForm.phone.trim()) {
      setCreateError(copy.identityRequired);
      return;
    }
    setCreateBusy(true);
    setCreateError('');
    try {
      const response = await createCrmAccountContact(token, createForm.accountId, {
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim() || null,
        phone: createForm.phone.trim() || null,
        notes: createForm.notes.trim() || null
      });
      setCreateOpen(false);
      setSuccess(copy.created);
      await loadContacts();
      const query = pendingParamsRef.current.toString();
      navigate(`/crm/contacts/${response.contact.id}${query ? `?${query}` : ''}`);
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
    navigate(`/crm/contacts/${id}${query ? `?${query}` : ''}`);
  }

  function closeDetail() {
    setSelectedContact(null);
    setDuplicates([]);
    setDetailError('');
    const query = pendingParamsRef.current.toString();
    navigate(`/crm/contacts${query ? `?${query}` : ''}`);
    window.requestAnimationFrame(() => detailTriggerRef.current?.focus());
  }

  function requestArchive() {
    setArchiveReason('');
    setArchiveAcknowledged(false);
    setArchiveError('');
    setArchiveOpen(true);
  }

  async function submitArchive(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedContact) return;
    const archived = !selectedContact.archivedAt;
    setArchiveBusy(true);
    setArchiveError('');
    try {
      await archiveCrmContact(token, selectedContact.id, archived, archiveReason.trim());
      setArchiveOpen(false);
      setSuccess(archived ? copy.contactArchived : copy.contactRestored);
      await Promise.all([refreshDetail(), loadContacts()]);
    } catch (submitError) {
      setArchiveError(errorMessage(submitError));
    } finally {
      setArchiveBusy(false);
    }
  }

  async function requestMerge(candidate: CrmDuplicateCandidate, trigger: HTMLButtonElement) {
    if (!token || !selectedContact) return;
    mergeTriggerRef.current = trigger;
    setPendingMerge(candidate);
    setMergePreview(null);
    setMergeResult(null);
    setMergeError('');
    try {
      const response = await previewCrmContactMerge(token, selectedContact.id, candidate.id);
      setMergePreview(response.preview);
    } catch (previewError) {
      setMergeError(errorMessage(previewError));
    }
  }

  async function confirmMerge(resolutions: CrmContactMergeResolution) {
    if (!token || !selectedContact || !pendingMerge) return;
    setMergeBusy(true);
    setMergeError('');
    try {
      const response = await mergeCrmContacts(token, selectedContact.id, pendingMerge.id, resolutions);
      setMergeResult(response);
      await Promise.all([refreshDetail(), loadContacts()]);
    } catch (mergeSubmitError) {
      setMergeError(errorMessage(mergeSubmitError));
    } finally {
      setMergeBusy(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(summary.total / PAGE_SIZE));

  return (
    <main className="crm-contacts" aria-labelledby="crm-contacts-title">
      <header className="crm-contacts__hero">
        <div>
          <p className="eyebrow"><ContactRound aria-hidden="true" size={17} /> {copy.eyebrow}</p>
          <h2 id="crm-contacts-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="crm-contacts__hero-actions">
          <button className="button-link button-link--secondary" disabled={loading} onClick={() => void Promise.all([loadContacts(), loadAccounts()])} type="button"><RefreshCw aria-hidden="true" className={loading ? 'spin' : ''} size={16} /> {copy.refresh}</button>
          {canManage ? <button className="button-link button-link--primary" disabled={accounts.length === 0} onClick={openCreate} ref={createTriggerRef} type="button"><Plus aria-hidden="true" size={16} /> {copy.create}</button> : null}
        </div>
      </header>

      <section className="crm-contacts__workspace" aria-label={copy.workspace}>
        <WorkspaceSelector label={copy.workspace} value={workspaceId} choices={choices} onChange={workspaceChanged} />
        {!canManage ? <div className="crm-contacts__readonly" role="note"><ShieldCheck aria-hidden="true" /><div><strong>{copy.readOnly}</strong><p>{copy.readOnlyBody}</p></div></div> : null}
      </section>

      {success ? <p className="form-alert form-alert--success" role="status">{success}</p> : null}
      {error ? <p className="form-alert form-alert--error" role="alert">{error}</p> : null}

      <section className="crm-contacts__summary" aria-label={copy.total}>
        <article><span>{copy.total}</span><strong>{summary.total}</strong></article>
        <article><span>{copy.active}</span><strong>{summary.active}</strong></article>
        <article><span>{copy.archived}</span><strong>{summary.archived}</strong></article>
      </section>

      <form className="crm-contacts__filters" onSubmit={applyFilters}>
        <label className="crm-contacts__search"><span>{copy.search}</span><div><Search aria-hidden="true" size={16} /><input placeholder={copy.searchPlaceholder} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div></label>
        <label><span>{copy.account}</span><select value={accountInput} onChange={(event) => setAccountInput(event.target.value)}><option value="">{copy.allAccounts}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label><span>{copy.consent}</span><select value={consentInput} onChange={(event) => setConsentInput(event.target.value as CrmContactConsentStatus | '')}><option value="">{copy.allConsent}</option>{consentStatuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
        <label><span>{copy.state}</span><select value={statusInput} onChange={(event) => setStatusInput(event.target.value as CrmContactStatus)}><option value="ACTIVE">{copy.activeState}</option><option value="ARCHIVED">{copy.archivedState}</option><option value="ALL">{copy.allStates}</option></select></label>
        <label><span>{copy.sort}</span><select value={sortInput} onChange={(event) => setSortInput(event.target.value as CrmContactSortBy)}><option value="fullName">{copy.fullNameSort}</option><option value="updatedAt">{copy.updatedAt}</option><option value="createdAt">{copy.createdAt}</option></select></label>
        <label><span>{copy.direction}</span><select value={directionInput} onChange={(event) => setDirectionInput(event.target.value as CrmContactDirection)}><option value="asc">{copy.ascending}</option><option value="desc">{copy.descending}</option></select></label>
        <div className="crm-contacts__filter-actions"><button className="button-link button-link--primary" type="submit">{copy.apply}</button><button className="button-link button-link--ghost" onClick={resetFilters} type="button">{copy.reset}</button></div>
      </form>

      <section className="crm-contacts__results" aria-label={copy.title} aria-busy={loading}>
        {loading && contacts.length === 0 ? <p className="crm-contacts__loading">{copy.loading}</p> : contacts.length === 0 ? <div className="crm-empty"><ContactRound aria-hidden="true" /><h3>{copy.emptyTitle}</h3><p>{copy.emptyBody}</p></div> : <div className="crm-contacts__table-wrap"><table><thead><tr><th scope="col">{copy.name}</th><th scope="col">{copy.account}</th><th scope="col">{copy.identity}</th><th scope="col">{copy.preferences}</th><th scope="col">{copy.leads}</th><th scope="col">{copy.deals}</th><th scope="col">{copy.updated}</th><th scope="col">{copy.actions}</th></tr></thead><tbody>{contacts.map((contact) => <tr key={contact.id} className={contact.archivedAt ? 'is-archived' : ''}><th scope="row"><strong>{contact.fullName}</strong><span>{contact.archivedAt ? copy.statusArchived : copy.statusActive}</span></th><td>{contact.account?.name || '—'}</td><td><strong>{contact.email || contact.phone || '—'}</strong><small>{contact.identities.length} {copy.identities.toLowerCase()}</small></td><td>{contact.channelPreferences.length ? contact.channelPreferences.map((preference) => `${preference.channel}: ${humanize(preference.status)}`).join(' · ') : copy.unknown}</td><td>{contact._count.leads}</td><td>{contact._count.primaryDeals}</td><td>{formatDate(contact.updatedAt, locale)}</td><td><button className="button-link button-link--secondary" onClick={(event) => openDetail(contact.id, event.currentTarget)} type="button"><Eye aria-hidden="true" size={15} /> {copy.review}</button></td></tr>)}</tbody></table></div>}
      </section>

      <nav className="crm-contacts__pagination" aria-label={`${copy.page} ${page}`}><button disabled={page <= 1} onClick={() => pageChanged(page - 1)} type="button"><ChevronLeft aria-hidden="true" /> {copy.previous}</button><span>{copy.page} {page} {copy.of} {pageCount}</span><button disabled={page >= pageCount} onClick={() => pageChanged(page + 1)} type="button">{copy.next} <ChevronRight aria-hidden="true" /></button></nav>

      {contactId ? <section className="crm-contact-detail" aria-labelledby="crm-contact-detail-title">
        <header><div><p className="eyebrow"><UserRound aria-hidden="true" size={16} /> {copy.details}</p><h3 id="crm-contact-detail-title">{selectedContact?.fullName || copy.details}</h3><p>{selectedContact ? `${selectedContact.archivedAt ? copy.statusArchived : copy.statusActive} · ${selectedContact.account?.name || copy.allAccounts}` : copy.loading}</p></div><button className="button-link button-link--ghost" onClick={closeDetail} type="button">{copy.back}</button></header>
        {detailLoading ? <p>{copy.loading}</p> : detailError ? <p className="form-alert form-alert--error" role="alert">{detailError}</p> : selectedContact ? <div className="crm-contact-detail__body">
          <section className="crm-contact-detail__summary"><article><span>{copy.leads}</span><strong>{selectedContact.leads.length}</strong></article><article><span>{copy.deals}</span><strong>{selectedContact.primaryDeals.length}</strong></article><article><span>{copy.updated}</span><strong>{formatDate(selectedContact.updatedAt, locale)}</strong></article></section>
          <dl className="crm-contact-detail__facts"><div><dt>{copy.email}</dt><dd>{selectedContact.email || '—'}</dd></div><div><dt>{copy.phone}</dt><dd>{selectedContact.phone || '—'}</dd></div><div><dt>{copy.account}</dt><dd>{selectedContact.account?.name || '—'}</dd></div><div><dt>{copy.notes}</dt><dd>{selectedContact.notes || '—'}</dd></div></dl>
          <div className="crm-contact-detail__grid">
            <section aria-labelledby="crm-contact-identities"><h4 id="crm-contact-identities"><Link2 aria-hidden="true" size={17} /> {copy.identities}</h4>{selectedContact.identities.length ? <ul>{selectedContact.identities.map((identity) => <li key={identity.id}><strong>{identity.type}</strong><code>{identity.normalizedValue}</code></li>)}</ul> : <p>{copy.noIdentities}</p>}</section>
            <section aria-labelledby="crm-contact-preferences"><h4 id="crm-contact-preferences"><MailCheck aria-hidden="true" size={17} /> {copy.communication}</h4>{selectedContact.channelPreferences.length ? <ul>{selectedContact.channelPreferences.map((preference) => <li key={preference.id}><strong>{preference.channel}</strong><span>{humanize(preference.status)}{preference.lawfulBasis ? ` · ${preference.lawfulBasis}` : ''}</span></li>)}</ul> : <p>{copy.noPreferences}</p>}</section>
            <section aria-labelledby="crm-contact-linked"><h4 id="crm-contact-linked"><UsersRound aria-hidden="true" size={17} /> {copy.linked}</h4>{selectedContact.leads.length ? <ul>{selectedContact.leads.map((lead) => <li key={lead.id}><strong>{lead.title}</strong><span>{lead.status} · {lead.score}</span></li>)}</ul> : <p>{copy.noLeads}</p>}{selectedContact.primaryDeals.length ? <ul>{selectedContact.primaryDeals.map((deal) => <li key={deal.id}><strong>{deal.name}</strong><span>{deal.stage.name} · {deal.currency}</span></li>)}</ul> : <p>{copy.noDeals}</p>}</section>
            <section aria-labelledby="crm-contact-suppressions"><h4 id="crm-contact-suppressions"><ShieldCheck aria-hidden="true" size={17} /> {copy.suppressions}</h4>{selectedContact.suppressions?.length ? <ul>{selectedContact.suppressions.map((suppression) => <li key={suppression.id}><strong>{suppression.channel}</strong><span>{suppression.reason}</span></li>)}</ul> : <p>{copy.noSuppressions}</p>}</section>
          </div>
          <section className="crm-contact-detail__duplicates" aria-labelledby="crm-contact-duplicates"><header><h4 id="crm-contact-duplicates"><GitMerge aria-hidden="true" size={17} /> {copy.duplicates}</h4></header>{duplicates.length === 0 ? <p>{copy.noDuplicates}</p> : duplicates.map((candidate) => <article key={candidate.id}><div><strong>{candidate.fullName}</strong><span>{candidate.email || candidate.phone || '—'} · {candidate.reasons.join(', ')}</span></div>{canManage && !selectedContact.archivedAt ? <button className="button-link button-link--secondary" onClick={(event) => void requestMerge(candidate, event.currentTarget)} type="button">{copy.reviewMerge}</button> : null}</article>)}</section>
          {canManage ? <div className="crm-contact-detail__actions"><button className={selectedContact.archivedAt ? 'button-link button-link--primary' : 'button-link button-link--danger'} onClick={requestArchive} type="button">{selectedContact.archivedAt ? <ArchiveRestore aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />}{selectedContact.archivedAt ? copy.restore : copy.archive}</button></div> : null}
        </div> : null}
      </section> : null}

      <AccessibleDialog open={createOpen} title={copy.createTitle} description={copy.createDescription} closeLabel={copy.closeCreate} onClose={() => setCreateOpen(false)} initialFocusRef={createNameRef} returnFocusRef={createTriggerRef} size="large">
        <form className="crm-contacts__dialog-form" onSubmit={submitCreate}>
          {createError ? <p className="form-alert form-alert--error crm-contacts__dialog-wide" role="alert">{createError}</p> : null}
          <label><span>{copy.account}</span><select required value={createForm.accountId} onChange={(event) => setCreateForm((current) => ({ ...current, accountId: event.target.value }))}><option value="">{copy.accountRequired}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label><span>{copy.fullName}</span><input ref={createNameRef} required minLength={2} value={createForm.fullName} onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
          <label><span>{copy.email}</span><input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label><span>{copy.phone}</span><input value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label className="crm-contacts__dialog-wide"><span>{copy.notes}</span><textarea rows={4} value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          <div className="crm-contacts__dialog-actions crm-contacts__dialog-wide"><button className="button-link button-link--primary" disabled={createBusy} type="submit">{createBusy ? copy.saving : copy.saveContact}</button></div>
        </form>
      </AccessibleDialog>

      <AccessibleDialog open={archiveOpen} title={copy.archiveTitle} description={copy.archiveDescription} closeLabel={copy.closeArchive} onClose={() => setArchiveOpen(false)} initialFocusRef={archiveReasonRef} size="medium">
        <form className="crm-contact-archive" onSubmit={submitArchive}>
          {archiveError ? <p className="form-alert form-alert--error" role="alert">{archiveError}</p> : null}
          <label><span>{copy.reason}</span><textarea ref={archiveReasonRef} required minLength={3} rows={4} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} /></label>
          <label className="crm-contact-archive__ack"><input checked={archiveAcknowledged} onChange={(event) => setArchiveAcknowledged(event.target.checked)} type="checkbox" /><span>{copy.acknowledge}</span></label>
          <button className="button-link button-link--primary" disabled={archiveBusy || !archiveAcknowledged || archiveReason.trim().length < 3} type="submit">{archiveBusy ? copy.saving : selectedContact?.archivedAt ? copy.confirmRestore : copy.confirmArchive}</button>
        </form>
      </AccessibleDialog>

      <CrmContactMergeDialog
        busy={mergeBusy}
        candidate={pendingMerge}
        error={mergeError}
        language={language}
        onClose={() => {
          if (mergeBusy) return;
          if (mergeResult && mergePreview) {
            setSuccess(language === 'ar'
              ? `تم دمج ${mergePreview.duplicate.fullName} في ${mergePreview.primary.fullName}.`
              : `${mergePreview.duplicate.fullName} was merged into ${mergePreview.primary.fullName}.`);
          }
          setPendingMerge(null);
          setMergePreview(null);
          setMergeResult(null);
          setMergeError('');
        }}
        onConfirm={confirmMerge}
        open={Boolean(pendingMerge)}
        preview={mergePreview}
        result={mergeResult}
        returnFocusRef={mergeTriggerRef}
      />
    </main>
  );
}

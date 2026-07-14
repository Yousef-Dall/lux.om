import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Eye,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import { listCrmProperties, type CrmWorkspaceAccess } from '../../../api/crm';
import {
  archiveCrmAccount,
  createCrmAccount,
  createCrmAccountContact,
  getCrmAccount,
  listCrmAccountRegister,
  type CrmAccountDetail,
  type CrmAccountDirection,
  type CrmAccountSortBy,
  type CrmAccountStatus,
  type CrmAccountSummary
} from '../../../api/crmAdvanced';
import { useAuth } from '../../../auth/AuthContext';
import AccessibleDialog from '../../../components/AccessibleDialog';
import type { CrmAccountType } from '../../../generated/crmContract';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useLanguage } from '../../../i18n/LanguageContext';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../WorkspaceSelector';

const PAGE_SIZE = 25;
const accountTypes: CrmAccountType[] = [
  'INDIVIDUAL',
  'COMPANY',
  'DEVELOPER',
  'TRAVEL_AGENCY',
  'ACTIVITY_PROVIDER',
  'PROPERTY_OWNER',
  'INVESTOR',
  'VENDOR',
  'TENANT_ORGANIZATION',
  'GOVERNMENT',
  'INSTITUTIONAL_PARTNER',
  'OTHER'
];

type AccountWorkspaceChoice = CrmWorkspaceChoice & { scope: 'personal' | 'company' | 'admin' };

type AccountForm = {
  type: CrmAccountType;
  name: string;
  legalName: string;
  registrationNumber: string;
  email: string;
  phone: string;
  industry: string;
  pmsPropertyId: string;
  notes: string;
};

type ContactForm = { fullName: string; email: string; phone: string; notes: string };

const emptyAccountForm: AccountForm = {
  type: 'COMPANY',
  name: '',
  legalName: '',
  registrationNumber: '',
  email: '',
  phone: '',
  industry: '',
  pmsPropertyId: '',
  notes: ''
};
const emptyContactForm: ContactForm = { fullName: '', email: '', phone: '', notes: '' };

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'CRM account operation failed.';
}

function workspaceChoices(access: CrmWorkspaceAccess | null | undefined, language: 'en' | 'ar'): AccountWorkspaceChoice[] {
  if (!access) return [];
  const choices: AccountWorkspaceChoice[] = [];
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

function safeType(value: string | null): CrmAccountType | '' {
  return accountTypes.includes(value as CrmAccountType) ? value as CrmAccountType : '';
}

function safeStatus(value: string | null): CrmAccountStatus {
  return value === 'ARCHIVED' || value === 'ALL' ? value : 'ACTIVE';
}

function safeSort(value: string | null): CrmAccountSortBy {
  return value === 'updatedAt' || value === 'createdAt' ? value : 'name';
}

function safeDirection(value: string | null): CrmAccountDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const arabicAccountTypeLabels: Record<CrmAccountType, string> = {
  INDIVIDUAL: 'فرد',
  COMPANY: 'شركة',
  DEVELOPER: 'مطوّر',
  TRAVEL_AGENCY: 'وكالة سفر',
  ACTIVITY_PROVIDER: 'مزود أنشطة',
  PROPERTY_OWNER: 'مالك عقار',
  INVESTOR: 'مستثمر',
  VENDOR: 'مورد',
  TENANT_ORGANIZATION: 'جهة مستأجرة',
  GOVERNMENT: 'جهة حكومية',
  INSTITUTIONAL_PARTNER: 'شريك مؤسسي',
  OTHER: 'أخرى'
};

function accountTypeLabel(value: CrmAccountType, language: 'en' | 'ar') {
  return language === 'ar' ? arabicAccountTypeLabels[value] : humanize(value);
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function CrmAccountsWorkspace() {
  const { token, crmAccess } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-OM' : 'en-OM';
  const navigate = useNavigate();
  const { accountId } = useParams();
  const [params, setParams] = useSearchParams();
  const pendingParamsRef = useRef(new URLSearchParams(params));
  const choices = useMemo(() => workspaceChoices(crmAccess, language), [crmAccess, language]);
  const requestedWorkspaceId = params.get('workspaceId');
  const [workspaceId, setWorkspaceId] = useState('');
  const activeChoice = choices.find((choice) => choice.workspaceId === workspaceId);
  const canManage = Boolean(activeChoice?.canManage);

  const page = Math.max(1, Number(params.get('accountPage')) || 1);
  const search = params.get('accountQ')?.trim() ?? '';
  const type = safeType(params.get('accountType'));
  const status = safeStatus(params.get('accountStatus'));
  const sortBy = safeSort(params.get('accountSort'));
  const direction = safeDirection(params.get('accountDirection'));

  const [searchInput, setSearchInput] = useState(search);
  const [typeInput, setTypeInput] = useState<CrmAccountType | ''>(type);
  const [statusInput, setStatusInput] = useState<CrmAccountStatus>(status);
  const [sortInput, setSortInput] = useState<CrmAccountSortBy>(sortBy);
  const [directionInput, setDirectionInput] = useState<CrmAccountDirection>(direction);
  const [accounts, setAccounts] = useState<CrmAccountSummary[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, archived: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [properties, setProperties] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AccountForm>(emptyAccountForm);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  const [selectedAccount, setSelectedAccount] = useState<CrmAccountDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState('');

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveAcknowledged, setArchiveAcknowledged] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const createNameRef = useRef<HTMLInputElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement>(null);
  const contactNameRef = useRef<HTMLInputElement>(null);
  const archiveReasonRef = useRef<HTMLTextAreaElement>(null);

  useDocumentTitle(language === 'ar' ? 'حسابات CRM | lux.om' : 'CRM accounts | lux.om');

  const copy = language === 'ar'
    ? {
        eyebrow: 'سجل علاقات محكوم', title: 'مركز حسابات CRM', description: 'استعرض الحسابات وابحث وصفِّ النتائج وأضف جهات اتصال مع الحفاظ على نطاق مساحة العمل والعقار.',
        workspace: 'مساحة العمل', refresh: 'تحديث الحسابات', create: 'إنشاء حساب', readOnly: 'عرض فقط', readOnlyBody: 'يمكنك مراجعة الحسابات، لكن صلاحيتك الحالية لا تسمح بإنشائها أو تعديلها.',
        total: 'إجمالي النتائج', active: 'نشطة', archived: 'مؤرشفة', search: 'البحث في الحساب', searchPlaceholder: 'الاسم أو البريد أو القطاع', type: 'النوع', state: 'الحالة', all: 'الكل', sort: 'الترتيب', direction: 'الاتجاه', apply: 'تطبيق عوامل التصفية', reset: 'إعادة الضبط',
        name: 'الاسم', contacts: 'جهات الاتصال', deals: 'الصفقات', owner: 'المالك', updated: 'آخر تحديث', actions: 'الإجراءات', review: 'مراجعة الحساب', loading: 'جارٍ تحميل حسابات CRM…', emptyTitle: 'لا توجد حسابات مطابقة', emptyBody: 'عدّل عوامل التصفية أو أنشئ حساباً محكوماً.',
        previous: 'السابق', next: 'التالي', page: 'صفحة', of: 'من', ascending: 'تصاعدي', descending: 'تنازلي', createdAt: 'وقت الإنشاء', updatedAt: 'آخر تحديث',
        createTitle: 'إنشاء حساب CRM محكوم', createDescription: 'يبقى الحساب داخل مساحة العمل ونطاق العقار المحدد.', closeCreate: 'إغلاق إنشاء الحساب', accountName: 'اسم الحساب', legalName: 'الاسم القانوني', registration: 'رقم التسجيل', email: 'البريد الإلكتروني', phone: 'الهاتف', industry: 'القطاع', property: 'العقار', noProperty: 'بدون عقار', notes: 'ملاحظات', saveAccount: 'حفظ الحساب', saving: 'جارٍ الحفظ…', created: 'تم إنشاء حساب CRM.',
        details: 'تفاصيل الحساب', closeDetails: 'إغلاق تفاصيل الحساب', statusActive: 'نشط', statusArchived: 'مؤرشف', hierarchy: 'التسلسل', activity: 'آخر نشاط', noContacts: 'لا توجد جهات اتصال مرتبطة.', noDeals: 'لا توجد صفقات مرتبطة.', addContact: 'إضافة جهة اتصال',
        addContactTitle: 'إضافة جهة اتصال للحساب', addContactDescription: 'تُطبّق قواعد الهوية المكررة والنطاق في الخادم.', closeContact: 'إغلاق إضافة جهة الاتصال', fullName: 'الاسم الكامل', saveContact: 'حفظ جهة الاتصال', contactCreated: 'تمت إضافة جهة الاتصال إلى الحساب.', identityRequired: 'أدخل بريداً إلكترونياً أو رقم هاتف.',
        archive: 'أرشفة الحساب', restore: 'استعادة الحساب', archiveTitle: 'مراجعة تغيير حالة الحساب', archiveDescription: 'يتطلب الأرشفة أو الاستعادة سبباً واضحاً ويُسجّل الحدث في سجل الحساب.', closeArchive: 'إغلاق مراجعة الحالة', reason: 'سبب التغيير', acknowledge: 'أفهم أن هذا التغيير يؤثر في ظهور الحساب التشغيلي.', confirmArchive: 'تأكيد الأرشفة', confirmRestore: 'تأكيد الاستعادة', accountArchived: 'تمت أرشفة الحساب.', accountRestored: 'تمت استعادة الحساب.',
        nameSort: 'الاسم', activeState: 'نشطة فقط', archivedState: 'مؤرشفة فقط', allStates: 'كل الحالات'
      }
    : {
        eyebrow: 'Governed relationship register', title: 'CRM account center', description: 'Browse, search, and filter accounts while adding contacts without leaving the selected workspace and property scope.',
        workspace: 'Workspace', refresh: 'Refresh accounts', create: 'Create account', readOnly: 'Read only', readOnlyBody: 'You can review CRM accounts, but your current access cannot create or change them.',
        total: 'Total results', active: 'Active', archived: 'Archived', search: 'Search accounts', searchPlaceholder: 'Name, email, phone, or industry', type: 'Type', state: 'State', all: 'All', sort: 'Sort by', direction: 'Direction', apply: 'Apply filters', reset: 'Reset filters',
        name: 'Name', contacts: 'Contacts', deals: 'Deals', owner: 'Owner', updated: 'Updated', actions: 'Actions', review: 'Review account', loading: 'Loading CRM accounts…', emptyTitle: 'No matching accounts', emptyBody: 'Adjust the filters or create a governed account.',
        previous: 'Previous', next: 'Next', page: 'Page', of: 'of', ascending: 'Ascending', descending: 'Descending', createdAt: 'Created time', updatedAt: 'Updated time',
        createTitle: 'Create governed CRM account', createDescription: 'The account remains inside the selected workspace and property scope.', closeCreate: 'Close account creation', accountName: 'Account name', legalName: 'Legal name', registration: 'Registration number', email: 'Email', phone: 'Phone', industry: 'Industry', property: 'PMS property', noProperty: 'No property', notes: 'Notes', saveAccount: 'Save account', saving: 'Saving…', created: 'The CRM account was created.',
        details: 'Account details', closeDetails: 'Close account details', statusActive: 'Active', statusArchived: 'Archived', hierarchy: 'Hierarchy', activity: 'Recent activity', noContacts: 'No contacts are linked.', noDeals: 'No deals are linked.', addContact: 'Add contact',
        addContactTitle: 'Add contact to account', addContactDescription: 'Server-side duplicate identity and scope rules remain enforced.', closeContact: 'Close contact creation', fullName: 'Full name', saveContact: 'Save contact', contactCreated: 'The contact was added to the account.', identityRequired: 'Enter an email address or phone number.',
        archive: 'Archive account', restore: 'Restore account', archiveTitle: 'Review account state change', archiveDescription: 'Archiving or restoring requires a clear reason and records an account activity.', closeArchive: 'Close state review', reason: 'Change reason', acknowledge: 'I understand this changes the account’s operational visibility.', confirmArchive: 'Confirm archive', confirmRestore: 'Confirm restore', accountArchived: 'The account was archived.', accountRestored: 'The account was restored.',
        nameSort: 'Name', activeState: 'Active only', archivedState: 'Archived only', allStates: 'All states'
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
        next.delete('accountPage');
      });
    }
  }, [choices, requestedWorkspaceId, workspaceId]);

  useEffect(() => {
    setSearchInput(search);
    setTypeInput(type);
    setStatusInput(status);
    setSortInput(sortBy);
    setDirectionInput(direction);
  }, [search, type, status, sortBy, direction]);

  useEffect(() => {
    if (!token || !activeChoice?.companyId) {
      setProperties([]);
      return;
    }
    let active = true;
    void listCrmProperties(token, activeChoice.companyId)
      .then((response) => { if (active) setProperties(response.properties); })
      .catch(() => { if (active) setProperties([]); });
    return () => { active = false; };
  }, [activeChoice?.companyId, token]);

  async function loadAccounts() {
    if (!token || !workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const response = await listCrmAccountRegister(token, {
        workspaceId,
        search: search || undefined,
        type: type || undefined,
        status,
        sortBy,
        direction,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE
      });
      setAccounts(response.accounts);
      setSummary(response.summary ?? { total: response.pagination.total, active: response.accounts.filter((account) => !account.archivedAt).length, archived: response.accounts.filter((account) => Boolean(account.archivedAt)).length });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAccounts(); }, [token, workspaceId, search, type, status, sortBy, direction, page]);

  useEffect(() => {
    if (!token || !accountId) {
      setSelectedAccount(null);
      setDetailError('');
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    void getCrmAccount(token, accountId)
      .then((response) => { if (active) setSelectedAccount(response.account); })
      .catch((detailLoadError) => { if (active) setDetailError(errorMessage(detailLoadError)); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [accountId, token]);

  function workspaceChanged(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId);
    setSelectedAccount(null);
    replaceQuery((next) => {
      next.set('workspaceId', nextWorkspaceId);
      next.delete('accountPage');
    });
    navigate({ pathname: '/crm/accounts', search: `?${pendingParamsRef.current.toString()}` }, { replace: true });
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    replaceQuery((next) => {
      const values: Array<[string, string]> = [
        ['accountQ', searchInput.trim()],
        ['accountType', typeInput],
        ['accountStatus', statusInput === 'ACTIVE' ? '' : statusInput],
        ['accountSort', sortInput === 'name' ? '' : sortInput],
        ['accountDirection', directionInput === 'asc' ? '' : directionInput]
      ];
      for (const [key, value] of values) value ? next.set(key, value) : next.delete(key);
      next.delete('accountPage');
    });
  }

  function resetFilters() {
    setSearchInput('');
    setTypeInput('');
    setStatusInput('ACTIVE');
    setSortInput('name');
    setDirectionInput('asc');
    replaceQuery((next) => {
      ['accountQ', 'accountType', 'accountStatus', 'accountSort', 'accountDirection', 'accountPage'].forEach((key) => next.delete(key));
    });
  }

  function pageChanged(nextPage: number) {
    replaceQuery((next) => {
      nextPage > 1 ? next.set('accountPage', String(nextPage)) : next.delete('accountPage');
    });
  }

  function openCreate() {
    const scopedPropertyId = activeChoice?.propertyScope && !activeChoice.propertyScope.allProperties
      ? activeChoice.propertyScope.propertyIds[0] ?? ''
      : '';
    setCreateForm({ ...emptyAccountForm, pmsPropertyId: scopedPropertyId });
    setCreateError('');
    setCreateOpen(true);
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!token || !workspaceId) return;
    setCreateBusy(true);
    setCreateError('');
    try {
      await createCrmAccount(token, {
        workspaceId,
        type: createForm.type,
        name: createForm.name.trim(),
        legalName: createForm.legalName.trim() || null,
        registrationNumber: createForm.registrationNumber.trim() || null,
        email: createForm.email.trim() || null,
        phone: createForm.phone.trim() || null,
        industry: createForm.industry.trim() || null,
        pmsPropertyId: createForm.pmsPropertyId || null,
        notes: createForm.notes.trim() || null,
        teamUserIds: []
      });
      setCreateOpen(false);
      setSuccess(copy.created);
      await loadAccounts();
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
    navigate(`/crm/accounts/${id}${query ? `?${query}` : ''}`);
  }

  function closeDetail() {
    setSelectedAccount(null);
    setDetailError('');
    const query = pendingParamsRef.current.toString();
    navigate(`/crm/accounts${query ? `?${query}` : ''}`);
  }

  async function refreshDetail() {
    if (!token || !accountId) return;
    const response = await getCrmAccount(token, accountId);
    setSelectedAccount(response.account);
  }

  async function submitContact(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedAccount) return;
    if (!contactForm.email.trim() && !contactForm.phone.trim()) {
      setContactError(copy.identityRequired);
      return;
    }
    setContactBusy(true);
    setContactError('');
    try {
      await createCrmAccountContact(token, selectedAccount.id, {
        fullName: contactForm.fullName.trim(),
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        notes: contactForm.notes.trim() || null
      });
      setContactOpen(false);
      setContactForm(emptyContactForm);
      setSuccess(copy.contactCreated);
      await Promise.all([refreshDetail(), loadAccounts()]);
    } catch (submitError) {
      setContactError(errorMessage(submitError));
    } finally {
      setContactBusy(false);
    }
  }

  function requestArchive() {
    setArchiveReason('');
    setArchiveAcknowledged(false);
    setArchiveError('');
    setArchiveOpen(true);
  }

  async function submitArchive(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedAccount) return;
    const archived = !selectedAccount.archivedAt;
    setArchiveBusy(true);
    setArchiveError('');
    try {
      await archiveCrmAccount(token, selectedAccount.id, archived, archiveReason.trim());
      setArchiveOpen(false);
      setSuccess(archived ? copy.accountArchived : copy.accountRestored);
      await Promise.all([refreshDetail(), loadAccounts()]);
    } catch (submitError) {
      setArchiveError(errorMessage(submitError));
    } finally {
      setArchiveBusy(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(summary.total / PAGE_SIZE));
  const propertyRequired = Boolean(activeChoice?.propertyScope && !activeChoice.propertyScope.allProperties);

  return (
    <main className="crm-accounts" aria-labelledby="crm-accounts-title">
      <header className="crm-accounts__hero">
        <div>
          <p className="eyebrow"><Building2 aria-hidden="true" size={17} /> {copy.eyebrow}</p>
          <h2 id="crm-accounts-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="crm-accounts__hero-actions">
          <button className="button-link button-link--secondary" disabled={loading} onClick={() => void loadAccounts()} type="button">
            <RefreshCw aria-hidden="true" className={loading ? 'spin' : ''} size={16} /> {copy.refresh}
          </button>
          {canManage ? <button className="button-link button-link--primary" onClick={openCreate} ref={createTriggerRef} type="button"><Plus aria-hidden="true" size={16} /> {copy.create}</button> : null}
        </div>
      </header>

      <section className="crm-accounts__toolbar" aria-label={copy.workspace}>
        <WorkspaceSelector label={copy.workspace} value={workspaceId} choices={choices} onChange={workspaceChanged} />
      </section>

      {!canManage && activeChoice ? <aside className="crm-accounts__readonly" role="note"><ShieldCheck aria-hidden="true" /><div><strong>{copy.readOnly}</strong><p>{copy.readOnlyBody}</p></div></aside> : null}
      {success && !accountId ? <p className="form-alert form-alert--success" role="status">{success}</p> : null}
      {error ? <p className="form-alert form-alert--error" role="alert">{error}</p> : null}

      <section className="crm-accounts__metrics" aria-label={copy.total}>
        <article><span>{copy.total}</span><strong>{summary.total}</strong></article>
        <article><span>{copy.active}</span><strong>{summary.active}</strong></article>
        <article><span>{copy.archived}</span><strong>{summary.archived}</strong></article>
      </section>

      <form className="crm-accounts__filters" onSubmit={applyFilters}>
        <label className="crm-accounts__search"><span>{copy.search}</span><span><Search aria-hidden="true" size={16} /><input aria-label={copy.search} onChange={(event) => setSearchInput(event.target.value)} placeholder={copy.searchPlaceholder} value={searchInput} /></span></label>
        <label><span>{copy.type}</span><select aria-label={copy.type} onChange={(event) => setTypeInput(event.target.value as CrmAccountType | '')} value={typeInput}><option value="">{copy.all}</option>{accountTypes.map((item) => <option key={item} value={item}>{accountTypeLabel(item, language)}</option>)}</select></label>
        <label><span>{copy.state}</span><select aria-label={copy.state} onChange={(event) => setStatusInput(event.target.value as CrmAccountStatus)} value={statusInput}><option value="ACTIVE">{copy.activeState}</option><option value="ARCHIVED">{copy.archivedState}</option><option value="ALL">{copy.allStates}</option></select></label>
        <label><span>{copy.sort}</span><select aria-label={copy.sort} onChange={(event) => setSortInput(event.target.value as CrmAccountSortBy)} value={sortInput}><option value="name">{copy.nameSort}</option><option value="updatedAt">{copy.updatedAt}</option><option value="createdAt">{copy.createdAt}</option></select></label>
        <label><span>{copy.direction}</span><select aria-label={copy.direction} onChange={(event) => setDirectionInput(event.target.value as CrmAccountDirection)} value={directionInput}><option value="asc">{copy.ascending}</option><option value="desc">{copy.descending}</option></select></label>
        <div className="crm-accounts__filter-actions"><button className="button-link button-link--primary" type="submit">{copy.apply}</button><button className="button-link button-link--ghost" onClick={resetFilters} type="button">{copy.reset}</button></div>
      </form>

      <section className="crm-accounts__results" aria-label={copy.title} aria-busy={loading}>
        {loading && accounts.length === 0 ? <p className="crm-accounts__loading">{copy.loading}</p> : accounts.length === 0 ? <div className="crm-empty"><Building2 aria-hidden="true" /><h3>{copy.emptyTitle}</h3><p>{copy.emptyBody}</p></div> : <div className="crm-accounts__table-wrap"><table><thead><tr><th scope="col">{copy.name}</th><th scope="col">{copy.type}</th><th scope="col">{copy.contacts}</th><th scope="col">{copy.deals}</th><th scope="col">{copy.owner}</th><th scope="col">{copy.updated}</th><th scope="col">{copy.actions}</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id} className={account.archivedAt ? 'is-archived' : ''}><th scope="row"><strong>{account.name}</strong><small>{account.email || account.phone || account.industry || '—'}</small><span>{account.archivedAt ? copy.statusArchived : copy.statusActive}</span></th><td>{accountTypeLabel(account.type, language)}</td><td>{account._count.contacts}</td><td>{account._count.deals}</td><td>{account.ownerUser?.name || '—'}</td><td>{formatDate(account.updatedAt, locale)}</td><td><button className="button-link button-link--secondary" onClick={(event) => openDetail(account.id, event.currentTarget)} type="button"><Eye aria-hidden="true" size={15} /> {copy.review}</button></td></tr>)}</tbody></table></div>}
      </section>

      <nav className="crm-accounts__pagination" aria-label={`${copy.page} ${page}`}><button disabled={page <= 1} onClick={() => pageChanged(page - 1)} type="button"><ChevronLeft aria-hidden="true" /> {copy.previous}</button><span>{copy.page} {page} {copy.of} {pageCount}</span><button disabled={page >= pageCount} onClick={() => pageChanged(page + 1)} type="button">{copy.next} <ChevronRight aria-hidden="true" /></button></nav>

      <AccessibleDialog open={createOpen} title={copy.createTitle} description={copy.createDescription} closeLabel={copy.closeCreate} onClose={() => setCreateOpen(false)} initialFocusRef={createNameRef} returnFocusRef={createTriggerRef} size="large">
        <form className="crm-accounts__dialog-form" onSubmit={submitCreate}>
          {createError ? <p className="form-alert form-alert--error" role="alert">{createError}</p> : null}
          <label><span>{copy.accountName}</span><input ref={createNameRef} required minLength={2} value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label><span>{copy.type}</span><select aria-label={copy.type} value={createForm.type} onChange={(event) => setCreateForm((current) => ({ ...current, type: event.target.value as CrmAccountType }))}>{accountTypes.map((item) => <option key={item} value={item}>{accountTypeLabel(item, language)}</option>)}</select></label>
          <label><span>{copy.legalName}</span><input value={createForm.legalName} onChange={(event) => setCreateForm((current) => ({ ...current, legalName: event.target.value }))} /></label>
          <label><span>{copy.registration}</span><input disabled={createForm.type === 'INDIVIDUAL'} value={createForm.registrationNumber} onChange={(event) => setCreateForm((current) => ({ ...current, registrationNumber: event.target.value }))} /></label>
          <label><span>{copy.email}</span><input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label><span>{copy.phone}</span><input value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label><span>{copy.industry}</span><input value={createForm.industry} onChange={(event) => setCreateForm((current) => ({ ...current, industry: event.target.value }))} /></label>
          {activeChoice?.companyId ? <label><span>{copy.property}</span><select aria-label={copy.property} required={propertyRequired} value={createForm.pmsPropertyId} onChange={(event) => setCreateForm((current) => ({ ...current, pmsPropertyId: event.target.value }))}><option value="">{copy.noProperty}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}{property.code ? ` · ${property.code}` : ''}</option>)}</select></label> : null}
          <label className="crm-accounts__dialog-wide"><span>{copy.notes}</span><textarea rows={4} value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          <div className="crm-accounts__dialog-actions"><button className="button-link button-link--primary" disabled={createBusy} type="submit">{createBusy ? copy.saving : copy.saveAccount}</button></div>
        </form>
      </AccessibleDialog>

      <AccessibleDialog open={Boolean(accountId) && !contactOpen && !archiveOpen} title={selectedAccount ? `${copy.details} · ${selectedAccount.name}` : copy.details} description={selectedAccount ? `${accountTypeLabel(selectedAccount.type, language)} · ${selectedAccount.archivedAt ? copy.statusArchived : copy.statusActive}` : undefined} closeLabel={copy.closeDetails} onClose={closeDetail} returnFocusRef={detailTriggerRef} size="large">
        {success ? <p className="form-alert form-alert--success" role="status">{success}</p> : null}
        {detailLoading ? <p>{copy.loading}</p> : detailError ? <p className="form-alert form-alert--error" role="alert">{detailError}</p> : selectedAccount ? <div className="crm-account-detail">
          <section className="crm-account-detail__summary"><article><span>{copy.contacts}</span><strong>{selectedAccount._count.contacts}</strong></article><article><span>{copy.deals}</span><strong>{selectedAccount._count.deals}</strong></article><article><span>{copy.updated}</span><strong>{formatDate(selectedAccount.updatedAt, locale)}</strong></article></section>
          <dl><div><dt>{copy.email}</dt><dd>{selectedAccount.email || '—'}</dd></div><div><dt>{copy.phone}</dt><dd>{selectedAccount.phone || '—'}</dd></div><div><dt>{copy.industry}</dt><dd>{selectedAccount.industry || '—'}</dd></div><div><dt>{copy.owner}</dt><dd>{selectedAccount.ownerUser?.name || '—'}</dd></div></dl>
          <section aria-labelledby="crm-account-contacts-title"><header><h3 id="crm-account-contacts-title"><ContactRound aria-hidden="true" size={18} /> {copy.contacts}</h3>{canManage && !selectedAccount.archivedAt ? <button className="button-link button-link--secondary" onClick={() => { setContactForm(emptyContactForm); setContactError(''); setContactOpen(true); }} type="button"><Plus aria-hidden="true" size={15} /> {copy.addContact}</button> : null}</header>{selectedAccount.contacts.length === 0 ? <p>{copy.noContacts}</p> : <ul>{selectedAccount.contacts.map((contact) => <li key={contact.id}><strong>{contact.fullName}</strong><span>{contact.email || contact.phone || '—'}</span></li>)}</ul>}</section>
          <section aria-labelledby="crm-account-deals-title"><header><h3 id="crm-account-deals-title"><UsersRound aria-hidden="true" size={18} /> {copy.deals}</h3></header>{selectedAccount.deals.length === 0 ? <p>{copy.noDeals}</p> : <ul>{selectedAccount.deals.map((deal) => <li key={deal.id}><strong>{deal.name}</strong><span>{deal.pipeline.name} · {deal.stage.name} · {deal.currency}</span></li>)}</ul>}</section>
          {canManage ? <div className="crm-account-detail__actions"><button className={selectedAccount.archivedAt ? 'button-link button-link--primary' : 'button-link button-link--danger'} onClick={requestArchive} type="button">{selectedAccount.archivedAt ? <ArchiveRestore aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />}{selectedAccount.archivedAt ? copy.restore : copy.archive}</button></div> : null}
        </div> : null}
      </AccessibleDialog>

      <AccessibleDialog open={contactOpen} title={copy.addContactTitle} description={copy.addContactDescription} closeLabel={copy.closeContact} onClose={() => setContactOpen(false)} initialFocusRef={contactNameRef} size="medium">
        <form className="crm-accounts__dialog-form" onSubmit={submitContact}>
          {contactError ? <p className="form-alert form-alert--error crm-accounts__dialog-wide" role="alert">{contactError}</p> : null}
          <label><span>{copy.fullName}</span><input ref={contactNameRef} required minLength={2} value={contactForm.fullName} onChange={(event) => setContactForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
          <label><span>{copy.email}</span><input type="email" value={contactForm.email} onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label><span>{copy.phone}</span><input value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label className="crm-accounts__dialog-wide"><span>{copy.notes}</span><textarea rows={4} value={contactForm.notes} onChange={(event) => setContactForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          <div className="crm-accounts__dialog-actions crm-accounts__dialog-wide"><button className="button-link button-link--primary" disabled={contactBusy} type="submit">{contactBusy ? copy.saving : copy.saveContact}</button></div>
        </form>
      </AccessibleDialog>

      <AccessibleDialog open={archiveOpen} title={copy.archiveTitle} description={copy.archiveDescription} closeLabel={copy.closeArchive} onClose={() => setArchiveOpen(false)} initialFocusRef={archiveReasonRef} size="medium">
        <form className="crm-account-archive" onSubmit={submitArchive}>
          {archiveError ? <p className="form-alert form-alert--error" role="alert">{archiveError}</p> : null}
          <label><span>{copy.reason}</span><textarea ref={archiveReasonRef} required minLength={3} rows={4} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} /></label>
          <label className="crm-account-archive__ack"><input checked={archiveAcknowledged} onChange={(event) => setArchiveAcknowledged(event.target.checked)} type="checkbox" /><span>{copy.acknowledge}</span></label>
          <button className="button-link button-link--primary" disabled={archiveBusy || !archiveAcknowledged || archiveReason.trim().length < 3} type="submit">{archiveBusy ? copy.saving : selectedAccount?.archivedAt ? copy.confirmRestore : copy.confirmArchive}</button>
        </form>
      </AccessibleDialog>
    </main>
  );
}

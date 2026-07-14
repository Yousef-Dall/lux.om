import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MailCheck,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserRound
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../api/client';
import type { CrmWorkspaceAccess } from '../../../api/crm';
import {
  createCrmDeliveryAttempt,
  listCrmCommunicationContacts,
  listCrmCommunicationTemplates,
  listCrmDeliveryAttempts,
  type CrmCommunicationContact,
  type CrmCommunicationTemplate,
  type CrmDeliveryAttempt,
  type CrmDeliveryProvider
} from '../../../api/crmAdvanced';
import type { CrmCommunicationChannel, CrmDeliveryStatus } from '../../../generated/crmContract';
import { useAuth } from '../../../auth/AuthContext';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useLanguage } from '../../../i18n/LanguageContext';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../WorkspaceSelector';

const PAGE_SIZE = 25;
const deliveryStatuses: CrmDeliveryStatus[] = [
  'DRAFT',
  'QUEUED',
  'PROCESSING',
  'SUBMITTED',
  'DELIVERED',
  'FAILED',
  'BOUNCED',
  'BLOCKED',
  'CANCELLED'
];
const communicationChannels: CrmCommunicationChannel[] = ['EMAIL', 'WHATSAPP', 'PHONE'];
const deliveryProviders: CrmDeliveryProvider[] = ['DRAFT_ONLY', 'VERIFIED_EMAIL', 'WHATSAPP_BUSINESS'];

type SortBy = 'attemptedAt' | 'status' | 'channel';
type Direction = 'asc' | 'desc';

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'CRM communication operation failed.';
}

function workspaceChoices(access: CrmWorkspaceAccess | null | undefined): CrmWorkspaceChoice[] {
  if (!access) return [];
  const values: CrmWorkspaceChoice[] = [];
  const personal = access.workspaces?.find((item) => item.type === 'PERSONAL');
  if (personal?.workspaceId && personal.canView) {
    values.push({
      key: personal.workspaceId,
      workspaceId: personal.workspaceId,
      label: 'Personal CRM',
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
      label: company.nameEn,
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
      label: 'lux.om operator CRM',
      canManage: true,
      canManageWorkspace: true,
      propertyScope: platform.propertyScope
    });
  }
  return values;
}

function safeStatus(value: string | null): CrmDeliveryStatus | '' {
  return deliveryStatuses.includes(value as CrmDeliveryStatus) ? value as CrmDeliveryStatus : '';
}

function safeChannel(value: string | null): CrmCommunicationChannel | '' {
  return communicationChannels.includes(value as CrmCommunicationChannel) ? value as CrmCommunicationChannel : '';
}

function safeProvider(value: string | null): CrmDeliveryProvider | '' {
  return deliveryProviders.includes(value as CrmDeliveryProvider) ? value as CrmDeliveryProvider : '';
}

function safeSort(value: string | null): SortBy {
  return value === 'status' || value === 'channel' ? value : 'attemptedAt';
}

function safeDirection(value: string | null): Direction {
  return value === 'asc' ? 'asc' : 'desc';
}

function newIdempotencyKey() {
  const suffix = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `crm-communications-ui:${suffix}`;
}

function latestVersion(template: CrmCommunicationTemplate) {
  return template.versions.find((version) => version.active) ?? template.versions[0] ?? null;
}

export default function CrmCommunicationsWorkspace() {
  const { token, crmAccess } = useAuth();
  const { language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const choices = useMemo(() => workspaceChoices(crmAccess), [crmAccess]);
  const requestedWorkspaceId = params.get('workspaceId');
  const [workspaceId, setWorkspaceId] = useState('');
  const activeChoice = choices.find((choice) => choice.workspaceId === workspaceId);
  const canManage = Boolean(activeChoice?.canManage);
  const page = Math.max(1, Number(params.get('communicationPage')) || 1);
  const search = params.get('communicationQ')?.trim() ?? '';
  const status = safeStatus(params.get('communicationStatus'));
  const channel = safeChannel(params.get('communicationChannel'));
  const provider = safeProvider(params.get('communicationProvider'));
  const sortBy = safeSort(params.get('communicationSort'));
  const direction = safeDirection(params.get('communicationDirection'));

  const [attempts, setAttempts] = useState<CrmDeliveryAttempt[]>([]);
  const [total, setTotal] = useState(0);
  const [templates, setTemplates] = useState<CrmCommunicationTemplate[]>([]);
  const [contacts, setContacts] = useState<CrmCommunicationContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [composeDataLoading, setComposeDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [createdAttempt, setCreatedAttempt] = useState<CrmDeliveryAttempt | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [contactId, setContactId] = useState('');
  const [composeChannel, setComposeChannel] = useState<CrmCommunicationChannel>('EMAIL');
  const [composeProvider, setComposeProvider] = useState<CrmDeliveryProvider>('DRAFT_ONLY');
  const [templateVersionId, setTemplateVersionId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const composeTriggerRef = useRef<HTMLButtonElement>(null);
  const contactSearchRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  useDocumentTitle(language === 'ar' ? 'تواصل CRM | lux.om' : 'CRM communications | lux.om');

  const copy = language === 'ar'
    ? {
        eyebrow: 'تواصل محكوم وقابل للتدقيق',
        title: 'مركز تواصل CRM',
        description: 'راجع المسودات ومحاولات التسليم وحالات المزوّد دون اعتبار الإرسال أو التسليم مؤكداً قبل الدليل المناسب.',
        workspace: 'مساحة العمل',
        refresh: 'تحديث محاولات التواصل',
        compose: 'إنشاء تواصل',
        readOnly: 'عرض فقط',
        readOnlyBody: 'يمكنك مراجعة سجل التواصل، لكن صلاحيتك الحالية لا تسمح بإنشاء مسودة أو وضع رسالة في قائمة الإرسال.',
        search: 'بحث بالاسم أو الوجهة أو القالب',
        searchPlaceholder: 'مثال: Harbour أو بريد إلكتروني',
        status: 'الحالة',
        channel: 'القناة',
        provider: 'المزوّد',
        sort: 'الترتيب',
        direction: 'الاتجاه',
        all: 'الكل',
        newest: 'الأحدث أولاً',
        oldest: 'الأقدم أولاً',
        attemptedAt: 'وقت المحاولة',
        apply: 'تطبيق عوامل التصفية',
        reset: 'إعادة الضبط',
        loading: 'جارٍ تحميل سجل التواصل…',
        emptyTitle: 'لا توجد محاولات تواصل',
        emptyBody: 'عدّل عوامل التصفية أو أنشئ مسودة محكومة جديدة.',
        destination: 'الوجهة',
        attempted: 'وقت الإنشاء',
        template: 'القالب',
        noTemplate: 'بدون قالب',
        message: 'محتوى الرسالة',
        noBody: 'تم حجب المحتوى أو لم يعد متاحاً.',
        providerReference: 'مرجع المزوّد',
        notConfirmed: 'لا يوجد تأكيد تسليم من المزوّد.',
        previous: 'السابق',
        next: 'التالي',
        page: 'الصفحة',
        of: 'من',
        total: 'إجمالي المحاولات',
        close: 'إغلاق إنشاء التواصل',
        composeTitle: 'إنشاء تواصل محكوم',
        composeDescription: 'المسودة لا تُرسل. البريد الموثق يدخل قائمة انتظار مستقلة ولا يُعتبر مسلماً حتى يؤكد المزوّد ذلك.',
        findContact: 'البحث عن جهة اتصال',
        contactSearchPlaceholder: 'الاسم أو البريد أو الهاتف',
        find: 'بحث',
        contact: 'جهة الاتصال',
        chooseContact: 'اختر جهة اتصال',
        noContacts: 'لا توجد جهات اتصال مطابقة ضمن نطاقك.',
        communicationChannel: 'قناة التواصل',
        deliveryMode: 'طريقة المعالجة',
        draftOnly: 'حفظ مسودة فقط',
        verifiedEmail: 'وضع بريد موثق في قائمة الانتظار',
        whatsappUnavailable: 'واتساب الحقيقي غير مفعّل. استخدم المسودة فقط.',
        contactPreference: 'حالة موافقة جهة الاتصال',
        unknownPreference: 'غير محددة',
        destinationHelp: 'تُستمد الوجهة من الهوية المحفوظة ولا يمكن تعديلها يدوياً.',
        selectTemplate: 'قالب اختياري',
        noTemplateOption: 'بدون قالب',
        subject: 'الموضوع',
        body: 'نص الرسالة',
        acknowledgement: 'أفهم أن وضع البريد في قائمة الانتظار لا يعني إرساله أو تسليمه، وأن تأكيد المزوّد مطلوب لحالة التسليم.',
        saveDraft: 'حفظ المسودة',
        queueEmail: 'إضافة البريد إلى قائمة الانتظار',
        saving: 'جارٍ الحفظ…',
        resultDraft: 'تم حفظ المسودة المحكومة.',
        resultQueued: 'تم إنشاء محاولة في قائمة الانتظار. التسليم غير مؤكد.',
        resultStatus: 'حالة المحاولة',
        resultReference: 'مرجع المحاولة',
        done: 'تم',
        queuedNote: 'تُعالج قائمة الانتظار بواسطة مهمة التسليم الدائمة خارج معاملة الطلب.',
        blocked: 'ممنوع',
        draft: 'مسودة',
        queued: 'في قائمة الانتظار',
        processing: 'قيد المعالجة',
        submitted: 'مُرسل إلى المزوّد',
        delivered: 'تم التسليم',
        failed: 'فشل',
        bounced: 'مرتجع',
        cancelled: 'ملغى',
        email: 'بريد إلكتروني',
        whatsapp: 'واتساب',
        phone: 'هاتف',
        draftProvider: 'مسودة فقط',
        verifiedProvider: 'بريد موثق',
        whatsappProvider: 'واتساب للأعمال'
      }
    : {
        eyebrow: 'Governed, auditable outreach',
        title: 'CRM communications center',
        description: 'Review drafts, delivery attempts, and provider states without treating submission or delivery as confirmed before evidence exists.',
        workspace: 'Workspace',
        refresh: 'Refresh communication attempts',
        compose: 'Create communication',
        readOnly: 'Read-only access',
        readOnlyBody: 'You can review the communication register, but your current access cannot create a draft or queue a delivery.',
        search: 'Search name, destination, or template',
        searchPlaceholder: 'For example, Harbour or an email address',
        status: 'Status',
        channel: 'Channel',
        provider: 'Provider',
        sort: 'Sort by',
        direction: 'Direction',
        all: 'All',
        newest: 'Newest first',
        oldest: 'Oldest first',
        attemptedAt: 'Attempted time',
        apply: 'Apply filters',
        reset: 'Reset filters',
        loading: 'Loading the communication register…',
        emptyTitle: 'No communication attempts',
        emptyBody: 'Adjust the filters or create a new governed draft.',
        destination: 'Destination',
        attempted: 'Created',
        template: 'Template',
        noTemplate: 'No template',
        message: 'Message content',
        noBody: 'The content was redacted or is no longer available.',
        providerReference: 'Provider reference',
        notConfirmed: 'No provider delivery confirmation.',
        previous: 'Previous',
        next: 'Next',
        page: 'Page',
        of: 'of',
        total: 'Total attempts',
        close: 'Close communication composer',
        composeTitle: 'Create governed communication',
        composeDescription: 'A draft is not sent. Verified email enters a separate durable queue and is not delivered until the provider confirms it.',
        findContact: 'Find contact',
        contactSearchPlaceholder: 'Name, email, or phone',
        find: 'Search',
        contact: 'Contact',
        chooseContact: 'Choose a contact',
        noContacts: 'No matching contacts are available inside your scope.',
        communicationChannel: 'Communication channel',
        deliveryMode: 'Delivery mode',
        draftOnly: 'Save a draft only',
        verifiedEmail: 'Queue verified email',
        whatsappUnavailable: 'Real WhatsApp delivery is not enabled. Use draft-only mode.',
        contactPreference: 'Contact consent state',
        unknownPreference: 'Unknown',
        destinationHelp: 'The destination comes from the stored identity and cannot be edited manually.',
        selectTemplate: 'Optional template',
        noTemplateOption: 'No template',
        subject: 'Subject',
        body: 'Message body',
        acknowledgement: 'I understand that queueing this email does not confirm submission or delivery, and provider evidence is required for delivered status.',
        saveDraft: 'Save draft',
        queueEmail: 'Queue verified email',
        saving: 'Saving…',
        resultDraft: 'The governed draft was saved.',
        resultQueued: 'A queued attempt was created. Delivery is not confirmed.',
        resultStatus: 'Attempt status',
        resultReference: 'Attempt reference',
        done: 'Done',
        queuedNote: 'The durable communication job processes queued work outside the request transaction.',
        blocked: 'Blocked',
        draft: 'Draft',
        queued: 'Queued',
        processing: 'Processing',
        submitted: 'Submitted to provider',
        delivered: 'Delivered',
        failed: 'Failed',
        bounced: 'Bounced',
        cancelled: 'Cancelled',
        email: 'Email',
        whatsapp: 'WhatsApp',
        phone: 'Phone',
        draftProvider: 'Draft only',
        verifiedProvider: 'Verified email',
        whatsappProvider: 'WhatsApp Business'
      };

  const statusLabel: Record<CrmDeliveryStatus, string> = {
    DRAFT: copy.draft,
    QUEUED: copy.queued,
    PROCESSING: copy.processing,
    SUBMITTED: copy.submitted,
    DELIVERED: copy.delivered,
    FAILED: copy.failed,
    BOUNCED: copy.bounced,
    BLOCKED: copy.blocked,
    CANCELLED: copy.cancelled
  };
  const channelLabel: Record<CrmCommunicationChannel, string> = {
    EMAIL: copy.email,
    WHATSAPP: copy.whatsapp,
    PHONE: copy.phone
  };
  const providerLabel: Record<CrmDeliveryProvider, string> = {
    DRAFT_ONLY: copy.draftProvider,
    VERIFIED_EMAIL: copy.verifiedProvider,
    WHATSAPP_BUSINESS: copy.whatsappProvider
  };

  useEffect(() => {
    setWorkspaceId((current) => {
      if (requestedWorkspaceId && choices.some((choice) => choice.workspaceId === requestedWorkspaceId)) {
        return requestedWorkspaceId;
      }
      if (choices.some((choice) => choice.workspaceId === current)) return current;
      return choices[0]?.workspaceId ?? '';
    });
  }, [choices, requestedWorkspaceId]);

  useEffect(() => {
    if (!workspaceId || workspaceId === requestedWorkspaceId) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('workspaceId', workspaceId);
      next.delete('communicationPage');
      return next;
    }, { replace: true });
  }, [requestedWorkspaceId, setParams, workspaceId]);

  async function loadAttempts() {
    if (!token || !workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const response = await listCrmDeliveryAttempts(token, {
        workspaceId,
        search: search || undefined,
        status: status || undefined,
        channel: channel || undefined,
        provider: provider || undefined,
        sortBy,
        direction,
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE
      });
      setAttempts(response.attempts);
      setTotal(response.pagination.total);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAttempts();
  }, [channel, direction, page, provider, search, sortBy, status, token, workspaceId]);

  async function loadTemplates() {
    if (!token || !workspaceId) return;
    try {
      const response = await listCrmCommunicationTemplates(token, workspaceId);
      setTemplates(response.templates.filter((template) => template.active));
    } catch (cause) {
      setComposeError(errorMessage(cause));
    }
  }

  async function searchContacts(searchValue = contactSearch) {
    if (!token || !workspaceId) return;
    setComposeDataLoading(true);
    setComposeError('');
    try {
      const response = await listCrmCommunicationContacts(token, {
        workspaceId,
        search: searchValue.trim() || undefined,
        sortBy: 'fullName',
        direction: 'asc',
        take: 50,
        skip: 0
      });
      setContacts(response.contacts);
      setContactId((current) => response.contacts.some((contact) => contact.id === current) ? current : response.contacts[0]?.id ?? '');
    } catch (cause) {
      setComposeError(errorMessage(cause));
    } finally {
      setComposeDataLoading(false);
    }
  }

  function openComposer() {
    setComposeOpen(true);
    setComposeError('');
    setCreatedAttempt(null);
    setContactSearch('');
    setContactId('');
    setComposeChannel('EMAIL');
    setComposeProvider('DRAFT_ONLY');
    setTemplateVersionId('');
    setSubject('');
    setBody('');
    setAcknowledged(false);
    setIdempotencyKey(newIdempotencyKey());
    void Promise.all([loadTemplates(), searchContacts('')]);
  }

  const selectedContact = contacts.find((contact) => contact.id === contactId) ?? null;
  const destination = composeChannel === 'EMAIL'
    ? selectedContact?.email ?? ''
    : selectedContact?.phone ?? '';
  const selectedPreference = selectedContact?.channelPreferences.find((preference) => preference.channel === composeChannel);
  const availableTemplates = templates
    .filter((template) => template.channel === composeChannel)
    .map((template) => ({ template, version: latestVersion(template) }))
    .filter((value): value is { template: CrmCommunicationTemplate; version: NonNullable<ReturnType<typeof latestVersion>> } => Boolean(value.version));

  function changeChannel(nextChannel: CrmCommunicationChannel) {
    setComposeChannel(nextChannel);
    setComposeProvider('DRAFT_ONLY');
    setTemplateVersionId('');
    setSubject('');
    setBody('');
    setAcknowledged(false);
  }

  function changeTemplate(nextVersionId: string) {
    setTemplateVersionId(nextVersionId);
    const match = availableTemplates.find(({ version }) => version.id === nextVersionId);
    setSubject(match?.version.subject ?? '');
    setBody(match?.version.body ?? '');
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setParams((current) => {
      const next = new URLSearchParams(current);
      const values = {
        communicationQ: String(data.get('communicationQ') ?? '').trim(),
        communicationStatus: String(data.get('communicationStatus') ?? ''),
        communicationChannel: String(data.get('communicationChannel') ?? ''),
        communicationProvider: String(data.get('communicationProvider') ?? ''),
        communicationSort: String(data.get('communicationSort') ?? 'attemptedAt'),
        communicationDirection: String(data.get('communicationDirection') ?? 'desc')
      };
      for (const [key, value] of Object.entries(values)) {
        if (value && !(key === 'communicationSort' && value === 'attemptedAt') && !(key === 'communicationDirection' && value === 'desc')) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      }
      next.delete('communicationPage');
      return next;
    }, { replace: true });
  }

  function resetFilters() {
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of ['communicationQ', 'communicationStatus', 'communicationChannel', 'communicationProvider', 'communicationSort', 'communicationDirection', 'communicationPage']) {
        next.delete(key);
      }
      return next;
    }, { replace: true });
  }

  function setPage(nextPage: number) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage <= 1) next.delete('communicationPage');
      else next.set('communicationPage', String(nextPage));
      return next;
    }, { replace: true });
  }

  async function submitCommunication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspaceId || !selectedContact || !destination || !body.trim()) return;
    if (composeProvider !== 'DRAFT_ONLY' && !acknowledged) return;
    setComposeBusy(true);
    setComposeError('');
    try {
      const response = await createCrmDeliveryAttempt(token, {
        workspaceId,
        contactId: selectedContact.id,
        templateVersionId: templateVersionId || null,
        channel: composeChannel,
        provider: composeProvider,
        destination,
        subject: subject.trim() || null,
        body: body.trim(),
        idempotencyKey
      });
      setCreatedAttempt(response.attempt);
      setSuccess(response.attempt.status === 'DRAFT' ? copy.resultDraft : copy.resultQueued);
      await loadAttempts();
    } catch (cause) {
      setComposeError(errorMessage(cause));
    } finally {
      setComposeBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateLocale = language === 'ar' ? 'ar-OM' : 'en-OM';

  return (
    <section className="crm-communications" aria-labelledby="crm-communications-title">
      <header className="crm-communications__hero">
        <div>
          <p className="eyebrow"><MailCheck aria-hidden="true" size={17} /> {copy.eyebrow}</p>
          <h2 id="crm-communications-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="crm-communications__hero-actions">
          <WorkspaceSelector
            choices={choices}
            label={copy.workspace}
            onChange={(value) => setWorkspaceId(value)}
            value={workspaceId}
          />
          <button
            aria-label={copy.refresh}
            className="button-link button-link--secondary"
            disabled={loading || !workspaceId}
            onClick={() => void loadAttempts()}
            type="button"
          >
            <RefreshCw aria-hidden="true" className={loading ? 'spin' : undefined} size={16} />
            {copy.refresh}
          </button>
          {canManage ? (
            <button
              className="button-link button-link--primary"
              disabled={!workspaceId}
              onClick={openComposer}
              ref={composeTriggerRef}
              type="button"
            >
              <Plus aria-hidden="true" size={16} /> {copy.compose}
            </button>
          ) : null}
        </div>
      </header>

      {!canManage && workspaceId ? (
        <aside className="crm-communications__readonly" role="note">
          <ShieldCheck aria-hidden="true" />
          <div><strong>{copy.readOnly}</strong><p>{copy.readOnlyBody}</p></div>
        </aside>
      ) : null}

      {error ? <p className="form-alert form-alert--error" role="alert"><AlertCircle aria-hidden="true" /> {error}</p> : null}
      {success ? <p className="form-alert form-alert--success" role="status"><CheckCircle2 aria-hidden="true" /> {success}</p> : null}

      <form className="crm-communications__filters" onSubmit={applyFilters}>
        <label className="crm-communications__search">
          <span>{copy.search}</span>
          <div><Search aria-hidden="true" size={16} /><input defaultValue={search} key={`q-${search}`} name="communicationQ" placeholder={copy.searchPlaceholder} /></div>
        </label>
        <label><span>{copy.status}</span><select defaultValue={status} key={`status-${status}`} name="communicationStatus"><option value="">{copy.all}</option>{deliveryStatuses.map((value) => <option key={value} value={value}>{statusLabel[value]}</option>)}</select></label>
        <label><span>{copy.channel}</span><select defaultValue={channel} key={`channel-${channel}`} name="communicationChannel"><option value="">{copy.all}</option>{communicationChannels.map((value) => <option key={value} value={value}>{channelLabel[value]}</option>)}</select></label>
        <label><span>{copy.provider}</span><select defaultValue={provider} key={`provider-${provider}`} name="communicationProvider"><option value="">{copy.all}</option>{deliveryProviders.map((value) => <option key={value} value={value}>{providerLabel[value]}</option>)}</select></label>
        <label><span>{copy.sort}</span><select defaultValue={sortBy} key={`sort-${sortBy}`} name="communicationSort"><option value="attemptedAt">{copy.attemptedAt}</option><option value="status">{copy.status}</option><option value="channel">{copy.channel}</option></select></label>
        <label><span>{copy.direction}</span><select defaultValue={direction} key={`direction-${direction}`} name="communicationDirection"><option value="desc">{copy.newest}</option><option value="asc">{copy.oldest}</option></select></label>
        <div className="crm-communications__filter-actions">
          <button className="button-link button-link--primary" type="submit">{copy.apply}</button>
          <button className="button-link button-link--ghost" onClick={resetFilters} type="button">{copy.reset}</button>
        </div>
      </form>

      <div className="crm-communications__summary" aria-live="polite">
        <span>{copy.total}</span><strong>{total.toLocaleString(dateLocale)}</strong>
      </div>

      {loading ? (
        <div className="crm-communications__state" role="status"><RefreshCw aria-hidden="true" className="spin" /><p>{copy.loading}</p></div>
      ) : attempts.length === 0 ? (
        <div className="crm-communications__state"><MessageSquareText aria-hidden="true" /><h3>{copy.emptyTitle}</h3><p>{copy.emptyBody}</p></div>
      ) : (
        <div className="crm-communications__results" aria-label={copy.title}>
          {attempts.map((attempt) => {
            const messageBody = typeof attempt.metadata?.body === 'string' ? attempt.metadata.body : '';
            const messageSubject = typeof attempt.metadata?.subject === 'string' ? attempt.metadata.subject : '';
            return (
              <article className="crm-communication-card" key={attempt.id}>
                <header>
                  <div>
                    <span className={`status-pill status-pill--${attempt.status.toLowerCase()}`}>{statusLabel[attempt.status]}</span>
                    <h3>{attempt.contact?.fullName ?? attempt.destination}</h3>
                    <p>{channelLabel[attempt.channel]} · {providerLabel[attempt.provider]}</p>
                  </div>
                  <Send aria-hidden="true" />
                </header>
                <dl>
                  <div><dt>{copy.destination}</dt><dd><code>{attempt.destination}</code></dd></div>
                  <div><dt>{copy.attempted}</dt><dd>{new Date(attempt.attemptedAt).toLocaleString(dateLocale)}</dd></div>
                  <div><dt>{copy.template}</dt><dd>{attempt.templateVersion?.template.name ?? copy.noTemplate}</dd></div>
                  <div><dt>{copy.providerReference}</dt><dd>{attempt.providerMessageId ?? copy.notConfirmed}</dd></div>
                </dl>
                <div className="crm-communication-card__message">
                  <strong>{messageSubject || copy.message}</strong>
                  <p>{messageBody || copy.noBody}</p>
                </div>
                {attempt.errorCode || attempt.errorMessage ? <p className="form-alert form-alert--error">{attempt.errorCode}{attempt.errorMessage ? ` · ${attempt.errorMessage}` : ''}</p> : null}
              </article>
            );
          })}
        </div>
      )}

      <nav className="crm-communications__pagination" aria-label={`${copy.page} ${page}`}>
        <button className="button-link button-link--secondary" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} type="button"><ChevronLeft aria-hidden="true" size={16} /> {copy.previous}</button>
        <span>{copy.page} <strong>{page.toLocaleString(dateLocale)}</strong> {copy.of} {totalPages.toLocaleString(dateLocale)}</span>
        <button className="button-link button-link--secondary" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)} type="button">{copy.next} <ChevronRight aria-hidden="true" size={16} /></button>
      </nav>

      <AccessibleDialog
        closeLabel={copy.close}
        description={createdAttempt ? (createdAttempt.status === 'DRAFT' ? copy.resultDraft : copy.resultQueued) : copy.composeDescription}
        initialFocusRef={createdAttempt ? doneRef : contactSearchRef}
        onClose={() => {
          if (composeBusy) return;
          setComposeOpen(false);
          setCreatedAttempt(null);
          setComposeError('');
        }}
        open={composeOpen}
        returnFocusRef={composeTriggerRef}
        size="large"
        title={copy.composeTitle}
      >
        {createdAttempt ? (
          <section className="crm-communication-result" aria-live="polite">
            <CheckCircle2 aria-hidden="true" size={42} />
            <h3>{createdAttempt.status === 'DRAFT' ? copy.resultDraft : copy.resultQueued}</h3>
            <dl>
              <div><dt>{copy.resultStatus}</dt><dd>{statusLabel[createdAttempt.status]}</dd></div>
              <div><dt>{copy.resultReference}</dt><dd><code>{createdAttempt.id}</code></dd></div>
            </dl>
            {createdAttempt.status !== 'DRAFT' ? <p><Clock3 aria-hidden="true" size={16} /> {copy.queuedNote}</p> : null}
            <button className="button-link button-link--primary" onClick={() => setComposeOpen(false)} ref={doneRef} type="button">{copy.done}</button>
          </section>
        ) : (
          <form className="crm-communication-composer" onSubmit={submitCommunication}>
            {composeError ? <p className="form-alert form-alert--error" role="alert"><AlertCircle aria-hidden="true" /> {composeError}</p> : null}
            <fieldset disabled={composeBusy}>
              <legend className="sr-only">{copy.composeTitle}</legend>
              <div className="crm-communication-composer__contact-search">
                <label><span>{copy.findContact}</span><input onChange={(event) => setContactSearch(event.target.value)} placeholder={copy.contactSearchPlaceholder} ref={contactSearchRef} value={contactSearch} /></label>
                <button className="button-link button-link--secondary" disabled={composeDataLoading} onClick={() => void searchContacts()} type="button"><Search aria-hidden="true" size={15} /> {copy.find}</button>
              </div>
              <label><span>{copy.contact}</span><select disabled={composeDataLoading || contacts.length === 0} onChange={(event) => setContactId(event.target.value)} required value={contactId}><option value="">{composeDataLoading ? copy.loading : contacts.length ? copy.chooseContact : copy.noContacts}</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName}{contact.email ? ` · ${contact.email}` : contact.phone ? ` · ${contact.phone}` : ''}</option>)}</select></label>
              <div className="crm-communication-composer__grid">
                <label><span>{copy.communicationChannel}</span><select onChange={(event) => changeChannel(event.target.value as CrmCommunicationChannel)} value={composeChannel}>{communicationChannels.map((value) => <option key={value} value={value}>{channelLabel[value]}</option>)}</select></label>
                <label><span>{copy.deliveryMode}</span><select onChange={(event) => { setComposeProvider(event.target.value as CrmDeliveryProvider); setAcknowledged(false); }} value={composeProvider}><option value="DRAFT_ONLY">{copy.draftOnly}</option>{composeChannel === 'EMAIL' ? <option value="VERIFIED_EMAIL">{copy.verifiedEmail}</option> : null}</select></label>
              </div>
              {composeChannel === 'WHATSAPP' ? <p className="crm-governance-note">{copy.whatsappUnavailable}</p> : null}
              <div className="crm-communication-composer__identity">
                <UserRound aria-hidden="true" />
                <div><span>{copy.destination}</span><strong>{destination || '—'}</strong><small>{copy.destinationHelp}</small></div>
                <div><span>{copy.contactPreference}</span><strong>{selectedPreference?.status ?? copy.unknownPreference}</strong></div>
              </div>
              <label><span>{copy.selectTemplate}</span><select onChange={(event) => changeTemplate(event.target.value)} value={templateVersionId}><option value="">{copy.noTemplateOption}</option>{availableTemplates.map(({ template, version }) => <option key={version.id} value={version.id}>{template.name} · v{version.version}</option>)}</select></label>
              {composeChannel === 'EMAIL' ? <label><span>{copy.subject}</span><input maxLength={240} onChange={(event) => setSubject(event.target.value)} value={subject} /></label> : null}
              <label><span>{copy.body}</span><textarea maxLength={20000} onChange={(event) => setBody(event.target.value)} required rows={8} value={body} /></label>
              {composeProvider !== 'DRAFT_ONLY' ? <label className="crm-communication-composer__acknowledgement"><input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" /><span>{copy.acknowledgement}</span></label> : null}
              <div className="crm-communication-composer__actions">
                <button className="button-link button-link--primary" disabled={!selectedContact || !destination || !body.trim() || (composeProvider !== 'DRAFT_ONLY' && !acknowledged) || composeBusy} type="submit"><Send aria-hidden="true" size={16} /> {composeBusy ? copy.saving : composeProvider === 'DRAFT_ONLY' ? copy.saveDraft : copy.queueEmail}</button>
              </div>
            </fieldset>
          </form>
        )}
      </AccessibleDialog>
    </section>
  );
}

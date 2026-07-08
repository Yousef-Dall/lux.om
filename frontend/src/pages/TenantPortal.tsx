import { AlertTriangle, CalendarDays, ExternalLink, FileText, Home, ReceiptText, ShieldCheck, UserCircle, Wrench } from 'lucide-react';
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, useLocation } from 'react-router-dom';

import {
  createTenantDocument,
  confirmTenantMaintenanceResolved,
  createTenantMaintenanceRequest,
  createTenantRentCheckoutSession,
  getTenantDocuments,
  getTenantLease,
  getTenantOverview,
  getTenantProfile,
  getTenantRentPaymentReceipt,
  listTenantMaintenance,
  listTenantRent,
  listTenantRentPayments,
  reopenTenantMaintenance,
  syncTenantRentPayment,
  updateTenantProfile,
  type TenantLeaseResponse,
  type TenantMaintenanceResponse,
  type TenantOverview,
  type TenantDocumentPayload,
  type TenantProfilePayload,
  type TenantRentResponse
} from '../api/tenant';
import type { PmsDocument, PmsMaintenancePriority, PmsRentDueItem, PmsRentPayment, PmsRentReceipt } from '../api/pms';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

const tenantTabs = [
  { key: 'overview', path: '/tenant/overview', icon: Home },
  { key: 'lease', path: '/tenant/lease', icon: FileText },
  { key: 'rent', path: '/tenant/rent', icon: ReceiptText },
  { key: 'maintenance', path: '/tenant/maintenance', icon: Wrench },
  { key: 'documents', path: '/tenant/documents', icon: ShieldCheck },
  { key: 'profile', path: '/tenant/profile', icon: UserCircle }
] as const;

type TenantTabKey = (typeof tenantTabs)[number]['key'];

type MaintenanceFormState = {
  title: string;
  description: string;
  priority: PmsMaintenancePriority;
};

const emptyTenantDocumentForm: TenantDocumentPayload = {
  type: 'OTHER',
  title: '',
  fileUrl: '',
  expiryDate: '',
  notes: ''
};

function getTenantTab(pathname: string): TenantTabKey {
  if (pathname.startsWith('/tenant/lease')) return 'lease';
  if (pathname.startsWith('/tenant/rent')) return 'rent';
  if (pathname.startsWith('/tenant/maintenance')) return 'maintenance';
  if (pathname.startsWith('/tenant/documents')) return 'documents';
  if (pathname.startsWith('/tenant/profile')) return 'profile';

  return 'overview';
}

function formatDate(value?: string | null, language: 'en' | 'ar' = 'en') {
  if (!value) return language === 'ar' ? 'غير محدد' : 'Not set';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-OM', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function formatMoney(amount?: string | null, currency = 'OMR') {
  if (!amount) return `0 ${currency}`;
  return `${amount} ${currency}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed';
}

function normalizeProfileValue(value?: string | null) {
  const trimmed = value?.trim() ?? '';

  return trimmed ? trimmed : null;
}

export default function TenantPortal() {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const activeTab = getTenantTab(pathname);
  const accessOptions = user?.tenantAccess?.tenancies ?? [];
  const [selectedAccessId, setSelectedAccessId] = useState(accessOptions[0]?.accessId ?? '');
  const activeAccessId = selectedAccessId || accessOptions[0]?.accessId;
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [leaseData, setLeaseData] = useState<TenantLeaseResponse | null>(null);
  const [rentData, setRentData] = useState<TenantRentResponse | null>(null);
  const [rentPaymentsByItemId, setRentPaymentsByItemId] = useState<Record<string, PmsRentPayment[]>>({});
  const [rentReceipt, setRentReceipt] = useState<PmsRentReceipt | null>(null);
  const [maintenanceData, setMaintenanceData] = useState<TenantMaintenanceResponse | null>(null);
  const [profile, setProfile] = useState<TenantProfilePayload>({});
  const [documents, setDocuments] = useState<PmsDocument[]>([]);
  const [documentsNote, setDocumentsNote] = useState('');
  const [documentForm, setDocumentForm] = useState<TenantDocumentPayload>(emptyTenantDocumentForm);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceFormState>({
    title: '',
    description: '',
    priority: 'MEDIUM'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const copy = useMemo(
    () =>
      language === 'ar'
        ? {
            title: 'بوابة المستأجر',
            subtitle: 'مساحة منفصلة وآمنة لعرض عقدك والإيجارات وطلبات الصيانة.',
            switchTenancy: 'اختيار السكن',
            overview: 'نظرة عامة',
            lease: 'العقد',
            rent: 'الإيجارات',
            maintenance: 'الصيانة',
            documents: 'المستندات',
            profile: 'البيانات',
            activeLease: 'العقد الحالي',
            noLease: 'لا يوجد عقد نشط ظاهر لهذا الحساب حالياً.',
            rentDue: 'إيجارات مستحقة',
            overdue: 'متأخر',
            dueSoon: 'قريب الاستحقاق',
            openMaintenance: 'طلبات صيانة مفتوحة',
            latestRent: 'آخر إيجار ظاهر',
            latestMaintenance: 'آخر طلب صيانة',
            amount: 'المبلغ',
            status: 'الحالة',
            dueDate: 'تاريخ الاستحقاق',
            property: 'العقار',
            unit: 'الوحدة',
            dates: 'الفترة',
            paymentNote: 'الدفع الإلكتروني للإيجار محفوظ لمرحلة المدفوعات القادمة.',
            payRent: 'دفع الإيجار',
            viewPayments: 'عرض سجل المدفوعات',
            syncPayment: 'تحديث حالة الدفع',
            viewReceipt: 'عرض الإيصال',
            printableReceipt: 'إيصال قابل للطباعة',
            printReceipt: 'طباعة الإيصال',
            balance: 'الرصيد المتبقي',
            paidAmount: 'المدفوع',
            paymentHistory: 'سجل المدفوعات',
            receiptNumber: 'رقم الإيصال',
            paymentMethod: 'طريقة الدفع',
            paymentReference: 'رقم المرجع',
            paidAt: 'تاريخ الدفع',
            noPayments: 'لا توجد مدفوعات مسجلة لهذا البند بعد.',
            noRent: 'لا توجد إيجارات مستحقة أو مسجلة بعد.',
            noMaintenance: 'لا توجد طلبات صيانة بعد.',
            newRequest: 'طلب صيانة جديد',
            titleLabel: 'عنوان الطلب',
            description: 'الوصف',
            priority: 'الأولوية',
            submit: 'إرسال الطلب',
            saving: 'جارٍ الحفظ...',
            saved: 'تم الحفظ بنجاح.',
            requestCreated: 'تم إنشاء طلب الصيانة.',
            confirmResolved: 'تأكيد الحل',
            reopenRequest: 'إعادة فتح الطلب',
            tenantConfirmed: 'تم التأكيد من المستأجر',
            documentsText: 'مستنداتك الخاصة تظهر هنا فقط ولا تظهر لمستأجرين آخرين.',
            uploadDocument: 'إضافة مستند',
            documentTitle: 'عنوان المستند',
            documentType: 'نوع المستند',
            documentUrl: 'رابط أو مسار الملف',
            expiryDate: 'تاريخ الانتهاء',
            notes: 'ملاحظات',
            openDocument: 'فتح المستند',
            noDocuments: 'لا توجد مستندات بعد.',
            phone: 'الهاتف',
            email: 'البريد الإلكتروني',
            emergencyName: 'اسم جهة الطوارئ',
            emergencyPhone: 'هاتف الطوارئ',
            emergencyEmail: 'بريد الطوارئ',
            saveProfile: 'حفظ البيانات',
            secured: 'هذه البوابة تعرض بياناتك فقط ولا تمنحك صلاحيات PMS للمديرين.'
          }
        : {
            title: 'Tenant portal',
            subtitle: 'A separate secure space for your lease, rent dues, and maintenance requests.',
            switchTenancy: 'Choose tenancy',
            overview: 'Overview',
            lease: 'Lease',
            rent: 'Rent',
            maintenance: 'Maintenance',
            documents: 'Documents',
            profile: 'Profile',
            activeLease: 'Current lease',
            noLease: 'No active lease is visible for this account yet.',
            rentDue: 'Rent dues',
            overdue: 'Overdue',
            dueSoon: 'Due soon',
            openMaintenance: 'Open maintenance',
            latestRent: 'Latest rent item',
            latestMaintenance: 'Latest maintenance request',
            amount: 'Amount',
            status: 'Status',
            dueDate: 'Due date',
            property: 'Property',
            unit: 'Unit',
            dates: 'Dates',
            paymentNote: 'Online rent payment is reserved for the next payment stage.',
            payRent: 'Pay rent',
            viewPayments: 'View payment history',
            syncPayment: 'Sync payment status',
            viewReceipt: 'View receipt',
            printableReceipt: 'Printable receipt',
            printReceipt: 'Print receipt',
            balance: 'Balance',
            paidAmount: 'Paid',
            paymentHistory: 'Payment history',
            receiptNumber: 'Receipt number',
            paymentMethod: 'Payment method',
            paymentReference: 'Reference number',
            paidAt: 'Paid date',
            noPayments: 'No payments are recorded for this rent item yet.',
            noRent: 'No rent dues or history are available yet.',
            noMaintenance: 'No maintenance requests yet.',
            newRequest: 'New maintenance request',
            titleLabel: 'Request title',
            description: 'Description',
            priority: 'Priority',
            submit: 'Submit request',
            saving: 'Saving...',
            saved: 'Saved successfully.',
            requestCreated: 'Maintenance request created.',
            confirmResolved: 'Confirm resolved',
            reopenRequest: 'Reopen request',
            tenantConfirmed: 'Confirmed by tenant',
            documentsText: 'Your private tenant documents appear here and are not shared with other tenants.',
            uploadDocument: 'Add document',
            documentTitle: 'Document title',
            documentType: 'Document type',
            documentUrl: 'File URL or uploaded path',
            expiryDate: 'Expiry date',
            notes: 'Notes',
            openDocument: 'Open document',
            noDocuments: 'No documents yet.',
            phone: 'Phone',
            email: 'Email',
            emergencyName: 'Emergency contact name',
            emergencyPhone: 'Emergency contact phone',
            emergencyEmail: 'Emergency contact email',
            saveProfile: 'Save profile',
            secured: 'This portal only shows your tenant records and does not grant PMS manager access.'
          },
    [language]
  );

  useEffect(() => {
    if (!selectedAccessId && accessOptions[0]?.accessId) {
      setSelectedAccessId(accessOptions[0].accessId);
    }
  }, [accessOptions, selectedAccessId]);

  useEffect(() => {
    let isMounted = true;

    async function loadTenantPortal() {
      if (!token || !activeAccessId) return;

      setLoading(true);
      setError('');
      setSuccess('');

      try {
        const [overviewResponse, leaseResponse, rentResponse, maintenanceResponse, profileResponse, documentsResponse] =
          await Promise.all([
            getTenantOverview(token, activeAccessId),
            getTenantLease(token, activeAccessId),
            listTenantRent(token, { accessId: activeAccessId, take: 50 }),
            listTenantMaintenance(token, { accessId: activeAccessId, take: 50 }),
            getTenantProfile(token, activeAccessId),
            getTenantDocuments(token, activeAccessId)
          ]);

        if (!isMounted) return;

        setOverview(overviewResponse);
        setLeaseData(leaseResponse);
        setRentData(rentResponse);
        setMaintenanceData(maintenanceResponse);
        setProfile({
          phone: profileResponse.profile.phone ?? '',
          email: profileResponse.profile.email ?? '',
          emergencyContactName: profileResponse.profile.emergencyContactName ?? '',
          emergencyContactPhone: profileResponse.profile.emergencyContactPhone ?? '',
          emergencyContactEmail: profileResponse.profile.emergencyContactEmail ?? ''
        });
        setDocuments(documentsResponse.documents);
        setDocumentsNote(documentsResponse.foundation.note || copy.documentsText);
        setRentPaymentsByItemId({});
        setRentReceipt(null);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadTenantPortal();

    return () => {
      isMounted = false;
    };
  }, [activeAccessId, copy.documentsText, token]);

  async function handleCreateMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeAccessId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await createTenantMaintenanceRequest(
        token,
        {
          title: maintenanceForm.title,
          description: maintenanceForm.description || null,
          priority: maintenanceForm.priority
        },
        activeAccessId
      );

      const [overviewResponse, maintenanceResponse] = await Promise.all([
        getTenantOverview(token, activeAccessId),
        listTenantMaintenance(token, { accessId: activeAccessId, take: 50 })
      ]);
      setOverview(overviewResponse);
      setMaintenanceData(maintenanceResponse);
      setMaintenanceForm({ title: '', description: '', priority: 'MEDIUM' });
      setSuccess(copy.requestCreated);
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmMaintenance(workOrderId: string) {
    if (!token || !activeAccessId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await confirmTenantMaintenanceResolved(token, workOrderId, {}, activeAccessId);
      const maintenanceResponse = await listTenantMaintenance(token, { accessId: activeAccessId, take: 50 });
      setMaintenanceData(maintenanceResponse);
      setSuccess(copy.saved);
    } catch (confirmError) {
      setError(getErrorMessage(confirmError));
    } finally {
      setSaving(false);
    }
  }

  async function handleReopenMaintenance(workOrderId: string) {
    if (!token || !activeAccessId) return;
    const notes = window.prompt(copy.description, '') || null;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await reopenTenantMaintenance(token, workOrderId, { notes }, activeAccessId);
      const maintenanceResponse = await listTenantMaintenance(token, { accessId: activeAccessId, take: 50 });
      setMaintenanceData(maintenanceResponse);
      setSuccess(copy.saved);
    } catch (reopenError) {
      setError(getErrorMessage(reopenError));
    } finally {
      setSaving(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeAccessId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await updateTenantProfile(
        token,
        {
          phone: normalizeProfileValue(profile.phone),
          email: normalizeProfileValue(profile.email),
          emergencyContactName: normalizeProfileValue(profile.emergencyContactName),
          emergencyContactPhone: normalizeProfileValue(profile.emergencyContactPhone),
          emergencyContactEmail: normalizeProfileValue(profile.emergencyContactEmail)
        },
        activeAccessId
      );
      setProfile({
        phone: response.profile.phone ?? '',
        email: response.profile.email ?? '',
        emergencyContactName: response.profile.emergencyContactName ?? '',
        emergencyContactPhone: response.profile.emergencyContactPhone ?? '',
        emergencyContactEmail: response.profile.emergencyContactEmail ?? ''
      });
      setSuccess(copy.saved);
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }


  async function handleCreateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeAccessId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await createTenantDocument(
        token,
        {
          ...documentForm,
          title: documentForm.title.trim(),
          fileUrl: documentForm.fileUrl.trim(),
          expiryDate: documentForm.expiryDate || null,
          notes: documentForm.notes || null
        },
        activeAccessId
      );
      setDocuments((current) => [response.document, ...current]);
      setDocumentForm(emptyTenantDocumentForm);
      setSuccess(copy.saved);
    } catch (documentError) {
      setError(getErrorMessage(documentError));
    } finally {
      setSaving(false);
    }
  }

  async function reloadRentWorkspace() {
    if (!token || !activeAccessId) return;

    const [overviewResponse, rentResponse] = await Promise.all([
      getTenantOverview(token, activeAccessId),
      listTenantRent(token, { accessId: activeAccessId, take: 50 })
    ]);
    setOverview(overviewResponse);
    setRentData(rentResponse);
  }

  async function handleLoadRentPayments(item: PmsRentDueItem) {
    if (!token || !activeAccessId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await listTenantRentPayments(token, item.id, activeAccessId);
      setRentPaymentsByItemId((current) => ({ ...current, [item.id]: response.payments }));
    } catch (paymentsError) {
      setError(getErrorMessage(paymentsError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRentCheckout(item: PmsRentDueItem) {
    if (!token || !activeAccessId) return;

    if (!rentData?.paymentFoundation.onlineRentPaymentEnabled) {
      setError(rentData?.paymentFoundation.note || copy.paymentNote);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const amount = Number(item.balanceAmount ?? item.amount);
      const response = await createTenantRentCheckoutSession(token, item.id, { amount }, activeAccessId);
      setRentPaymentsByItemId((current) => ({
        ...current,
        [item.id]: [response.payment, ...(current[item.id] ?? []).filter((payment) => payment.id !== response.payment.id)]
      }));
      window.location.assign(response.checkoutUrl);
    } catch (checkoutError) {
      setError(getErrorMessage(checkoutError));
      setSaving(false);
    }
  }

  async function handleSyncRentPayment(payment: PmsRentPayment) {
    if (!token || !activeAccessId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await syncTenantRentPayment(token, payment.id, activeAccessId);
      setRentReceipt(response.receipt);
      setRentPaymentsByItemId((current) => {
        const payments = current[response.rentDueItem.id] ?? [];
        const nextPayments = payments.some((item) => item.id === response.payment.id)
          ? payments.map((item) => (item.id === response.payment.id ? response.payment : item))
          : [response.payment, ...payments];

        return { ...current, [response.rentDueItem.id]: nextPayments };
      });
      await reloadRentWorkspace();
      setSuccess(copy.saved);
    } catch (syncError) {
      setError(getErrorMessage(syncError));
    } finally {
      setSaving(false);
    }
  }

  async function handleViewRentReceipt(payment: PmsRentPayment) {
    if (!token || !activeAccessId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await getTenantRentPaymentReceipt(token, payment.id, activeAccessId);
      setRentReceipt(response.receipt);
    } catch (receiptError) {
      setError(getErrorMessage(receiptError));
    } finally {
      setSaving(false);
    }
  }

  if (!activeAccessId) {
    return <Navigate to="/dashboard" replace />;
  }

  const workspace = overview?.workspace ?? leaseData?.workspace ?? rentData?.workspace ?? maintenanceData?.workspace;
  const activeLease = leaseData?.activeLease ?? overview?.activeLease ?? null;

  return (
    <section className="tenant-portal page-section" aria-labelledby="tenant-portal-title">
      <div className="tenant-portal__hero container">
        <div>
          <p className="eyebrow">lux PMS</p>
          <h1 id="tenant-portal-title">{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        {accessOptions.length > 1 ? (
          <label className="tenant-portal__switcher">
            <span>{copy.switchTenancy}</span>
            <select value={activeAccessId} onChange={(event) => setSelectedAccessId(event.target.value)}>
              {accessOptions.map((option) => (
                <option key={option.accessId} value={option.accessId}>
                  {option.tenant.fullName} · {option.company.nameEn}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="tenant-portal__layout container">
        <aside className="tenant-portal__nav" aria-label={copy.title}>
          {tenantTabs.map((tab) => {
            const Icon = tab.icon;
            const label = copy[tab.key];

            return (
              <NavLink
                key={tab.key}
                to={tab.path}
                className={({ isActive }) =>
                  `tenant-portal__nav-link ${isActive || activeTab === tab.key ? 'tenant-portal__nav-link--active' : ''}`
                }
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            );
          })}
        </aside>

        <div className="tenant-portal__content">
          {workspace ? (
            <div className="tenant-portal__notice tenant-portal__notice--secure">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                {workspace.tenant.fullName} · {workspace.company.nameEn}. {copy.secured}
              </span>
            </div>
          ) : null}

          {loading ? <TenantEmptyState title="Loading tenant portal..." /> : null}
          {error ? (
            <div className="tenant-portal__notice tenant-portal__notice--error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
          {success ? <div className="tenant-portal__notice tenant-portal__notice--success">{success}</div> : null}

          {!loading && activeTab === 'overview' ? (
            <div className="tenant-portal__stack">
              <div className="tenant-portal__metrics">
                <MetricCard label={copy.rentDue} value={overview?.metrics.unpaidRentCount ?? 0} />
                <MetricCard label={copy.overdue} value={overview?.metrics.overdueRentCount ?? 0} />
                <MetricCard label={copy.dueSoon} value={overview?.metrics.dueSoonRentCount ?? 0} />
                <MetricCard label={copy.openMaintenance} value={overview?.metrics.openMaintenanceCount ?? 0} />
              </div>
              <LeaseCard title={copy.activeLease} empty={copy.noLease} lease={activeLease} language={language} copy={copy} />
              <div className="tenant-portal__grid">
                <InfoCard title={copy.latestRent} empty={copy.noRent}>
                  {overview?.latest.rentDueItem ? (
                    <dl className="tenant-portal__details">
                      <div><dt>{copy.amount}</dt><dd>{formatMoney(overview.latest.rentDueItem.amount, overview.latest.rentDueItem.currency)}</dd></div>
                      <div><dt>{copy.status}</dt><dd>{overview.latest.rentDueItem.status}</dd></div>
                      <div><dt>{copy.dueDate}</dt><dd>{formatDate(overview.latest.rentDueItem.dueDate, language)}</dd></div>
                    </dl>
                  ) : null}
                </InfoCard>
                <InfoCard title={copy.latestMaintenance} empty={copy.noMaintenance}>
                  {overview?.latest.maintenanceRequest ? (
                    <dl className="tenant-portal__details">
                      <div><dt>{copy.titleLabel}</dt><dd>{overview.latest.maintenanceRequest.title}</dd></div>
                      <div><dt>{copy.status}</dt><dd>{overview.latest.maintenanceRequest.status}</dd></div>
                      <div><dt>{copy.priority}</dt><dd>{overview.latest.maintenanceRequest.priority}</dd></div>
                    </dl>
                  ) : null}
                </InfoCard>
              </div>
            </div>
          ) : null}

          {!loading && activeTab === 'lease' ? (
            <div className="tenant-portal__stack">
              <LeaseCard title={copy.activeLease} empty={copy.noLease} lease={activeLease} language={language} copy={copy} />
              {(leaseData?.leases ?? []).map((lease) => (
                <LeaseCard key={lease.id} title={lease.title || lease.status} empty={copy.noLease} lease={lease} language={language} copy={copy} />
              ))}
            </div>
          ) : null}

          {!loading && activeTab === 'rent' ? (
            <div className="tenant-portal__stack">
              <div className="tenant-portal__notice">{rentData?.paymentFoundation.note || copy.paymentNote}</div>
              <TenantRentReceiptPanel copy={copy} receipt={rentReceipt} language={language} />
              {(rentData?.rentDueItems.length ?? 0) === 0 ? <TenantEmptyState title={copy.noRent} /> : null}
              {rentData?.rentDueItems.map((item) => {
                const payments = rentPaymentsByItemId[item.id] ?? [];
                const canPay = rentData?.paymentFoundation.onlineRentPaymentEnabled && !['PAID', 'CANCELLED'].includes(item.status);

                return (
                  <InfoCard key={item.id} title={`${copy.dueDate}: ${formatDate(item.dueDate, language)}`}>
                    <dl className="tenant-portal__details">
                      <div><dt>{copy.amount}</dt><dd>{formatMoney(item.amount, item.currency)}</dd></div>
                      <div><dt>{copy.paidAmount}</dt><dd>{formatMoney(item.paidAmount, item.currency)}</dd></div>
                      <div><dt>{copy.balance}</dt><dd>{formatMoney(item.balanceAmount, item.currency)}</dd></div>
                      <div><dt>{copy.status}</dt><dd><span className="tenant-portal__badge">{item.status}</span></dd></div>
                      <div><dt>{copy.property}</dt><dd>{item.property.name}</dd></div>
                      <div><dt>{copy.unit}</dt><dd>{item.unit.unitNumber}</dd></div>
                    </dl>

                    <div className="tenant-portal__actions">
                      {canPay ? (
                        <button
                          className="button-link button-link--primary"
                          type="button"
                          disabled={saving}
                          onClick={() => void handleCreateRentCheckout(item)}
                        >
                          <ExternalLink size={16} aria-hidden="true" />
                          {copy.payRent}
                        </button>
                      ) : null}
                      <button
                        className="button-link"
                        type="button"
                        disabled={saving}
                        onClick={() => void handleLoadRentPayments(item)}
                      >
                        {copy.viewPayments}
                      </button>
                    </div>

                    {payments.length > 0 ? (
                      <div className="tenant-portal__payment-history">
                        <h3>{copy.paymentHistory}</h3>
                        {payments.map((payment) => (
                          <article className="tenant-portal__payment-row" key={payment.id}>
                            <dl className="tenant-portal__details">
                              <div><dt>{copy.amount}</dt><dd>{formatMoney(payment.amount, payment.currency)}</dd></div>
                              <div><dt>{copy.status}</dt><dd><span className="tenant-portal__badge">{payment.status}</span></dd></div>
                              <div><dt>{copy.paymentMethod}</dt><dd>{payment.method}</dd></div>
                              <div><dt>{copy.paidAt}</dt><dd>{formatDate(payment.paidAt ?? payment.confirmedAt ?? payment.createdAt, language)}</dd></div>
                            </dl>
                            <div className="tenant-portal__actions">
                              {payment.status === 'PENDING' ? (
                                <button className="button-link" type="button" disabled={saving} onClick={() => void handleSyncRentPayment(payment)}>
                                  {copy.syncPayment}
                                </button>
                              ) : null}
                              {payment.status === 'CONFIRMED' ? (
                                <button className="button-link" type="button" disabled={saving} onClick={() => void handleViewRentReceipt(payment)}>
                                  {copy.viewReceipt}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </InfoCard>
                );
              })}
            </div>
          ) : null}

          {!loading && activeTab === 'maintenance' ? (
            <div className="tenant-portal__stack">
              <form className="tenant-portal__form" onSubmit={handleCreateMaintenance}>
                <h2>{copy.newRequest}</h2>
                <label>
                  <span>{copy.titleLabel}</span>
                  <input
                    required
                    minLength={2}
                    value={maintenanceForm.title}
                    onChange={(event) => setMaintenanceForm((form) => ({ ...form, title: event.target.value }))}
                  />
                </label>
                <label>
                  <span>{copy.description}</span>
                  <textarea
                    rows={4}
                    value={maintenanceForm.description}
                    onChange={(event) => setMaintenanceForm((form) => ({ ...form, description: event.target.value }))}
                  />
                </label>
                <label>
                  <span>{copy.priority}</span>
                  <select
                    value={maintenanceForm.priority}
                    onChange={(event) =>
                      setMaintenanceForm((form) => ({ ...form, priority: event.target.value as PmsMaintenancePriority }))
                    }
                  >
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </label>
                <button className="button-link button-link--primary" type="submit" disabled={saving}>
                  {saving ? copy.saving : copy.submit}
                </button>
              </form>

              {(maintenanceData?.workOrders.length ?? 0) === 0 ? <TenantEmptyState title={copy.noMaintenance} /> : null}
              {maintenanceData?.workOrders.map((request) => (
                <InfoCard key={request.id} title={request.title}>
                  <dl className="tenant-portal__details">
                    <div><dt>{copy.status}</dt><dd><span className="tenant-portal__badge">{request.status}</span></dd></div>
                    <div><dt>{copy.priority}</dt><dd>{request.priority}</dd></div>
                    <div><dt>{copy.property}</dt><dd>{request.property.name}</dd></div>
                    <div><dt>{copy.unit}</dt><dd>{request.unit?.unitNumber ?? '—'}</dd></div>
                    <div><dt>{copy.dates}</dt><dd>{formatDate(request.createdAt, language)}</dd></div>
                  </dl>
                  {request.description ? <p>{request.description}</p> : null}
                  {request.tenantConfirmedAt ? <p className="tenant-portal__notice">{copy.tenantConfirmed}</p> : null}
                  {request.status === 'RESOLVED' ? (
                    <div className="tenant-portal__actions">
                      <button className="button-link button-link--primary" type="button" disabled={saving || Boolean(request.tenantConfirmedAt)} onClick={() => void handleConfirmMaintenance(request.id)}>
                        {copy.confirmResolved}
                      </button>
                      <button className="button-link button-link--secondary" type="button" disabled={saving} onClick={() => void handleReopenMaintenance(request.id)}>
                        {copy.reopenRequest}
                      </button>
                    </div>
                  ) : null}
                </InfoCard>
              ))}
            </div>
          ) : null}

          {!loading && activeTab === 'documents' ? (
            <div className="tenant-portal__stack">
              <div className="tenant-portal__notice">{documentsNote || copy.documentsText}</div>
              <form className="tenant-portal__form" onSubmit={handleCreateDocument}>
                <h2>{copy.uploadDocument}</h2>
                <label>
                  <span>{copy.documentTitle}</span>
                  <input
                    required
                    minLength={2}
                    value={documentForm.title}
                    onChange={(event) => setDocumentForm((form) => ({ ...form, title: event.target.value }))}
                  />
                </label>
                <label>
                  <span>{copy.documentType}</span>
                  <select
                    value={documentForm.type}
                    onChange={(event) => setDocumentForm((form) => ({ ...form, type: event.target.value as TenantDocumentPayload['type'] }))}
                  >
                    <option value="OTHER">OTHER</option>
                    <option value="TENANT_ID">TENANT_ID</option>
                    <option value="PASSPORT_RESIDENCY">PASSPORT_RESIDENCY</option>
                  </select>
                </label>
                <label>
                  <span>{copy.documentUrl}</span>
                  <input
                    required
                    value={documentForm.fileUrl}
                    placeholder="/uploads/file.pdf or https://..."
                    onChange={(event) => setDocumentForm((form) => ({ ...form, fileUrl: event.target.value }))}
                  />
                </label>
                <label>
                  <span>{copy.expiryDate}</span>
                  <input
                    type="date"
                    value={documentForm.expiryDate ?? ''}
                    onChange={(event) => setDocumentForm((form) => ({ ...form, expiryDate: event.target.value }))}
                  />
                </label>
                <label>
                  <span>{copy.notes}</span>
                  <textarea
                    rows={3}
                    value={documentForm.notes ?? ''}
                    onChange={(event) => setDocumentForm((form) => ({ ...form, notes: event.target.value }))}
                  />
                </label>
                <button className="button-link button-link--primary" type="submit" disabled={saving}>
                  {saving ? copy.saving : copy.uploadDocument}
                </button>
              </form>

              {documents.length === 0 ? <TenantEmptyState title={copy.noDocuments} /> : null}
              {documents.map((document) => (
                <InfoCard key={document.id} title={document.title}>
                  <dl className="tenant-portal__details">
                    <div><dt>{copy.documentType}</dt><dd>{document.type}</dd></div>
                    <div><dt>{copy.status}</dt><dd><span className="tenant-portal__badge">{document.status}</span></dd></div>
                    <div><dt>{copy.expiryDate}</dt><dd>{formatDate(document.expiryDate, language)}</dd></div>
                  </dl>
                  {document.notes ? <p>{document.notes}</p> : null}
                  <a className="button-link" href={document.fileUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} aria-hidden="true" />
                    {copy.openDocument}
                  </a>
                </InfoCard>
              ))}
            </div>
          ) : null}

          {!loading && activeTab === 'profile' ? (
            <form className="tenant-portal__form" onSubmit={handleProfileSubmit}>
              <h2>{copy.profile}</h2>
              <ProfileInput label={copy.phone} value={profile.phone} onChange={(value) => setProfile((data) => ({ ...data, phone: value }))} />
              <ProfileInput label={copy.email} type="email" value={profile.email} onChange={(value) => setProfile((data) => ({ ...data, email: value }))} />
              <ProfileInput label={copy.emergencyName} value={profile.emergencyContactName} onChange={(value) => setProfile((data) => ({ ...data, emergencyContactName: value }))} />
              <ProfileInput label={copy.emergencyPhone} value={profile.emergencyContactPhone} onChange={(value) => setProfile((data) => ({ ...data, emergencyContactPhone: value }))} />
              <ProfileInput label={copy.emergencyEmail} type="email" value={profile.emergencyContactEmail} onChange={(value) => setProfile((data) => ({ ...data, emergencyContactEmail: value }))} />
              <button className="button-link button-link--primary" type="submit" disabled={saving}>
                {saving ? copy.saving : copy.saveProfile}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="tenant-portal__metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function InfoCard({ children, empty, title }: { children?: ReactNode; empty?: string; title: string }) {
  return (
    <article className="tenant-portal__card">
      <h2>{title}</h2>
      {children ?? (empty ? <p className="tenant-portal__empty">{empty}</p> : null)}
    </article>
  );
}


function TenantRentReceiptPanel({
  copy,
  language,
  receipt
}: {
  copy: {
    amount: string;
    paidAt: string;
    paymentMethod: string;
    paymentReference: string;
    printableReceipt: string;
    printReceipt: string;
    property: string;
    receiptNumber: string;
    status: string;
    unit: string;
  };
  language: 'en' | 'ar';
  receipt: PmsRentReceipt | null;
}) {
  if (!receipt) return null;

  return (
    <article className="tenant-portal__card tenant-portal__receipt-panel">
      <div>
        <p className="eyebrow">lux PMS</p>
        <h2>{copy.printableReceipt}</h2>
      </div>
      <dl className="tenant-portal__details">
        <div><dt>{copy.receiptNumber}</dt><dd>{receipt.receiptNumber ?? receipt.paymentId}</dd></div>
        <div><dt>{copy.amount}</dt><dd>{formatMoney(receipt.amount, receipt.currency)}</dd></div>
        <div><dt>{copy.status}</dt><dd><span className="tenant-portal__badge">{receipt.status}</span></dd></div>
        <div><dt>{copy.paymentMethod}</dt><dd>{receipt.method}</dd></div>
        <div><dt>{copy.paymentReference}</dt><dd>{receipt.referenceNumber ?? receipt.providerReference ?? '—'}</dd></div>
        <div><dt>{copy.paidAt}</dt><dd>{formatDate(receipt.paidAt ?? receipt.confirmedAt ?? receipt.issuedAt, language)}</dd></div>
        <div><dt>{copy.property}</dt><dd>{receipt.property.name}</dd></div>
        <div><dt>{copy.unit}</dt><dd>{receipt.unit.unitNumber}</dd></div>
      </dl>
      <button className="button-link" type="button" onClick={() => window.print()}>{copy.printReceipt}</button>
    </article>
  );
}

function LeaseCard({
  copy,
  empty,
  language,
  lease,
  title
}: {
  copy: { amount: string; dates: string; property: string; status: string; unit: string };
  empty: string;
  language: 'en' | 'ar';
  lease: TenantLeaseResponse['activeLease'];
  title: string;
}) {
  return (
    <InfoCard title={title} empty={!lease ? empty : undefined}>
      {lease ? (
        <dl className="tenant-portal__details">
          <div><dt>{copy.status}</dt><dd><span className="tenant-portal__badge">{lease.status}</span></dd></div>
          <div><dt>{copy.property}</dt><dd>{lease.property.name}</dd></div>
          <div><dt>{copy.unit}</dt><dd>{lease.unit.unitNumber}</dd></div>
          <div><dt>{copy.amount}</dt><dd>{formatMoney(lease.rentAmount, lease.currency)}</dd></div>
          <div><dt>{copy.dates}</dt><dd>{formatDate(lease.startDate, language)} → {formatDate(lease.endDate, language)}</dd></div>
        </dl>
      ) : null}
    </InfoCard>
  );
}

function ProfileInput({
  label,
  onChange,
  type = 'text',
  value
}: {
  label: string;
  onChange: (value: string) => void;
  type?: 'email' | 'text';
  value?: string | null;
}) {
  return (
    <label>
      <span>{label}</span>
      <input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TenantEmptyState({ title }: { title: string }) {
  return (
    <div className="tenant-portal__empty-state">
      <CalendarDays size={24} aria-hidden="true" />
      <p>{title}</p>
    </div>
  );
}

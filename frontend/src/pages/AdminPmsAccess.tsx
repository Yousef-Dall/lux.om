import {
  Building2,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import {
  listAdminPmsCompanies,
  updateAdminPmsEntitlement,
  upsertAdminPmsMember,
  type AdminPmsCompany,
  type PmsEntitlementStatus,
  type PmsMemberRole
} from '../api/pms';
import { useAuth } from '../auth/AuthContext';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

const entitlementStatuses: PmsEntitlementStatus[] = ['ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED'];
const memberRoles: PmsMemberRole[] = [
  'PMS_OWNER',
  'PMS_MANAGER',
  'PMS_ACCOUNTANT',
  'PMS_MAINTENANCE',
  'PMS_AGENT',
  'PMS_VIEWER'
];

function getCompanyName(company: AdminPmsCompany, language: 'en' | 'ar') {
  return language === 'ar' ? company.nameAr || company.nameEn : company.nameEn || company.nameAr || '';
}

function getStatusLabel(status: PmsEntitlementStatus | 'NONE' | 'ALL', language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    ALL: { en: 'All statuses', ar: 'كل الحالات' },
    NONE: { en: 'Not enabled', ar: 'غير مفعّل' },
    ACTIVE: { en: 'Active', ar: 'مفعّل' },
    TRIAL: { en: 'Trial', ar: 'تجريبي' },
    SUSPENDED: { en: 'Suspended', ar: 'معلق' },
    EXPIRED: { en: 'Expired', ar: 'منتهي' }
  };

  return labels[status]?.[language] ?? status;
}

function getRoleLabel(role: PmsMemberRole, language: 'en' | 'ar') {
  const labels: Record<PmsMemberRole, { en: string; ar: string }> = {
    PMS_OWNER: { en: 'Owner', ar: 'مالك المساحة' },
    PMS_MANAGER: { en: 'Manager', ar: 'مدير' },
    PMS_ACCOUNTANT: { en: 'Accountant', ar: 'محاسب' },
    PMS_MAINTENANCE: { en: 'Maintenance', ar: 'صيانة' },
    PMS_AGENT: { en: 'Agent', ar: 'وسيط' },
    PMS_VIEWER: { en: 'Viewer', ar: 'مشاهد' }
  };

  return labels[role][language];
}

export default function AdminPmsAccess() {
  const { language } = useLanguage();
  const { token } = useAuth();
  const [companies, setCompanies] = useState<AdminPmsCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<AdminPmsCompany | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PmsEntitlementStatus>('ALL');
  const [entitlementStatus, setEntitlementStatus] = useState<PmsEntitlementStatus>('TRIAL');
  const [entitlementNotes, setEntitlementNotes] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<PmsMemberRole>('PMS_MANAGER');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useDocumentTitle('Admin PMS access');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'إدارة PMS',
          title: 'صلاحيات بوابة إدارة العقارات',
          text:
            'فعّل أو أوقف وصول PMS على مستوى الشركة، ثم أضف أعضاء بصلاحيات محددة داخل مساحة الشركة فقط.',
          searchPlaceholder: 'ابحث باسم الشركة أو البريد أو المقر',
          searchAction: 'بحث',
          refresh: 'تحديث',
          status: 'حالة PMS',
          company: 'الشركة',
          portfolio: 'المحفظة',
          members: 'الأعضاء',
          select: 'إدارة',
          noCompanies: 'لا توجد شركات مطابقة.',
          loading: 'جاري تحميل الشركات...',
          selectedTitle: 'إدارة صلاحية الشركة',
          selectCompany: 'اختاري شركة لإدارة PMS.',
          notes: 'ملاحظات داخلية',
          trialEndsAt: 'تاريخ انتهاء التجربة',
          saveEntitlement: 'حفظ صلاحية PMS',
          memberEmail: 'بريد عضو الفريق',
          memberRole: 'صلاحية العضو',
          addMember: 'إضافة / تحديث عضو',
          active: 'نشط',
          inactive: 'غير نشط',
          actionSuccess: 'تم حفظ التغييرات.',
          actionError: 'تعذر حفظ التغييرات.',
          enableFirst: 'فعّل PMS للشركة قبل إضافة أعضاء.',
          listings: 'عقارات',
          projects: 'مشاريع'
        }
      : {
          eyebrow: 'PMS administration',
          title: 'Property Management System access',
          text:
            'Enable or suspend PMS at company level, then assign staff roles scoped only to that company workspace.',
          searchPlaceholder: 'Search by company, email, or headquarters',
          searchAction: 'Search',
          refresh: 'Refresh',
          status: 'PMS status',
          company: 'Company',
          portfolio: 'Portfolio',
          members: 'Members',
          select: 'Manage',
          noCompanies: 'No matching companies found.',
          loading: 'Loading companies...',
          selectedTitle: 'Manage company PMS access',
          selectCompany: 'Select a company to manage PMS access.',
          notes: 'Internal notes',
          trialEndsAt: 'Trial end date',
          saveEntitlement: 'Save PMS entitlement',
          memberEmail: 'Staff email',
          memberRole: 'Staff role',
          addMember: 'Add / update member',
          active: 'Active',
          inactive: 'Inactive',
          actionSuccess: 'Changes saved.',
          actionError: 'Could not save changes.',
          enableFirst: 'Enable PMS for the company before adding members.',
          listings: 'Listings',
          projects: 'Projects'
        };

  const syncEntitlementForm = useCallback((company: AdminPmsCompany) => {
    setEntitlementStatus(company.pmsEntitlement?.status ?? 'TRIAL');
    setEntitlementNotes(company.pmsEntitlement?.notes ?? '');
    setTrialEndsAt(company.pmsEntitlement?.trialEndsAt?.slice(0, 10) ?? '');
  }, []);

  const fetchCompanies = useCallback(async (companyIdToRefresh?: string) => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      const response = await listAdminPmsCompanies(
        {
          search: search.trim() || undefined,
          status: statusFilter,
          take: 50,
          skip: 0
        },
        token
      );

      setCompanies(response.companies);

      if (companyIdToRefresh) {
        const refreshed = response.companies.find((company) => company.id === companyIdToRefresh);
        setSelectedCompany(refreshed ?? null);

        if (refreshed) {
          syncEntitlementForm(refreshed);
        }
      }
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof ApiError ? loadError.message : copy.actionError);
    } finally {
      setLoading(false);
    }
  }, [copy.actionError, search, statusFilter, syncEntitlementForm, token]);

  useEffect(() => {
    void fetchCompanies();
  }, [fetchCompanies]);

  function handleSelectCompany(company: AdminPmsCompany) {
    setSelectedCompany(company);
    syncEntitlementForm(company);
    setMemberEmail('');
    setMemberRole('PMS_MANAGER');
    setMessage('');
    setError('');
  }

  async function handleSaveEntitlement() {
    if (!selectedCompany || !token) return;

    try {
      setSaving(true);
      setMessage('');
      setError('');
      const response = await updateAdminPmsEntitlement(
        selectedCompany.id,
        {
          status: entitlementStatus,
          notes: entitlementNotes.trim() || undefined,
          trialEndsAt: trialEndsAt || null
        },
        token
      );

      setSelectedCompany(response.company);
      setMessage(copy.actionSuccess);
      await fetchCompanies(selectedCompany.id);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.actionError);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember() {
    if (!selectedCompany || !token) return;

    if (!selectedCompany.pmsEntitlement) {
      setError(copy.enableFirst);
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      setError('');
      await upsertAdminPmsMember(
        selectedCompany.id,
        {
          email: memberEmail.trim(),
          role: memberRole,
          active: true
        },
        token
      );

      setMemberEmail('');
      setMessage(copy.actionSuccess);
      await fetchCompanies(selectedCompany.id);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof ApiError ? saveError.message : copy.actionError);
    } finally {
      setSaving(false);
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void fetchCompanies();
  }

  return (
    <section className="page-section container admin-pms-page" aria-labelledby="admin-pms-title">
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} />
      <p className="admin-users-intro">{copy.text}</p>

      <form className="admin-users-toolbar" onSubmit={handleSearchSubmit}>
        <label className="admin-users-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </label>

        <label>
          <span className="sr-only">{copy.status}</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | PmsEntitlementStatus)}
          >
            <option value="ALL">{getStatusLabel('ALL', language)}</option>
            {entitlementStatuses.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status, language)}
              </option>
            ))}
          </select>
        </label>

        <button className="button-link button-link--primary" type="submit">
          {copy.searchAction}
        </button>

        <button className="button-link button-link--secondary" type="button" onClick={() => void fetchCompanies()}>
          <RefreshCw size={16} aria-hidden="true" />
          {copy.refresh}
        </button>
      </form>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}

      <div className="admin-users-layout admin-pms-layout">
        <section className="admin-users-panel" aria-label={copy.company}>
          <div className="admin-users-panel__header">
            <div>
              <p className="eyebrow">{copy.company}</p>
              <h2>{companies.length.toLocaleString()} {copy.company}</h2>
            </div>
          </div>

          {loading ? (
            <p className="trust-note">{copy.loading}</p>
          ) : companies.length === 0 ? (
            <p className="trust-note">{copy.noCompanies}</p>
          ) : (
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>{copy.company}</th>
                    <th>{copy.status}</th>
                    <th>{copy.portfolio}</th>
                    <th>{copy.members}</th>
                    <th>{copy.select}</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const status = company.pmsEntitlement?.status ?? 'NONE';

                    return (
                      <tr key={company.id}>
                        <td>
                          <strong>{getCompanyName(company, language)}</strong>
                          <span>{company.headquartersEn ?? company.email ?? company.slug}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${status === 'ACTIVE' || status === 'TRIAL' ? 'approved' : status === 'NONE' ? 'pending' : 'rejected'}`}>
                            {status === 'ACTIVE' || status === 'TRIAL' ? <CheckCircle2 size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}
                            {getStatusLabel(status, language)}
                          </span>
                        </td>
                        <td>
                          <small>{copy.listings}: {company.counts.listings}</small>
                          <small>{copy.projects}: {company.counts.projects}</small>
                        </td>
                        <td>{company.counts.pmsMembers}</td>
                        <td>
                          <button className="button-link button-link--ghost" type="button" onClick={() => handleSelectCompany(company)}>
                            <ShieldCheck size={15} aria-hidden="true" />
                            {copy.select}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="admin-users-detail admin-pms-detail" aria-label={copy.selectedTitle}>
          {!selectedCompany ? (
            <div className="admin-users-empty">
              <Building2 size={30} aria-hidden="true" />
              <p>{copy.selectCompany}</p>
            </div>
          ) : (
            <>
              <div className="admin-users-detail__header">
                <div>
                  <p className="eyebrow">{copy.selectedTitle}</p>
                  <h2>{getCompanyName(selectedCompany, language)}</h2>
                  <p>{selectedCompany.email ?? selectedCompany.slug}</p>
                </div>
              </div>

              <div className="admin-users-actions">
                <label>
                  {copy.status}
                  <select value={entitlementStatus} onChange={(event) => setEntitlementStatus(event.target.value as PmsEntitlementStatus)}>
                    {entitlementStatuses.map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(status, language)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  {copy.trialEndsAt}
                  <input type="date" value={trialEndsAt} onChange={(event) => setTrialEndsAt(event.target.value)} />
                </label>

                <label>
                  {copy.notes}
                  <textarea rows={3} value={entitlementNotes} onChange={(event) => setEntitlementNotes(event.target.value)} />
                </label>

                <button className="button-link button-link--primary" type="button" disabled={saving} onClick={() => void handleSaveEntitlement()}>
                  <ShieldCheck size={16} aria-hidden="true" />
                  {copy.saveEntitlement}
                </button>

                <label>
                  {copy.memberEmail}
                  <input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} />
                </label>

                <label>
                  {copy.memberRole}
                  <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as PmsMemberRole)}>
                    {memberRoles.map((role) => (
                      <option key={role} value={role}>
                        {getRoleLabel(role, language)}
                      </option>
                    ))}
                  </select>
                </label>

                <button className="button-link button-link--secondary" type="button" disabled={saving || !memberEmail.trim()} onClick={() => void handleAddMember()}>
                  <UserPlus size={16} aria-hidden="true" />
                  {copy.addMember}
                </button>
              </div>

              <div className="admin-users-events admin-pms-members">
                <h3>
                  <Users size={17} aria-hidden="true" />
                  {copy.members}
                </h3>
                {selectedCompany.pmsMembers.length === 0 ? (
                  <p className="trust-note">{copy.enableFirst}</p>
                ) : (
                  <ol>
                    {selectedCompany.pmsMembers.map((member) => (
                      <li key={member.id}>
                        <span className="admin-users-event-icon">
                          <Users size={15} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>{member.user.name}</strong>
                          <p>{member.user.email} · {getRoleLabel(member.role, language)}</p>
                          <small>{member.active ? copy.active : copy.inactive}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

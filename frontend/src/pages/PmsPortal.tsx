import {
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  Loader2,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  Wrench
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getPmsOverview, type PmsWorkspaceOverview } from '../api/pms';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { cn } from '../utils/format';

const pmsNavigation = [
  { to: '/pms/overview', key: 'overview', icon: Home, available: true },
  { to: '/pms/properties', key: 'properties', icon: Building2, available: false },
  { to: '/pms/units', key: 'units', icon: KeyRound, available: false },
  { to: '/pms/tenants', key: 'tenants', icon: UserRoundCheck, available: false },
  { to: '/pms/rentals', key: 'rentals', icon: ClipboardList, available: false },
  { to: '/pms/maintenance', key: 'maintenance', icon: Wrench, available: false },
  { to: '/pms/accounting', key: 'accounting', icon: CreditCard, available: false },
  { to: '/pms/reports', key: 'reports', icon: BarChart3, available: false },
  { to: '/pms/settings', key: 'settings', icon: Settings, available: false }
] as const;

function formatNumber(value: number, language: 'en' | 'ar') {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-OM' : 'en-GB').format(value);
}

function getRoleLabel(role: string, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    PMS_OWNER: { en: 'Owner', ar: 'مالك المساحة' },
    PMS_MANAGER: { en: 'Manager', ar: 'مدير' },
    PMS_ACCOUNTANT: { en: 'Accountant', ar: 'محاسب' },
    PMS_MAINTENANCE: { en: 'Maintenance', ar: 'صيانة' },
    PMS_AGENT: { en: 'Agent', ar: 'وسيط' },
    PMS_VIEWER: { en: 'Viewer', ar: 'مشاهد' }
  };

  return labels[role]?.[language] ?? role;
}

function getCompanyName(company: { nameEn: string; nameAr?: string | null }, language: 'en' | 'ar') {
  return language === 'ar' ? company.nameAr || company.nameEn : company.nameEn || company.nameAr || '';
}

export default function PmsPortal() {
  const { language } = useLanguage();
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCompanyId = searchParams.get('companyId') ?? undefined;

  const [overview, setOverview] = useState<PmsWorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentTitle('lux PMS');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'lux PMS',
          portal: 'بوابة إدارة العقارات',
          portalText: 'مساحة B2B منفصلة لإدارة المحافظ والوحدات والإيجارات والعمليات المالية تدريجياً.',
          active: 'مفعّل',
          trial: 'تجريبي',
          suspended: 'معلق',
          expired: 'منتهي',
          company: 'الشركة',
          role: 'صلاحيتك',
          loading: 'جاري تحميل بوابة PMS...',
          unavailable: 'تعذر تحميل بيانات PMS.',
          overview: 'نظرة عامة',
          properties: 'العقارات',
          units: 'الوحدات',
          tenants: 'المستأجرون',
          rentals: 'الإيجارات',
          maintenance: 'الصيانة',
          accounting: 'المحاسبة',
          reports: 'التقارير',
          settings: 'الإعدادات',
          soon: 'قريباً',
          headline: 'مركز إدارة محفظة العقارات',
          headlineText:
            'هذه هي طبقة الوصول والبنية الأساسية للـ PMS. تعرض الآن مؤشرات آمنة من بيانات lux.om الحالية، وتترك الوحدات المتقدمة كمراحل تالية.',
          totalListings: 'إجمالي العقارات',
          approvedListings: 'عقارات منشورة',
          totalProjects: 'مشاريع مرتبطة',
          approvedProjects: 'مشاريع منشورة',
          activeRentSchedules: 'جداول إيجار نشطة',
          openContracts: 'عقود مفتوحة',
          pendingRentDueItems: 'دفعات مستحقة',
          overdueRentDueItems: 'دفعات متأخرة',
          activeTransactions: 'معاملات نشطة',
          readiness: 'جاهزية المساحة',
          entitlementReady: 'تم تفعيل صلاحية PMS للشركة.',
          accessScoped: 'صلاحيتك مرتبطة بهذه الشركة فقط وليست صلاحية عامة على المنصة.',
          emptyProperties: 'لا توجد عقارات مرتبطة بهذه الشركة بعد.',
          emptyRentals: 'لا توجد جداول إيجار نشطة بعد.',
          emptyAccounting: 'لا توجد دفعات مستحقة أو متأخرة حالياً.',
          switchCompany: 'تبديل الشركة'
        }
      : {
          eyebrow: 'lux PMS',
          portal: 'Property Management System portal',
          portalText:
            'A separate private B2B workspace for portfolio, unit, rental, maintenance, and accounting operations.',
          active: 'Active',
          trial: 'Trial',
          suspended: 'Suspended',
          expired: 'Expired',
          company: 'Company',
          role: 'Your role',
          loading: 'Loading PMS portal...',
          unavailable: 'Could not load PMS data.',
          overview: 'Overview',
          properties: 'Properties',
          units: 'Units',
          tenants: 'Tenants',
          rentals: 'Rentals',
          maintenance: 'Maintenance',
          accounting: 'Accounting',
          reports: 'Reports',
          settings: 'Settings',
          soon: 'Soon',
          headline: 'Property portfolio command center',
          headlineText:
            'This is the PMS access and shell foundation. It uses safe metrics from current lux.om data while deeper modules remain future stages.',
          totalListings: 'Total properties',
          approvedListings: 'Published properties',
          totalProjects: 'Linked projects',
          approvedProjects: 'Published projects',
          activeRentSchedules: 'Active rent schedules',
          openContracts: 'Open contracts',
          pendingRentDueItems: 'Payments due',
          overdueRentDueItems: 'Overdue payments',
          activeTransactions: 'Active transactions',
          readiness: 'Workspace readiness',
          entitlementReady: 'PMS entitlement is enabled for this company.',
          accessScoped: 'Your PMS access is scoped to this company, not global marketplace power.',
          emptyProperties: 'No properties are linked to this company yet.',
          emptyRentals: 'No active rent schedules yet.',
          emptyAccounting: 'No due or overdue rent payments right now.',
          switchCompany: 'Switch company'
        };

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      if (!token) return;

      try {
        setLoading(true);
        setError('');
        const response = await getPmsOverview(token, selectedCompanyId);

        if (!isMounted) return;
        setOverview(response);
      } catch (loadError) {
        console.error(loadError);

        if (!isMounted) return;
        setError(loadError instanceof ApiError ? loadError.message : copy.unavailable);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, [copy.unavailable, selectedCompanyId, token]);

  const metrics = useMemo(() => {
    if (!overview) return [];

    return [
      { key: 'totalListings', label: copy.totalListings, value: overview.metrics.totalListings },
      { key: 'approvedListings', label: copy.approvedListings, value: overview.metrics.approvedListings },
      { key: 'totalProjects', label: copy.totalProjects, value: overview.metrics.totalProjects },
      { key: 'approvedProjects', label: copy.approvedProjects, value: overview.metrics.approvedProjects },
      { key: 'activeRentSchedules', label: copy.activeRentSchedules, value: overview.metrics.activeRentSchedules },
      { key: 'openContracts', label: copy.openContracts, value: overview.metrics.openContracts },
      { key: 'pendingRentDueItems', label: copy.pendingRentDueItems, value: overview.metrics.pendingRentDueItems },
      { key: 'overdueRentDueItems', label: copy.overdueRentDueItems, value: overview.metrics.overdueRentDueItems },
      { key: 'activeTransactions', label: copy.activeTransactions, value: overview.metrics.activeTransactions }
    ];
  }, [copy, overview]);

  const statusLabel = overview?.workspace.entitlement.status === 'ACTIVE'
    ? copy.active
    : overview?.workspace.entitlement.status === 'TRIAL'
      ? copy.trial
      : overview?.workspace.entitlement.status === 'SUSPENDED'
        ? copy.suspended
        : copy.expired;

  return (
    <section className="pms-portal" aria-labelledby="pms-title">
      <aside className="pms-sidebar" aria-label={copy.portal}>
        <NavLink className="pms-sidebar__brand" to="/pms/overview">
          <span>lux</span>
          <strong>PMS</strong>
        </NavLink>

        <nav className="pms-sidebar__nav">
          {pmsNavigation.map((item) => {
            const Icon = item.icon;
            const label = copy[item.key];

            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  cn('pms-sidebar__link', isActive && item.available && 'pms-sidebar__link--active', !item.available && 'pms-sidebar__link--disabled')
                }
                onClick={(event) => {
                  if (!item.available) {
                    event.preventDefault();
                  }
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {!item.available ? <small>{copy.soon}</small> : null}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="pms-main">
        <header className="pms-header">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 id="pms-title">{copy.portal}</h1>
            <p>{copy.portalText}</p>
          </div>

          {overview ? (
            <div className="pms-company-card">
              <span>{copy.company}</span>
              <strong>{getCompanyName(overview.workspace.company, language)}</strong>
              <small>
                {copy.role}: {getRoleLabel(overview.workspace.member.role, language)}
              </small>
              <em>{statusLabel}</em>
            </div>
          ) : null}
        </header>

        {overview && overview.companies.length > 1 ? (
          <label className="pms-company-switcher">
            {copy.switchCompany}
            <select
              value={overview.workspace.company.id}
              onChange={(event) => {
                setSearchParams({ companyId: event.target.value });
              }}
            >
              {overview.companies.map((workspace) => (
                <option key={workspace.company.id} value={workspace.company.id}>
                  {getCompanyName(workspace.company, language)} · {getRoleLabel(workspace.role, language)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {loading ? (
          <div className="pms-loading" role="status">
            <Loader2 size={22} aria-hidden="true" />
            {copy.loading}
          </div>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {overview ? (
          <div className="pms-content-grid">
            <section className="pms-hero-card">
              <div>
                <p className="eyebrow">{copy.overview}</p>
                <h2>{copy.headline}</h2>
                <p>{copy.headlineText}</p>
              </div>

              <div className="pms-readiness-list" aria-label={copy.readiness}>
                <div>
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>{copy.entitlementReady}</span>
                </div>
                <div>
                  <UserRoundCheck size={18} aria-hidden="true" />
                  <span>{copy.accessScoped}</span>
                </div>
              </div>
            </section>

            <section className="pms-metric-grid" aria-label={copy.overview}>
              {metrics.map((metric) => (
                <article key={metric.key} className="pms-metric-card">
                  <span>{metric.label}</span>
                  <strong>{formatNumber(metric.value, language)}</strong>
                </article>
              ))}
            </section>

            <section className="pms-next-actions">
              <div className="pms-next-actions__header">
                <p className="eyebrow">{copy.readiness}</p>
                <h2>{copy.overview}</h2>
              </div>

              <div className="pms-empty-state-list">
                {overview.emptyStates.properties ? (
                  <div>
                    <Building2 size={18} aria-hidden="true" />
                    <span>{copy.emptyProperties}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </div>
                ) : null}

                {overview.emptyStates.rentals ? (
                  <div>
                    <FileText size={18} aria-hidden="true" />
                    <span>{copy.emptyRentals}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </div>
                ) : null}

                {overview.emptyStates.accounting ? (
                  <div>
                    <CreditCard size={18} aria-hidden="true" />
                    <span>{copy.emptyAccounting}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}

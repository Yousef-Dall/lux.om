import { Building2, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../../auth/AuthContext';
import { useLanguage } from '../../../i18n/LanguageContext';
import { cn } from '../../../utils/format';
import { resolvePmsWorkspace, type PmsWorkspaceAccess } from '../access';
import {
  canViewPmsNavigationItem,
  pmsNavigation,
  pmsNavigationGroups,
  type PmsNavigationGroup,
  type PmsNavigationKey
} from '../navigation';

function companyName(workspace: PmsWorkspaceAccess, language: 'en' | 'ar') {
  return language === 'ar'
    ? workspace.company.nameAr || workspace.company.nameEn
    : workspace.company.nameEn || workspace.company.nameAr || '';
}

function roleLabel(role: string, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    PMS_OWNER: { en: 'Owner', ar: 'مالك' },
    PMS_MANAGER: { en: 'Manager', ar: 'مدير' },
    PMS_ACCOUNTANT: { en: 'Accountant', ar: 'محاسب' },
    PMS_MAINTENANCE: { en: 'Maintenance', ar: 'صيانة' },
    PMS_AGENT: { en: 'Agent', ar: 'وكيل' },
    PMS_VIEWER: { en: 'Viewer', ar: 'مشاهد' }
  };
  return labels[role]?.[language] ?? role;
}

function safeCompanySwitchPath(pathname: string) {
  if (/^\/pms\/portfolio\/properties\/[^/]+/.test(pathname)) return '/pms/portfolio/properties';
  if (/^\/pms\/leasing\/leases\/[^/]+/.test(pathname)) return '/pms/leasing/leases';
  return pathname;
}

export default function PmsShell() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaces = user?.pmsAccess?.workspaces ?? [];
  const requestedCompanyId = searchParams.get('companyId');
  const activeWorkspace = resolvePmsWorkspace(workspaces, requestedCompanyId);

  const copy = language === 'ar'
    ? {
        workspace: 'مساحة عمل PMS',
        company: 'الشركة',
        switchCompany: 'تبديل شركة PMS',
        scopeAll: 'كل العقارات',
        scopeAssigned: 'عقارات مخصصة',
        active: 'مفعّل',
        trial: 'تجريبي',
        suspended: 'معلّق',
        expired: 'منتهي',
        unavailableTitle: 'لا توجد مساحة PMS متاحة',
        unavailableText: 'لم يعد لهذا الحساب وصول فعّال إلى مساحة داخلية لإدارة العقارات.',
        groups: {
          overview: 'نظرة عامة',
          portfolio: 'المحفظة',
          leasing: 'الإيجارات',
          operations: 'العمليات',
          finance: 'المالية',
          reports: 'التقارير',
          administration: 'الإدارة'
        },
        items: {
          overview: 'نظرة عامة',
          properties: 'العقارات',
          units: 'الوحدات',
          tenants: 'المستأجرون',
          leases: 'العقود وجداول الإيجار',
          maintenance: 'الصيانة',
          vendors: 'المورّدون',
          assetsInspections: 'الأصول والصيانة الوقائية والفحوصات',
          documents: 'المستندات',
          financeOverview: 'نظرة مالية',
          financeCharges: 'المطالبات',
          financePayments: 'الدفعات والتخصيصات',
          financeDeposits: 'التأمينات',
          financePeriods: 'الفترات المالية',
          financeReconciliation: 'المطابقة البنكية',
          financeRecords: 'السجلات المالية',
          reports: 'التقارير',
          staffAccess: 'الموظفون والصلاحيات',
          importExport: 'الاستيراد والتصدير',
          settings: 'الإعدادات'
        }
      }
    : {
        workspace: 'PMS workspace',
        company: 'Company',
        switchCompany: 'Switch PMS company',
        scopeAll: 'All properties',
        scopeAssigned: 'assigned properties',
        active: 'Active',
        trial: 'Trial',
        suspended: 'Suspended',
        expired: 'Expired',
        unavailableTitle: 'No PMS workspace is available',
        unavailableText: 'This account no longer has an active internal property-management workspace.',
        groups: {
          overview: 'Overview',
          portfolio: 'Portfolio',
          leasing: 'Leasing',
          operations: 'Operations',
          finance: 'Finance',
          reports: 'Reports',
          administration: 'Administration'
        },
        items: {
          overview: 'Overview',
          properties: 'Properties',
          units: 'Units',
          tenants: 'Tenants',
          leases: 'Leases and rent schedules',
          maintenance: 'Maintenance',
          vendors: 'Vendors',
          assetsInspections: 'Assets, preventive maintenance, and inspections',
          documents: 'Documents',
          financeOverview: 'Financial overview',
          financeCharges: 'Charges',
          financePayments: 'Payments and allocations',
          financeDeposits: 'Deposits',
          financePeriods: 'Financial periods',
          financeReconciliation: 'Reconciliation',
          financeRecords: 'Finance records',
          reports: 'Reports',
          staffAccess: 'Staff and access',
          importExport: 'Import and export',
          settings: 'Settings'
        }
      };

  useEffect(() => {
    if (!activeWorkspace || requestedCompanyId === activeWorkspace.company.id) return;
    const next = new URLSearchParams(location.search);
    next.set('companyId', activeWorkspace.company.id);
    navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true });
  }, [activeWorkspace, location.pathname, location.search, navigate, requestedCompanyId]);

  const visibleNavigation = useMemo(() => {
    if (!activeWorkspace) return [];
    return pmsNavigation.filter((item) =>
      canViewPmsNavigationItem(
        item,
        activeWorkspace.permissionKeys,
        activeWorkspace.propertyScope
      )
    );
  }, [activeWorkspace]);

  function targetFor(pathname: string) {
    if (!activeWorkspace) return pathname;
    return `${pathname}?companyId=${encodeURIComponent(activeWorkspace.company.id)}`;
  }

  function switchCompany(companyId: string) {
    navigate({
      pathname: safeCompanySwitchPath(location.pathname),
      search: `?companyId=${encodeURIComponent(companyId)}`
    });
  }

  if (!activeWorkspace) {
    return (
      <section className="pms-portal pms-portal--unavailable" aria-labelledby="pms-unavailable-title">
        <div className="pms-main">
          <div className="pms-empty-card" role="alert">
            <ShieldCheck aria-hidden="true" size={24} />
            <div>
              <h1 id="pms-unavailable-title">{copy.unavailableTitle}</h1>
              <p>{copy.unavailableText}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const assignedPropertyCount = activeWorkspace.propertyScope?.propertyIds.length ?? 0;
  const scopeText = activeWorkspace.propertyScope?.allProperties
    ? copy.scopeAll
    : language === 'ar'
      ? `${assignedPropertyCount} ${copy.scopeAssigned}`
      : `${assignedPropertyCount} assigned ${assignedPropertyCount === 1 ? 'property' : 'properties'}`;
  const entitlementLabel = activeWorkspace.entitlement?.status === 'TRIAL'
    ? copy.trial
    : activeWorkspace.entitlement?.status === 'SUSPENDED'
      ? copy.suspended
      : activeWorkspace.entitlement?.status === 'EXPIRED'
        ? copy.expired
        : copy.active;

  return (
    <section className="pms-portal" aria-label={copy.workspace}>
      <aside className="pms-sidebar">
        <NavLink className="pms-sidebar__brand" to={targetFor('/pms/overview')}>
          <span>lux</span>
          <strong>PMS</strong>
        </NavLink>

        <div className="pms-sidebar__workspace">
          <Building2 aria-hidden="true" size={18} />
          <div>
            <small>{copy.company}</small>
            <strong>{companyName(activeWorkspace, language)}</strong>
            <span>{roleLabel(activeWorkspace.role, language)} · {scopeText}</span>
          </div>
          <em>{entitlementLabel}</em>
        </div>

        {workspaces.length > 1 ? (
          <label className="pms-sidebar__company-switcher">
            <span>{copy.switchCompany}</span>
            <select
              aria-label={copy.switchCompany}
              value={activeWorkspace.company.id}
              onChange={(event) => switchCompany(event.target.value)}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.memberId} value={workspace.company.id}>
                  {companyName(workspace, language)} · {roleLabel(workspace.role, language)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <nav className="pms-sidebar__nav" aria-label={copy.workspace}>
          {pmsNavigationGroups.map((group) => {
            const items = visibleNavigation.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div className="pms-sidebar__group" key={group}>
                <span className="pms-sidebar__group-label">
                  {copy.groups[group as PmsNavigationGroup]}
                </span>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      className={({ isActive }) => cn('pms-sidebar__link', isActive && 'pms-sidebar__link--active')}
                      end={item.key === 'overview'}
                      key={item.key}
                      to={targetFor(item.to)}
                    >
                      <Icon aria-hidden="true" size={18} />
                      <span>{copy.items[item.key as PmsNavigationKey]}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="pms-main">
        <Outlet />
      </div>
    </section>
  );
}

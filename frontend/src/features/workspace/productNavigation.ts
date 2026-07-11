import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  Building2,
  Home,
  LayoutDashboard,
  ShieldCheck,
  UserCircle,
  UsersRound,
  Wrench
} from 'lucide-react';
import { useMemo } from 'react';

import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';

export type AuthenticatedProductNavigationItem = {
  key:
    | 'dashboard'
    | 'marketplace'
    | 'crm'
    | 'pms'
    | 'tenant'
    | 'owner'
    | 'vendor'
    | 'admin'
    | 'notifications'
    | 'profile';
  to: string;
  label: string;
  icon: LucideIcon;
};

function getMarketplaceOperationsPath(input: {
  canManageListings: boolean;
  canManageActivities: boolean;
  canManageTravelPackages: boolean;
  canManageDeveloperProjects: boolean;
  canAccessAdmin: boolean;
}) {
  if (input.canAccessAdmin) return '/dashboard?workspace=admin-operations';
  if (input.canManageListings) return '/dashboard?workspace=listings-command';
  if (input.canManageActivities) return '/dashboard?workspace=activities-command';
  if (input.canManageTravelPackages) return '/dashboard?workspace=travel-packages';
  if (input.canManageDeveloperProjects) return '/dashboard?workspace=projects-developments';
  return null;
}

export function useAuthenticatedProductNavigation() {
  const { language } = useLanguage();
  const auth = useAuth();

  return useMemo<AuthenticatedProductNavigationItem[]>(() => {
    if (!auth.isAuthenticated || auth.loading) return [];

    const copy = language === 'ar'
      ? {
          dashboard: 'لوحة التحكم',
          marketplace: 'عمليات السوق',
          crm: 'إدارة علاقات العملاء',
          pms: 'إدارة العقارات',
          tenant: 'بوابة المستأجر',
          owner: 'بوابة المالك',
          vendor: 'بوابة المورّد',
          admin: 'الإدارة',
          notifications: 'الإشعارات',
          profile: 'الملف الشخصي'
        }
      : {
          dashboard: 'Dashboard',
          marketplace: 'Marketplace operations',
          crm: 'CRM',
          pms: 'PMS',
          tenant: 'Tenant portal',
          owner: 'Owner portal',
          vendor: 'Vendor portal',
          admin: 'Administration',
          notifications: 'Notifications',
          profile: 'Profile'
        };

    const marketplacePath = getMarketplaceOperationsPath(auth);
    const hasPortalAccess =
      auth.canAccessTenantPortal || auth.canAccessOwnerPortal || auth.canAccessVendorPortal;
    const portalOnly =
      hasPortalAccess &&
      !auth.canAccessCrm &&
      !auth.canAccessPms &&
      !auth.isMarketplaceOperator &&
      !auth.canAccessAdmin;
    const items: AuthenticatedProductNavigationItem[] = [];

    if (!portalOnly) {
      items.push({ key: 'dashboard', to: '/dashboard', label: copy.dashboard, icon: LayoutDashboard });
    }
    if (marketplacePath) {
      items.push({ key: 'marketplace', to: marketplacePath, label: copy.marketplace, icon: BarChart3 });
    }
    if (auth.canAccessCrm) {
      items.push({ key: 'crm', to: '/crm/overview', label: copy.crm, icon: UsersRound });
    }
    if (auth.canAccessPms) {
      items.push({ key: 'pms', to: '/pms/overview', label: copy.pms, icon: Building2 });
    }
    if (auth.canAccessTenantPortal) {
      items.push({ key: 'tenant', to: '/tenant', label: copy.tenant, icon: Home });
    }
    if (auth.canAccessOwnerPortal) {
      items.push({ key: 'owner', to: '/owner', label: copy.owner, icon: Building2 });
    }
    if (auth.canAccessVendorPortal) {
      items.push({ key: 'vendor', to: '/vendor', label: copy.vendor, icon: Wrench });
    }
    if (auth.canAccessAdmin) {
      items.push({ key: 'admin', to: '/admin', label: copy.admin, icon: ShieldCheck });
    }

    items.push(
      { key: 'notifications', to: '/notifications', label: copy.notifications, icon: Bell },
      { key: 'profile', to: '/profile', label: copy.profile, icon: UserCircle }
    );

    return items;
  }, [
    auth.canAccessAdmin,
    auth.canAccessCrm,
    auth.canAccessOwnerPortal,
    auth.canAccessPms,
    auth.canAccessTenantPortal,
    auth.canAccessVendorPortal,
    auth.canManageActivities,
    auth.canManageDeveloperProjects,
    auth.canManageListings,
    auth.canManageTravelPackages,
    auth.isAuthenticated,
    auth.isMarketplaceOperator,
    auth.loading,
    language
  ]);
}

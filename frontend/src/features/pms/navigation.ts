import {
  BarChart3,
  Building2,
  ClipboardList,
  FileInput,
  FileText,
  Gauge,
  KeyRound,
  Landmark,
  PackageSearch,
  ReceiptText,
  Settings,
  UserCog,
  UserRoundCheck,
  UsersRound,
  Wrench,
  type LucideIcon
} from 'lucide-react';

import type { PmsPermissionKey } from '../../api/pms';
import { hasPmsPermission } from './access';

export type PmsNavigationKey =
  | 'overview'
  | 'properties'
  | 'units'
  | 'tenants'
  | 'leases'
  | 'maintenance'
  | 'vendors'
  | 'assetsInspections'
  | 'documents'
  | 'financeOverview'
  | 'financeRecords'
  | 'reports'
  | 'staffAccess'
  | 'importExport'
  | 'settings';

export type PmsNavigationGroup =
  | 'overview'
  | 'portfolio'
  | 'leasing'
  | 'operations'
  | 'finance'
  | 'reports'
  | 'administration';

export type PmsNavigationItem = {
  to: string;
  key: PmsNavigationKey;
  group: PmsNavigationGroup;
  icon: LucideIcon;
  permission: PmsPermissionKey | null;
  requiresWorkspaceWideAccess?: boolean;
};

export const pmsNavigation: readonly PmsNavigationItem[] = [
  { to: '/pms/overview', key: 'overview', group: 'overview', icon: Gauge, permission: null },
  { to: '/pms/portfolio/properties', key: 'properties', group: 'portfolio', icon: Building2, permission: 'INVENTORY_VIEW' },
  { to: '/pms/portfolio/units', key: 'units', group: 'portfolio', icon: KeyRound, permission: 'INVENTORY_VIEW' },
  { to: '/pms/leasing/tenants', key: 'tenants', group: 'leasing', icon: UserRoundCheck, permission: 'TENANCY_VIEW' },
  { to: '/pms/leasing/leases', key: 'leases', group: 'leasing', icon: ClipboardList, permission: 'TENANCY_VIEW' },
  { to: '/pms/operations/maintenance', key: 'maintenance', group: 'operations', icon: Wrench, permission: 'MAINTENANCE_VIEW' },
  { to: '/pms/operations/vendors', key: 'vendors', group: 'operations', icon: UsersRound, permission: 'MAINTENANCE_VIEW' },
  { to: '/pms/operations/assets-inspections', key: 'assetsInspections', group: 'operations', icon: PackageSearch, permission: 'MAINTENANCE_VIEW' },
  { to: '/pms/operations/documents', key: 'documents', group: 'operations', icon: FileText, permission: 'DOCUMENTS_VIEW' },
  { to: '/pms/finance/overview', key: 'financeOverview', group: 'finance', icon: Landmark, permission: 'ACCOUNTING_VIEW' },
  { to: '/pms/finance/records', key: 'financeRecords', group: 'finance', icon: ReceiptText, permission: 'ACCOUNTING_VIEW' },
  { to: '/pms/reports', key: 'reports', group: 'reports', icon: BarChart3, permission: 'REPORTS_VIEW' },
  { to: '/pms/administration/staff-access', key: 'staffAccess', group: 'administration', icon: UserCog, permission: 'STAFF_MANAGE', requiresWorkspaceWideAccess: true },
  { to: '/pms/administration/import-export', key: 'importExport', group: 'administration', icon: FileInput, permission: 'IMPORT_EXPORT', requiresWorkspaceWideAccess: true },
  { to: '/pms/administration/settings', key: 'settings', group: 'administration', icon: Settings, permission: 'SETTINGS_MANAGE' }
];

export const pmsNavigationGroups: readonly PmsNavigationGroup[] = [
  'overview',
  'portfolio',
  'leasing',
  'operations',
  'finance',
  'reports',
  'administration'
];

export function canViewPmsNavigationItem(
  item: PmsNavigationItem,
  permissionKeys: readonly PmsPermissionKey[] | undefined,
  propertyScope: { allProperties: boolean; propertyIds: string[] } | undefined
) {
  if (!hasPmsPermission(permissionKeys, item.permission)) return false;
  if (item.requiresWorkspaceWideAccess && !propertyScope?.allProperties) return false;
  return true;
}

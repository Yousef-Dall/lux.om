import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  Settings,
  UserCog,
  UserRoundCheck,
  Wrench,
  type LucideIcon
} from 'lucide-react';

import type { PmsPermissionKey } from '../../api/pms';

export type PmsNavigationKey = 'overview' | 'crm' | 'properties' | 'units' | 'tenants' | 'rentals' | 'documents' | 'maintenance' | 'accounting' | 'importExport' | 'staff' | 'reports' | 'settings';
export type PmsNavigationGroup = 'workspace' | 'leasing' | 'operations' | 'control';

export const pmsNavigation: ReadonlyArray<{
  to: string;
  key: PmsNavigationKey;
  group: PmsNavigationGroup;
  icon: LucideIcon;
  permission: PmsPermissionKey | null;
}> = [
  { to: '/pms/overview', key: 'overview', group: 'workspace', icon: Home, permission: null },
  { to: '/crm', key: 'crm', group: 'workspace', icon: UserRoundCheck, permission: 'CRM_VIEW' },
  { to: '/pms/properties', key: 'properties', group: 'workspace', icon: Building2, permission: 'INVENTORY_VIEW' },
  { to: '/pms/units', key: 'units', group: 'workspace', icon: KeyRound, permission: 'INVENTORY_VIEW' },
  { to: '/pms/tenants', key: 'tenants', group: 'leasing', icon: UserRoundCheck, permission: 'TENANCY_VIEW' },
  { to: '/pms/rentals', key: 'rentals', group: 'leasing', icon: ClipboardList, permission: 'TENANCY_VIEW' },
  { to: '/pms/documents', key: 'documents', group: 'operations', icon: FileText, permission: 'DOCUMENTS_VIEW' },
  { to: '/pms/maintenance', key: 'maintenance', group: 'operations', icon: Wrench, permission: 'MAINTENANCE_VIEW' },
  { to: '/pms/accounting', key: 'accounting', group: 'control', icon: CreditCard, permission: 'ACCOUNTING_VIEW' },
  { to: '/pms/reports', key: 'reports', group: 'control', icon: BarChart3, permission: 'REPORTS_VIEW' },
  { to: '/pms/import-export', key: 'importExport', group: 'control', icon: FileText, permission: 'IMPORT_EXPORT' },
  { to: '/pms/staff', key: 'staff', group: 'control', icon: UserCog, permission: 'STAFF_MANAGE' },
  { to: '/pms/settings', key: 'settings', group: 'control', icon: Settings, permission: 'SETTINGS_MANAGE' }
];

export const pmsNavigationGroups: readonly PmsNavigationGroup[] = ['workspace', 'leasing', 'operations', 'control'];

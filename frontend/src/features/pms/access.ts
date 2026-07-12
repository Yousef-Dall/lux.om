import type { PmsAccessSummary, PmsPermissionKey } from '../../api/pms';

export type PmsWorkspaceAccess = PmsAccessSummary['workspaces'][number];

export function hasPmsPermission(
  permissionKeys: readonly PmsPermissionKey[] | undefined,
  permission: PmsPermissionKey | null
) {
  return permission === null || (permissionKeys?.includes(permission) ?? false);
}

export function resolvePmsWorkspace(
  workspaces: readonly PmsWorkspaceAccess[],
  requestedCompanyId?: string | null
) {
  return workspaces.find((workspace) => workspace.company.id === requestedCompanyId) ?? workspaces[0];
}

export function canManagePmsAccounting(workspace: PmsWorkspaceAccess | undefined) {
  return hasPmsPermission(workspace?.permissionKeys, 'ACCOUNTING_MANAGE');
}

export function canCollectPmsRent(workspace: PmsWorkspaceAccess | undefined) {
  return hasPmsPermission(workspace?.permissionKeys, 'RENT_MANAGE');
}

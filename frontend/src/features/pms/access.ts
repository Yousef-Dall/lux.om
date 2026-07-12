import type { PmsPermissionKey } from '../../api/pms';

export function hasPmsPermission(
  permissionKeys: readonly PmsPermissionKey[] | undefined,
  permission: PmsPermissionKey | null
) {
  return permission === null || (permissionKeys?.includes(permission) ?? false);
}

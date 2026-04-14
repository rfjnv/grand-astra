import type { PermissionKey } from '../permissions/permission-keys';

export type AuthUser = {
  userId: string;
  organizationId: string;
  departmentId: string | null;
  roleId: string;
  /** Стабильный ключ роли внутри организации (owner, director, …). */
  roleSlug: string;
  permissionKeys: PermissionKey[];
};

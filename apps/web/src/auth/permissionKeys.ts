/** Синхронизировано с API `PermissionKeys` — для проверок в UI. */
export const PermissionKeys = {
  ALL: '*',
  USERS_LIST: 'users.list',
  USERS_CREATE: 'users.create',
  CLIENTS_READ: 'clients.read',
  CLIENTS_WRITE: 'clients.write',
  DEALS_READ: 'deals.read',
  DEALS_WRITE: 'deals.write',
  PROPERTIES_READ: 'properties.read',
  PROPERTIES_WRITE: 'properties.write',
  CONSTRUCTION_READ: 'construction.read',
  FINANCE_READ: 'finance.read',
  FINANCE_WRITE: 'finance.write',
  FINANCE_SCHEDULES: 'finance.schedules',
  REPORTS_READ: 'reports.read',
  NOTIFICATIONS_READ: 'notifications.read',
} as const;

export type PermissionKey = (typeof PermissionKeys)[keyof typeof PermissionKeys];

export function can(user: { permissionKeys: string[] } | null | undefined, key: PermissionKey | string): boolean {
  if (!user?.permissionKeys?.length) return false;
  if (user.permissionKeys.includes(PermissionKeys.ALL)) return true;
  return user.permissionKeys.includes(key);
}

/** Ключи прав для SaaS-модели (кастомные роли = набор этих ключей). */
export const PermissionKeys = {
  ALL: '*',
  USERS_LIST: 'users.list',
  USERS_CREATE: 'users.create',
  ROLES_MANAGE: 'roles.manage',
  CLIENTS_READ: 'clients.read',
  CLIENTS_WRITE: 'clients.write',
  DEALS_READ: 'deals.read',
  DEALS_WRITE: 'deals.write',
  DEAL_STAGES_MANAGE: 'deal_stages.manage',
  PROPERTIES_READ: 'properties.read',
  PROPERTIES_WRITE: 'properties.write',
  CONSTRUCTION_READ: 'construction.read',
  CONSTRUCTION_WRITE: 'construction.write',
  FINANCE_READ: 'finance.read',
  FINANCE_WRITE: 'finance.write',
  FINANCE_SCHEDULES: 'finance.schedules',
  REPORTS_READ: 'reports.read',
  AUDIT_READ: 'audit.read',
  NOTIFICATIONS_READ: 'notifications.read',
  ORG_SETTINGS: 'org.settings',
  /** Менеджер: только свои клиенты/сделки (entity ownership). */
  SCOPE_OWN_RECORDS: 'scope.own_records',
} as const;

export type PermissionKey = (typeof PermissionKeys)[keyof typeof PermissionKeys];

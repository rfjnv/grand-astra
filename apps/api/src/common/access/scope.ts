import { Prisma } from '@prisma/client';
import type { AuthUser } from '../types/auth-user';
import { PermissionKeys } from '../permissions/permission-keys';

export function orgWhere(user: AuthUser): { organizationId: string } {
  return { organizationId: user.organizationId };
}

function ownRecordsOnly(user: AuthUser): boolean {
  return (
    user.permissionKeys.includes(PermissionKeys.SCOPE_OWN_RECORDS) &&
    !user.permissionKeys.includes(PermissionKeys.ALL)
  );
}

export function clientWhere(user: AuthUser): Prisma.ClientWhereInput {
  const base: Prisma.ClientWhereInput = orgWhere(user);
  if (ownRecordsOnly(user)) {
    return { ...base, assignedUserId: user.userId };
  }
  return base;
}

export function dealWhere(user: AuthUser): Prisma.DealWhereInput {
  const base: Prisma.DealWhereInput = orgWhere(user);
  if (ownRecordsOnly(user)) {
    return { ...base, responsibleUserId: user.userId };
  }
  return base;
}

export function canAccessDeal(user: AuthUser, responsibleUserId: string): boolean {
  if (ownRecordsOnly(user)) return responsibleUserId === user.userId;
  return true;
}

export function canAccessClient(user: AuthUser, assignedUserId: string | null): boolean {
  if (ownRecordsOnly(user)) return assignedUserId === user.userId;
  return true;
}

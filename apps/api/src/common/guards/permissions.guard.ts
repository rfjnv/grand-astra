import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { PermissionKey } from '../permissions/permission-keys';
import { PermissionKeys } from '../permissions/permission-keys';
import type { AuthUser } from '../types/auth-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<{ user: AuthUser }>().user;
    if (user.permissionKeys.includes(PermissionKeys.ALL)) return true;
    return required.every((p) => user.permissionKeys.includes(p));
  }
}

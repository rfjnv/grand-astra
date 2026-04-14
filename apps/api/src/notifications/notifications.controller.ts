import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionKeys } from '../common/permissions/permission-keys';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @RequirePermissions(PermissionKeys.NOTIFICATIONS_READ)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('take') take?: string) {
    const n = take ? Number(take) : 50;
    return this.notifications.list(user, Number.isFinite(n) ? n : 50);
  }

  @RequirePermissions(PermissionKeys.NOTIFICATIONS_READ)
  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }

  @RequirePermissions(PermissionKeys.NOTIFICATIONS_READ)
  @Patch('read-all')
  markAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionKeys } from '../common/permissions/permission-keys';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Доступно любому авторизованному пользователю (данные уже ограничены по роли в сервисе). */
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.reports.dashboard(user);
  }

  @RequirePermissions(PermissionKeys.DEALS_READ)
  @Get('sales-by-month')
  salesByMonth(@CurrentUser() user: AuthUser, @Query('months') months?: string) {
    const m = months ? Number(months) : 6;
    return this.reports.salesByMonth(user, Number.isFinite(m) ? m : 6);
  }
}

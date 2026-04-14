import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionKeys } from '../common/permissions/permission-keys';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermissions(PermissionKeys.AUDIT_READ)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
    @Query('entityType') entityType?: string,
  ) {
    const n = take ? Math.min(200, Number(take)) : 50;
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: user.organizationId,
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number.isFinite(n) ? n : 50,
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }
}

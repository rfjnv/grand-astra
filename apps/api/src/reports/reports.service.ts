import { Injectable } from '@nestjs/common';
import { DealType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user';
import { dealWhere, orgWhere } from '../common/access/scope';
import { PermissionKeys } from '../common/permissions/permission-keys';

function canSeeOrgFinance(user: AuthUser) {
  if (user.permissionKeys.includes(PermissionKeys.ALL)) return true;
  return (
    user.permissionKeys.includes(PermissionKeys.FINANCE_READ) &&
    !user.permissionKeys.includes(PermissionKeys.SCOPE_OWN_RECORDS)
  );
}

function ownScope(user: AuthUser) {
  return (
    user.permissionKeys.includes(PermissionKeys.SCOPE_OWN_RECORDS) &&
    !user.permissionKeys.includes(PermissionKeys.ALL)
  );
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: AuthUser) {
    const dealFilter = ownScope(user) ? dealWhere(user) : orgWhere(user);
    const clientFilter = ownScope(user)
      ? { organizationId: user.organizationId, assignedUserId: user.userId }
      : orgWhere(user);

    const monthStart = startOfMonth(new Date());
    const canFinance = canSeeOrgFinance(user);

    const [clientsCount, openDeals, propertiesByStatus, expensesMonth, incomesMonth, overdueCount] =
      await Promise.all([
        this.prisma.client.count({ where: clientFilter }),
        this.prisma.deal.count({ where: { ...dealFilter, closedAt: null } }),
        this.prisma.property.groupBy({
          by: ['status'],
          where: orgWhere(user),
          _count: true,
        }),
        canFinance
          ? this.prisma.expense.aggregate({
              where: {
                organizationId: user.organizationId,
                paymentDate: { gte: monthStart },
                status: { not: 'CANCELLED' },
              },
              _sum: { normalizedAmountBase: true },
            })
          : Promise.resolve({ _sum: { normalizedAmountBase: null } }),
        canFinance
          ? this.prisma.income.aggregate({
              where: { organizationId: user.organizationId, receivedAt: { gte: monthStart } },
              _sum: { normalizedAmountBase: true },
            })
          : Promise.resolve({ _sum: { normalizedAmountBase: null } }),
        this.prisma.scheduledPayment.count({
          where: {
            organizationId: user.organizationId,
            status: { in: ['PLANNED', 'OVERDUE'] },
            dueDate: { lt: new Date() },
            ...(ownScope(user) ? { deal: dealWhere(user) } : {}),
          },
        }),
      ]);

    const dealsByType = await this.prisma.deal.groupBy({
      by: ['type'],
      where: dealFilter,
      _count: true,
    });

    return {
      clientsCount,
      openDeals,
      propertiesByStatus,
      dealsByType: Object.fromEntries(dealsByType.map((d) => [d.type, d._count])) as Record<
        DealType,
        number
      >,
      financeThisMonth: canFinance
        ? {
            expenses: expensesMonth._sum.normalizedAmountBase?.toString() ?? '0',
            incomes: incomesMonth._sum.normalizedAmountBase?.toString() ?? '0',
          }
        : null,
      overdueSchedules: overdueCount,
    };
  }

  async salesByMonth(user: AuthUser, months = 6) {
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    const baseWhere = {
      type: DealType.SALE,
      closedAt: { gte: from },
    };
    const deals = await this.prisma.deal.findMany({
      where: ownScope(user) ? { ...dealWhere(user), ...baseWhere } : { ...orgWhere(user), ...baseWhere },
      select: { closedAt: true, amount: true },
    });
    const buckets = new Map<string, number>();
    for (const d of deals) {
      if (!d.closedAt || !d.amount) continue;
      const key = `${d.closedAt.getFullYear()}-${String(d.closedAt.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, (buckets.get(key) ?? 0) + Number(d.amount));
    }
    return Array.from(buckets.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

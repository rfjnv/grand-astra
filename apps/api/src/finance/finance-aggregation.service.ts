import { Injectable } from '@nestjs/common';
import { Prisma, ScheduleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user';
import { dealWhere, orgWhere } from '../common/access/scope';
import { PermissionKeys } from '../common/permissions/permission-keys';

export type AggregationPeriod = { from: Date; to: Date };

@Injectable()
export class FinanceAggregationService {
  constructor(private readonly prisma: PrismaService) {}

  private canFullFinance(user: AuthUser) {
    return (
      user.permissionKeys.includes(PermissionKeys.ALL) ||
      (user.permissionKeys.includes(PermissionKeys.FINANCE_READ) &&
        !user.permissionKeys.includes(PermissionKeys.SCOPE_OWN_RECORDS))
    );
  }

  /** P&L в базовой валюте за период (доходы − расходы по normalizedAmountBase). */
  async profit(user: AuthUser, period: AggregationPeriod): Promise<{ income: string; expense: string; net: string }> {
    if (!this.canFullFinance(user)) {
      return { income: '0', expense: '0', net: '0' };
    }
    const [inc, exp] = await Promise.all([
      this.prisma.income.aggregate({
        where: {
          organizationId: user.organizationId,
          receivedAt: { gte: period.from, lte: period.to },
        },
        _sum: { normalizedAmountBase: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          organizationId: user.organizationId,
          paymentDate: { gte: period.from, lte: period.to },
          status: { not: 'CANCELLED' },
        },
        _sum: { normalizedAmountBase: true },
      }),
    ]);
    const income = inc._sum.normalizedAmountBase ?? new Prisma.Decimal(0);
    const expense = exp._sum.normalizedAmountBase ?? new Prisma.Decimal(0);
    const net = income.sub(expense);
    return {
      income: income.toString(),
      expense: expense.toString(),
      net: net.toString(),
    };
  }

  /** Денежный поток по месяцам (базовая валюта). */
  async cashflowByMonth(
    user: AuthUser,
    months: number,
  ): Promise<{ month: string; inflow: string; outflow: string }[]> {
    if (!this.canFullFinance(user)) return [];
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const [incomes, expenses] = await Promise.all([
      this.prisma.income.findMany({
        where: { organizationId: user.organizationId, receivedAt: { gte: from } },
        select: { receivedAt: true, normalizedAmountBase: true },
      }),
      this.prisma.expense.findMany({
        where: {
          organizationId: user.organizationId,
          paymentDate: { gte: from },
          status: { not: 'CANCELLED' },
        },
        select: { paymentDate: true, normalizedAmountBase: true },
      }),
    ]);

    const bucket = new Map<string, { inflow: Prisma.Decimal; outflow: Prisma.Decimal }>();
    const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    for (const r of incomes) {
      const k = keyOf(r.receivedAt);
      const b = bucket.get(k) ?? { inflow: new Prisma.Decimal(0), outflow: new Prisma.Decimal(0) };
      b.inflow = b.inflow.add(r.normalizedAmountBase);
      bucket.set(k, b);
    }
    for (const r of expenses) {
      const k = keyOf(r.paymentDate);
      const b = bucket.get(k) ?? { inflow: new Prisma.Decimal(0), outflow: new Prisma.Decimal(0) };
      b.outflow = b.outflow.add(r.normalizedAmountBase);
      bucket.set(k, b);
    }

    return Array.from(bucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        inflow: v.inflow.toString(),
        outflow: v.outflow.toString(),
      }));
  }

  /** Задолженность: сумма balanceAmount по открытым сделкам + неоплаченные графики (в валюте строки, не конвертируем). */
  async receivablesSummary(user: AuthUser): Promise<{
    openDealBalanceSum: string;
    unpaidSchedulesCount: number;
    unpaidSchedulesAmountApprox: string;
  }> {
    if (!this.canFullFinance(user)) {
      return { openDealBalanceSum: '0', unpaidSchedulesCount: 0, unpaidSchedulesAmountApprox: '0' };
    }
    const dealFilter = orgWhere(user);
    const agg = await this.prisma.deal.aggregate({
      where: { ...dealFilter, closedAt: null },
      _sum: { balanceAmount: true },
    });
    const unpaid = await this.prisma.scheduledPayment.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: [ScheduleStatus.PLANNED, ScheduleStatus.OVERDUE] },
      },
      select: { amount: true },
    });
    let sum = new Prisma.Decimal(0);
    for (const s of unpaid) sum = sum.add(s.amount);
    return {
      openDealBalanceSum: agg._sum.balanceAmount?.toString() ?? '0',
      unpaidSchedulesCount: unpaid.length,
      unpaidSchedulesAmountApprox: sum.toString(),
    };
  }

  async overdueSchedulesDetailed(user: AuthUser) {
    const now = new Date();
    return this.prisma.scheduledPayment.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: [ScheduleStatus.PLANNED, ScheduleStatus.OVERDUE] },
        dueDate: { lt: now },
        ...(user.permissionKeys.includes(PermissionKeys.SCOPE_OWN_RECORDS) &&
        !user.permissionKeys.includes(PermissionKeys.ALL)
          ? { deal: dealWhere(user) }
          : {}),
      },
      orderBy: { dueDate: 'asc' },
      include: {
        deal: {
          include: {
            dealStage: true,
            client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          },
        },
      },
    });
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ExpenseScope, ExpenseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CurrencyNormalizationService } from './currency-normalization.service';
import type { AuthUser } from '../common/types/auth-user';
import { dealWhere, orgWhere } from '../common/access/scope';
import { PermissionKeys } from '../common/permissions/permission-keys';
import { CrmEvents } from '../events/crm-events.constants';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { CreateIncomeDto } from './dto/create-income.dto';
import type { CreateScheduleDto } from './dto/create-schedule.dto';
import type { PatchScheduleDto } from './dto/patch-schedule.dto';
import type { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';

function ownScope(user: AuthUser) {
  return (
    user.permissionKeys.includes(PermissionKeys.SCOPE_OWN_RECORDS) &&
    !user.permissionKeys.includes(PermissionKeys.ALL)
  );
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly currencyNorm: CurrencyNormalizationService,
    private readonly events: EventEmitter2,
  ) {}

  listCurrencyRates(user: AuthUser) {
    return this.prisma.currencyRate.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ quoteCurrency: 'asc' }, { validFrom: 'desc' }],
    });
  }

  async createCurrencyRate(user: AuthUser, dto: CreateCurrencyRateDto) {
    const base = await this.currencyNorm.getBaseCurrency(user.organizationId);
    if (dto.quoteCurrency === base) {
      throw new BadRequestException('Для базовой валюты курс не задаётся (используется 1)');
    }
    return this.prisma.currencyRate.create({
      data: {
        organizationId: user.organizationId,
        quoteCurrency: dto.quoteCurrency.toUpperCase(),
        rateToBase: dto.rateToBase,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
      },
    });
  }

  listExpenses(
    user: AuthUser,
    q?: { from?: string; to?: string; status?: string; responsibleId?: string },
  ) {
    const where: Prisma.ExpenseWhereInput = orgWhere(user);
    if (q?.from || q?.to) {
      where.paymentDate = {};
      if (q.from) where.paymentDate.gte = new Date(q.from);
      if (q.to) where.paymentDate.lte = new Date(q.to);
    }
    if (q?.status) where.status = q.status as ExpenseStatus;
    if (q?.responsibleId) where.createdById = q.responsibleId;
    return this.prisma.expense.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async createExpense(user: AuthUser, dto: CreateExpenseDto) {
    this.assertExpenseScope(dto.scope, dto);
    const paymentDate = new Date(dto.paymentDate);
    const currency = (dto.currency ?? 'UZS').toUpperCase();
    const { normalizedAmountBase, fxRateToBase } = await this.currencyNorm.normalizeAmount(
      user.organizationId,
      dto.amount,
      currency,
      paymentDate,
    );

    const row = await this.prisma.expense.create({
      data: {
        organizationId: user.organizationId,
        paymentDate,
        amount: dto.amount,
        currency,
        normalizedAmountBase,
        fxRateToBase,
        expenseType: dto.expenseType,
        paymentTerms: dto.paymentTerms,
        paymentMethod: dto.paymentMethod,
        comment: dto.comment,
        status: dto.status ?? undefined,
        scope: dto.scope,
        clientId: dto.clientId ?? null,
        dealId: dto.dealId ?? null,
        propertyId: dto.propertyId ?? null,
        projectId: dto.projectId ?? null,
        createdById: user.userId,
      },
    });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'CREATE',
      entityType: 'Expense',
      entityId: row.id,
    });
    this.events.emit(CrmEvents.EXPENSE_CREATED, {
      organizationId: user.organizationId,
      expenseId: row.id,
      actorUserId: user.userId,
      amount: row.amount.toString(),
      currency: row.currency,
    });
    return row;
  }

  listIncomes(
    user: AuthUser,
    q?: { from?: string; to?: string; dealId?: string; responsibleId?: string },
  ) {
    const where: Prisma.IncomeWhereInput = orgWhere(user);
    if (q?.from || q?.to) {
      where.receivedAt = {};
      if (q.from) where.receivedAt.gte = new Date(q.from);
      if (q.to) where.receivedAt.lte = new Date(q.to);
    }
    if (q?.dealId) where.dealId = q.dealId;
    if (q?.responsibleId) where.createdById = q.responsibleId;
    return this.prisma.income.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async createIncome(user: AuthUser, dto: CreateIncomeDto) {
    const receivedAt = new Date(dto.receivedAt);
    const currency = (dto.currency ?? 'UZS').toUpperCase();
    const { normalizedAmountBase, fxRateToBase } = await this.currencyNorm.normalizeAmount(
      user.organizationId,
      dto.amount,
      currency,
      receivedAt,
    );

    const row = await this.prisma.income.create({
      data: {
        organizationId: user.organizationId,
        receivedAt,
        amount: dto.amount,
        currency,
        normalizedAmountBase,
        fxRateToBase,
        incomeType: dto.incomeType,
        paymentMethod: dto.paymentMethod,
        comment: dto.comment,
        isCompanyLevel: dto.isCompanyLevel ?? false,
        clientId: dto.clientId ?? null,
        dealId: dto.dealId ?? null,
        propertyId: dto.propertyId ?? null,
        projectId: dto.projectId ?? null,
        createdById: user.userId,
      },
    });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'CREATE',
      entityType: 'Income',
      entityId: row.id,
    });
    this.events.emit(CrmEvents.PAYMENT_RECEIVED, {
      organizationId: user.organizationId,
      incomeId: row.id,
      actorUserId: user.userId,
      amount: row.amount.toString(),
      currency: row.currency,
      dealId: row.dealId,
    });
    return row;
  }

  listSchedules(user: AuthUser) {
    return this.prisma.scheduledPayment.findMany({
      where: ownScope(user)
        ? { organizationId: user.organizationId, deal: dealWhere(user) }
        : orgWhere(user),
      orderBy: { dueDate: 'asc' },
      include: {
        deal: {
          select: {
            id: true,
            type: true,
            responsibleUserId: true,
            dealStage: { select: { id: true, name: true, sortOrder: true } },
          },
        },
      },
    });
  }

  async createSchedule(user: AuthUser, dto: CreateScheduleDto) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dto.dealId, ...dealWhere(user) },
    });
    if (!deal) throw new NotFoundException('Сделка не найдена');

    const dueDate = new Date(dto.dueDate);
    const currency = (dto.currency ?? 'UZS').toUpperCase();
    const { normalizedAmountBase, fxRateToBase } = await this.currencyNorm.normalizeAmount(
      user.organizationId,
      dto.amount,
      currency,
      dueDate,
    );

    return this.prisma.scheduledPayment.create({
      data: {
        organizationId: user.organizationId,
        dealId: dto.dealId,
        clientId: dto.clientId ?? deal.clientId,
        dueDate,
        amount: dto.amount,
        currency,
        normalizedAmountBase,
        fxRateToBase,
        purpose: dto.purpose,
        status: dto.status ?? undefined,
      },
    });
  }

  async patchSchedule(user: AuthUser, id: string, dto: PatchScheduleDto) {
    const row = await this.prisma.scheduledPayment.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { deal: true },
    });
    if (!row) throw new NotFoundException();
    if (ownScope(user) && row.deal.responsibleUserId !== user.userId) {
      throw new ForbiddenException();
    }

    const nextAmount = dto.amount !== undefined ? dto.amount : Number(row.amount);
    const nextCurrency = dto.currency ?? row.currency;
    const dateForFx = dto.dueDate ? new Date(dto.dueDate) : row.dueDate;
    const { normalizedAmountBase, fxRateToBase } = await this.currencyNorm.normalizeAmount(
      user.organizationId,
      nextAmount,
      nextCurrency,
      dateForFx,
    );

    return this.prisma.scheduledPayment.update({
      where: { id },
      data: {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        amount: dto.amount,
        currency: dto.currency,
        normalizedAmountBase,
        fxRateToBase,
        purpose: dto.purpose,
        status: dto.status,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : dto.paidAt === null ? null : undefined,
        linkedIncomeId: dto.linkedIncomeId,
      },
    });
  }

  overdueSchedules(user: AuthUser) {
    const now = new Date();
    return this.prisma.scheduledPayment.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: ['PLANNED', 'OVERDUE'] },
        dueDate: { lt: now },
        ...(ownScope(user) ? { deal: dealWhere(user) } : {}),
      },
      orderBy: { dueDate: 'asc' },
      include: { deal: { include: { dealStage: true } } },
    });
  }

  private assertExpenseScope(scope: ExpenseScope, dto: CreateExpenseDto) {
    if (scope === ExpenseScope.COMPANY) {
      if (dto.clientId || dto.dealId || dto.propertyId || dto.projectId) {
        throw new BadRequestException('Для расхода компании не указывайте привязки');
      }
      return;
    }
    if (scope === ExpenseScope.CLIENT && !dto.clientId) throw new BadRequestException('Нужен clientId');
    if (scope === ExpenseScope.DEAL && !dto.dealId) throw new BadRequestException('Нужен dealId');
    if (scope === ExpenseScope.PROPERTY && !dto.propertyId) throw new BadRequestException('Нужен propertyId');
    if (scope === ExpenseScope.CONSTRUCTION && !dto.projectId) throw new BadRequestException('Нужен projectId');
  }
}

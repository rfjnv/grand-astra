import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventType, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CrmEvents } from './crm-events.constants';
import type {
  ClientCreatedPayload,
  DealCreatedPayload,
  DealStageChangedPayload,
  PaymentOverduePayload,
  PaymentReceivedPayload,
} from './crm-events.constants';

@Injectable()
export class CrmDomainListener {
  private readonly log = new Logger(CrmDomainListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @OnEvent(CrmEvents.DEAL_STAGE_CHANGED)
  async onDealStageChanged(p: DealStageChangedPayload) {
    await this.prisma.eventLog.create({
      data: {
        organizationId: p.organizationId,
        eventType: EventType.DEAL_STAGE_CHANGED,
        payload: p as object,
        actorUserId: p.actorUserId,
        relatedEntityType: 'Deal',
        relatedEntityId: p.dealId,
      },
    });
    await this.audit.log({
      organizationId: p.organizationId,
      userId: p.actorUserId,
      action: 'DEAL_STAGE_CHANGED',
      entityType: 'Deal',
      entityId: p.dealId,
      metadata: { fromStageId: p.fromStageId, toStageId: p.toStageId },
    });

    const deal = await this.prisma.deal.findUnique({
      where: { id: p.dealId },
      select: { responsibleUserId: true },
    });
    if (deal) {
      const toStage = await this.prisma.dealStage.findUnique({
        where: { id: p.toStageId },
        select: { name: true },
      });
      await this.notifyUser(deal.responsibleUserId, p.organizationId, {
        type: NotificationType.DEAL_STAGE_CHANGED,
        title: 'Стадия сделки изменена',
        message: `Сделка ${p.dealId.slice(0, 8)}…: новая стадия — ${toStage?.name ?? '—'}`,
        relatedEntityType: 'Deal',
        relatedEntityId: p.dealId,
      });
    }
  }

  @OnEvent(CrmEvents.DEAL_CREATED)
  async onDealCreated(p: DealCreatedPayload) {
    await this.prisma.eventLog.create({
      data: {
        organizationId: p.organizationId,
        eventType: EventType.NEW_DEAL,
        payload: p as object,
        actorUserId: p.actorUserId,
        relatedEntityType: 'Deal',
        relatedEntityId: p.dealId,
      },
    });
    const directors = await this.prisma.user.findMany({
      where: {
        organizationId: p.organizationId,
        isActive: true,
        role: { slug: { in: ['owner', 'director'] } },
      },
      select: { id: true },
    });
    for (const u of directors) {
      if (u.id === p.actorUserId) continue;
      await this.notifyUser(u.id, p.organizationId, {
        type: NotificationType.NEW_DEAL,
        title: 'Новая сделка',
        message: `Создана сделка, клиент: ${p.clientLabel}`,
        relatedEntityType: 'Deal',
        relatedEntityId: p.dealId,
      });
    }
  }

  @OnEvent(CrmEvents.CLIENT_CREATED)
  async onClientCreated(p: ClientCreatedPayload) {
    await this.prisma.eventLog.create({
      data: {
        organizationId: p.organizationId,
        eventType: EventType.NEW_CLIENT,
        payload: p as object,
        actorUserId: p.actorUserId,
        relatedEntityType: 'Client',
        relatedEntityId: p.clientId,
      },
    });
  }

  @OnEvent(CrmEvents.PAYMENT_RECEIVED)
  async onPaymentReceived(p: PaymentReceivedPayload) {
    await this.prisma.eventLog.create({
      data: {
        organizationId: p.organizationId,
        eventType: EventType.PAYMENT_RECEIVED,
        payload: p as object,
        actorUserId: p.actorUserId,
        relatedEntityType: 'Income',
        relatedEntityId: p.incomeId,
      },
    });
    const accountants = await this.prisma.user.findMany({
      where: {
        organizationId: p.organizationId,
        isActive: true,
        role: { slug: 'accountant' },
      },
      select: { id: true },
    });
    for (const u of accountants) {
      await this.notifyUser(u.id, p.organizationId, {
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Поступление',
        message: `Оплата ${p.amount} ${p.currency}`,
        relatedEntityType: 'Income',
        relatedEntityId: p.incomeId,
      });
    }
  }

  @OnEvent(CrmEvents.EXPENSE_CREATED)
  async onExpenseCreated(p: {
    organizationId: string;
    expenseId: string;
    actorUserId: string;
    amount: string;
    currency: string;
  }) {
    await this.prisma.eventLog.create({
      data: {
        organizationId: p.organizationId,
        eventType: EventType.EXPENSE_CREATED,
        payload: p as object,
        actorUserId: p.actorUserId,
        relatedEntityType: 'Expense',
        relatedEntityId: p.expenseId,
      },
    });
  }

  @OnEvent(CrmEvents.PAYMENT_OVERDUE)
  async onPaymentOverdue(p: PaymentOverduePayload) {
    await this.prisma.eventLog.create({
      data: {
        organizationId: p.organizationId,
        eventType: EventType.PAYMENT_OVERDUE,
        payload: p as object,
        relatedEntityType: 'ScheduledPayment',
        relatedEntityId: p.scheduleId,
      },
    });
    const deal = await this.prisma.deal.findUnique({
      where: { id: p.dealId },
      select: { responsibleUserId: true },
    });
    const recipients = new Set<string>();
    if (deal) recipients.add(deal.responsibleUserId);
    const fin = await this.prisma.user.findMany({
      where: {
        organizationId: p.organizationId,
        isActive: true,
        role: { slug: { in: ['accountant', 'owner', 'director'] } },
      },
      select: { id: true },
    });
    for (const u of fin) recipients.add(u.id);
    for (const uid of recipients) {
      await this.notifyUser(uid, p.organizationId, {
        type: NotificationType.PAYMENT_OVERDUE,
        title: 'Просрочен платёж',
        message: `Срок ${p.dueDate.toISOString().slice(0, 10)}: ${p.amount} ${p.currency}`,
        relatedEntityType: 'ScheduledPayment',
        relatedEntityId: p.scheduleId,
      });
    }
  }

  private async notifyUser(
    userId: string,
    organizationId: string,
    data: {
      type: NotificationType;
      title: string;
      message: string;
      relatedEntityType: string;
      relatedEntityId: string;
    },
  ) {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          organizationId,
          type: data.type,
          title: data.title,
          message: data.message,
          relatedEntityType: data.relatedEntityType,
          relatedEntityId: data.relatedEntityId,
        },
      });
    } catch (e) {
      this.log.warn(`notifyUser failed: ${e}`);
    }
  }
}

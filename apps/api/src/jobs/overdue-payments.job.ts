import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ScheduleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CrmEvents } from '../events/crm-events.constants';
import type { PaymentOverduePayload } from '../events/crm-events.constants';

@Injectable()
export class OverduePaymentsJob {
  private readonly log = new Logger(OverduePaymentsJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async markOverdueAndNotify() {
    const now = new Date();
    const due = await this.prisma.scheduledPayment.findMany({
      where: {
        status: ScheduleStatus.PLANNED,
        dueDate: { lt: now },
      },
      select: {
        id: true,
        organizationId: true,
        dealId: true,
        amount: true,
        currency: true,
        dueDate: true,
        overdueNotifiedAt: true,
      },
    });

    for (const row of due) {
      await this.prisma.scheduledPayment.update({
        where: { id: row.id },
        data: { status: ScheduleStatus.OVERDUE },
      });
      if (row.overdueNotifiedAt) continue;

      const payload: PaymentOverduePayload = {
        organizationId: row.organizationId,
        scheduleId: row.id,
        dealId: row.dealId,
        amount: row.amount.toString(),
        currency: row.currency,
        dueDate: row.dueDate,
      };
      this.events.emit(CrmEvents.PAYMENT_OVERDUE, payload);
      await this.prisma.scheduledPayment.update({
        where: { id: row.id },
        data: { overdueNotifiedAt: new Date() },
      });
    }
    if (due.length) this.log.log(`Обработано просрочек графика: ${due.length}`);
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DealType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DealStagesService } from '../deal-stages/deal-stages.service';
import type { AuthUser } from '../common/types/auth-user';
import { canAccessDeal, dealWhere } from '../common/access/scope';
import { CrmEvents } from '../events/crm-events.constants';
import type { DealCreatedPayload, DealStageChangedPayload } from '../events/crm-events.constants';
import type { CreateDealDto } from './dto/create-deal.dto';
import type { UpdateDealDto } from './dto/update-deal.dto';

const dealScalar = [
  'type',
  'dealStageId',
  'responsibleUserId',
  'clientId',
  'propertyId',
  'constructionProjectId',
  'amount',
  'advanceAmount',
  'balanceAmount',
  'notes',
  'closedAt',
] as const;

function pickChanges<T extends Record<string, unknown>>(before: T, after: T, keys: readonly string[]) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    const same =
      a === b ||
      (a != null &&
        b != null &&
        typeof (a as { toString?: () => string }).toString === 'function' &&
        (a as { toString: () => string }).toString() === (b as { toString: () => string }).toString());
    if (!same && (a !== null || b !== null)) out[k] = { from: a, to: b };
  }
  return out;
}

function clientLabel(c: { companyName: string | null; firstName: string | null; lastName: string | null }) {
  if (c.companyName) return c.companyName;
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Клиент';
}

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dealStages: DealStagesService,
    private readonly events: EventEmitter2,
  ) {}

  list(
    user: AuthUser,
    q?: {
      responsibleUserId?: string;
      dealStageId?: string;
      type?: DealType;
      updatedFrom?: string;
      updatedTo?: string;
      openOnly?: boolean;
    },
  ) {
    const where: Prisma.DealWhereInput = { ...dealWhere(user) };
    if (q?.responsibleUserId) where.responsibleUserId = q.responsibleUserId;
    if (q?.dealStageId) where.dealStageId = q.dealStageId;
    if (q?.type) where.type = q.type;
    if (q?.openOnly) where.closedAt = null;
    if (q?.updatedFrom || q?.updatedTo) {
      where.updatedAt = {};
      if (q.updatedFrom) where.updatedAt.gte = new Date(q.updatedFrom);
      if (q.updatedTo) where.updatedAt.lte = new Date(q.updatedTo);
    }
    return this.prisma.deal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        dealStage: true,
        client: { select: { id: true, companyName: true, firstName: true, lastName: true } },
        property: { select: { id: true, title: true, addressLine: true } },
        responsible: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getById(user: AuthUser, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, ...dealWhere(user) },
      include: {
        dealStage: true,
        client: true,
        property: true,
        constructionProject: true,
        responsible: true,
        changeLogs: { orderBy: { createdAt: 'desc' }, take: 50, include: { user: true } },
        schedules: { orderBy: { dueDate: 'asc' } },
      },
    });
    if (!deal) throw new NotFoundException();
    return deal;
  }

  async create(user: AuthUser, dto: CreateDealDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, organizationId: user.organizationId },
    });
    if (!client) throw new NotFoundException('Клиент не найден');

    const responsibleId = dto.responsibleUserId ?? user.userId;
    const responsible = await this.prisma.user.findFirst({
      where: { id: responsibleId, organizationId: user.organizationId },
    });
    if (!responsible) throw new NotFoundException('Ответственный не найден');

    if (dto.propertyId) {
      const p = await this.prisma.property.findFirst({
        where: { id: dto.propertyId, organizationId: user.organizationId },
      });
      if (!p) throw new NotFoundException('Объект не найден');
    }
    if (dto.constructionProjectId) {
      const p = await this.prisma.constructionProject.findFirst({
        where: { id: dto.constructionProjectId, organizationId: user.organizationId },
      });
      if (!p) throw new NotFoundException('Проект не найден');
    }

    const dealStageId = await this.dealStages.resolveStageId(user, dto.type, dto.dealStageId);

    const data: Prisma.DealCreateInput = {
      organization: { connect: { id: user.organizationId } },
      type: dto.type,
      dealStage: { connect: { id: dealStageId } },
      responsible: { connect: { id: responsibleId } },
      client: { connect: { id: dto.clientId } },
      amount: dto.amount,
      advanceAmount: dto.advanceAmount,
      balanceAmount: dto.balanceAmount,
      notes: dto.notes,
      closedAt: dto.closedAt ? new Date(dto.closedAt) : undefined,
    };
    if (dto.propertyId) data.property = { connect: { id: dto.propertyId } };
    if (dto.constructionProjectId) data.constructionProject = { connect: { id: dto.constructionProjectId } };

    const created = await this.prisma.deal.create({ data });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'CREATE',
      entityType: 'Deal',
      entityId: created.id,
    });

    const payload: DealCreatedPayload = {
      organizationId: user.organizationId,
      dealId: created.id,
      actorUserId: user.userId,
      responsibleUserId: responsibleId,
      clientLabel: clientLabel(client),
    };
    this.events.emit(CrmEvents.DEAL_CREATED, payload);

    return this.getById(user, created.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateDealDto) {
    const existing = await this.prisma.deal.findFirst({
      where: { id, ...dealWhere(user) },
      include: { dealStage: true },
    });
    if (!existing) throw new NotFoundException();
    if (!canAccessDeal(user, existing.responsibleUserId)) throw new ForbiddenException();

    const nextType = dto.type ?? existing.type;
    let nextStageId = existing.dealStageId;
    if (dto.dealStageId !== undefined) {
      nextStageId = await this.dealStages.resolveStageId(user, nextType, dto.dealStageId);
    } else if (dto.type !== undefined && dto.type !== existing.type) {
      nextStageId = await this.dealStages.resolveStageId(user, nextType);
    }

    const data: Prisma.DealUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (nextStageId !== existing.dealStageId) {
      data.dealStage = { connect: { id: nextStageId } };
    }
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.advanceAmount !== undefined) data.advanceAmount = dto.advanceAmount;
    if (dto.balanceAmount !== undefined) data.balanceAmount = dto.balanceAmount;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.closedAt !== undefined) data.closedAt = dto.closedAt ? new Date(dto.closedAt) : null;

    if (dto.responsibleUserId !== undefined) {
      const resp = await this.prisma.user.findFirst({
        where: { id: dto.responsibleUserId, organizationId: user.organizationId },
      });
      if (!resp) throw new NotFoundException('Ответственный не найден');
      data.responsible = { connect: { id: dto.responsibleUserId } };
    }
    if (dto.clientId !== undefined) {
      const c = await this.prisma.client.findFirst({
        where: { id: dto.clientId, organizationId: user.organizationId },
      });
      if (!c) throw new NotFoundException('Клиент не найден');
      data.client = { connect: { id: dto.clientId } };
    }
    if (dto.propertyId !== undefined) {
      if (dto.propertyId) {
        const p = await this.prisma.property.findFirst({
          where: { id: dto.propertyId, organizationId: user.organizationId },
        });
        if (!p) throw new NotFoundException('Объект не найден');
        data.property = { connect: { id: dto.propertyId } };
      } else {
        data.property = { disconnect: true };
      }
    }
    if (dto.constructionProjectId !== undefined) {
      if (dto.constructionProjectId) {
        const p = await this.prisma.constructionProject.findFirst({
          where: { id: dto.constructionProjectId, organizationId: user.organizationId },
        });
        if (!p) throw new NotFoundException('Проект не найден');
        data.constructionProject = { connect: { id: dto.constructionProjectId } };
      } else {
        data.constructionProject = { disconnect: true };
      }
    }

    const before = { ...existing } as Record<string, unknown>;
    const updated = await this.prisma.deal.update({ where: { id }, data });
    const after = { ...updated } as Record<string, unknown>;
    const changes = pickChanges(before, after, dealScalar as unknown as string[]);

    if (existing.dealStageId !== nextStageId) {
      const p: DealStageChangedPayload = {
        organizationId: user.organizationId,
        dealId: id,
        fromStageId: existing.dealStageId,
        toStageId: nextStageId,
        actorUserId: user.userId,
        dealType: updated.type,
      };
      this.events.emit(CrmEvents.DEAL_STAGE_CHANGED, p);
    }

    if (Object.keys(changes).length) {
      await this.prisma.dealChangeLog.create({
        data: { dealId: id, userId: user.userId, changes: changes as Prisma.InputJsonValue },
      });
    }

    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'UPDATE',
      entityType: 'Deal',
      entityId: id,
      metadata: { changes: Object.keys(changes) },
    });
    return this.getById(user, id);
  }
}

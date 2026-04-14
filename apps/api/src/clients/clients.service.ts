import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { canAccessClient, clientWhere } from '../common/access/scope';
import { PermissionKeys } from '../common/permissions/permission-keys';
import { CrmEvents } from '../events/crm-events.constants';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { CreateInteractionDto } from './dto/create-interaction.dto';

function jsonOrDefault(value: unknown, fallback: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (value === undefined) return fallback;
  return value as Prisma.InputJsonValue;
}

function ownScope(user: AuthUser) {
  return (
    user.permissionKeys.includes(PermissionKeys.SCOPE_OWN_RECORDS) &&
    !user.permissionKeys.includes(PermissionKeys.ALL)
  );
}

function label(c: { companyName: string | null; firstName: string | null; lastName: string | null }) {
  if (c.companyName) return c.companyName;
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Клиент';
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  list(user: AuthUser, q?: { status?: string; assignedUserId?: string; createdFrom?: string; createdTo?: string }) {
    const where: Prisma.ClientWhereInput = clientWhere(user);
    if (q?.status) where.status = q.status;
    if (q?.assignedUserId) where.assignedUserId = q.assignedUserId;
    if (q?.createdFrom || q?.createdTo) {
      where.createdAt = {};
      if (q.createdFrom) where.createdAt.gte = new Date(q.createdFrom);
      if (q.createdTo) where.createdAt.lte = new Date(q.createdTo);
    }
    return this.prisma.client.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getById(user: AuthUser, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...clientWhere(user) },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        interactions: { orderBy: { occurredAt: 'desc' }, take: 50, include: { createdBy: true } },
        deals: {
          take: 20,
          orderBy: { updatedAt: 'desc' },
          include: { dealStage: { select: { id: true, name: true, sortOrder: true } } },
        },
      },
    });
    if (!client) throw new NotFoundException();
    return client;
  }

  async create(user: AuthUser, dto: CreateClientDto) {
    const data: Prisma.ClientCreateInput = {
      organization: { connect: { id: user.organizationId } },
      type: dto.type,
      firstName: dto.firstName,
      lastName: dto.lastName,
      companyName: dto.companyName,
      phones: jsonOrDefault(dto.phones, []),
      emails: jsonOrDefault(dto.emails, []),
      messengers: jsonOrDefault(dto.messengers, []),
      leadSource: dto.leadSource,
      status: dto.status ?? 'NEW',
      notes: dto.notes,
    };
    if (dto.assignedUserId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedUserId, organizationId: user.organizationId },
      });
      if (!assignee) throw new NotFoundException('Ответственный не найден');
      data.assignedUser = { connect: { id: dto.assignedUserId } };
    } else if (ownScope(user)) {
      data.assignedUser = { connect: { id: user.userId } };
    }

    const created = await this.prisma.client.create({ data });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'CREATE',
      entityType: 'Client',
      entityId: created.id,
    });
    this.events.emit(CrmEvents.CLIENT_CREATED, {
      organizationId: user.organizationId,
      clientId: created.id,
      actorUserId: user.userId,
      clientLabel: label(created),
    });
    return created;
  }

  async update(user: AuthUser, id: string, dto: UpdateClientDto) {
    const existing = await this.prisma.client.findFirst({ where: { id, ...clientWhere(user) } });
    if (!existing) throw new NotFoundException();
    if (!canAccessClient(user, existing.assignedUserId)) throw new ForbiddenException();

    const data: Prisma.ClientUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.companyName !== undefined) data.companyName = dto.companyName;
    if (dto.phones !== undefined) data.phones = jsonOrDefault(dto.phones, []);
    if (dto.emails !== undefined) data.emails = jsonOrDefault(dto.emails, []);
    if (dto.messengers !== undefined) data.messengers = jsonOrDefault(dto.messengers, []);
    if (dto.leadSource !== undefined) data.leadSource = dto.leadSource;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.assignedUserId !== undefined) {
      if (dto.assignedUserId) {
        const assignee = await this.prisma.user.findFirst({
          where: { id: dto.assignedUserId, organizationId: user.organizationId },
        });
        if (!assignee) throw new NotFoundException('Ответственный не найден');
        data.assignedUser = { connect: { id: dto.assignedUserId } };
      } else {
        data.assignedUser = { disconnect: true };
      }
    }

    const updated = await this.prisma.client.update({ where: { id }, data });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'UPDATE',
      entityType: 'Client',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return updated;
  }

  async addInteraction(user: AuthUser, clientId: string, dto: CreateInteractionDto) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, ...clientWhere(user) } });
    if (!client) throw new NotFoundException();
    if (!canAccessClient(user, client.assignedUserId)) throw new ForbiddenException();

    return this.prisma.clientInteraction.create({
      data: {
        clientId,
        type: dto.type,
        occurredAt: new Date(dto.occurredAt),
        summary: dto.summary,
        createdById: user.userId,
      },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { orgWhere } from '../common/access/scope';
import type { CreatePropertyDto } from './dto/create-property.dto';
import type { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(user: AuthUser, q?: { status?: PropertyStatus }) {
    return this.prisma.property.findMany({
      where: { ...orgWhere(user), ...(q?.status ? { status: q.status } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: {
        ownerClient: { select: { id: true, companyName: true, firstName: true, lastName: true } },
      },
    });
  }

  async getById(user: AuthUser, id: string) {
    const row = await this.prisma.property.findFirst({
      where: { id, ...orgWhere(user) },
      include: {
        ownerClient: true,
        constructionProject: true,
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async create(user: AuthUser, dto: CreatePropertyDto) {
    const data: Prisma.PropertyCreateInput = {
      organization: { connect: { id: user.organizationId } },
      kind: dto.kind,
      title: dto.title,
      addressLine: dto.addressLine,
      city: dto.city,
      region: dto.region,
      country: dto.country ?? 'UZ',
      areaM2: dto.areaM2,
      salePrice: dto.salePrice !== undefined ? dto.salePrice : undefined,
      rentPrice: dto.rentPrice !== undefined ? dto.rentPrice : undefined,
      currency: dto.currency ?? 'UZS',
      status: dto.status ?? undefined,
    };

    if (dto.ownerClientId) {
      const c = await this.prisma.client.findFirst({
        where: { id: dto.ownerClientId, organizationId: user.organizationId },
      });
      if (!c) throw new NotFoundException('Клиент не найден');
      data.ownerClient = { connect: { id: dto.ownerClientId } };
    }
    if (dto.constructionProjectId) {
      const p = await this.prisma.constructionProject.findFirst({
        where: { id: dto.constructionProjectId, organizationId: user.organizationId },
      });
      if (!p) throw new NotFoundException('Проект не найден');
      data.constructionProject = { connect: { id: dto.constructionProjectId } };
    }

    const created = await this.prisma.property.create({ data });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'CREATE',
      entityType: 'Property',
      entityId: created.id,
    });
    return created;
  }

  async update(user: AuthUser, id: string, dto: UpdatePropertyDto) {
    const existing = await this.prisma.property.findFirst({ where: { id, ...orgWhere(user) } });
    if (!existing) throw new NotFoundException();

    const data: Prisma.PropertyUpdateInput = {};
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.addressLine !== undefined) data.addressLine = dto.addressLine;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.region !== undefined) data.region = dto.region;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.areaM2 !== undefined) data.areaM2 = dto.areaM2;
    if (dto.salePrice !== undefined) data.salePrice = dto.salePrice;
    if (dto.rentPrice !== undefined) data.rentPrice = dto.rentPrice;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.status !== undefined) data.status = dto.status;

    if (dto.ownerClientId !== undefined) {
      if (dto.ownerClientId) {
        const c = await this.prisma.client.findFirst({
          where: { id: dto.ownerClientId, organizationId: user.organizationId },
        });
        if (!c) throw new NotFoundException('Клиент не найден');
        data.ownerClient = { connect: { id: dto.ownerClientId } };
      } else {
        data.ownerClient = { disconnect: true };
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

    const updated = await this.prisma.property.update({ where: { id }, data });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'UPDATE',
      entityType: 'Property',
      entityId: id,
    });
    return updated;
  }
}

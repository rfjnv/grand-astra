import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { orgWhere } from '../common/access/scope';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import type { CreateStageDto } from './dto/create-stage.dto';
import type { UpdateStageDto } from './dto/update-stage.dto';

@Injectable()
export class ConstructionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listProjects(user: AuthUser) {
    return this.prisma.constructionProject.findMany({
      where: orgWhere(user),
      orderBy: { updatedAt: 'desc' },
      include: { client: { select: { id: true, companyName: true, firstName: true, lastName: true } } },
    });
  }

  async getProject(user: AuthUser, id: string) {
    const p = await this.prisma.constructionProject.findFirst({
      where: { id, ...orgWhere(user) },
      include: {
        client: true,
        stages: { orderBy: { sortOrder: 'asc' }, include: { contractors: true, materials: true } },
      },
    });
    if (!p) throw new NotFoundException();
    return p;
  }

  async createProject(user: AuthUser, dto: CreateProjectDto) {
    const data: Prisma.ConstructionProjectCreateInput = {
      organization: { connect: { id: user.organizationId } },
      name: dto.name,
      description: dto.description,
      siteAddress: dto.siteAddress,
      budgetAmount: dto.budgetAmount,
      currency: dto.currency ?? 'UZS',
      plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : undefined,
      plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
      status: dto.status ?? 'PLANNING',
    };
    if (dto.clientId) {
      const c = await this.prisma.client.findFirst({
        where: { id: dto.clientId, organizationId: user.organizationId },
      });
      if (!c) throw new NotFoundException('Клиент не найден');
      data.client = { connect: { id: dto.clientId } };
    }
    const created = await this.prisma.constructionProject.create({ data });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'CREATE',
      entityType: 'ConstructionProject',
      entityId: created.id,
    });
    return created;
  }

  async updateProject(user: AuthUser, id: string, dto: UpdateProjectDto) {
    const existing = await this.prisma.constructionProject.findFirst({ where: { id, ...orgWhere(user) } });
    if (!existing) throw new NotFoundException();

    const data: Prisma.ConstructionProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.siteAddress !== undefined) data.siteAddress = dto.siteAddress;
    if (dto.budgetAmount !== undefined) data.budgetAmount = dto.budgetAmount;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.plannedStart !== undefined) data.plannedStart = dto.plannedStart ? new Date(dto.plannedStart) : null;
    if (dto.plannedEnd !== undefined) data.plannedEnd = dto.plannedEnd ? new Date(dto.plannedEnd) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.clientId !== undefined) {
      if (dto.clientId) {
        const c = await this.prisma.client.findFirst({
          where: { id: dto.clientId, organizationId: user.organizationId },
        });
        if (!c) throw new NotFoundException('Клиент не найден');
        data.client = { connect: { id: dto.clientId } };
      } else {
        data.client = { disconnect: true };
      }
    }

    const updated = await this.prisma.constructionProject.update({ where: { id }, data });
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'UPDATE',
      entityType: 'ConstructionProject',
      entityId: id,
    });
    return updated;
  }

  async addStage(user: AuthUser, projectId: string, dto: CreateStageDto) {
    const project = await this.prisma.constructionProject.findFirst({ where: { id: projectId, ...orgWhere(user) } });
    if (!project) throw new NotFoundException();

    return this.prisma.constructionStage.create({
      data: {
        projectId,
        title: dto.title,
        sortOrder: dto.sortOrder ?? 0,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status ?? 'PENDING',
        budgetAmount: dto.budgetAmount,
        notes: dto.notes,
      },
    });
  }

  async updateStage(user: AuthUser, stageId: string, dto: UpdateStageDto) {
    const stage = await this.prisma.constructionStage.findFirst({
      where: { id: stageId, project: { organizationId: user.organizationId } },
    });
    if (!stage) throw new NotFoundException();

    const data: Prisma.ConstructionStageUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.budgetAmount !== undefined) data.budgetAmount = dto.budgetAmount;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.constructionStage.update({ where: { id: stageId }, data });
  }
}

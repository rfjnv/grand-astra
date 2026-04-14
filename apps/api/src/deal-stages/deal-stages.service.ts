import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DealType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateDealStageDto } from './dto/create-deal-stage.dto';
import type { UpdateDealStageDto } from './dto/update-deal-stage.dto';

@Injectable()
export class DealStagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Первая стадия воронки или явно выбранная; проверка org + dealType. */
  async resolveStageId(user: AuthUser, dealType: DealType, dealStageId?: string): Promise<string> {
    if (dealStageId) {
      const s = await this.prisma.dealStage.findFirst({
        where: { id: dealStageId, organizationId: user.organizationId, dealType },
      });
      if (!s) throw new BadRequestException('Этап не найден или не соответствует типу сделки');
      return s.id;
    }
    const first = await this.prisma.dealStage.findFirst({
      where: { organizationId: user.organizationId, dealType },
      orderBy: { sortOrder: 'asc' },
    });
    if (!first) throw new BadRequestException('Нет этапов воронки для этого типа сделки');
    return first.id;
  }

  list(user: AuthUser, dealType?: DealType) {
    return this.prisma.dealStage.findMany({
      where: {
        organizationId: user.organizationId,
        ...(dealType ? { dealType } : {}),
      },
      orderBy: [{ dealType: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async create(user: AuthUser, dto: CreateDealStageDto) {
    const max = await this.prisma.dealStage.aggregate({
      where: { organizationId: user.organizationId, dealType: dto.dealType },
      _max: { sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1;
    return this.prisma.dealStage.create({
      data: {
        organizationId: user.organizationId,
        dealType: dto.dealType,
        name: dto.name,
        sortOrder,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateDealStageDto) {
    const row = await this.prisma.dealStage.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException();
    return this.prisma.dealStage.update({
      where: { id },
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    const used = await this.prisma.deal.count({ where: { dealStageId: id } });
    if (used > 0) throw new BadRequestException('Этап используется в сделках');
    const row = await this.prisma.dealStage.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException();
    await this.prisma.dealStage.delete({ where: { id } });
  }
}

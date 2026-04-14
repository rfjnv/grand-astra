import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser) {
    return this.prisma.user.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: { select: { slug: true, name: true } },
        departmentId: true,
        isActive: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
      },
    });
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Пользователь с таким email уже есть');

    const role = await this.prisma.role.findFirst({
      where: { organizationId: actor.organizationId, slug: dto.roleSlug },
    });
    if (!role) throw new NotFoundException('Роль не найдена в организации');

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId: actor.organizationId },
      });
      if (!dept) throw new NotFoundException('Отдел не найден');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: role.id,
        organizationId: actor.organizationId,
        departmentId: dto.departmentId ?? null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: { select: { slug: true, name: true } },
        departmentId: true,
        createdAt: true,
      },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      userId: actor.userId,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, roleSlug: user.role.slug },
    });

    return user;
  }
}

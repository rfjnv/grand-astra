import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, take = 50) {
    return this.prisma.notification.findMany({
      where: { userId: user.userId, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
    });
  }

  async markRead(user: AuthUser, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId: user.userId, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException();
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.userId, organizationId: user.organizationId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user';
import type { PermissionKey } from '../common/permissions/permission-keys';
import { PermissionKeys } from '../common/permissions/permission-keys';

type JwtPayload = {
  sub: string;
  org: string;
  roleId: string;
  dept: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, organizationId: payload.org },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (!user) throw new UnauthorizedException();

    const permissionKeys: PermissionKey[] =
      user.role.slug === 'owner'
        ? [PermissionKeys.ALL]
        : user.role.permissions.map((rp) => rp.permission.key as PermissionKey);

    return {
      userId: user.id,
      organizationId: user.organizationId,
      departmentId: user.departmentId,
      roleId: user.roleId,
      roleSlug: user.role.slug,
      permissionKeys,
    };
  }
}

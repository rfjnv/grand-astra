import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionKeys } from '../common/permissions/permission-keys';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @RequirePermissions(PermissionKeys.PROPERTIES_READ)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: PropertyStatus) {
    return this.properties.list(user, status ? { status } : undefined);
  }

  @RequirePermissions(PermissionKeys.PROPERTIES_READ)
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.properties.getById(user, id);
  }

  @RequirePermissions(PermissionKeys.PROPERTIES_WRITE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto) {
    return this.properties.create(user, dto);
  }

  @RequirePermissions(PermissionKeys.PROPERTIES_WRITE)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.properties.update(user, id, dto);
  }
}

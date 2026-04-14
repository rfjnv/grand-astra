import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DealType } from '@prisma/client';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionKeys } from '../common/permissions/permission-keys';

@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @RequirePermissions(PermissionKeys.DEALS_READ)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('responsibleUserId') responsibleUserId?: string,
    @Query('dealStageId') dealStageId?: string,
    @Query('type') type?: DealType,
    @Query('updatedFrom') updatedFrom?: string,
    @Query('updatedTo') updatedTo?: string,
    @Query('openOnly') openOnly?: string,
  ) {
    return this.deals.list(user, {
      responsibleUserId,
      dealStageId,
      type,
      updatedFrom,
      updatedTo,
      openOnly: openOnly === 'true' || openOnly === '1',
    });
  }

  @RequirePermissions(PermissionKeys.DEALS_READ)
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deals.getById(user, id);
  }

  @RequirePermissions(PermissionKeys.DEALS_WRITE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDealDto) {
    return this.deals.create(user, dto);
  }

  @RequirePermissions(PermissionKeys.DEALS_WRITE)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDealDto) {
    return this.deals.update(user, id, dto);
  }
}

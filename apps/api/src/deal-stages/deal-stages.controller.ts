import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DealType } from '@prisma/client';
import { DealStagesService } from './deal-stages.service';
import { CreateDealStageDto } from './dto/create-deal-stage.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionKeys } from '../common/permissions/permission-keys';

@Controller('deal-stages')
export class DealStagesController {
  constructor(private readonly stages: DealStagesService) {}

  @RequirePermissions(PermissionKeys.DEALS_READ)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('dealType') dealType?: DealType) {
    return this.stages.list(user, dealType);
  }

  @RequirePermissions(PermissionKeys.DEAL_STAGES_MANAGE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDealStageDto) {
    return this.stages.create(user, dto);
  }

  @RequirePermissions(PermissionKeys.DEAL_STAGES_MANAGE)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDealStageDto) {
    return this.stages.update(user, id, dto);
  }

  @RequirePermissions(PermissionKeys.DEAL_STAGES_MANAGE)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stages.remove(user, id);
  }
}

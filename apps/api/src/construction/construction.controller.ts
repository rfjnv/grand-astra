import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ConstructionService } from './construction.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionKeys } from '../common/permissions/permission-keys';

@Controller('construction')
export class ConstructionController {
  constructor(private readonly construction: ConstructionService) {}

  @RequirePermissions(PermissionKeys.CONSTRUCTION_READ)
  @Get('projects')
  list(@CurrentUser() user: AuthUser) {
    return this.construction.listProjects(user);
  }

  @RequirePermissions(PermissionKeys.CONSTRUCTION_READ)
  @Get('projects/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.construction.getProject(user, id);
  }

  @RequirePermissions(PermissionKeys.CONSTRUCTION_WRITE)
  @Post('projects')
  createProject(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.construction.createProject(user, dto);
  }

  @RequirePermissions(PermissionKeys.CONSTRUCTION_WRITE)
  @Patch('projects/:id')
  updateProject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.construction.updateProject(user, id, dto);
  }

  @RequirePermissions(PermissionKeys.CONSTRUCTION_WRITE)
  @Post('projects/:id/stages')
  addStage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateStageDto) {
    return this.construction.addStage(user, id, dto);
  }

  @RequirePermissions(PermissionKeys.CONSTRUCTION_WRITE)
  @Patch('stages/:stageId')
  updateStage(@CurrentUser() user: AuthUser, @Param('stageId') stageId: string, @Body() dto: UpdateStageDto) {
    return this.construction.updateStage(user, stageId, dto);
  }
}

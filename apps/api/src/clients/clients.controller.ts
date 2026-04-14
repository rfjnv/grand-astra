import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionKeys } from '../common/permissions/permission-keys';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @RequirePermissions(PermissionKeys.CLIENTS_READ)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
  ) {
    return this.clients.list(user, { status, assignedUserId, createdFrom, createdTo });
  }

  @RequirePermissions(PermissionKeys.CLIENTS_READ)
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.getById(user, id);
  }

  @RequirePermissions(PermissionKeys.CLIENTS_WRITE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClientDto) {
    return this.clients.create(user, dto);
  }

  @RequirePermissions(PermissionKeys.CLIENTS_WRITE)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(user, id, dto);
  }

  @RequirePermissions(PermissionKeys.CLIENTS_WRITE)
  @Post(':id/interactions')
  addInteraction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateInteractionDto,
  ) {
    return this.clients.addInteraction(user, id, dto);
  }
}

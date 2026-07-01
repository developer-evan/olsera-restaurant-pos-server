import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '../rbac/constants/permissions.constant';
import {
  CurrentStoreContext,
} from '../rbac/decorators/current-store-context.decorator';
import {
  Permissions,
  PermissionScope,
} from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import type { StoreContextPayload } from '../rbac/types/rbac.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateStoreInviteDto } from '../invites/dto/create-store-invite.dto';
import { CreateStoreDto, UpdateStoreDto } from '../stores/dto/store.dto';
import type { SafeUser } from '../users/types/user.types';
import { TenantGuard } from './guards/tenant.guard';
import { TenantService } from './tenant.service';

@ApiTags('Stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('stores')
export class StoresController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @ApiOperation({
    summary: 'List stores for store switcher (includes role per store)',
  })
  listMyStores(@CurrentUser() user: SafeUser) {
    return this.tenantService.listMyStores(user.id);
  }

  @Post()
  @Permissions(Permission.STORES_CREATE)
  @PermissionScope({ orgIdBody: 'organizationId' })
  @ApiOperation({ summary: 'Create a new store under your organization' })
  createStore(@CurrentUser() user: SafeUser, @Body() dto: CreateStoreDto) {
    return this.tenantService.createStore(user.id, dto);
  }

  @Get(':storeId')
  @Permissions(Permission.STORES_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Get store details if you are a member' })
  getStore(@CurrentUser() user: SafeUser, @Param('storeId') storeId: string) {
    return this.tenantService.getStore(user.id, storeId);
  }

  @Patch(':storeId')
  @Permissions(Permission.STORES_UPDATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Update store settings (owners and managers)' })
  updateStore(
    @CurrentUser() user: SafeUser,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreDto,
    @CurrentStoreContext() context: StoreContextPayload,
  ) {
    return this.tenantService.updateStore(user.id, storeId, dto, context.role);
  }

  @Post(':storeId/invites')
  @Permissions(Permission.INVITES_CREATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Invite staff to a store (owners and managers)' })
  createInvite(
    @CurrentUser() user: SafeUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateStoreInviteDto,
  ) {
    return this.tenantService.createStoreInvite(user.id, storeId, dto);
  }

  @Get(':storeId/invites')
  @Permissions(Permission.INVITES_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'List pending invites for a store' })
  listInvites(
    @CurrentUser() user: SafeUser,
    @Param('storeId') storeId: string,
  ) {
    return this.tenantService.listStoreInvites(user.id, storeId);
  }
}

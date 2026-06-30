import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { STORE_ID_HEADER } from '../../common/constants/headers.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateStoreInviteDto } from '../invites/dto/create-store-invite.dto';
import { CreateStoreDto, UpdateStoreDto } from '../stores/dto/store.dto';
import type { SafeUser } from '../users/types/user.types';
import { TenantGuard } from './guards/tenant.guard';
import { TenantService } from './tenant.service';

@ApiTags('Stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
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
  @ApiOperation({ summary: 'Create a new store under your organization' })
  createStore(@CurrentUser() user: SafeUser, @Body() dto: CreateStoreDto) {
    return this.tenantService.createStore(user.id, dto);
  }

  @Get(':storeId')
  @ApiOperation({ summary: 'Get store details if you are a member' })
  @ApiHeader({
    name: STORE_ID_HEADER,
    required: false,
    description: 'Optional active store context header used by the dashboard',
  })
  getStore(@CurrentUser() user: SafeUser, @Param('storeId') storeId: string) {
    return this.tenantService.getStore(user.id, storeId);
  }

  @Patch(':storeId')
  @ApiOperation({ summary: 'Update store settings (store owners only)' })
  updateStore(
    @CurrentUser() user: SafeUser,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.tenantService.updateStore(user.id, storeId, dto);
  }

  @Post(':storeId/invites')
  @ApiOperation({ summary: 'Invite staff to a store (store owners only)' })
  createInvite(
    @CurrentUser() user: SafeUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateStoreInviteDto,
  ) {
    return this.tenantService.createStoreInvite(user.id, storeId, dto);
  }

  @Get(':storeId/invites')
  @ApiOperation({ summary: 'List pending invites for a store' })
  listInvites(
    @CurrentUser() user: SafeUser,
    @Param('storeId') storeId: string,
  ) {
    return this.tenantService.listStoreInvites(user.id, storeId);
  }
}

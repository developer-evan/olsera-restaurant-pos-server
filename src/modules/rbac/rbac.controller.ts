import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { STORE_ID_HEADER } from '../../common/constants/headers.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import { Permission } from './constants/permissions.constant';
import { CurrentStoreContext } from './decorators/current-store-context.decorator';
import {
  Permissions,
  PermissionScope,
} from './decorators/permissions.decorator';
import { PermissionsGuard } from './guards/permissions.guard';
import type { StoreContextPayload } from './types/rbac.types';

@ApiTags('RBAC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('stores/:storeId')
export class RbacController {
  @Get('access-context')
  @Permissions(Permission.STORES_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({
    summary: 'Get active store context and permissions for the dashboard',
  })
  @ApiHeader({
    name: STORE_ID_HEADER,
    required: false,
    description: 'Optional — should match :storeId for the active store',
  })
  getAccessContext(@CurrentStoreContext() context: StoreContextPayload) {
    return context;
  }
}

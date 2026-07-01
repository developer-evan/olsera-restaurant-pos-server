import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '../rbac/constants/permissions.constant';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../users/types/user.types';
import { TenantGuard } from './guards/tenant.guard';
import { TenantService } from './tenant.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('me')
  @Permissions(Permission.ORGANIZATIONS_READ)
  @ApiOperation({ summary: 'List organizations the current user belongs to' })
  getMyOrganizations(@CurrentUser() user: SafeUser) {
    return this.tenantService.getMyOrganizations(user.id);
  }
}

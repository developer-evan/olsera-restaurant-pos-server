import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PlatformPermission } from '../rbac/constants/permissions.constant';
import { PlatformPermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
import { PlatformService } from './platform.service';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Post('onboarding')
  @PlatformPermissions(
    PlatformPermission.ONBOARDING_CREATE,
    PlatformPermission.ORGANIZATIONS_CREATE,
  )
  @ApiOperation({
    summary: 'Onboard a tenant (owner + organization + first store)',
  })
  onboardTenant(@Body() dto: OnboardTenantDto) {
    return this.platformService.onboardTenant(dto);
  }

  @Get('organizations')
  @PlatformPermissions(PlatformPermission.ORGANIZATIONS_READ)
  @ApiOperation({ summary: 'List all tenant organizations' })
  listOrganizations() {
    return this.platformService.listOrganizations();
  }
}

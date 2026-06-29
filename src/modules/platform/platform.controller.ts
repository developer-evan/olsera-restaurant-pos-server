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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
import { PlatformGuard } from './guards/platform.guard';
import { PlatformService } from './platform.service';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Post('onboarding')
  @ApiOperation({
    summary: 'Onboard a tenant (owner + organization + first store)',
  })
  onboardTenant(@Body() dto: OnboardTenantDto) {
    return this.platformService.onboardTenant(dto);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List all tenant organizations' })
  listOrganizations() {
    return this.platformService.listOrganizations();
  }
}

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permission } from '../rbac/constants/permissions.constant';
import {
  Permissions,
  PermissionScope,
} from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsOverviewQueryDto,
  AnalyticsRangeQueryDto,
  TopProductsQueryDto,
} from './dto/analytics.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('stores/:storeId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @Permissions(Permission.ANALYTICS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Get daily sales overview for a store' })
  overview(
    @Param('storeId') storeId: string,
    @Query() query: AnalyticsOverviewQueryDto,
  ) {
    return this.analyticsService.getOverview(storeId, query);
  }

  @Get('sales-by-day')
  @Permissions(Permission.ANALYTICS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Get sales chart data grouped by day' })
  salesByDay(
    @Param('storeId') storeId: string,
    @Query() query: AnalyticsRangeQueryDto,
  ) {
    return this.analyticsService.getSalesByDay(storeId, query);
  }

  @Get('top-products')
  @Permissions(Permission.ANALYTICS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Get top-selling products by revenue' })
  topProducts(
    @Param('storeId') storeId: string,
    @Query() query: TopProductsQueryDto,
  ) {
    return this.analyticsService.getTopProducts(storeId, query);
  }
}

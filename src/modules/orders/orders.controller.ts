import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../users/types/user.types';
import { Permission } from '../rbac/constants/permissions.constant';
import { CurrentStoreContext } from '../rbac/decorators/current-store-context.decorator';
import {
  Permissions,
  PermissionScope,
} from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import type { StoreContextPayload } from '../rbac/types/rbac.types';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import {
  CreateOrderDto,
  ListOrdersQueryDto,
  UpdateOrderItemsDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('stores/:storeId/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Permissions(Permission.ORDERS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'List orders for a store' })
  list(
    @Param('storeId') storeId: string,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.findAllForStore(storeId, query);
  }

  @Post()
  @Permissions(Permission.ORDERS_CREATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Create a draft or open order' })
  create(
    @Param('storeId') storeId: string,
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: SafeUser,
    @CurrentStoreContext() context: StoreContextPayload,
  ) {
    return this.ordersService
      .create({
        ...dto,
        storeId,
        organizationId: context.organizationId,
        createdBy: user.id,
      })
      .then((order) => this.ordersService.toResponse(order));
  }

  @Get(':orderId')
  @Permissions(Permission.ORDERS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Get an order by id' })
  getOne(
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService
      .findByIdForStore(storeId, orderId)
      .then((order) => this.ordersService.toResponse(order));
  }

  @Patch(':orderId/items')
  @Permissions(Permission.ORDERS_UPDATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Replace order line items and recalculate totals' })
  updateItems(
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderItemsDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.ordersService
      .updateItems(storeId, orderId, dto, user.id)
      .then((order) => this.ordersService.toResponse(order));
  }

  @Patch(':orderId/status')
  @Permissions(Permission.ORDERS_UPDATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.ordersService
      .updateStatus(storeId, orderId, dto, user.id)
      .then((order) => this.ordersService.toResponse(order));
  }
}

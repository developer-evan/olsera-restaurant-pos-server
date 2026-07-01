import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  ListTransactionsQueryDto,
  PayOrderDto,
  RefundTransactionDto,
} from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('stores/:storeId')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('orders/:orderId/pay')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.TRANSACTIONS_CREATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Pay an order and create a transaction' })
  payOrder(
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
    @Body() dto: PayOrderDto,
    @CurrentUser() user: SafeUser,
    @CurrentStoreContext() context: StoreContextPayload,
  ) {
    return this.transactionsService.payOrder({
      ...dto,
      storeId,
      organizationId: context.organizationId,
      orderId,
      createdBy: user.id,
    });
  }

  @Get('transactions')
  @Permissions(Permission.TRANSACTIONS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'List transactions for a store' })
  list(
    @Param('storeId') storeId: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactionsService.findAllForStore(storeId, query);
  }

  @Get('transactions/:transactionId')
  @Permissions(Permission.TRANSACTIONS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Get a transaction by id' })
  getOne(
    @Param('storeId') storeId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionsService
      .findByIdForStore(storeId, transactionId)
      .then((transaction) => this.transactionsService.toResponse(transaction));
  }

  @Post('transactions/:transactionId/refund')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.TRANSACTIONS_REFUND)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Refund a completed transaction' })
  refund(
    @Param('storeId') storeId: string,
    @Param('transactionId') transactionId: string,
    @Body() _dto: RefundTransactionDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.transactionsService
      .refund(storeId, transactionId, user.id)
      .then((transaction) => this.transactionsService.toResponse(transaction));
  }
}

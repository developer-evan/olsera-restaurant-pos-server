import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  CreatePromoDto,
  ListPromosQueryDto,
  UpdatePromoDto,
  ValidatePromoDto,
} from './dto/promo.dto';
import { PromosService } from './promos.service';

@ApiTags('Promos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('stores/:storeId/promos')
export class PromosController {
  constructor(private readonly promosService: PromosService) {}

  @Get()
  @Permissions(Permission.PROMOS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'List promos for a store' })
  list(
    @Param('storeId') storeId: string,
    @Query() query: ListPromosQueryDto,
  ) {
    return this.promosService
      .findAllForStore(storeId, query.active)
      .then((promos) => promos.map((promo) => this.promosService.toResponse(promo)));
  }

  @Post()
  @Permissions(Permission.PROMOS_CREATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Create a promo' })
  create(
    @Param('storeId') storeId: string,
    @Body() dto: CreatePromoDto,
    @CurrentUser() user: SafeUser,
    @CurrentStoreContext() context: StoreContextPayload,
  ) {
    return this.promosService
      .create({
        ...dto,
        storeId,
        organizationId: context.organizationId,
        createdBy: user.id,
      })
      .then((promo) => this.promosService.toResponse(promo));
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.ORDERS_CREATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Validate a promo code against a cart subtotal' })
  validate(
    @Param('storeId') storeId: string,
    @Body() dto: ValidatePromoDto,
  ) {
    return this.promosService.validatePromo(storeId, dto.code, dto.subtotal);
  }

  @Get(':promoId')
  @Permissions(Permission.PROMOS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Get a promo by id' })
  getOne(
    @Param('storeId') storeId: string,
    @Param('promoId') promoId: string,
  ) {
    return this.promosService
      .findByIdForStore(storeId, promoId)
      .then((promo) => this.promosService.toResponse(promo));
  }

  @Patch(':promoId')
  @Permissions(Permission.PROMOS_UPDATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Update a promo' })
  update(
    @Param('storeId') storeId: string,
    @Param('promoId') promoId: string,
    @Body() dto: UpdatePromoDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.promosService
      .update(storeId, promoId, dto, user.id)
      .then((promo) => this.promosService.toResponse(promo));
  }

  @Delete(':promoId')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.PROMOS_DELETE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Soft-delete a promo' })
  async remove(
    @Param('storeId') storeId: string,
    @Param('promoId') promoId: string,
    @CurrentUser() user: SafeUser,
  ) {
    await this.promosService.softDelete(storeId, promoId, user.id);
    return { message: 'Promo deleted successfully' };
  }
}

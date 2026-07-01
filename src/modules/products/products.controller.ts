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
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('stores/:storeId/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions(Permission.PRODUCTS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'List products for a store' })
  list(
    @Param('storeId') storeId: string,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.productsService
      .findAllForStore(storeId, {
        active: query.active,
        categoryId: query.categoryId,
      })
      .then((products) =>
        products.map((product) => this.productsService.toResponse(product)),
      );
  }

  @Post()
  @Permissions(Permission.PRODUCTS_CREATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Create a product' })
  create(
    @Param('storeId') storeId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user: SafeUser,
    @CurrentStoreContext() context: StoreContextPayload,
  ) {
    return this.productsService
      .create({
        ...dto,
        storeId,
        organizationId: context.organizationId,
        createdBy: user.id,
      })
      .then((product) => this.productsService.toResponse(product));
  }

  @Get(':productId')
  @Permissions(Permission.PRODUCTS_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Get a product by id' })
  getOne(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService
      .findByIdForStore(storeId, productId)
      .then((product) => this.productsService.toResponse(product));
  }

  @Patch(':productId')
  @Permissions(Permission.PRODUCTS_UPDATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Update a product' })
  update(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.productsService
      .update(storeId, productId, dto, user.id)
      .then((product) => this.productsService.toResponse(product));
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.PRODUCTS_DELETE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Soft-delete a product' })
  async remove(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: SafeUser,
  ) {
    await this.productsService.softDelete(storeId, productId, user.id);
    return { message: 'Product deleted successfully' };
  }
}

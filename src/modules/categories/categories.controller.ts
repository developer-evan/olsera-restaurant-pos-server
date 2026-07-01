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
import { Permission } from '../rbac/constants/permissions.constant';
import type { StoreContextPayload } from '../rbac/types/rbac.types';
import { CurrentStoreContext } from '../rbac/decorators/current-store-context.decorator';
import {
  Permissions,
  PermissionScope,
} from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../users/types/user.types';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('stores/:storeId/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Permissions(Permission.CATEGORIES_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'List categories for a store' })
  list(
    @Param('storeId') storeId: string,
    @Query() query: ListCategoriesQueryDto,
  ) {
    return this.categoriesService
      .findAllForStore(storeId, query.active)
      .then((categories) => categories.map((c) => this.categoriesService.toResponse(c)));
  }

  @Post()
  @Permissions(Permission.CATEGORIES_CREATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Create a category' })
  create(
    @Param('storeId') storeId: string,
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: SafeUser,
    @CurrentStoreContext() context: StoreContextPayload,
  ) {
    return this.categoriesService
      .create({
        ...dto,
        storeId,
        organizationId: context.organizationId,
        createdBy: user.id,
      })
      .then((category) => this.categoriesService.toResponse(category));
  }

  @Get(':categoryId')
  @Permissions(Permission.CATEGORIES_READ)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Get a category by id' })
  getOne(
    @Param('storeId') storeId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.categoriesService
      .findByIdForStore(storeId, categoryId)
      .then((category) => this.categoriesService.toResponse(category));
  }

  @Patch(':categoryId')
  @Permissions(Permission.CATEGORIES_UPDATE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Update a category' })
  update(
    @Param('storeId') storeId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.categoriesService
      .update(storeId, categoryId, dto, user.id)
      .then((category) => this.categoriesService.toResponse(category));
  }

  @Delete(':categoryId')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.CATEGORIES_DELETE)
  @PermissionScope({ storeIdParam: 'storeId' })
  @ApiOperation({ summary: 'Soft-delete a category' })
  async remove(
    @Param('storeId') storeId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: SafeUser,
  ) {
    await this.categoriesService.softDelete(storeId, categoryId, user.id);
    return { message: 'Category deleted successfully' };
  }
}

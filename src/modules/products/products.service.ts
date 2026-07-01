import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { buildUniqueSlug } from '../../common/utils/slug.util';
import { CategoriesService } from '../categories/categories.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { Product, ProductDocument } from './schemas/product.schema';

export type CreateProductInput = CreateProductDto & {
  storeId: string;
  organizationId: string;
  createdBy?: string;
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(input: CreateProductInput): Promise<ProductDocument> {
    await this.assertCategoryInStore(input.storeId, input.categoryId);

    const slug = await buildUniqueSlug(input.name, (value) =>
      this.productModel
        .exists({ storeId: input.storeId, slug: value, deletedAt: null })
        .then(Boolean),
    );

    try {
      const [product] = await this.productModel.create([
        {
          storeId: new Types.ObjectId(input.storeId),
          organizationId: new Types.ObjectId(input.organizationId),
          categoryId: new Types.ObjectId(input.categoryId),
          name: input.name,
          slug,
          description: input.description ?? '',
          sku: input.sku ?? null,
          price: input.price,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          createdBy: input.createdBy
            ? new Types.ObjectId(input.createdBy)
            : null,
        },
      ]);

      return product;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Product slug already exists in this store');
      }
      throw error;
    }
  }

  async findAllForStore(
    storeId: string,
    filters?: { active?: boolean; categoryId?: string },
  ): Promise<ProductDocument[]> {
    const query: Record<string, unknown> = {
      storeId: new Types.ObjectId(storeId),
      deletedAt: null,
    };

    if (filters?.active !== undefined) {
      query.isActive = filters.active;
    }

    if (filters?.categoryId) {
      query.categoryId = new Types.ObjectId(filters.categoryId);
    }

    return this.productModel
      .find(query)
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findByIdForStore(
    storeId: string,
    productId: string,
  ): Promise<ProductDocument> {
    const product = await this.productModel
      .findOne({
        _id: productId,
        storeId: new Types.ObjectId(storeId),
        deletedAt: null,
      })
      .exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(
    storeId: string,
    productId: string,
    dto: UpdateProductDto,
    updatedBy?: string,
  ): Promise<ProductDocument> {
    const product = await this.findByIdForStore(storeId, productId);
    const updates: Partial<Product> = {
      updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : null,
    };

    if (dto.categoryId !== undefined) {
      await this.assertCategoryInStore(storeId, dto.categoryId);
      updates.categoryId = new Types.ObjectId(dto.categoryId);
    }

    if (dto.name !== undefined) {
      updates.name = dto.name;
      updates.slug = await buildUniqueSlug(dto.name, (value) =>
        this.productModel
          .exists({
            storeId: new Types.ObjectId(storeId),
            slug: value,
            deletedAt: null,
            _id: { $ne: product._id },
          })
          .then(Boolean),
      );
    }

    if (dto.description !== undefined) {
      updates.description = dto.description;
    }

    if (dto.sku !== undefined) {
      updates.sku = dto.sku;
    }

    if (dto.price !== undefined) {
      updates.price = dto.price;
    }

    if (dto.sortOrder !== undefined) {
      updates.sortOrder = dto.sortOrder;
    }

    if (dto.isActive !== undefined) {
      updates.isActive = dto.isActive;
    }

    try {
      const updated = await this.productModel
        .findOneAndUpdate(
          {
            _id: product._id,
            storeId: new Types.ObjectId(storeId),
            deletedAt: null,
          },
          updates,
          { new: true },
        )
        .exec();

      if (!updated) {
        throw new NotFoundException('Product not found');
      }

      return updated;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Product slug already exists in this store');
      }
      throw error;
    }
  }

  async softDelete(
    storeId: string,
    productId: string,
    updatedBy?: string,
  ): Promise<void> {
    await this.findByIdForStore(storeId, productId);

    await this.productModel
      .updateOne(
        {
          _id: productId,
          storeId: new Types.ObjectId(storeId),
          deletedAt: null,
        },
        {
          deletedAt: new Date(),
          isActive: false,
          updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : null,
        },
      )
      .exec();
  }

  toResponse(product: ProductDocument) {
    return {
      id: product._id.toString(),
      storeId: product.storeId.toString(),
      organizationId: product.organizationId.toString(),
      categoryId: product.categoryId.toString(),
      name: product.name,
      slug: product.slug,
      description: product.description,
      sku: product.sku,
      price: product.price,
      sortOrder: product.sortOrder,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private async assertCategoryInStore(
    storeId: string,
    categoryId: string,
  ): Promise<void> {
    try {
      await this.categoriesService.findByIdForStore(storeId, categoryId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException('Category not found in this store');
      }
      throw error;
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }
}

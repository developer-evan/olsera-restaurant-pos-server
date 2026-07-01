import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { buildUniqueSlug } from '../../common/utils/slug.util';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Category, CategoryDocument } from './schemas/category.schema';

export type CreateCategoryInput = CreateCategoryDto & {
  storeId: string;
  organizationId: string;
  createdBy?: string;
};

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
  ) {}

  async create(input: CreateCategoryInput): Promise<CategoryDocument> {
    const slug = await buildUniqueSlug(input.name, (value) =>
      this.categoryModel
        .exists({ storeId: input.storeId, slug: value, deletedAt: null })
        .then(Boolean),
    );

    try {
      const [category] = await this.categoryModel.create([
        {
          storeId: new Types.ObjectId(input.storeId),
          organizationId: new Types.ObjectId(input.organizationId),
          name: input.name,
          slug,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          createdBy: input.createdBy
            ? new Types.ObjectId(input.createdBy)
            : null,
        },
      ]);

      return category;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'Category slug already exists in this store',
        );
      }
      throw error;
    }
  }

  async findAllForStore(
    storeId: string,
    active?: boolean,
  ): Promise<CategoryDocument[]> {
    const filter: Record<string, unknown> = {
      storeId: new Types.ObjectId(storeId),
      deletedAt: null,
    };

    if (active !== undefined) {
      filter.isActive = active;
    }

    return this.categoryModel
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findByIdForStore(
    storeId: string,
    categoryId: string,
  ): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne({
        _id: categoryId,
        storeId: new Types.ObjectId(storeId),
        deletedAt: null,
      })
      .exec();

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    storeId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
    updatedBy?: string,
  ): Promise<CategoryDocument> {
    const category = await this.findByIdForStore(storeId, categoryId);
    const updates: Partial<Category> = {
      updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : null,
    };

    if (dto.name !== undefined) {
      updates.name = dto.name;
      updates.slug = await buildUniqueSlug(dto.name, (value) =>
        this.categoryModel
          .exists({
            storeId,
            slug: value,
            deletedAt: null,
            _id: { $ne: category._id },
          })
          .then(Boolean),
      );
    }

    if (dto.sortOrder !== undefined) {
      updates.sortOrder = dto.sortOrder;
    }

    if (dto.isActive !== undefined) {
      updates.isActive = dto.isActive;
    }

    try {
      const updated = await this.categoryModel
        .findOneAndUpdate(
          { _id: category._id, storeId: new Types.ObjectId(storeId), deletedAt: null },
          updates,
          { new: true },
        )
        .exec();

      if (!updated) {
        throw new NotFoundException('Category not found');
      }

      return updated;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'Category slug already exists in this store',
        );
      }
      throw error;
    }
  }

  async softDelete(
    storeId: string,
    categoryId: string,
    updatedBy?: string,
  ): Promise<void> {
    await this.findByIdForStore(storeId, categoryId);

    await this.categoryModel
      .updateOne(
        {
          _id: categoryId,
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

  toResponse(category: CategoryDocument) {
    return {
      id: category._id.toString(),
      storeId: category.storeId.toString(),
      organizationId: category.organizationId.toString(),
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
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

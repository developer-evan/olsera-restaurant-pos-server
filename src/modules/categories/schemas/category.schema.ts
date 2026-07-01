import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applySoftDeleteFilter } from '../../../database/schemas/base.schema';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null, index: true })
  deletedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ storeId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ storeId: 1, sortOrder: 1 });
applySoftDeleteFilter(CategorySchema);

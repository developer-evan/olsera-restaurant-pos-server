import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applySoftDeleteFilter } from '../../../database/schemas/base.schema';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: String, trim: true, default: null })
  sku?: string | null;

  @Prop({ required: true, min: 0 })
  price: number;

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

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ storeId: 1, slug: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, categoryId: 1, sortOrder: 1 });
applySoftDeleteFilter(ProductSchema);

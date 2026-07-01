import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applySoftDeleteFilter } from '../../../database/schemas/base.schema';
import { PromoType } from '../enums/promo.enum';

export type PromoDocument = HydratedDocument<Promo>;

@Schema({ timestamps: true, collection: 'promos' })
export class Promo {
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, enum: PromoType, required: true })
  type: PromoType;

  @Prop({ required: true, min: 0 })
  value: number;

  @Prop({ default: 0, min: 0 })
  minOrderAmount: number;

  @Prop({ type: Number, default: null, min: 1 })
  maxUses?: number | null;

  @Prop({ default: 0, min: 0 })
  usedCount: number;

  @Prop({ type: Date, default: null })
  startsAt?: Date | null;

  @Prop({ type: Date, default: null })
  endsAt?: Date | null;

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

export const PromoSchema = SchemaFactory.createForClass(Promo);

PromoSchema.index({ storeId: 1, code: 1 }, { unique: true });
PromoSchema.index({ storeId: 1, isActive: 1, startsAt: 1, endsAt: 1 });
applySoftDeleteFilter(PromoSchema);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { StoreStatus } from '../../organizations/enums/organization.enum';

export type StoreDocument = HydratedDocument<Store>;

@Schema({ timestamps: true, collection: 'stores' })
export class Store {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ default: 'UTC' })
  timezone: string;

  @Prop({
    type: String,
    enum: StoreStatus,
    default: StoreStatus.ACTIVE,
  })
  status: StoreStatus;

  createdAt?: Date;
  updatedAt?: Date;
}

export const StoreSchema = SchemaFactory.createForClass(Store);

StoreSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

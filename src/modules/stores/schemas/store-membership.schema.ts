import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { StoreMemberRole } from '../../organizations/enums/organization.enum';

export type StoreMembershipDocument = HydratedDocument<StoreMembership>;

@Schema({ timestamps: true, collection: 'store_memberships' })
export class StoreMembership {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId: Types.ObjectId;

  @Prop({
    type: String,
    enum: StoreMemberRole,
    required: true,
  })
  role: StoreMemberRole;
}

export const StoreMembershipSchema =
  SchemaFactory.createForClass(StoreMembership);

StoreMembershipSchema.index({ userId: 1, storeId: 1 }, { unique: true });

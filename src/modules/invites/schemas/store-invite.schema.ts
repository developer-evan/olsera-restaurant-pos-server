import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { StoreMemberRole } from '../../organizations/enums/organization.enum';

export type StoreInviteDocument = HydratedDocument<StoreInvite>;

@Schema({ timestamps: true, collection: 'store_invites' })
export class StoreInvite {
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId: Types.ObjectId;

  @Prop({ type: String, enum: StoreMemberRole, required: true })
  role: StoreMemberRole;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy: Types.ObjectId;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  acceptedAt?: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const StoreInviteSchema = SchemaFactory.createForClass(StoreInvite);

StoreInviteSchema.index({ email: 1, storeId: 1, acceptedAt: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  PaymentMethod,
  TransactionStatus,
} from '../enums/transaction.enum';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true, collection: 'transactions' })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  orderNumber: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  method: PaymentMethod;

  @Prop({
    type: String,
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
    index: true,
  })
  status: TransactionStatus;

  @Prop({ required: true, trim: true })
  idempotencyKey: string;

  @Prop({ type: String, default: null })
  externalRef?: string | null;

  @Prop({ type: Date, default: null })
  processedAt?: Date | null;

  @Prop({ type: Date, default: null })
  refundedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.index({ storeId: 1, idempotencyKey: 1 }, { unique: true });
TransactionSchema.index({ storeId: 1, orderId: 1, status: 1 });
TransactionSchema.index({ storeId: 1, method: 1, createdAt: -1 });
TransactionSchema.index({ storeId: 1, status: 1, createdAt: -1 });

import { Prop, Schema } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export abstract class BaseSchema {
  @Prop({ type: Date, default: null, index: true })
  deletedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId | null;
}

export function applySoftDeleteFilter(schema: MongooseSchema): void {
  schema.pre('find', function excludeSoftDeleted() {
    this.where({ deletedAt: null });
  });

  schema.pre('findOne', function excludeSoftDeleted() {
    this.where({ deletedAt: null });
  });

  schema.pre('countDocuments', function excludeSoftDeleted() {
    this.where({ deletedAt: null });
  });
}

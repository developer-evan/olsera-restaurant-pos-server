import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PromoType } from './enums/promo.enum';
import { CreatePromoDto, UpdatePromoDto } from './dto/promo.dto';
import { Promo, PromoDocument } from './schemas/promo.schema';

export type CreatePromoInput = CreatePromoDto & {
  storeId: string;
  organizationId: string;
  createdBy?: string;
};

export type ValidatePromoResult = {
  promo: ReturnType<PromosService['toResponse']>;
  discountAmount: number;
  subtotal: number;
  totalAfterDiscount: number;
};

@Injectable()
export class PromosService {
  constructor(
    @InjectModel(Promo.name)
    private readonly promoModel: Model<Promo>,
  ) {}

  async create(input: CreatePromoInput): Promise<PromoDocument> {
    this.validatePromoValue(input.type, input.value);
    this.validateDateRange(input.startsAt, input.endsAt);

    try {
      const [promo] = await this.promoModel.create([
        {
          storeId: new Types.ObjectId(input.storeId),
          organizationId: new Types.ObjectId(input.organizationId),
          name: input.name,
          code: input.code.toUpperCase().trim(),
          type: input.type,
          value: input.value,
          minOrderAmount: input.minOrderAmount ?? 0,
          maxUses: input.maxUses ?? null,
          usedCount: 0,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          isActive: input.isActive ?? true,
          createdBy: input.createdBy
            ? new Types.ObjectId(input.createdBy)
            : null,
        },
      ]);

      return promo;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Promo code already exists in this store');
      }
      throw error;
    }
  }

  async findAllForStore(
    storeId: string,
    active?: boolean,
  ): Promise<PromoDocument[]> {
    const filter: Record<string, unknown> = {
      storeId: new Types.ObjectId(storeId),
      deletedAt: null,
    };

    if (active !== undefined) {
      filter.isActive = active;
    }

    return this.promoModel.find(filter).sort({ name: 1 }).exec();
  }

  async findByIdForStore(
    storeId: string,
    promoId: string,
  ): Promise<PromoDocument> {
    const promo = await this.promoModel
      .findOne({
        _id: promoId,
        storeId: new Types.ObjectId(storeId),
        deletedAt: null,
      })
      .exec();

    if (!promo) {
      throw new NotFoundException('Promo not found');
    }

    return promo;
  }

  async findByCodeForStore(
    storeId: string,
    code: string,
  ): Promise<PromoDocument | null> {
    return this.promoModel
      .findOne({
        storeId: new Types.ObjectId(storeId),
        code: code.toUpperCase().trim(),
        deletedAt: null,
      })
      .exec();
  }

  async update(
    storeId: string,
    promoId: string,
    dto: UpdatePromoDto,
    updatedBy?: string,
  ): Promise<PromoDocument> {
    const promo = await this.findByIdForStore(storeId, promoId);
    const type = dto.type ?? promo.type;
    const value = dto.value ?? promo.value;

    if (dto.type !== undefined || dto.value !== undefined) {
      this.validatePromoValue(type, value);
    }

    const startsAt = dto.startsAt !== undefined ? dto.startsAt : promo.startsAt;
    const endsAt = dto.endsAt !== undefined ? dto.endsAt : promo.endsAt;
    this.validateDateRange(startsAt, endsAt);

    const updates: Partial<Promo> = {
      updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : null,
    };

    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.code !== undefined) updates.code = dto.code.toUpperCase().trim();
    if (dto.type !== undefined) updates.type = dto.type;
    if (dto.value !== undefined) updates.value = dto.value;
    if (dto.minOrderAmount !== undefined) {
      updates.minOrderAmount = dto.minOrderAmount;
    }
    if (dto.maxUses !== undefined) updates.maxUses = dto.maxUses;
    if (dto.startsAt !== undefined) updates.startsAt = dto.startsAt;
    if (dto.endsAt !== undefined) updates.endsAt = dto.endsAt;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;

    try {
      const updated = await this.promoModel
        .findOneAndUpdate(
          {
            _id: promo._id,
            storeId: new Types.ObjectId(storeId),
            deletedAt: null,
          },
          updates,
          { new: true },
        )
        .exec();

      if (!updated) {
        throw new NotFoundException('Promo not found');
      }

      return updated;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Promo code already exists in this store');
      }
      throw error;
    }
  }

  async softDelete(
    storeId: string,
    promoId: string,
    updatedBy?: string,
  ): Promise<void> {
    await this.findByIdForStore(storeId, promoId);

    await this.promoModel
      .updateOne(
        {
          _id: promoId,
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

  async validatePromo(
    storeId: string,
    code: string,
    subtotal: number,
  ): Promise<ValidatePromoResult> {
    const promo = await this.findByCodeForStore(storeId, code);

    if (!promo) {
      throw new BadRequestException('Promo code not found');
    }

    this.assertPromoApplicable(promo, subtotal);

    const discountAmount = this.calculateDiscount(promo, subtotal);

    return {
      promo: this.toResponse(promo),
      discountAmount,
      subtotal,
      totalAfterDiscount: this.roundCurrency(subtotal - discountAmount),
    };
  }

  async incrementUsedCount(storeId: string, promoId: string): Promise<void> {
    await this.promoModel
      .updateOne(
        {
          _id: promoId,
          storeId: new Types.ObjectId(storeId),
          deletedAt: null,
        },
        { $inc: { usedCount: 1 } },
      )
      .exec();
  }

  toResponse(promo: PromoDocument) {
    return {
      id: promo._id.toString(),
      storeId: promo.storeId.toString(),
      organizationId: promo.organizationId.toString(),
      name: promo.name,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      minOrderAmount: promo.minOrderAmount,
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
      startsAt: promo.startsAt,
      endsAt: promo.endsAt,
      isActive: promo.isActive,
      createdAt: promo.createdAt,
      updatedAt: promo.updatedAt,
    };
  }

  private assertPromoApplicable(promo: PromoDocument, subtotal: number): void {
    if (!promo.isActive) {
      throw new BadRequestException('Promo is not active');
    }

    const now = new Date();

    if (promo.startsAt && now < promo.startsAt) {
      throw new BadRequestException('Promo is not yet active');
    }

    if (promo.endsAt && now > promo.endsAt) {
      throw new BadRequestException('Promo has expired');
    }

    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
      throw new BadRequestException('Promo usage limit reached');
    }

    if (subtotal < promo.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount of ${promo.minOrderAmount} required`,
      );
    }
  }

  private calculateDiscount(promo: PromoDocument, subtotal: number): number {
    if (promo.type === PromoType.PERCENTAGE) {
      return this.roundCurrency(subtotal * (promo.value / 100));
    }

    return this.roundCurrency(Math.min(promo.value, subtotal));
  }

  private validatePromoValue(type: PromoType, value: number): void {
    if (type === PromoType.PERCENTAGE && (value <= 0 || value > 100)) {
      throw new BadRequestException(
        'Percentage value must be greater than 0 and at most 100',
      );
    }

    if (type === PromoType.FIXED && value <= 0) {
      throw new BadRequestException('Fixed discount value must be greater than 0');
    }
  }

  private validateDateRange(
    startsAt?: Date | null,
    endsAt?: Date | null,
  ): void {
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
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

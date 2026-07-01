import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PromoType } from '../enums/promo.enum';

export class CreatePromoDto {
  @ApiProperty({ example: 'Summer Sale' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  code: string;

  @ApiProperty({ enum: PromoType, example: PromoType.PERCENTAGE })
  @IsEnum(PromoType)
  type: PromoType;

  @ApiProperty({ example: 20, description: 'Percentage (0-100) or fixed amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @ApiPropertyOptional({ example: '2026-08-31T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromoDto {
  @ApiPropertyOptional({ example: 'Summer Sale Extended' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'SUMMER25' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  code?: string;

  @ApiPropertyOptional({ enum: PromoType })
  @IsOptional()
  @IsEnum(PromoType)
  type?: PromoType;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListPromosQueryDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}

export class ValidatePromoDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  code: string;

  @ApiProperty({ example: 50 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal: number;
}

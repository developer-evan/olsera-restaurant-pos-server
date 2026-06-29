import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OnboardOwnerDto {
  @ApiProperty({ example: 'owner@alicoffee.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'OwnerPass123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Ali' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Hassan' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;
}

export class OnboardOrganizationDto {
  @ApiProperty({ example: 'Ali Coffee Group' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}

export class OnboardStoreDto {
  @ApiProperty({ example: 'Ali Coffee & Eatery' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Africa/Nairobi' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}

export class OnboardTenantDto {
  @ApiProperty({ type: OnboardOwnerDto })
  @ValidateNested()
  @Type(() => OnboardOwnerDto)
  owner: OnboardOwnerDto;

  @ApiProperty({ type: OnboardOrganizationDto })
  @ValidateNested()
  @Type(() => OnboardOrganizationDto)
  organization: OnboardOrganizationDto;

  @ApiProperty({ type: OnboardStoreDto })
  @ValidateNested()
  @Type(() => OnboardStoreDto)
  store: OnboardStoreDto;
}

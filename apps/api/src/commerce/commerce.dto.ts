import { Type } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InventoryFeedDto {
  @IsUUID('4')
  variantId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  facilityId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  source!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  externalKey!: string;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  quantity!: number;
}

export class CreateCartDto {
  @IsUUID('4')
  storeId!: string;
}

export class AddCartLineDto {
  @IsUUID('4')
  offerId!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;
}

export class UpdateCartLineDto {
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;
}

export class QuoteCartDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  promotionCode?: string;
}

export class CreatePromotionDto {
  @IsUUID('4')
  storeId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsIn(['PERCENTAGE', 'FIXED'])
  kind!: 'PERCENTAGE' | 'FIXED';

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  value!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  minimumMinor?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;
}

export class AddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  recipient!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(240)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  line2?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  postalCode!: string;

  @Matches(/^[A-Z]{2}$/u)
  countryCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class CreateAddressDto extends AddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;
}

export class CheckoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  promotionCode?: string;

  @IsString()
  @Matches(/^tok_[A-Za-z0-9_-]{8,120}$/u)
  paymentToken!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}

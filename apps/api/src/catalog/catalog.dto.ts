import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsFQDN,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const keyPattern = /^[a-z][a-z0-9-]{1,98}[a-z0-9]$/u;

export class CreateStoreDto {
  @Matches(keyPattern)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/u)
  defaultLocale?: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/u)
  defaultCurrency?: string;

  @IsOptional()
  @IsObject()
  branding?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  seo?: Record<string, unknown>;
}

export class CreateStoreDomainDto {
  @IsFQDN({ require_tld: false })
  @MaxLength(253)
  hostname!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateCategoryDto {
  @Matches(keyPattern)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;
}

export class AttributeOptionDto {
  @Matches(/^[a-z0-9][a-z0-9-]{0,158}[a-z0-9]$|^[a-z0-9]$/u)
  value!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;
}

export class CreateAttributeDto {
  @Matches(keyPattern)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsIn(['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT'])
  kind!: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT';

  @IsBoolean()
  isVariant!: boolean;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AttributeOptionDto)
  options?: AttributeOptionDto[];
}

export class CreatePartnerDto {
  @Matches(keyPattern)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;
}

export class SubmissionVariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  barcode?: string;
}

export class SubmissionMediaDto {
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  url!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  altText!: string;
}

export class CreateSubmissionDto {
  @IsUUID('4')
  storeId!: string;

  @IsUUID('4')
  supplierId!: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @Matches(keyPattern)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(20_000)
  description!: string;

  @IsOptional()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/u)
  locale?: string;

  @IsOptional()
  @IsObject()
  seo?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SubmissionMediaDto)
  media?: SubmissionMediaDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SubmissionVariantDto)
  variants!: SubmissionVariantDto[];
}

export class ReviewSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateOfferDto {
  @IsUUID('4')
  storeId!: string;

  @IsUUID('4')
  variantId!: string;

  @IsUUID('4')
  sellerId!: string;

  @IsUUID('4')
  supplierId!: string;

  @Matches(/^[A-Z]{3}$/u)
  currency!: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  priceMinor!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  compareAtMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  minimumQuantity?: number;
}

export class StorefrontQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @IsOptional()
  @Matches(keyPattern)
  category?: string;
}

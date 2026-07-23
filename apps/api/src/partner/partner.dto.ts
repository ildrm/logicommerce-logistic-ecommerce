import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePartnerCredentialDto {
  @IsIn(['SELLER', 'SUPPLIER', 'SHOP']) partnerKind!: 'SELLER' | 'SUPPLIER' | 'SHOP';
  @IsUUID('4') partnerId!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) scopes!: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) ipPolicy?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(10_000) rateLimitPerMinute?: number;
}

export class CreateWebhookEndpointDto {
  @IsIn(['SELLER', 'SUPPLIER', 'SHOP']) partnerKind!: 'SELLER' | 'SUPPLIER' | 'SHOP';
  @IsUUID('4') partnerId!: string;
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false }) url!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) eventTypes!: string[];
}

export class ShopOrderLineDto {
  @IsUUID('4') variantId!: string;
  @IsInt() @Min(1) @Max(100_000) quantity!: number;
}

export class SubmitShopOrderDto {
  @IsString() @MinLength(3) @MaxLength(160) externalKey!: string;
  @IsString() @MinLength(3) @MaxLength(3) currency!: string;
  @IsObject() shippingAddress!: Record<string, unknown>;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShopOrderLineDto)
  lines!: ShopOrderLineDto[];
}

export class FulfillShopOrderDto {
  @IsString() @MinLength(4) @MaxLength(160) trackingNumber!: string;
  @IsString() @MinLength(2) @MaxLength(80) carrier!: string;
}

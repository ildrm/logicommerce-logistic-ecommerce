import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBusinessAccountDto {
  @IsString() @MinLength(2) @MaxLength(100) key!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString() @MinLength(3) @MaxLength(3) currency!: string;
  @IsInt() @Min(0) creditLimitMinor!: number;
  @IsInt() @Min(0) approvalMinor!: number;
  @IsInt() @Min(0) paymentTermsDays!: number;
}

export class AddBusinessMemberDto {
  @IsUUID('4') userId!: string;
  @IsString() @MinLength(2) @MaxLength(120) department!: string;
  @IsString() @MinLength(2) @MaxLength(40) role!: string;
  @IsInt() @Min(0) spendLimitMinor!: number;
}

export class ContractPriceDto {
  @IsUUID('4') variantId!: string;
  @IsInt() @Min(1) minimumQuantity!: number;
  @IsInt() @Min(1) unitPriceMinor!: number;
}

export class RfqLineDto {
  @IsUUID('4') variantId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsInt() @Min(1) targetMinor?: number;
}

export class CreateRfqDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RfqLineDto)
  lines!: RfqLineDto[];
}

export class QuoteLineDto {
  @IsUUID('4') variantId!: string;
  @IsInt() @Min(1) unitPriceMinor!: number;
}

export class CreateBusinessQuoteDto {
  @IsOptional() @IsUUID('4') sellerId?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];
  @IsOptional() @IsObject() terms?: Record<string, unknown>;
}

export class AddSellerMemberDto {
  @IsUUID('4') userId!: string;
}

export class AcceptBusinessQuoteDto {
  @IsString() @MinLength(2) @MaxLength(160) purchaseOrderRef!: string;
}

export class FulfillBusinessLineDto {
  @IsUUID('4') lineId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class FulfillBusinessOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FulfillBusinessLineDto)
  lines!: FulfillBusinessLineDto[];
}

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ReturnRequestLineDto {
  @IsUUID('4') orderLineId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class CreateReturnDto {
  @IsUUID('4') orderId!: string;
  @IsString() @MinLength(2) @MaxLength(80) reasonCode!: string;
  @IsIn(['REFUND', 'REPLACEMENT', 'EXCHANGE']) requestedOutcome!:
    | 'REFUND'
    | 'REPLACEMENT'
    | 'EXCHANGE';
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnRequestLineDto)
  lines!: ReturnRequestLineDto[];
}

export class ReceiveReturnLineDto {
  @IsUUID('4') lineId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class ReceiveReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveReturnLineDto)
  lines!: ReceiveReturnLineDto[];
}

export class InspectReturnLineDto {
  @IsUUID('4') lineId!: string;
  @IsIn(['RESTOCK', 'REFURBISH', 'LIQUIDATE', 'DESTROY', 'RETURN_TO_SELLER'])
  disposition!: string;
  @IsIn(['REFUND', 'REPLACEMENT', 'EXCHANGE', 'DENIED']) resolution!: string;
  @IsInt() @Min(0) refundMinor!: number;
}

export class InspectReturnDto {
  @IsIn(['NEW', 'OPEN_BOX', 'USED', 'DAMAGED']) conditionCode!: string;
  @IsOptional() @IsObject() evidence?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InspectReturnLineDto)
  lines!: InspectReturnLineDto[];
}

export class OpenReturnDisputeDto {
  @IsString() @MinLength(4) @MaxLength(1000) reason!: string;
}

export class ResolveReturnDisputeDto {
  @IsString() @MinLength(4) @MaxLength(1000) resolution!: string;
}

export class JournalLineDto {
  @IsUUID('4') accountId!: string;
  @IsInt() @Min(0) debitMinor!: number;
  @IsInt() @Min(0) creditMinor!: number;
  @IsOptional() @IsString() @MaxLength(500) memo?: string;
}

export class PostJournalDto {
  @IsString() @MinLength(2) @MaxLength(80) sourceType!: string;
  @IsUUID('4') sourceId!: string;
  @IsString() @MinLength(2) @MaxLength(500) description!: string;
  @IsString() @MinLength(3) @MaxLength(3) currency!: string;
  @IsString() @MinLength(8) @MaxLength(160) idempotencyKey!: string;
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class ReverseJournalDto {
  @IsString() @MinLength(8) @MaxLength(160) idempotencyKey!: string;
  @IsString() @MinLength(2) @MaxLength(500) reason!: string;
}

export class CalculateSettlementDto {
  @IsIn(['SELLER', 'SUPPLIER', 'CARRIER']) partnerKind!: string;
  @IsUUID('4') partnerId!: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsString() @MinLength(3) @MaxLength(3) currency!: string;
  @IsInt() @Min(0) reserveMinor!: number;
  @IsInt() adjustmentMinor!: number;
}

export class ReconcileDto {
  @IsString() @MinLength(2) @MaxLength(80) providerKey!: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsString() @MinLength(3) @MaxLength(3) currency!: string;
  @IsInt() @Min(0) expectedMinor!: number;
  @IsInt() @Min(0) providerMinor!: number;
  @IsOptional() @IsObject() evidence?: Record<string, unknown>;
}

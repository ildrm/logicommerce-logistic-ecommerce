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
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFacilityDto {
  @IsString() @MinLength(2) @MaxLength(100) key!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsObject() address!: Record<string, unknown>;
}

export class CreateBinDto {
  @IsString() @MinLength(1) @MaxLength(100) code!: string;
  @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
}

export class AsnLineDto {
  @IsUUID('4') variantId!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
}

export class CreateAsnDto {
  @IsUUID('4') facilityId!: string;
  @IsOptional() @IsUUID('4') supplierId?: string;
  @IsString() @MinLength(2) @MaxLength(120) reference!: string;
  @IsOptional() @IsDateString() expectedAt?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AsnLineDto)
  lines!: AsnLineDto[];
}

export class ReceiveAsnLineDto {
  @IsUUID('4') lineId!: string;
  @IsInt() @Min(0) acceptedQty!: number;
  @IsInt() @Min(0) rejectedQty!: number;
  @IsIn(['PASSED', 'FAILED']) inspection!: 'PASSED' | 'FAILED';
}

export class ReceiveAsnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveAsnLineDto)
  lines!: ReceiveAsnLineDto[];
}

export class PutawayDto {
  @IsUUID('4') lineId!: string;
  @IsUUID('4') binId!: string;
}

export class CreateFulfillmentDto {
  @IsUUID('4') orderSplitId!: string;
  @IsUUID('4') facilityId!: string;
  @IsOptional() @IsDateString() slaDueAt?: string;
}

export class PickDto {
  @IsOptional() @IsUUID('4') binId?: string;
}

export class PackDto {
  @IsString() @MinLength(2) @MaxLength(120) packageCode!: string;
  @IsInt() @Min(1) @Max(1_000_000) weightGrams!: number;
  @IsOptional() @IsObject() dimensions?: Record<string, number>;
}

export class LabelDto {
  @IsString() @MinLength(2) @MaxLength(80) carrierKey!: string;
  @IsString() @MinLength(2) @MaxLength(80) serviceLevel!: string;
}

export class TrackingEventDto {
  @IsString() @MinLength(2) @MaxLength(160) externalKey!: string;
  @IsIn(['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'])
  code!: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'EXCEPTION';
  @IsString() @MinLength(2) @MaxLength(500) description!: string;
  @IsOptional() @IsString() @MaxLength(240) location?: string;
  @IsDateString() occurredAt!: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

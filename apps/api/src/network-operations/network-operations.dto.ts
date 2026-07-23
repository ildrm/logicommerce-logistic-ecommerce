import {
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
} from 'class-validator';

export class CreateLogisticsClientDto {
  @IsString() @MinLength(2) @MaxLength(100) key!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
}

export class CreateLogisticsContractDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsObject() serviceCatalog!: Record<string, unknown>;
  @IsObject() rateCard!: Record<string, unknown>;
  @IsObject() sla!: Record<string, unknown>;
  @IsDateString() effectiveAt!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class AssignClientInventoryDto {
  @IsUUID('4') inventoryItemId!: string;
  @IsInt() @Min(0) allocatedQty!: number;
}

export class RecordBillableEventDto {
  @IsUUID('4') contractId!: string;
  @IsString() @MinLength(2) @MaxLength(80) eventType!: string;
  @IsString() @MinLength(2) @MaxLength(80) sourceType!: string;
  @IsUUID('4') sourceId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsInt() @Min(0) unitPriceMinor!: number;
  @IsString() @MinLength(3) @MaxLength(3) currency!: string;
  @IsDateString() occurredAt!: string;
}

export class IssueLogisticsInvoiceDto {
  @IsUUID('4') contractId!: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
}

export class CreateControlTowerExceptionDto {
  @IsUUID('4') fulfillmentOrderId!: string;
  @IsString() @MinLength(2) @MaxLength(80) code!: string;
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) severity!: string;
  @IsObject() context!: Record<string, unknown>;
}

export class RecommendRouteDto {
  @IsUUID('4') facilityId!: string;
  @IsString() @MinLength(2) @MaxLength(80) providerKey!: string;
  @IsInt() @Min(0) costMinor!: number;
  @IsInt() @Min(1) slaHours!: number;
  @IsInt() @Min(0) carbonGrams!: number;
  @IsObject() rationale!: Record<string, unknown>;
}

export class ApproveRouteDto {
  @IsString() @MinLength(4) @MaxLength(1000) reason!: string;
}

export class RollbackRouteDto {
  @IsUUID('4') recommendationId!: string;
  @IsString() @MinLength(4) @MaxLength(1000) reason!: string;
}

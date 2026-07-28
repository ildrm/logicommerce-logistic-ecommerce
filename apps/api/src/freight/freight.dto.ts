import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
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

export const TRANSPORT_MODES = ['ROAD', 'SEA', 'AIR', 'RAIL'] as const;
export const LOCATION_TYPES = ['ADDRESS', 'PORT', 'AIRPORT', 'RAIL_TERMINAL'] as const;

export class FreightStopDto {
  @IsInt() @Min(1) @Max(100) sequence!: number;
  @IsIn(['PICKUP', 'DELIVERY', 'TRANSFER']) kind!: string;
  @IsIn(LOCATION_TYPES) locationType!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(240) line1?: string;
  @IsOptional() @IsString() @MaxLength(240) line2?: string;
  @IsString() @MinLength(1) @MaxLength(120) city!: string;
  @IsOptional() @IsString() @MaxLength(120) region?: string;
  @IsOptional() @IsString() @MaxLength(40) postalCode?: string;
  @Matches(/^[A-Z]{2}$/u) countryCode!: string;
  @IsOptional() @IsString() @MaxLength(40) locationCode?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsString() @MaxLength(80) timeZone?: string;
  @IsOptional() @IsDateString() windowStart?: string;
  @IsOptional() @IsDateString() windowEnd?: string;
  @IsOptional() @IsString() @MaxLength(160) contactName?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(1000) instructions?: string;
}

export class CargoItemDto {
  @IsString() @MinLength(2) @MaxLength(500) description!: string;
  @IsOptional() @IsString() @MaxLength(40) commodityCode?: string;
  @IsString() @MinLength(2) @MaxLength(40) packageType!: string;
  @IsInt() @Min(1) @Max(1_000_000) packageCount!: number;
  @IsInt() @Min(1) @Max(10_000_000_000) weightGrams!: number;
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000_000_000) volumeCubicCm?: number;
  @IsOptional() @IsObject() dimensions?: Record<string, number>;
  @IsOptional() @IsInt() @Min(0) declaredValueMinor?: number;
  @Matches(/^[A-Z]{3}$/u) currency!: string;
  @IsOptional() @IsBoolean() hazardous?: boolean;
  @IsOptional() @IsObject() hazardousDetails?: Record<string, unknown>;
  @IsOptional() @IsNumber() temperatureMinC?: number;
  @IsOptional() @IsNumber() temperatureMaxC?: number;
  @IsOptional() @IsBoolean() stackable?: boolean;
}

export class CreateFreightRequestDto {
  @IsOptional() @IsUUID('4') businessAccountId?: string;
  @IsOptional() @IsString() @MaxLength(40) serviceLevel?: string;
  @IsArray() @ArrayMinSize(1) @IsIn(TRANSPORT_MODES, { each: true }) preferredModes!: string[];
  @IsOptional() @IsString() @MaxLength(20) incoterm?: string;
  @IsOptional() @IsBoolean() insuranceRequired?: boolean;
  @IsOptional() @IsBoolean() customsRequired?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) specialInstructions?: string;
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => FreightStopDto)
  stops!: FreightStopDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CargoItemDto)
  cargoItems!: CargoItemDto[];
}

export class UpdateFreightRequestDto {
  @IsOptional() @IsString() @MaxLength(40) serviceLevel?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(TRANSPORT_MODES, { each: true })
  preferredModes?: string[];
  @IsOptional() @IsString() @MaxLength(20) incoterm?: string;
  @IsOptional() @IsBoolean() insuranceRequired?: boolean;
  @IsOptional() @IsBoolean() customsRequired?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) specialInstructions?: string;
  @IsInt() @Min(1) version!: number;
}

export class UploadDocumentDto {
  @IsIn(['CARGO', 'CUSTOMS', 'INSURANCE', 'QUOTE', 'PROOF_OF_DELIVERY']) kind!: string;
  @IsString() @MinLength(1) @MaxLength(240) fileName!: string;
  @IsIn(['application/pdf', 'image/jpeg', 'image/png']) contentType!: string;
  @IsInt() @Min(1) @Max(20_000_000) sizeBytes!: number;
  @Matches(/^[a-f0-9]{64}$/u) checksum!: string;
}

export class CreateRateCardDto {
  @Matches(/^[a-z][a-z0-9-]{1,98}[a-z0-9]$/u) key!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @Matches(/^[A-Z]{3}$/u) currency!: string;
  @IsDateString() effectiveAt!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class CreateRateRuleDto {
  @IsIn(TRANSPORT_MODES) mode!: string;
  @IsOptional() @Matches(/^[A-Z]{2}$/u) originCountryCode?: string;
  @IsOptional() @Matches(/^[A-Z]{2}$/u) destinationCountryCode?: string;
  @IsOptional() @IsString() @MaxLength(40) originLocationCode?: string;
  @IsOptional() @IsString() @MaxLength(40) destinationLocationCode?: string;
  @IsOptional() @IsString() @MaxLength(60) equipmentType?: string;
  @IsInt() @Min(0) baseMinor!: number;
  @IsInt() @Min(0) perKgMinor!: number;
  @IsOptional() @IsInt() @Min(0) perCubicMeterMinor?: number;
  @IsOptional() @IsInt() @Min(0) minimumMinor?: number;
  @IsOptional() @IsObject() accessorials?: Record<string, number>;
  @IsOptional() @IsInt() @Min(1) @Max(10_000) priority?: number;
}

export class QuoteLineDto {
  @IsString() @MinLength(2) @MaxLength(60) kind!: string;
  @IsString() @MinLength(2) @MaxLength(500) description!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
  @IsInt() @Min(0) unitMinor!: number;
  @IsOptional() @IsBoolean() taxable?: boolean;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class CreateFreightQuoteDto {
  @Matches(/^[A-Z]{3}$/u) currency!: string;
  @IsInt() @Min(0) taxMinor!: number;
  @IsIn(['PREPAY', 'DEPOSIT', 'NET_TERMS']) paymentPolicy!: string;
  @IsOptional() @IsInt() @Min(1) @Max(99) depositPercent?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) paymentTermsDays?: number;
  @IsDateString() validUntil!: string;
  @IsOptional() @IsObject() terms?: Record<string, unknown>;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];
}

export class CreateCarrierDto {
  @Matches(/^[a-z][a-z0-9-]{1,98}[a-z0-9]$/u) key!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsIn(['INTERNAL', 'SUBCONTRACTED']) kind!: string;
  @IsArray() @ArrayMinSize(1) @IsIn(TRANSPORT_MODES, { each: true }) modes!: string[];
  @IsOptional() @IsString() @MaxLength(160) contactName?: string;
  @IsOptional() @IsEmail() @MaxLength(320) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
}

export class CreateDriverDto {
  @IsOptional() @IsUUID('4') carrierId?: string;
  @IsOptional() @IsString() @MaxLength(100) employeeRef?: string;
  @IsString() @MinLength(2) @MaxLength(160) displayName!: string;
  @IsString() @MinLength(5) @MaxLength(40) phone!: string;
  @IsOptional() @IsString() @MaxLength(120) licenseNumber?: string;
  @IsOptional() @IsDateString() licenseExpiresAt?: string;
}

export class CreateVehicleDto {
  @IsOptional() @IsUUID('4') carrierId?: string;
  @IsString() @MinLength(2) @MaxLength(120) registration!: string;
  @IsString() @MinLength(2) @MaxLength(60) equipmentType!: string;
  @IsOptional() @IsInt() @Min(1) capacityKg?: number;
  @IsOptional() @IsNumber() @Min(0.1) capacityCubicM?: number;
}

export class CreateLegDto {
  @IsInt() @Min(1) @Max(100) sequence!: number;
  @IsIn(TRANSPORT_MODES) mode!: string;
  @IsUUID('4') originStopId!: string;
  @IsUUID('4') destinationStopId!: string;
  @IsOptional() @IsUUID('4') carrierId?: string;
  @IsOptional() @IsString() @MaxLength(160) providerReference?: string;
  @IsOptional() @IsDateString() plannedDepartureAt?: string;
  @IsOptional() @IsDateString() plannedArrivalAt?: string;
  @IsOptional() @IsObject() equipment?: Record<string, unknown>;
}

export class CreateAssignmentDto {
  @IsUUID('4') driverId!: string;
  @IsUUID('4') vehicleId!: string;
  @IsOptional() @IsUUID('4') carrierId?: string;
  @IsOptional() @IsInt() @Min(15) @Max(1440) checkInIntervalMinutes?: number;
}

export class AssignmentTransitionDto {
  @IsIn(['START', 'COMPLETE', 'CANCEL']) action!: string;
}

export class DriverCheckInDto {
  @IsIn(['PHONE', 'SMS', 'WHATSAPP', 'CARRIER_PORTAL', 'MANUAL']) source!: string;
  @IsIn(['REACHED', 'NO_ANSWER', 'DELAY', 'EXCEPTION']) outcome!: string;
  @IsString() @MinLength(2) @MaxLength(240) locationText!: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsDateString() reportedAt!: string;
  @IsOptional() @IsDateString() estimatedArrivalAt?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsString() @MaxLength(80) exceptionCode?: string;
  @IsOptional() @IsDateString() nextCheckInAt?: string;
  @IsString() @MinLength(8) @MaxLength(160) externalKey!: string;
}

export class TransportMilestoneDto {
  @IsOptional() @IsUUID('4') legId?: string;
  @IsString() @MinLength(2) @MaxLength(80) code!: string;
  @IsString() @MinLength(2) @MaxLength(500) description!: string;
  @IsOptional() @IsString() @MaxLength(240) location?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsDateString() occurredAt!: string;
  @IsString() @MinLength(2) @MaxLength(40) source!: string;
  @IsString() @MinLength(8) @MaxLength(160) externalKey!: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

export class ProofOfDeliveryDto {
  @IsString() @MinLength(2) @MaxLength(160) recipient!: string;
  @IsDateString() deliveredAt!: string;
  @IsOptional() @IsUUID('4') documentId?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

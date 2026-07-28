import {
  IsArray,
  IsBoolean,
  IsDateString,
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
} from 'class-validator';

const MODES = ['ROAD', 'SEA', 'AIR', 'RAIL', 'POSTAL'] as const;

export class CreateStandardLocationDto {
  @IsOptional() @IsString() @MaxLength(8) unLocode?: string;
  @IsOptional() @IsString() @MaxLength(20) childCode?: string;
  @IsOptional() @Matches(/^[A-Z]{3}$/u) iataCode?: string;
  @IsOptional() @Matches(/^[A-Z0-9]{6}$/u) impcCode?: string;
  @IsOptional() @Matches(/^\d{13}$/u) gln?: string;
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @Matches(/^[A-Z]{2}$/u) countryCode!: string;
  @IsOptional() @IsString() @MaxLength(6) subdivisionCode?: string;
  @IsArray() @IsString({ each: true }) functions!: string[];
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsString() @MaxLength(80) timeZone?: string;
  @IsOptional() @IsString() @MaxLength(60) standardVersion?: string;
}

export class CreateTransportPartyDto {
  @IsIn(['ORGANIZATION', 'PERSON', 'AUTHORITY']) kind!: string;
  @IsString() @MinLength(2) @MaxLength(240) legalName!: string;
  @IsOptional() @IsObject() identifiers?: Record<string, unknown>;
  @IsObject() address!: Record<string, unknown>;
  @IsOptional() @IsObject() contacts?: Record<string, unknown>;
}

export class CreateConsignmentDto {
  @IsUUID('4') bookingId!: string;
  @IsOptional() @IsString() @MaxLength(30) ginc?: string;
  @IsOptional() @IsString() @MaxLength(30) gsIn?: string;
  @IsUUID('4') consignorId!: string;
  @IsUUID('4') consigneeId!: string;
  @IsUUID('4') originLocationId!: string;
  @IsUUID('4') destinationLocationId!: string;
  @IsIn(['CMR', 'BILL_OF_LADING', 'SEA_WAYBILL', 'AIR_WAYBILL', 'RAIL_NOTE', 'MULTIMODAL'])
  transportContractType!: string;
  @IsOptional() @IsString() @MaxLength(40) serviceLevel?: string;
  @IsOptional() @IsString() @MaxLength(20) incoterm?: string;
  @IsInt() @Min(1) packageCount!: number;
  @IsInt() @Min(1) grossWeightGrams!: number;
  @IsOptional() @IsInt() @Min(1) grossVolumeCubicCm?: number;
  @IsString() @MinLength(2) @MaxLength(1000) goodsDescription!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) commodityCodes?: string[];
  @IsOptional() @IsObject() dangerousGoods?: Record<string, unknown>;
  @IsOptional() @IsObject() temperatureControl?: Record<string, unknown>;
  @IsOptional()
  @IsIn(['NOT_REQUIRED', 'REQUIRED', 'DRAFT', 'LODGED', 'HELD', 'RELEASED', 'REJECTED'])
  customsStatus?: string;
}

export class CreateTransportDocumentDto {
  @IsIn([
    'ECMR',
    'BILL_OF_LADING',
    'SEA_WAYBILL',
    'AIR_WAYBILL',
    'RAIL_CONSIGNMENT_NOTE',
    'MULTIMODAL_TRANSPORT_DOCUMENT',
    'PACKING_LIST',
    'DANGEROUS_GOODS_DECLARATION',
    'VGM_CERTIFICATE',
  ])
  type!: string;
  @IsString() @MinLength(2) @MaxLength(120) number!: string;
  @IsString() @MinLength(2) @MaxLength(80) standard!: string;
  @IsOptional() @IsString() @MaxLength(40) standardVersion?: string;
  @IsObject() payload!: Record<string, unknown>;
  @IsOptional() @IsUUID('4') supersedesId?: string;
}

export class TransportDocumentTransitionDto {
  @IsIn(['ISSUED', 'SIGNED', 'SURRENDERED', 'VOID']) status!: string;
}

export class CreateCustomsFilingDto {
  @IsIn(['GOODS_DECLARATION', 'CARGO_REPORT', 'CONVEYANCE_REPORT', 'TRANSIT', 'LPCO'])
  type!: string;
  @IsIn(['EXPORT', 'IMPORT', 'TRANSIT']) direction!: string;
  @IsOptional() @IsString() @MaxLength(40) customsOfficeCode?: string;
  @IsOptional() @IsString() @MaxLength(40) dataModelVersion?: string;
  @IsObject() declaration!: Record<string, unknown>;
}

export class CustomsTransitionDto {
  @IsIn(['LODGED', 'HELD', 'RELEASED', 'REJECTED']) status!: string;
  @IsOptional() @IsString() @MaxLength(80) mrn?: string;
  @IsOptional() @IsObject() response?: Record<string, unknown>;
  @IsInt() @Min(1) version!: number;
}

export class CreateInsuranceProviderDto {
  @Matches(/^[a-z][a-z0-9-]{1,98}[a-z0-9]$/u) key!: string;
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @IsIn(['INSURER', 'BROKER', 'MGA']) kind!: string;
  @IsArray() @IsString({ each: true }) countries!: string[];
  @IsArray() @IsIn(MODES, { each: true }) modes!: string[];
  @IsArray() @IsString({ each: true }) currencies!: string[];
  @IsOptional() @IsObject() licenseRefs?: Record<string, unknown>;
}

export class CreateInsuranceProductDto {
  @IsString() @MinLength(2) @MaxLength(100) code!: string;
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @IsIn(['SINGLE_TRANSIT', 'OPEN_COVER', 'ANNUAL', 'CARRIER_LIABILITY']) policyType!: string;
  @IsIn(['ICC_A', 'ICC_B', 'ICC_C', 'ALL_RISK', 'NAMED_PERILS', 'CARRIER_LIABILITY', 'CUSTOM'])
  coverageLevel!: string;
  @IsArray() @IsString({ each: true }) clauses!: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) exclusions?: string[];
  @IsArray() @IsIn(MODES, { each: true }) supportedModes!: string[];
  @IsArray() @IsString({ each: true }) supportedCountries!: string[];
  @Matches(/^[A-Z]{3}$/u) currency!: string;
  @IsInt() @Min(0) @Max(100_000) rateBasisPoints!: number;
  @IsInt() @Min(0) minimumPremiumMinor!: number;
  @IsIn(['FIXED', 'PERCENT']) deductibleType!: string;
  @IsInt() @Min(0) deductibleValue!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) valuationUpliftPercent?: number;
  @IsOptional() @IsInt() @Min(1) maxInsuredValueMinor?: number;
  @IsDateString() effectiveAt!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class CreateInsuranceQuoteDto {
  @IsUUID('4') requestId!: string;
  @IsUUID('4') productId!: string;
  @IsDateString() coverageStartAt!: string;
  @IsDateString() coverageEndAt!: string;
  @IsDateString() validUntil!: string;
  @IsOptional() @IsInt() @Min(0) taxMinor?: number;
}

export class CreateInsuranceClaimDto {
  @IsIn([
    'LOSS',
    'THEFT',
    'DAMAGE',
    'WET_DAMAGE',
    'TEMPERATURE_EXCURSION',
    'GENERAL_AVERAGE',
    'DELAY',
    'OTHER',
  ])
  cause!: string;
  @IsDateString() lossOccurredAt!: string;
  @IsDateString() discoveredAt!: string;
  @IsString() @MinLength(2) @MaxLength(240) lossLocation!: string;
  @IsString() @MinLength(10) @MaxLength(2000) description!: string;
  @IsInt() @Min(1) claimedAmountMinor!: number;
  @Matches(/^[A-Z]{3}$/u) currency!: string;
  @IsOptional() @IsObject() evidence?: Record<string, unknown>;
}

export class InsuranceClaimTransitionDto {
  @IsIn([
    'SUBMITTED',
    'UNDER_REVIEW',
    'INFO_REQUIRED',
    'APPROVED',
    'PARTIALLY_APPROVED',
    'REJECTED',
    'PAID',
    'CLOSED',
    'CANCELLED',
  ])
  status!: string;
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsInt() @Min(0) approvedAmountMinor?: number;
  @IsOptional() @IsInt() @Min(0) paidAmountMinor?: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsObject() evidence?: Record<string, unknown>;
}

export class CreateLogisticsHubDto {
  @IsUUID('4') locationId!: string;
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,78}[A-Z0-9]$/u) code!: string;
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @IsIn([
    'HUB',
    'CROSS_DOCK',
    'CFS',
    'IMPC',
    'PORT_TERMINAL',
    'AIR_CARGO_TERMINAL',
    'RAIL_TERMINAL',
  ])
  type!: string;
  @IsOptional() @IsBoolean() customsBonded?: boolean;
  @IsArray() @IsString({ each: true }) capabilities!: string[];
  @IsOptional() @IsObject() operatingCalendar?: Record<string, unknown>;
}

export class CreateHandlingUnitDto {
  @IsOptional() @Matches(/^\d{18}$/u) sscc?: string;
  @IsOptional() @IsString() @MaxLength(120) externalIdentifier?: string;
  @IsIn(['PARCEL', 'CARTON', 'CRATE', 'PALLET', 'CAGE', 'BAG', 'CONTAINER', 'ULD', 'TRAILER'])
  type!: string;
  @IsOptional() @IsUUID('4') parentId?: string;
  @IsOptional() @IsUUID('4') currentHubId?: string;
  @IsOptional() @IsString() @MaxLength(160) owner?: string;
  @IsOptional() @IsString() @MaxLength(80) sealNumber?: string;
  @IsOptional() @IsInt() @Min(0) tareWeightGrams?: number;
  @IsInt() @Min(1) grossWeightGrams!: number;
  @IsOptional() @IsInt() @Min(1) volumeCubicCm?: number;
  @IsOptional() @IsObject() dimensions?: Record<string, number>;
  @IsOptional() @IsObject() dangerousGoods?: Record<string, unknown>;
  @IsOptional() @IsObject() temperatureControl?: Record<string, unknown>;
}

export class VerifyVgmDto {
  @IsInt() @Min(1) verifiedGrossMassGrams!: number;
  @IsIn(['METHOD_1', 'METHOD_2']) method!: string;
}

export class AddHandlingUnitContentDto {
  @IsUUID('4') cargoItemId!: string;
  @IsInt() @Min(1) packageCount!: number;
  @IsInt() @Min(1) weightGrams!: number;
  @IsOptional() @IsInt() @Min(1) volumeCubicCm?: number;
}

export class HandlingEventDto {
  @IsUUID('4') hubId!: string;
  @IsIn([
    'RECEIVED',
    'SCANNED',
    'BUILT',
    'SEALED',
    'STAGED',
    'SORTED',
    'LOADED',
    'UNLOADED',
    'OPENED',
    'DAMAGED',
    'SHORT',
    'OVER',
    'RELEASED',
  ])
  type!: string;
  @IsOptional()
  @IsIn(['GOOD', 'DAMAGED', 'WET', 'TAMPERED', 'TEMPERATURE_EXCEPTION'])
  condition?: string;
  @IsOptional() @IsString() @MaxLength(240) locationText?: string;
  @IsDateString() occurredAt!: string;
  @IsIn(['SCAN', 'MANUAL', 'EDI', 'API', 'IOT']) source!: string;
  @IsString() @MinLength(1) @MaxLength(160) externalKey!: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
}

export class CreateConsolidationPlanDto {
  @IsIn(MODES) mode!: string;
  @IsOptional() @IsString() @MaxLength(40) serviceLevel?: string;
  @IsUUID('4') originHubId!: string;
  @IsUUID('4') destinationHubId!: string;
  @IsDateString() cutoffAt!: string;
  @IsDateString() plannedDepartureAt!: string;
  @IsDateString() plannedArrivalAt!: string;
  @IsOptional() @IsInt() @Min(1) maxWeightGrams?: number;
  @IsOptional() @IsInt() @Min(1) maxVolumeCubicCm?: number;
  @IsOptional() @IsString() @MaxLength(60) equipmentType?: string;
  @IsOptional() @IsString() @MaxLength(120) masterReference?: string;
  @IsOptional() @IsString() @MaxLength(80) sealNumber?: string;
  @IsOptional() @IsObject() route?: Record<string, unknown>;
}

export class AddConsolidationMemberDto {
  @IsUUID('4') bookingId!: string;
  @IsOptional() @IsUUID('4') consignmentId?: string;
  @IsInt() @Min(1) allocatedWeightGrams!: number;
  @IsOptional() @IsInt() @Min(1) allocatedVolumeCubicCm?: number;
  @IsInt() @Min(1) packageCount!: number;
  @IsOptional() @IsInt() @Min(1) @Max(10_000) loadingPriority?: number;
  @IsOptional() @IsString() @MaxLength(240) finalDestination?: string;
}

export class AddConsolidationLoadDto {
  @IsUUID('4') handlingUnitId!: string;
  @IsInt() @Min(1) loadSequence!: number;
  @IsOptional() @IsString() @MaxLength(80) position?: string;
}

export class WorkflowTransitionDto {
  @IsString() @MinLength(2) @MaxLength(40) status!: string;
  @IsInt() @Min(1) version!: number;
}

export class CreateLinehaulDto {
  @IsIn(MODES) mode!: string;
  @IsUUID('4') originLocationId!: string;
  @IsUUID('4') destinationLocationId!: string;
  @IsOptional() @IsUUID('4') carrierId?: string;
  @IsOptional() @IsString() @MaxLength(120) conveyanceReference?: string;
  @IsOptional() @IsString() @MaxLength(120) equipmentIdentifier?: string;
  @IsDateString() scheduledDepartureAt!: string;
  @IsDateString() scheduledArrivalAt!: string;
  @IsOptional() @IsInt() @Min(1) maxWeightGrams?: number;
  @IsOptional() @IsInt() @Min(1) maxVolumeCubicCm?: number;
  @IsOptional() @IsObject() route?: Record<string, unknown>;
}

export class AllocateLinehaulDto {
  @IsUUID('4') consolidationPlanId!: string;
  @IsInt() @Min(1) allocatedWeightGrams!: number;
  @IsOptional() @IsInt() @Min(1) allocatedVolumeCubicCm?: number;
}

export class CreatePostalOperatorDto {
  @IsString() @MinLength(2) @MaxLength(20) code!: string;
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @Matches(/^[A-Z]{2}$/u) countryCode!: string;
  @IsOptional() @IsBoolean() designated?: boolean;
  @IsOptional() @IsObject() identifiers?: Record<string, unknown>;
}

export class CreatePostalProductDto {
  @IsString() @MinLength(2) @MaxLength(40) code!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsIn(['LETTER', 'REGISTERED', 'PARCEL', 'EMS', 'EXPRESS', 'RETURN']) category!: string;
  @IsOptional() @IsBoolean() tracked?: boolean;
  @IsOptional() @IsBoolean() registered?: boolean;
  @IsOptional() @IsBoolean() insured?: boolean;
  @IsOptional() @IsBoolean() signatureRequired?: boolean;
  @IsOptional() @IsBoolean() customsRequired?: boolean;
  @IsOptional() @IsInt() @Min(1) maxWeightGrams?: number;
  @IsOptional() @IsObject() maxDimensions?: Record<string, number>;
  @IsOptional() @IsObject() serviceStandard?: Record<string, unknown>;
}

export class CreatePostalItemDto {
  @IsUUID('4') operatorId!: string;
  @IsUUID('4') productId!: string;
  @IsOptional() @Matches(/^[A-Z]{2}\d{9}[A-Z]{2}$/u) s10Identifier?: string;
  @IsOptional() @Matches(/^[A-Z]{2}$/u) serviceIndicator?: string;
  @IsOptional() @Matches(/^\d{8}$/u) serial?: string;
  @Matches(/^[A-Z]{2}$/u) originCountryCode!: string;
  @Matches(/^[A-Z]{2}$/u) destinationCountryCode!: string;
  @IsObject() sender!: Record<string, unknown>;
  @IsObject() recipient!: Record<string, unknown>;
  @IsString() @MinLength(2) @MaxLength(1000) contentDescription!: string;
  @IsInt() @Min(1) weightGrams!: number;
  @IsOptional() @IsObject() dimensions?: Record<string, number>;
  @IsOptional() @IsInt() @Min(0) declaredValueMinor?: number;
  @Matches(/^[A-Z]{3}$/u) currency!: string;
  @IsOptional() @IsObject() customsData?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(0) postageMinor?: number;
}

export class CreatePostalReceptacleDto {
  @IsUUID('4') operatorId!: string;
  @IsOptional() @IsUUID('4') handlingUnitId?: string;
  @IsString() @MinLength(5) @MaxLength(35) receptacleId!: string;
  @IsIn(['BAG', 'TRAY', 'CAGE', 'CONTAINER', 'ULD']) type!: string;
  @IsIn(['LETTER', 'PARCEL', 'EMS', 'EXPRESS']) mailCategory!: string;
  @Matches(/^[A-Z0-9]{6}$/u) originImpcCode!: string;
  @Matches(/^[A-Z0-9]{6}$/u) destinationImpcCode!: string;
  @IsOptional() @IsString() @MaxLength(80) sealNumber?: string;
}

export class AddPostalItemDto {
  @IsUUID('4') itemId!: string;
}

export class CreatePostalDispatchDto {
  @IsUUID('4') operatorId!: string;
  @IsString() @MinLength(5) @MaxLength(35) dispatchId!: string;
  @Matches(/^[A-Z0-9]{6}$/u) originImpcCode!: string;
  @Matches(/^[A-Z0-9]{6}$/u) destinationImpcCode!: string;
  @IsIn(['LETTER', 'PARCEL', 'EMS', 'EXPRESS']) mailCategory!: string;
  @IsInt() @Min(1) dispatchNumber!: number;
  @IsOptional() @IsDateString() scheduledDepartureAt?: string;
}

export class AddPostalReceptacleDto {
  @IsUUID('4') receptacleId!: string;
  @IsInt() @Min(1) sequence!: number;
}

export class CreatePostalConsignmentDto {
  @IsUUID('4') operatorId!: string;
  @IsString() @MinLength(1) @MaxLength(12) consignmentId!: string;
  @IsOptional() @IsUUID('4') carrierId?: string;
  @IsOptional() @IsString() @MaxLength(120) transportReference?: string;
  @Matches(/^[A-Z0-9]{6}$/u) originImpcCode!: string;
  @Matches(/^[A-Z0-9]{6}$/u) destinationImpcCode!: string;
  @IsOptional() @IsDateString() scheduledDepartureAt?: string;
  @IsOptional() @IsDateString() scheduledArrivalAt?: string;
}

export class PostalEventDto {
  @IsOptional() @IsUUID('4') itemId?: string;
  @IsOptional() @IsUUID('4') receptacleId?: string;
  @IsOptional() @IsUUID('4') dispatchId?: string;
  @IsIn(['UPU_EMSEVT', 'UPU_RESDES', 'UPU_PRECON', 'UPU_CARDIT', 'UPU_RESDIT', 'INTERNAL'])
  standard!: string;
  @IsString() @MinLength(1) @MaxLength(20) code!: string;
  @IsString() @MinLength(2) @MaxLength(500) description!: string;
  @IsOptional() @IsString() @MaxLength(40) locationCode?: string;
  @IsDateString() occurredAt!: string;
  @IsIn(['SCAN', 'EDI', 'API', 'MANUAL']) source!: string;
  @IsString() @MinLength(1) @MaxLength(160) externalKey!: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
}

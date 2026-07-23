import {
  ArrayMaxSize,
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
} from 'class-validator';

export class VerifySellerDto {
  @IsString() @MinLength(4) @MaxLength(160) verificationToken!: string;
}

export class CreateListingDto {
  @IsString() @MinLength(2) @MaxLength(240) title!: string;
  @IsString() @MinLength(10) @MaxLength(20_000) description!: string;
  @IsIn(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']) conditionCode!: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR';
  @IsInt() @Min(1) priceMinor!: number;
  @IsString() @MinLength(3) @MaxLength(3) currency!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ require_tld: false }, { each: true })
  media?: string[];
}

export class ModerateListingDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class CreateC2COfferDto {
  @IsInt() @Min(1) amountMinor!: number;
  @IsOptional() @IsUUID('4') parentOfferId?: string;
}

export class ShipmentEvidenceDto {
  @IsString() @MinLength(4) @MaxLength(160) trackingNumber!: string;
  @IsString() @MinLength(2) @MaxLength(80) carrier!: string;
  @IsOptional() @IsObject() evidence?: Record<string, unknown>;
}

export class CreateDisputeDto {
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
}

export class ResolveDisputeDto {
  @IsIn(['BUYER', 'SELLER']) outcome!: 'BUYER' | 'SELLER';
  @IsString() @MinLength(4) @MaxLength(1000) resolution!: string;
}

export class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

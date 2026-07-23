import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSloDto {
  @IsString() @MinLength(2) @MaxLength(100) key!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsNumber() @Min(0) @Max(1) target!: number;
  @IsInt() @Min(1) @Max(365) windowDays!: number;
  @IsString() @MinLength(2) @MaxLength(1000) indicatorQuery!: string;
}

export class RecordSloObservationDto {
  @IsNumber() @Min(0) @Max(1) value!: number;
  @IsInt() @Min(1) sampleSize!: number;
  @IsDateString() windowStart!: string;
  @IsDateString() windowEnd!: string;
}

export class StartRecoveryExerciseDto {
  @IsIn(['BACKUP_RESTORE', 'REGION_FAILOVER', 'ROLLBACK']) kind!: string;
  @IsString() @MinLength(4) @MaxLength(240) backupReference!: string;
  @IsString() @MinLength(2) @MaxLength(80) environment!: string;
}

export class CompleteRecoveryExerciseDto {
  @IsInt() @Min(0) measuredRpoMinutes!: number;
  @IsInt() @Min(0) measuredRtoMinutes!: number;
  @IsObject() evidence!: Record<string, unknown>;
}

export class RetentionPolicyDto {
  @IsString() @MinLength(2) @MaxLength(120) dataClass!: string;
  @IsInt() @Min(1) @Max(36500) retentionDays!: number;
  @IsOptional() legalHold?: boolean;
  @IsIn(['DELETE', 'ANONYMIZE', 'ARCHIVE']) action!: string;
}

export class PrivacyRequestDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) subjectRef!: string;
  @IsIn(['ACCESS', 'EXPORT', 'ERASURE', 'RECTIFICATION', 'RESTRICT']) kind!: string;
}

export class CompletePrivacyRequestDto {
  @IsObject() evidence!: Record<string, unknown>;
}

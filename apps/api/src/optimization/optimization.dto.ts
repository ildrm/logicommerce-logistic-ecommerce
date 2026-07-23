import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class NetworkNodeDto {
  @IsString() @MinLength(1) @MaxLength(100) key!: string;
  @IsString() @MinLength(1) @MaxLength(40) kind!: string;
  @IsInt() @Min(0) capacity!: number;
}

export class NetworkLaneDto {
  @IsString() @MinLength(1) @MaxLength(100) from!: string;
  @IsString() @MinLength(1) @MaxLength(100) to!: string;
  @IsString() @MinLength(1) @MaxLength(80) carrierKey!: string;
  @IsInt() @Min(0) capacity!: number;
  @IsInt() @Min(0) costMinor!: number;
  @IsInt() @Min(0) carbonGrams!: number;
  @IsInt() @Min(1) slaHours!: number;
}

export class CreateNetworkModelDto {
  @IsString() @MinLength(2) @MaxLength(100) key!: string;
  @IsInt() @Min(1) version!: number;
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => NetworkNodeDto)
  nodes!: NetworkNodeDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NetworkLaneDto)
  lanes!: NetworkLaneDto[];
  @IsArray() @ArrayMinSize(1) carriers!: Record<string, unknown>[];
}

export class RunOptimizationDto {
  @IsString() @MinLength(2) @MaxLength(80) objectiveVersion!: string;
  @IsObject() inputSnapshot!: Record<string, unknown>;
  @IsObject() constraints!: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(0) costWeight?: number;
  @IsOptional() @IsInt() @Min(0) carbonWeight?: number;
  @IsOptional() @IsInt() @Min(0) slaWeight?: number;
}

export class OptimizationDecisionDto {
  @IsString() @MinLength(4) @MaxLength(1000) reason!: string;
}

export class RecordOptimizationOutcomeDto {
  @IsObject() actual!: Record<string, unknown>;
}

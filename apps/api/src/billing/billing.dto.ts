import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePaymentSessionDto {
  @IsIn(['STRIPE', 'COINBASE', 'MOCK']) provider!: 'STRIPE' | 'COINBASE' | 'MOCK';
  @IsOptional() @IsString() @MinLength(8) @MaxLength(160) scheduleId?: string;
}

export class RefundPaymentDto {
  @IsInt() @Min(1) amountMinor!: number;
  @IsString() @MinLength(4) @MaxLength(500) reason!: string;
}

export class IssueCreditNoteDto {
  @IsInt() @Min(1) amountMinor!: number;
  @IsString() @MinLength(4) @MaxLength(500) reason!: string;
}

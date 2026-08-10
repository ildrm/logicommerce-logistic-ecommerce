import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/u)
  code!: string;
}

export class MfaEnrollmentDto {
  @ApiProperty({ required: false, description: 'Current TOTP or recovery code for replacement' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:\d{6}|[A-Z0-9-]{8,32})$/iu)
  currentCode?: string;
}

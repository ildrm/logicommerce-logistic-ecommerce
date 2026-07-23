import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@demo.logicommerce.local' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(1024)
  password!: string;

  @ApiProperty({ required: false, description: 'Six-digit TOTP or recovery code' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:\d{6}|[A-Z2-9]{4}-[A-Z2-9]{4})$/u)
  mfaCode?: string;
}

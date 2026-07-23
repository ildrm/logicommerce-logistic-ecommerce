import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class EmailRequestDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class ConsumeIdentityTokenDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;
}

export class ResetPasswordDto extends ConsumeIdentityTokenDto {
  @IsString()
  @MinLength(12)
  @MaxLength(1024)
  password!: string;
}

export class PasswordlessConsumeDto extends ConsumeIdentityTokenDto {
  @IsOptional()
  @IsString()
  @Matches(/^(?:\d{6}|[A-Z2-9]{4}-[A-Z2-9]{4})$/u)
  mfaCode?: string;
}

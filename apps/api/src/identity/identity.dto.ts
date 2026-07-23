import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'support-agent' })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,98}[a-z0-9]$/u)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class SetPermissionsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissionKeys!: string[];
}

export class CreateUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(1024)
  password!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  roleIds!: string[];
}

export class SetUserRolesDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  roleIds!: string[];
}

export class CreateCredentialDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  scopes!: string[];
}

export class DeliveryPreviewDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsIn(['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PASSWORDLESS_LOGIN'])
  purpose!: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'PASSWORDLESS_LOGIN';
}

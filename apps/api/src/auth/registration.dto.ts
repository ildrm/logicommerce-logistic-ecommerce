import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegistrationDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ example: 'Alex Customer' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string;

  @ApiProperty({ format: 'password', minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(1024)
  password!: string;
}

import { IsBoolean } from 'class-validator';

export class UpdateRegistrationSettingsDto {
  @IsBoolean()
  selfRegistrationEnabled!: boolean;
}

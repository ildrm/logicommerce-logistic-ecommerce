import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS = 'logicommerce.required-permissions';

export const RequirePermissions = (...permissions: readonly string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

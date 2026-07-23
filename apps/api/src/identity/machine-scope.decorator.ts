import { SetMetadata } from '@nestjs/common';

export const MACHINE_SCOPES = Symbol('MACHINE_SCOPES');

export function RequireMachineScopes(...scopes: string[]) {
  return SetMetadata(MACHINE_SCOPES, scopes);
}

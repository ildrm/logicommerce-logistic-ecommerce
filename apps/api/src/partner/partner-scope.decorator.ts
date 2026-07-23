import { SetMetadata } from '@nestjs/common';

export const PARTNER_SCOPES = 'partner-scopes';
export const PartnerScopes = (...scopes: string[]) => SetMetadata(PARTNER_SCOPES, scopes);

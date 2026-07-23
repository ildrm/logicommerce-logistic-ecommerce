import type { TenantContext } from '@logicommerce/database';

export type ExternalIdentity = {
  readonly provider: string;
  readonly providerUserId: string;
  readonly email: string;
  readonly displayName: string;
  readonly emailVerified: boolean;
};

export interface IdentityProviderPort {
  readonly key: string;
  authorizationUrl(context: TenantContext, state: string, redirectUri: string): Promise<string>;
  exchange(context: TenantContext, code: string, redirectUri: string): Promise<ExternalIdentity>;
}

export const IDENTITY_PROVIDERS = Symbol('IDENTITY_PROVIDERS');

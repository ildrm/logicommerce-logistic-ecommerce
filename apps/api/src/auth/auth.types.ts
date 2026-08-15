import type { AuthenticatedUser } from '@logicommerce/api-contracts';
import type { TenantContext } from '@logicommerce/database';

export type AuthPrincipal = {
  readonly userId: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
};

export type PasswordUser = AuthenticatedUser & { readonly passwordHash: string };

export type SessionMetadata = {
  readonly userAgentHash: string | null;
  readonly ipPrefix: string | null;
};

export type RefreshRotation =
  | {
      readonly status: 'rotated';
      readonly principal: AuthPrincipal;
      readonly user: AuthenticatedUser;
    }
  | { readonly status: 'invalid' | 'reused' };

export type StoredSession = {
  readonly id: string;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
};

export type CustomerRegistration =
  | { readonly status: 'created'; readonly user: AuthenticatedUser }
  | { readonly status: 'disabled' | 'exists' | 'unavailable' };

export interface AuthStore {
  registerCustomer(
    context: TenantContext,
    input: { email: string; displayName: string; passwordHash: string },
  ): Promise<CustomerRegistration>;
  findPasswordUser(context: TenantContext, email: string): Promise<PasswordUser | null>;
  findUserById(context: TenantContext, userId: string): Promise<AuthenticatedUser | null>;
  createSession(
    context: TenantContext,
    input: {
      userId: string;
      sessionId: string;
      refreshTokenId: string;
      familyId: string;
      refreshTokenHash: string;
      expiresAt: Date;
      metadata: SessionMetadata;
    },
  ): Promise<void>;
  rotateRefreshToken(
    context: TenantContext,
    input: {
      currentHash: string;
      replacementId: string;
      replacementHash: string;
      expiresAt: Date;
      now: Date;
    },
  ): Promise<RefreshRotation>;
  isSessionActive(principal: AuthPrincipal, now: Date): Promise<boolean>;
  findUser(principal: AuthPrincipal): Promise<AuthenticatedUser | null>;
  listSessions(principal: AuthPrincipal): Promise<readonly StoredSession[]>;
  revokeSession(principal: AuthPrincipal, sessionId: string, now: Date): Promise<boolean>;
  revokeAllSessions(principal: AuthPrincipal, now: Date): Promise<void>;
  recordAudit(
    context: TenantContext,
    input: { action: string; entityId: string; actorId?: string; reason?: string },
  ): Promise<void>;
}

export const AUTH_STORE = Symbol('AUTH_STORE');

export type ProblemError = {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
};

export type ProblemDetails = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly instance: string;
  readonly requestId: string;
  readonly errors: readonly ProblemError[];
};

export type HealthStatus = {
  readonly status: 'ok' | 'degraded';
  readonly service: 'api' | 'web' | 'worker';
  readonly version: string;
  readonly timestamp: string;
};

export type TenantSummary = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly defaultLocale: string;
  readonly defaultCurrency: string;
};

export type AuthenticatedUser = {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
};

export type AuthSession = {
  readonly id: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
};

export type AuthenticationResult = {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly user: AuthenticatedUser;
};

export type MfaEnrollment = {
  readonly secret: string;
  readonly otpauthUri: string;
};

export type MfaRecoveryCodes = {
  readonly recoveryCodes: readonly string[];
};

export type IdentityPermission = {
  readonly id: string;
  readonly key: string;
  readonly description: string;
};

export type IdentityRole = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
};

export type IdentityUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly isActive: boolean;
  readonly verifiedAt: string | null;
  readonly roles: readonly IdentityRole[];
};

export type ApiCredentialSummary = {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly scopes: readonly string[];
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
};

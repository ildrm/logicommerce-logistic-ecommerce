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

export const transportModes = ['ROAD', 'SEA', 'AIR', 'RAIL'] as const;
export type TransportMode = (typeof transportModes)[number];
export type FreightRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';
export type FreightQuoteStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'SUPERSEDED';
export type FreightBookingStatus =
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'PLANNED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'EXCEPTION'
  | 'CANCELLED';
export type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
export type PaymentProvider = 'STRIPE' | 'COINBASE' | 'MOCK';

export type FreightStopSummary = {
  readonly id: string;
  readonly sequence: number;
  readonly kind: 'PICKUP' | 'DELIVERY' | 'TRANSFER';
  readonly locationType: 'ADDRESS' | 'PORT' | 'AIRPORT' | 'RAIL_TERMINAL';
  readonly name: string;
  readonly city: string;
  readonly countryCode: string;
  readonly locationCode: string | null;
};

export type FreightRequestSummary = {
  readonly id: string;
  readonly number: string;
  readonly status: FreightRequestStatus;
  readonly preferredModes: readonly TransportMode[];
  readonly serviceLevel: string;
  readonly stops: readonly FreightStopSummary[];
  readonly createdAt: string;
};

export type FreightQuoteSummary = {
  readonly id: string;
  readonly number: string;
  readonly revision: number;
  readonly status: FreightQuoteStatus;
  readonly currency: string;
  readonly subtotalMinor: number;
  readonly taxMinor: number;
  readonly totalMinor: number;
  readonly paymentPolicy: 'PREPAY' | 'DEPOSIT' | 'NET_TERMS';
  readonly validUntil: string;
};

export type FreightBookingSummary = {
  readonly id: string;
  readonly number: string;
  readonly status: FreightBookingStatus;
  readonly requestId: string;
  readonly quoteId: string;
  readonly invoiceId: string | null;
  readonly createdAt: string;
};

export type InvoiceSummary = {
  readonly id: string;
  readonly number: string;
  readonly status: InvoiceStatus;
  readonly currency: string;
  readonly totalMinor: number;
  readonly paidMinor: number;
  readonly dueAt: string;
};

export type DispatchCheckInSummary = {
  readonly id: string;
  readonly source: 'PHONE' | 'SMS' | 'WHATSAPP' | 'CARRIER_PORTAL' | 'MANUAL';
  readonly outcome: 'REACHED' | 'NO_ANSWER' | 'DELAY' | 'EXCEPTION';
  readonly locationText: string;
  readonly reportedAt: string;
  readonly nextCheckInAt: string | null;
};

export type ApiCredentialSummary = {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly scopes: readonly string[];
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
};

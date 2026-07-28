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

export const consolidationStatuses = [
  'DRAFT',
  'OPEN',
  'CLOSED',
  'LOADED',
  'DEPARTED',
  'ARRIVED',
  'DECONSOLIDATED',
  'COMPLETED',
  'CANCELLED',
  'EXCEPTION',
] as const;
export type ConsolidationStatus = (typeof consolidationStatuses)[number];

export const handlingUnitTypes = [
  'PACKAGE',
  'PALLET',
  'CAGE',
  'BAG',
  'ULD',
  'CONTAINER',
  'TRAILER',
] as const;
export type HandlingUnitType = (typeof handlingUnitTypes)[number];

export type InsuranceClaimStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'INFO_REQUIRED'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'CLOSED'
  | 'CANCELLED';

export type PostalItemStatus =
  | 'CREATED'
  | 'ACCEPTED'
  | 'AT_ORIGIN_OFFICE'
  | 'DEPARTED_ORIGIN'
  | 'AT_TRANSIT'
  | 'DEPARTED_TRANSIT'
  | 'ARRIVED_DESTINATION'
  | 'CUSTOMS_HELD'
  | 'CUSTOMS_RELEASED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERY_ATTEMPTED'
  | 'DELIVERED'
  | 'RETURNED'
  | 'LOST'
  | 'DAMAGED';

export type StandardLocationSummary = {
  readonly id: string;
  readonly unLocode: string | null;
  readonly iataCode: string | null;
  readonly impcCode: string | null;
  readonly gln: string | null;
  readonly name: string;
  readonly countryCode: string;
  readonly functions: readonly string[];
};

export type HandlingUnitSummary = {
  readonly id: string;
  readonly sscc: string | null;
  readonly externalIdentifier: string | null;
  readonly type: HandlingUnitType;
  readonly status: string;
  readonly grossWeightGrams: number;
  readonly verifiedGrossMassGrams: number | null;
  readonly currentHubId: string | null;
};

export type ConsolidationPlanSummary = {
  readonly id: string;
  readonly number: string;
  readonly status: ConsolidationStatus;
  readonly mode: TransportMode;
  readonly originHubId: string;
  readonly destinationHubId: string;
  readonly usedWeightGrams: number;
  readonly maxWeightGrams: number | null;
  readonly plannedDepartureAt: string;
  readonly plannedArrivalAt: string;
};

export type CargoInsurancePolicySummary = {
  readonly id: string;
  readonly policyNumber: string;
  readonly certificateNumber: string;
  readonly status: string;
  readonly currency: string;
  readonly insuredValueMinor: number;
  readonly premiumMinor: number;
  readonly coverageStartAt: string;
  readonly coverageEndAt: string;
};

export type CargoInsuranceClaimSummary = {
  readonly id: string;
  readonly number: string;
  readonly status: InsuranceClaimStatus;
  readonly cause: string;
  readonly claimedAmountMinor: number;
  readonly approvedAmountMinor: number | null;
  readonly currency: string;
};

export type PostalItemSummary = {
  readonly id: string;
  readonly s10Identifier: string;
  readonly status: PostalItemStatus;
  readonly originCountryCode: string;
  readonly destinationCountryCode: string;
  readonly weightGrams: number;
  readonly createdAt: string;
};

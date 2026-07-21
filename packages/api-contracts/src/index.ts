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

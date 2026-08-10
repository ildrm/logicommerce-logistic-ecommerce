import { z } from 'zod';

const booleanText = z.enum(['true', 'false']).transform((value) => value === 'true');
const optionalSecret = (minimum: number) =>
  z.preprocess((value) => (value === '' ? undefined : value), z.string().min(minimum).optional());
const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);
const optionalText = (minimum = 1) =>
  z.preprocess((value) => (value === '' ? undefined : value), z.string().min(minimum).optional());

const baseEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().startsWith('mysql://'),
  REDIS_URL: z.string().startsWith('redis://'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_PEPPER: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  CORS_ORIGINS: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  COOKIE_SECURE: booleanText.default(false),
  COOKIE_DOMAIN: z.string().min(1).optional(),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  AUTH_RECOVERY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:8080'),
  PAYMENT_ADAPTER: z.enum(['mock', 'stripe', 'coinbase', 'multi']).default('mock'),
  STRIPE_SECRET_KEY: optionalSecret(8),
  STRIPE_WEBHOOK_SECRET: optionalSecret(8),
  COINBASE_API_KEY_ID: optionalSecret(3),
  COINBASE_API_KEY_SECRET: optionalSecret(8),
  COINBASE_WEBHOOK_SECRET: optionalSecret(8),
  COMMERCE_ADAPTER: z.enum(['deterministic', 'http']).default('deterministic'),
  COMMERCE_PROVIDER_URL: optionalUrl,
  COMMERCE_PROVIDER_TOKEN: optionalSecret(24),
  CARRIER_ADAPTER: z.enum(['deterministic', 'http']).default('deterministic'),
  CARRIER_PROVIDER_URL: optionalUrl,
  CARRIER_PROVIDER_TOKEN: optionalSecret(24),
  IDENTITY_VERIFICATION_ADAPTER: z.enum(['deterministic', 'http']).default('deterministic'),
  IDENTITY_VERIFICATION_URL: optionalUrl,
  IDENTITY_VERIFICATION_TOKEN: optionalSecret(24),
  C2C_PAYMENT_ADAPTER: z.enum(['deterministic', 'http']).default('deterministic'),
  C2C_PAYMENT_PROVIDER_URL: optionalUrl,
  C2C_PAYMENT_PROVIDER_TOKEN: optionalSecret(24),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_PUBLIC_ENDPOINT: optionalUrl,
  S3_REGION: z.string().min(2).default('us-east-1'),
  S3_BUCKET: z.string().min(3).default('logicommerce-local'),
  S3_ACCESS_KEY: z.string().min(3).default('logicommerce'),
  S3_SECRET_KEY: z.string().min(8).default('logicommerce_local_storage'),
  DOCUMENT_SCANNER_ADAPTER: z.enum(['deterministic', 'http']).default('deterministic'),
  DOCUMENT_SCANNER_URL: optionalUrl,
  DOCUMENT_SCANNER_TOKEN: optionalSecret(24),
  EMAIL_ADAPTER: z.enum(['preview', 'smtp']).default('preview'),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: booleanText.default(false),
  SMTP_USER: optionalText(),
  SMTP_PASSWORD: optionalSecret(8),
  SMTP_FROM: z.string().email().default('no-reply@logicommerce.local'),
  PARTNER_WEBHOOK_ADAPTER: z.enum(['deterministic', 'http']).default('deterministic'),
  PARTNER_WEBHOOK_ALLOWED_HOSTS: z.string().default(''),
  PARTNER_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
  PROVIDER_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(10_000),
  PROVIDER_HTTP_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(10_485_760)
    .default(1_048_576),
  OUTBOX_QUEUE_NAME: z.string().min(1).max(120).default('logicommerce-domain-events'),
});

const knownPlaceholderFragments = [
  'replace-with',
  'change-me',
  'changeme',
  'logicommerce_local',
  'example-secret',
  'local_storage',
];

function isWeakProductionSecret(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    value.length < 48 ||
    new Set(value).size < 12 ||
    knownPlaceholderFragments.some((fragment) => normalized.includes(fragment))
  );
}

function requireField(
  issue: z.RefinementCtx,
  environment: z.infer<typeof baseEnvironmentSchema>,
  key: keyof z.infer<typeof baseEnvironmentSchema>,
) {
  if (!environment[key]) {
    issue.addIssue({ code: 'custom', path: [key], message: 'is required in production' });
  }
}

export const environmentSchema = baseEnvironmentSchema.superRefine((environment, issue) => {
  if (environment.NODE_ENV !== 'production') return;

  for (const key of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_PEPPER',
    'FIELD_ENCRYPTION_KEY',
    'S3_SECRET_KEY',
  ] as const) {
    if (isWeakProductionSecret(environment[key])) {
      issue.addIssue({
        code: 'custom',
        path: [key],
        message: 'must be an independently generated production secret',
      });
    }
  }
  if (
    new Set([
      environment.JWT_ACCESS_SECRET,
      environment.JWT_REFRESH_PEPPER,
      environment.FIELD_ENCRYPTION_KEY,
    ]).size !== 3
  ) {
    issue.addIssue({
      code: 'custom',
      path: ['JWT_ACCESS_SECRET'],
      message: 'security keys must be distinct',
    });
  }
  if (!environment.COOKIE_SECURE) {
    issue.addIssue({
      code: 'custom',
      path: ['COOKIE_SECURE'],
      message: 'must be true in production',
    });
  }
  if (!environment.PUBLIC_BASE_URL.startsWith('https://')) {
    issue.addIssue({
      code: 'custom',
      path: ['PUBLIC_BASE_URL'],
      message: 'must use https in production',
    });
  }
  const origins = environment.CORS_ORIGINS.split(',').map((origin) => origin.trim());
  if (origins.some((origin) => !origin.startsWith('https://'))) {
    issue.addIssue({
      code: 'custom',
      path: ['CORS_ORIGINS'],
      message: 'must contain only https origins in production',
    });
  }
  if (environment.PAYMENT_ADAPTER === 'mock') {
    issue.addIssue({
      code: 'custom',
      path: ['PAYMENT_ADAPTER'],
      message: 'mock is forbidden in production',
    });
  }
  if (environment.PAYMENT_ADAPTER === 'stripe' || environment.PAYMENT_ADAPTER === 'multi') {
    requireField(issue, environment, 'STRIPE_SECRET_KEY');
    requireField(issue, environment, 'STRIPE_WEBHOOK_SECRET');
  }
  if (environment.PAYMENT_ADAPTER === 'coinbase' || environment.PAYMENT_ADAPTER === 'multi') {
    requireField(issue, environment, 'COINBASE_API_KEY_ID');
    requireField(issue, environment, 'COINBASE_API_KEY_SECRET');
    requireField(issue, environment, 'COINBASE_WEBHOOK_SECRET');
  }
  for (const [adapterKey, urlKey, tokenKey] of [
    ['COMMERCE_ADAPTER', 'COMMERCE_PROVIDER_URL', 'COMMERCE_PROVIDER_TOKEN'],
    ['CARRIER_ADAPTER', 'CARRIER_PROVIDER_URL', 'CARRIER_PROVIDER_TOKEN'],
    ['IDENTITY_VERIFICATION_ADAPTER', 'IDENTITY_VERIFICATION_URL', 'IDENTITY_VERIFICATION_TOKEN'],
    ['C2C_PAYMENT_ADAPTER', 'C2C_PAYMENT_PROVIDER_URL', 'C2C_PAYMENT_PROVIDER_TOKEN'],
    ['DOCUMENT_SCANNER_ADAPTER', 'DOCUMENT_SCANNER_URL', 'DOCUMENT_SCANNER_TOKEN'],
  ] as const) {
    if (environment[adapterKey] !== 'http') {
      issue.addIssue({
        code: 'custom',
        path: [adapterKey],
        message: 'must use an external provider in production',
      });
    }
    requireField(issue, environment, urlKey);
    requireField(issue, environment, tokenKey);
    const url = environment[urlKey];
    if (url && !url.startsWith('https://')) {
      issue.addIssue({ code: 'custom', path: [urlKey], message: 'must use https in production' });
    }
  }
  if (environment.EMAIL_ADAPTER !== 'smtp') {
    issue.addIssue({
      code: 'custom',
      path: ['EMAIL_ADAPTER'],
      message: 'must be smtp in production',
    });
  }
  requireField(issue, environment, 'SMTP_USER');
  requireField(issue, environment, 'SMTP_PASSWORD');
  if (!environment.S3_PUBLIC_ENDPOINT?.startsWith('https://')) {
    issue.addIssue({
      code: 'custom',
      path: ['S3_PUBLIC_ENDPOINT'],
      message: 'must use https in production',
    });
  }
  if (environment.PARTNER_WEBHOOK_ADAPTER !== 'http') {
    issue.addIssue({
      code: 'custom',
      path: ['PARTNER_WEBHOOK_ADAPTER'],
      message: 'must use the HTTP transport in production',
    });
  }
  if (!environment.PARTNER_WEBHOOK_ALLOWED_HOSTS.trim()) {
    issue.addIssue({
      code: 'custom',
      path: ['PARTNER_WEBHOOK_ALLOWED_HOSTS'],
      message: 'must contain an explicit production allowlist',
    });
  }
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv): Environment {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid application configuration: ${summary}`);
  }
  return result.data;
}

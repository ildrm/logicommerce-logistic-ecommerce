import { z } from 'zod';

const booleanText = z.enum(['true', 'false']).transform((value) => value === 'true');
const optionalSecret = (minimum: number) =>
  z.preprocess((value) => (value === '' ? undefined : value), z.string().min(minimum).optional());

export const environmentSchema = z.object({
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
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:8080'),
  PAYMENT_ADAPTER: z.enum(['mock', 'stripe', 'coinbase', 'multi']).default('mock'),
  STRIPE_SECRET_KEY: optionalSecret(8),
  STRIPE_WEBHOOK_SECRET: optionalSecret(8),
  COINBASE_API_KEY_ID: optionalSecret(3),
  COINBASE_API_KEY_SECRET: optionalSecret(8),
  COINBASE_WEBHOOK_SECRET: optionalSecret(8),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().min(2).default('us-east-1'),
  S3_BUCKET: z.string().min(3).default('logicommerce-local'),
  S3_ACCESS_KEY: z.string().min(3).default('logicommerce'),
  S3_SECRET_KEY: z.string().min(8).default('logicommerce_local_storage'),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
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

import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './index.js';

const valid = {
  DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_PEPPER: 'b'.repeat(32),
  FIELD_ENCRYPTION_KEY: 'c'.repeat(32),
  CORS_ORIGINS: 'http://localhost:3000',
};

const production = {
  ...valid,
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'A9!access-token_Prod-7xQ2mL8vN4cR6yT1kP5sD3fH0wE7uJ9z',
  JWT_REFRESH_PEPPER: 'B8!refresh-pepper_Prod-6wE1nK9uM3zS7pV2jG5rC4xQ0tL8hF',
  FIELD_ENCRYPTION_KEY: 'C7!field-encryption_Prod-5qW2bJ8tL4xN9mR1vH6kD3sA0yP7eG',
  CORS_ORIGINS: 'https://app.example.com',
  COOKIE_SECURE: 'true',
  PUBLIC_BASE_URL: 'https://app.example.com',
  PAYMENT_ADAPTER: 'stripe',
  STRIPE_SECRET_KEY: 'stripe-secret-production',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-production',
  COMMERCE_ADAPTER: 'http',
  COMMERCE_PROVIDER_URL: 'https://commerce.example.com',
  COMMERCE_PROVIDER_TOKEN: 'commerce-provider-token-production',
  CARRIER_ADAPTER: 'http',
  CARRIER_PROVIDER_URL: 'https://carrier.example.com',
  CARRIER_PROVIDER_TOKEN: 'carrier-provider-token-production',
  IDENTITY_VERIFICATION_ADAPTER: 'http',
  IDENTITY_VERIFICATION_URL: 'https://identity.example.com',
  IDENTITY_VERIFICATION_TOKEN: 'identity-provider-token-production',
  C2C_PAYMENT_ADAPTER: 'http',
  C2C_PAYMENT_PROVIDER_URL: 'https://escrow.example.com',
  C2C_PAYMENT_PROVIDER_TOKEN: 'escrow-provider-token-production',
  S3_PUBLIC_ENDPOINT: 'https://objects.example.com',
  S3_SECRET_KEY: 'D6!object-storage_Prod-4rT1cM9wK3xV8pQ2jH7nS5aL0zE6uB',
  DOCUMENT_SCANNER_ADAPTER: 'http',
  DOCUMENT_SCANNER_URL: 'https://scanner.example.com',
  DOCUMENT_SCANNER_TOKEN: 'document-scanner-token-production',
  EMAIL_ADAPTER: 'smtp',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'smtp-password-production',
  SMTP_FROM: 'no-reply@example.com',
  PARTNER_WEBHOOK_ADAPTER: 'http',
  PARTNER_WEBHOOK_ALLOWED_HOSTS: 'hooks.example.com',
} satisfies NodeJS.ProcessEnv;

describe('parseEnvironment', () => {
  it('fails fast when secrets are missing', () => {
    expect(() => parseEnvironment({ DATABASE_URL: valid.DATABASE_URL })).toThrow(
      'Invalid application configuration',
    );
  });

  it('parses valid configuration', () => {
    expect(parseEnvironment(valid).API_PORT).toBe(3001);
    expect(parseEnvironment(valid).JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(parseEnvironment(valid).AUTH_LOGIN_RATE_LIMIT_MAX).toBe(10);
  });

  it('accepts TLS Redis URLs and rejects malformed CORS origins', () => {
    expect(
      parseEnvironment({ ...valid, REDIS_URL: 'rediss://cache.example.com:6380' }).REDIS_URL,
    ).toBe('rediss://cache.example.com:6380');
    expect(() =>
      parseEnvironment({ ...valid, CORS_ORIGINS: 'https://app.example.com/path' }),
    ).toThrow('CORS_ORIGINS');
  });

  it('rejects repository placeholders in production', () => {
    expect(() =>
      parseEnvironment({
        ...production,
        JWT_ACCESS_SECRET: 'replace-with-at-least-32-random-characters',
      }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('requires external adapters and secure origins in production', () => {
    expect(() =>
      parseEnvironment({
        ...production,
        COMMERCE_ADAPTER: 'deterministic',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow('COMMERCE_ADAPTER');
  });

  it('rejects the deterministic webhook transport in production', () => {
    expect(() =>
      parseEnvironment({
        ...production,
        PARTNER_WEBHOOK_ADAPTER: 'deterministic',
      }),
    ).toThrow('PARTNER_WEBHOOK_ADAPTER');
  });

  it('rejects the Coinbase sandbox endpoint in production', () => {
    expect(() =>
      parseEnvironment({
        ...production,
        COINBASE_API_BASE_URL: 'https://business.coinbase.com/sandbox/api/v1',
      }),
    ).toThrow('COINBASE_API_BASE_URL');
  });

  it('accepts a complete fail-closed production configuration', () => {
    expect(parseEnvironment(production).NODE_ENV).toBe('production');
  });
});

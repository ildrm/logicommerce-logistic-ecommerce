import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail: vi.fn() })));

vi.mock('nodemailer', () => ({ default: { createTransport } }));

import { IdentityMailAdapter } from './identity-mail.adapter.js';

const originalEnvironment = { ...process.env };

describe('IdentityMailAdapter', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://user:password@localhost:3306/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-32-characters',
      JWT_REFRESH_PEPPER: 'refresh-pepper-that-is-at-least-32-characters',
      FIELD_ENCRYPTION_KEY: 'field-encryption-key-at-least-32-characters',
      CORS_ORIGINS: 'http://localhost:8080',
      EMAIL_ADAPTER: 'smtp',
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'mailer',
      SMTP_PASSWORD: 'smtp-password-test',
      SMTP_FROM: 'no-reply@example.test',
    });
    createTransport.mockClear();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) delete process.env[key];
    }
    Object.assign(process.env, originalEnvironment);
  });

  it('requires authenticated TLS even when using STARTTLS submission', () => {
    new IdentityMailAdapter();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: false,
        requireTLS: true,
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      }),
    );
  });
});

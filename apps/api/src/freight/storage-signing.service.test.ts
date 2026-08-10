import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageSigningService } from './storage-signing.service.js';

const originalEnvironment = { ...process.env };

describe('StorageSigningService', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://user:password@localhost:3306/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-32-characters',
      JWT_REFRESH_PEPPER: 'refresh-pepper-that-is-at-least-32-characters',
      FIELD_ENCRYPTION_KEY: 'field-encryption-key-at-least-32-characters',
      CORS_ORIGINS: 'http://localhost:8080',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_BUCKET: 'test-bucket',
      S3_ACCESS_KEY: 'test-access',
      S3_SECRET_KEY: 'test-secret-key',
    });
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) delete process.env[key];
    }
    Object.assign(process.env, originalEnvironment);
  });

  it('binds exact length and a storage-verified SHA-256 header into the PUT signature', () => {
    const checksum = 'ab'.repeat(32);
    const signed = new StorageSigningService().presignPut(
      'tenant/staging/document.pdf',
      'application/pdf',
      1_024,
      checksum,
    );
    expect(signed.headers).toEqual({
      'content-type': 'application/pdf',
      'content-length': '1024',
      'x-amz-checksum-sha256': Buffer.from(checksum, 'hex').toString('base64'),
    });
    expect(new URL(signed.url).searchParams.get('X-Amz-SignedHeaders')).toBe(
      'content-length;content-type;host;x-amz-checksum-sha256',
    );
  });
});

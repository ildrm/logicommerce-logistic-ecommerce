import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentScannerService } from './document-scanner.service.js';

const originalEnvironment = { ...process.env };
const checksum = 'cd'.repeat(32);

describe('DocumentScannerService', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://user:password@localhost:3306/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-32-characters',
      JWT_REFRESH_PEPPER: 'refresh-pepper-that-is-at-least-32-characters',
      FIELD_ENCRYPTION_KEY: 'field-encryption-key-at-least-32-characters',
      CORS_ORIGINS: 'http://localhost:8080',
      DOCUMENT_SCANNER_ADAPTER: 'http',
      DOCUMENT_SCANNER_URL: 'https://scanner.example.test',
      DOCUMENT_SCANNER_TOKEN: 'scanner-token-that-is-long-enough',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) delete process.env[key];
    }
    Object.assign(process.env, originalEnvironment);
  });

  it('rejects a scanner response that does not attest the verified object digest', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ clean: true, reference: 'scan-1', checksum: 'ef'.repeat(32) }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
    );
    const storage = {
      presignGet: vi.fn().mockReturnValue({ url: 'https://objects.example.test/x' }),
    };
    const scanner = new DocumentScannerService(storage as never);

    await expect(
      scanner.scan({
        objectKey: 'tenant/verified/document',
        contentType: 'application/pdf',
        sizeBytes: 1_024,
        checksum,
      }),
    ).rejects.toThrow('Document scanner returned an invalid result');
  });

  it('accepts a clean scanner result only when the digest matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ clean: true, reference: 'scan-2', checksum }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const storage = {
      presignGet: vi.fn().mockReturnValue({ url: 'https://objects.example.test/x' }),
    };

    await expect(
      new DocumentScannerService(storage as never).scan({
        objectKey: 'tenant/verified/document',
        contentType: 'application/pdf',
        sizeBytes: 1_024,
        checksum,
      }),
    ).resolves.toMatchObject({ clean: true, reference: 'scan-2', checksum });
  });

  it('uses the network-free deterministic scanner outside production', async () => {
    process.env.DOCUMENT_SCANNER_ADAPTER = 'deterministic';
    delete process.env.DOCUMENT_SCANNER_URL;
    delete process.env.DOCUMENT_SCANNER_TOKEN;
    const storage = { presignGet: vi.fn() };

    await expect(
      new DocumentScannerService(storage as never).scan({
        objectKey: 'tenant/verified/document',
        contentType: 'application/pdf',
        sizeBytes: 1_024,
        checksum,
      }),
    ).resolves.toEqual({ clean: true, reference: `local-scan:${checksum}`, checksum });
    expect(storage.presignGet).not.toHaveBeenCalled();
  });

  it('fails closed when the HTTP scanner configuration is incomplete', async () => {
    delete process.env.DOCUMENT_SCANNER_TOKEN;
    const scanner = new DocumentScannerService({ presignGet: vi.fn() } as never);

    await expect(
      scanner.scan({
        objectKey: 'tenant/verified/document',
        contentType: 'application/pdf',
        sizeBytes: 1_024,
        checksum,
      }),
    ).rejects.toThrow('The HTTP document scanner is not completely configured');
  });
});

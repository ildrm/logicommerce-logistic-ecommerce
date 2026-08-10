import { ServiceUnavailableException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { AuthRateLimitService } from './auth-rate-limit.service.js';

const options = {
  accessSecret: 'access-secret-that-is-at-least-32-characters',
  refreshPepper: 'refresh-pepper-that-is-at-least-32-characters',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 2_592_000,
  cookieSecure: false,
  loginRateLimitMax: 10,
  refreshRateLimitMax: 30,
  recoveryRateLimitMax: 5,
  rateLimitWindowSeconds: 60,
};
const context = { tenantId: 'tenant-a', actorId: null, correlationId: 'request-a' };

describe('AuthRateLimitService', () => {
  it('uses a hashed key and permits requests within the limit', async () => {
    const evaluate = vi
      .fn<
        (script: string, keyCount: number, key: string, windowSeconds: number) => Promise<number>
      >()
      .mockResolvedValue(1);
    const service = new AuthRateLimitService({ eval: evaluate } as unknown as Redis, options);

    await service.assertLoginAllowed(context, 'Admin@Example.com', '192.0.2.1');

    const key = evaluate.mock.calls[0]?.[2];
    expect(key).toMatch(/^auth:login:[a-f0-9]{64}$/u);
    expect(String(key)).not.toContain('example.com');
  });

  it('returns 429 after the configured limit', async () => {
    const service = new AuthRateLimitService(
      { eval: vi.fn().mockResolvedValue(11) } as unknown as Redis,
      options,
    );
    await expect(
      service.assertLoginAllowed(context, 'admin@example.com', '192.0.2.1'),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('rate-limits recovery requests with a privacy-preserving tenant scope', async () => {
    const evaluate = vi
      .fn<
        (script: string, keyCount: number, key: string, windowSeconds: number) => Promise<number>
      >()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(6);
    const service = new AuthRateLimitService({ eval: evaluate } as unknown as Redis, options);

    await service.assertRecoveryAllowed(
      context,
      'Admin@Example.com',
      '192.0.2.1',
      'PASSWORD_RESET',
    );
    await expect(
      service.assertRecoveryAllowed(context, 'admin@example.com', '192.0.2.1', 'PASSWORD_RESET'),
    ).rejects.toMatchObject({ status: 429 });

    const accountKey = evaluate.mock.calls[0]?.[2];
    const ipKey = evaluate.mock.calls[1]?.[2];
    expect(accountKey).toMatch(/^auth:recovery:PASSWORD_RESET:account:[a-f0-9]{64}$/u);
    expect(ipKey).toMatch(/^auth:recovery:PASSWORD_RESET:ip:[a-f0-9]{64}$/u);
    expect(String(accountKey)).not.toContain('example.com');
    expect(String(accountKey)).not.toContain('tenant-a');
    expect(String(ipKey)).not.toContain('tenant-a');
    expect(String(ipKey)).not.toContain('192.0.2.1');
  });

  it('fails closed when Redis is unavailable', async () => {
    const service = new AuthRateLimitService(
      { eval: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as Redis,
      options,
    );
    await expect(service.assertRefreshAllowed(context, '192.0.2.1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

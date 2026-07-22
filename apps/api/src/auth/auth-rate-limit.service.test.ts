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

import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@logicommerce/database';
import type { Redis } from 'ioredis';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports ready only after both durable state and authentication storage respond', async () => {
    const query = vi.fn().mockResolvedValue([{ ok: 1 }]);
    const ping = vi.fn().mockResolvedValue('PONG');
    const controller = new HealthController(
      { $queryRaw: query } as unknown as DatabaseClient,
      { ping } as unknown as Redis,
    );

    await expect(controller.ready()).resolves.toMatchObject({ status: 'ok', service: 'api' });
    expect(query).toHaveBeenCalledOnce();
    expect(ping).toHaveBeenCalledOnce();
  });

  it('does not report ready when Redis is unavailable', async () => {
    const controller = new HealthController(
      { $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]) } as unknown as DatabaseClient,
      { ping: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as Redis,
    );

    await expect(controller.ready()).rejects.toThrow('offline');
  });
});

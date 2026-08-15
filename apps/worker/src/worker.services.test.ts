import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@logicommerce/database';

const mocks = vi.hoisted(() => ({
  close: vi.fn().mockResolvedValue(undefined),
  error: vi.fn(),
}));

vi.mock('@logicommerce/config', () => ({
  parseEnvironment: () => ({
    REDIS_URL: 'rediss://queue-user:queue-password@redis.example:6380/3',
    OUTBOX_QUEUE_NAME: 'outbox',
  }),
}));
vi.mock('@logicommerce/observability', () => ({
  createLogger: () => ({ error: mocks.error, info: vi.fn(), warn: vi.fn() }),
}));
vi.mock('bullmq', () => ({
  Queue: class {
    close = mocks.close;
  },
}));

import { HEALTH_FILE, OutboxPublisher, WorkerHealth, redisConnection } from './worker.services.js';

describe('worker services', () => {
  it('configures TLS and database selection for rediss queues', () => {
    expect(redisConnection('rediss://user:secret@redis.example:6380/3')).toMatchObject({
      host: 'redis.example',
      port: 6380,
      username: 'user',
      password: 'secret',
      db: 3,
      tls: {},
      maxRetriesPerRequest: null,
    });
  });

  it('logs an initial outbox failure and leaves the retry loop active', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const publisher = new OutboxPublisher({
      outboxEvent: { findMany: vi.fn().mockRejectedValue(new Error('database offline')) },
      $disconnect: disconnect,
    } as unknown as DatabaseClient);

    publisher.onModuleInit();
    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalled());
    await publisher.onApplicationShutdown();

    expect(disconnect).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('writes its health marker to the operating-system temporary directory', async () => {
    const health = new WorkerHealth();
    await health.onModuleInit();
    await expect(readFile(HEALTH_FILE, 'utf8')).resolves.toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    await health.onApplicationShutdown();
  });
});

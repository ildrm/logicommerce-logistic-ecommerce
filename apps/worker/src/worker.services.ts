import { writeFile, unlink } from 'node:fs/promises';
import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type { DatabaseClient } from '@logicommerce/database';
import { createLogger } from '@logicommerce/observability';

const logger = createLogger('worker');
export const DATABASE = Symbol('DATABASE');

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;

  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.publishBatch().catch((error: unknown) => {
        logger.error({ err: error }, 'Outbox poll failed; retrying');
      });
    }, 2_000);
  }

  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.database.$disconnect();
  }

  private async publishBatch() {
    const events = await this.database.outboxEvent.findMany({
      where: { status: 'PENDING', availableAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const event of events) {
      logger.info(
        { eventId: event.id, eventType: event.type, tenantId: event.tenantId },
        'Outbox event ready',
      );
      await this.database.outboxEvent.updateMany({
        where: { id: event.id, tenantId: event.tenantId, status: 'PENDING' },
        data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } },
      });
    }
  }
}

@Injectable()
export class WorkerHealth implements OnModuleInit, OnApplicationShutdown {
  async onModuleInit() {
    await writeFile('/tmp/logicommerce-worker-healthy', new Date().toISOString(), { mode: 0o600 });
  }

  async onApplicationShutdown() {
    await unlink('/tmp/logicommerce-worker-healthy').catch(() => undefined);
  }
}

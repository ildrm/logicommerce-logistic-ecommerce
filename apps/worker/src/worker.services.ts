import { randomUUID } from 'node:crypto';
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
export class ReservationExpirySweeper implements OnModuleInit, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;

  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.releaseBatch().catch((error: unknown) => {
        logger.error({ err: error }, 'Reservation expiry sweep failed; retrying');
      });
    }, 30_000);
    void this.releaseBatch().catch((error: unknown) => {
      logger.error({ err: error }, 'Initial reservation expiry sweep failed');
    });
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async releaseBatch() {
    const expired = await this.database.inventoryReservation.findMany({
      where: {
        expiresAt: { lte: new Date() },
        releasedAt: null,
        allocatedAt: null,
      },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });
    for (const reservation of expired) {
      await this.database.$transaction(async (transaction) => {
        const claimed = await transaction.inventoryReservation.updateMany({
          where: {
            id: reservation.id,
            tenantId: reservation.tenantId,
            releasedAt: null,
            allocatedAt: null,
            expiresAt: { lte: new Date() },
          },
          data: { releasedAt: new Date() },
        });
        if (claimed.count !== 1) return;
        const changed = await transaction.$executeRaw`
          UPDATE InventoryBalance
          SET quantity = quantity - ${reservation.quantity}, version = version + 1
          WHERE tenantId = ${reservation.tenantId}
            AND inventoryItemId = ${reservation.inventoryItemId}
            AND state = 'RESERVED'
            AND quantity >= ${reservation.quantity}
        `;
        if (Number(changed) !== 1) {
          throw new Error(`Reservation ${reservation.id} has no matching reserved balance`);
        }
        await transaction.inventoryBalance.upsert({
          where: {
            tenantId_inventoryItemId_state: {
              tenantId: reservation.tenantId,
              inventoryItemId: reservation.inventoryItemId,
              state: 'ON_HAND',
            },
          },
          create: {
            id: randomUUID(),
            tenantId: reservation.tenantId,
            inventoryItemId: reservation.inventoryItemId,
            state: 'ON_HAND',
            quantity: reservation.quantity,
          },
          update: { quantity: { increment: reservation.quantity }, version: { increment: 1 } },
        });
        const correlationId = randomUUID();
        await transaction.stockLedgerEntry.createMany({
          data: [
            {
              id: randomUUID(),
              tenantId: reservation.tenantId,
              inventoryItemId: reservation.inventoryItemId,
              state: 'RESERVED',
              quantityDelta: -reservation.quantity,
              operation: 'RELEASE',
              reasonCode: 'RESERVATION_EXPIRED',
              sourceType: 'INVENTORY_RESERVATION',
              sourceId: reservation.id,
              idempotencyKey: `expiry:${reservation.id}:reserved`,
              correlationId,
            },
            {
              id: randomUUID(),
              tenantId: reservation.tenantId,
              inventoryItemId: reservation.inventoryItemId,
              state: 'ON_HAND',
              quantityDelta: reservation.quantity,
              operation: 'RELEASE',
              reasonCode: 'RESERVATION_EXPIRED',
              sourceType: 'INVENTORY_RESERVATION',
              sourceId: reservation.id,
              idempotencyKey: `expiry:${reservation.id}:on-hand`,
              correlationId,
            },
          ],
        });
        await transaction.outboxEvent.create({
          data: {
            id: randomUUID(),
            tenantId: reservation.tenantId,
            type: 'inventory.reservation.expired.v1',
            subject: `inventory-reservation/${reservation.id}`,
            payload: {
              reservationId: reservation.id,
              inventoryItemId: reservation.inventoryItemId,
              quantity: Number(reservation.quantity),
            },
            correlationId,
          },
        });
      });
    }
    if (expired.length > 0) logger.info({ count: expired.length }, 'Expired reservations released');
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

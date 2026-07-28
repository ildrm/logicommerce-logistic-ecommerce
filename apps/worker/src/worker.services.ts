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
export class TransportOperationsSweeper implements OnModuleInit, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;

  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sweep().catch((error: unknown) => {
        logger.error({ err: error }, 'Transport operations sweep failed; retrying');
      });
    }, 60_000);
    void this.sweep();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    const now = new Date();
    const overdue = await this.database.dispatchAssignment.findMany({
      where: { status: 'IN_TRANSIT', nextCheckInAt: { lte: now } },
      include: { leg: true },
      take: 100,
    });
    for (const assignment of overdue) {
      await this.database.$transaction(async (tx) => {
        const open = await tx.freightException.findFirst({
          where: {
            tenantId: assignment.tenantId,
            assignmentId: assignment.id,
            code: 'CHECK_IN_OVERDUE',
            status: 'OPEN',
          },
        });
        if (open) return;
        await tx.freightException.create({
          data: {
            id: randomUUID(),
            tenantId: assignment.tenantId,
            bookingId: assignment.leg.bookingId,
            assignmentId: assignment.id,
            code: 'CHECK_IN_OVERDUE',
            severity: 'HIGH',
            description: `Driver check-in overdue since ${assignment.nextCheckInAt?.toISOString() ?? 'unknown'}`,
          },
        });
        await tx.freightBooking.updateMany({
          where: {
            id: assignment.leg.bookingId,
            tenantId: assignment.tenantId,
            status: 'IN_TRANSIT',
          },
          data: { status: 'EXCEPTION', version: { increment: 1 } },
        });
      });
    }
    await this.database.paymentSession.updateMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    await this.database.billingInvoice.updateMany({
      where: {
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueAt: { lt: now },
      },
      data: { status: 'OVERDUE', version: { increment: 1 } },
    });
    await this.database.cargoInsuranceQuote.updateMany({
      where: { status: 'QUOTED', validUntil: { lt: now } },
      data: { status: 'EXPIRED', version: { increment: 1 } },
    });
    await this.database.cargoInsurancePolicy.updateMany({
      where: { status: { in: ['AWAITING_PAYMENT', 'ACTIVE'] }, coverageEndAt: { lt: now } },
      data: { status: 'EXPIRED', version: { increment: 1 } },
    });
    const overdueConsolidations = await this.database.consolidationPlan.findMany({
      where: { status: { in: ['DRAFT', 'OPEN'] }, cutoffAt: { lte: now } },
      take: 100,
    });
    for (const plan of overdueConsolidations) {
      const subject = `consolidation-plan/${plan.id}`;
      const existing = await this.database.outboxEvent.findFirst({
        where: {
          tenantId: plan.tenantId,
          type: 'consolidation.cutoff.missed.v1',
          subject,
        },
      });
      if (existing) continue;
      await this.database.outboxEvent.create({
        data: {
          id: randomUUID(),
          tenantId: plan.tenantId,
          type: 'consolidation.cutoff.missed.v1',
          subject,
          payload: {
            planId: plan.id,
            planNumber: plan.number,
            cutoffAt: plan.cutoffAt.toISOString(),
          },
          correlationId: randomUUID(),
        },
      });
    }
    const delayedPostalDispatches = await this.database.postalDispatch.findMany({
      where: {
        status: 'OPEN',
        scheduledDepartureAt: { lt: now },
      },
      take: 100,
    });
    for (const dispatch of delayedPostalDispatches) {
      const subject = `postal-dispatch/${dispatch.id}`;
      const existing = await this.database.outboxEvent.findFirst({
        where: {
          tenantId: dispatch.tenantId,
          type: 'postal.dispatch.handover-overdue.v1',
          subject,
        },
      });
      if (existing) continue;
      await this.database.outboxEvent.create({
        data: {
          id: randomUUID(),
          tenantId: dispatch.tenantId,
          type: 'postal.dispatch.handover-overdue.v1',
          subject,
          payload: {
            dispatchId: dispatch.id,
            dispatchIdentifier: dispatch.dispatchId,
            scheduledDepartureAt: dispatch.scheduledDepartureAt?.toISOString(),
          },
          correlationId: randomUUID(),
        },
      });
    }
    if (overdue.length > 0) {
      logger.warn({ count: overdue.length }, 'Overdue transport check-ins opened as exceptions');
    }
    if (delayedPostalDispatches.length > 0) {
      logger.warn(
        { count: delayedPostalDispatches.length },
        'Postal dispatch handovers are past schedule',
      );
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

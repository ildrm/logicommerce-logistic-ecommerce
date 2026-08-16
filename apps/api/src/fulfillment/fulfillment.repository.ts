import { createHash, randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  safeIntegerNumber,
  type DatabaseClient,
  type Prisma,
  type TenantContext,
} from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import { CARRIER_ADAPTER, type CarrierPort } from './carrier.adapter.js';
import type {
  CreateAsnDto,
  CreateBinDto,
  CreateFacilityDto,
  CreateFulfillmentDto,
  LabelDto,
  PackDto,
  PutawayDto,
  ReceiveAsnDto,
  TrackingEventDto,
} from './fulfillment.dto.js';

export function asnReceiptPayloadHash(input: ReceiveAsnDto): string {
  const lines = input.lines
    .map((line) => ({
      lineId: line.lineId,
      acceptedQty: line.acceptedQty,
      rejectedQty: line.rejectedQty,
      inspection: line.inspection,
    }))
    .sort((left, right) => left.lineId.localeCompare(right.lineId));
  return createHash('sha256').update(JSON.stringify({ lines })).digest('hex');
}

@Injectable()
export class FulfillmentRepository {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(CARRIER_ADAPTER) private readonly carrier: CarrierPort,
  ) {}

  facilities(context: TenantContext): Promise<unknown> {
    return this.db.facility.findMany({
      where: { tenantId: context.tenantId, deletedAt: null },
      include: { bins: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createFacility(context: TenantContext, input: CreateFacilityDto): Promise<unknown> {
    return this.db.facility.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        key: input.key,
        name: input.name,
        address: input.address as Prisma.InputJsonValue,
      },
    });
  }

  async createBin(
    context: TenantContext,
    facilityId: string,
    input: CreateBinDto,
  ): Promise<unknown> {
    await this.requireFacility(context, facilityId);
    return this.db.facilityBin.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        facilityId,
        code: input.code,
        kind: input.kind ?? 'STORAGE',
        capacity: input.capacity ?? null,
      },
    });
  }

  asns(context: TenantContext): Promise<unknown> {
    return this.db.advanceShippingNotice.findMany({
      where: { tenantId: context.tenantId },
      include: { lines: true, facility: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAsn(context: TenantContext, input: CreateAsnDto): Promise<unknown> {
    await this.requireFacility(context, input.facilityId);
    const variants = await this.db.productVariant.count({
      where: { tenantId: context.tenantId, id: { in: input.lines.map((line) => line.variantId) } },
    });
    if (variants !== new Set(input.lines.map((line) => line.variantId)).size) {
      throw new NotFoundException('Resource not found');
    }
    return this.db.advanceShippingNotice.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        facilityId: input.facilityId,
        supplierId: input.supplierId ?? null,
        reference: input.reference,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        lines: {
          create: input.lines.map((line) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            variantId: line.variantId,
            expectedQty: line.quantity,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async receiveAsn(
    context: TenantContext,
    principal: AuthPrincipal,
    asnId: string,
    input: ReceiveAsnDto,
    idempotencyKey: string,
  ): Promise<unknown> {
    const normalizedIdempotencyKey = idempotencyKey.trim();
    this.requireIdempotency(normalizedIdempotencyKey);
    if (new Set(input.lines.map((line) => line.lineId)).size !== input.lines.length) {
      throw new ConflictException('Each ASN line may only appear once per receipt');
    }
    const payloadHash = asnReceiptPayloadHash(input);

    try {
      return await this.db.$transaction(async (tx) => {
        const asn = await tx.advanceShippingNotice.findFirst({
          where: { id: asnId, tenantId: context.tenantId },
          include: { lines: true },
        });
        if (!asn) throw new NotFoundException('Resource not found');

        const priorReceipt = await tx.asnReceiptCommand.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: context.tenantId,
              idempotencyKey: normalizedIdempotencyKey,
            },
          },
        });
        if (priorReceipt) {
          this.assertAsnReceiptReplay(priorReceipt, asnId, payloadHash);
          return asn;
        }
        if (asn.status !== 'OPEN' && asn.status !== 'IN_PROGRESS') {
          throw new ConflictException('ASN is not open for receiving');
        }

        for (const received of input.lines) {
          const line = asn.lines.find((candidate) => candidate.id === received.lineId);
          const receivedQuantity = received.acceptedQty + received.rejectedQty;
          if (
            !line ||
            receivedQuantity < 1 ||
            receivedQuantity > line.expectedQty ||
            line.receivedQty !== 0 ||
            line.inspection !== 'PENDING' ||
            received.acceptedQty > 0 !== (received.inspection === 'PASSED')
          ) {
            throw new ConflictException('Invalid ASN receipt quantity or inspection');
          }
        }

        await tx.asnReceiptCommand.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            asnId,
            idempotencyKey: normalizedIdempotencyKey,
            payloadHash,
          },
        });

        for (const received of input.lines) {
          const line = asn.lines.find((candidate) => candidate.id === received.lineId)!;
          let inventoryItemId: string | undefined;
          if (received.acceptedQty > 0) {
            const variant = await tx.productVariant.findFirst({
              where: { id: line.variantId, tenantId: context.tenantId },
            });
            if (!variant) throw new NotFoundException('Resource not found');
            const item = await tx.inventoryItem.upsert({
              where: {
                tenantId_facilityId_sku: {
                  tenantId: context.tenantId,
                  facilityId: asn.facilityId,
                  sku: variant.sku,
                },
              },
              create: {
                id: randomUUID(),
                tenantId: context.tenantId,
                facilityId: asn.facilityId,
                sku: variant.sku,
                productRef: variant.id,
              },
              update: { productRef: variant.id, version: { increment: 1 } },
            });
            inventoryItemId = item.id;
            await tx.inventoryBalance.upsert({
              where: {
                tenantId_inventoryItemId_state: {
                  tenantId: context.tenantId,
                  inventoryItemId: item.id,
                  state: 'ON_HAND',
                },
              },
              create: {
                id: randomUUID(),
                tenantId: context.tenantId,
                inventoryItemId: item.id,
                state: 'ON_HAND',
                quantity: received.acceptedQty,
              },
              update: {
                quantity: { increment: received.acceptedQty },
                version: { increment: 1 },
              },
            });
            await tx.stockLedgerEntry.create({
              data: {
                id: randomUUID(),
                tenantId: context.tenantId,
                inventoryItemId: item.id,
                state: 'ON_HAND',
                quantityDelta: received.acceptedQty,
                operation: 'RECEIVE',
                reasonCode: 'ASN_RECEIPT',
                sourceType: 'ASN_LINE',
                sourceId: line.id,
                idempotencyKey: `${normalizedIdempotencyKey}:${line.id}`,
                correlationId: context.correlationId,
                actorId: principal.userId,
              },
            });
          }
          await tx.asnLine.update({
            where: { id: line.id },
            data: {
              ...(inventoryItemId ? { inventoryItemId } : {}),
              receivedQty: received.acceptedQty + received.rejectedQty,
              acceptedQty: received.acceptedQty,
              rejectedQty: received.rejectedQty,
              inspection: received.inspection,
            },
          });
        }

        const receivingBlockers = await tx.asnLine.count({
          where: {
            asnId,
            tenantId: context.tenantId,
            OR: [{ inspection: 'PENDING' }, { acceptedQty: { gt: 0 }, putawayAt: null }],
          },
        });
        const updated = await tx.advanceShippingNotice.updateMany({
          where: {
            id: asn.id,
            tenantId: context.tenantId,
            version: asn.version,
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
          data: {
            status: receivingBlockers === 0 ? 'COMPLETED' : 'IN_PROGRESS',
            receivedAt: asn.receivedAt ?? new Date(),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('ASN was changed by another receipt');
        }
        return tx.advanceShippingNotice.findUniqueOrThrow({
          where: { id: asn.id },
          include: { lines: true },
        });
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const priorReceipt = await this.db.asnReceiptCommand.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: context.tenantId,
            idempotencyKey: normalizedIdempotencyKey,
          },
        },
      });
      if (!priorReceipt) throw error;
      this.assertAsnReceiptReplay(priorReceipt, asnId, payloadHash);
      const asn = await this.db.advanceShippingNotice.findFirst({
        where: { id: asnId, tenantId: context.tenantId },
        include: { lines: true },
      });
      if (!asn) throw new NotFoundException('Resource not found');
      return asn;
    }
  }

  async putaway(context: TenantContext, asnId: string, input: PutawayDto): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const [line, bin] = await Promise.all([
        tx.asnLine.findFirst({
          where: { id: input.lineId, tenantId: context.tenantId, asnId },
          include: { asn: true },
        }),
        tx.facilityBin.findFirst({
          where: { id: input.binId, tenantId: context.tenantId },
        }),
      ]);
      if (!line || !bin || bin.facilityId !== line.asn.facilityId) {
        throw new NotFoundException('Resource not found');
      }
      if (line.putawayAt && line.putawayBinId !== bin.id) {
        throw new ConflictException('ASN line was already put away in another bin');
      }
      if (!line.putawayAt && line.asn.status !== 'IN_PROGRESS') {
        throw new ConflictException('ASN is not ready for putaway');
      }
      if (!line.inventoryItemId || line.acceptedQty < 1 || line.inspection !== 'PASSED') {
        throw new ConflictException('Only inspected accepted inventory can be put away');
      }
      if (!line.putawayAt) {
        await tx.asnLine.update({
          where: { id: line.id },
          data: { putawayBinId: bin.id, putawayAt: new Date() },
        });
      }
      const remaining = await tx.asnLine.count({
        where: {
          asnId,
          tenantId: context.tenantId,
          OR: [{ inspection: 'PENDING' }, { acceptedQty: { gt: 0 }, putawayAt: null }],
        },
      });
      if (remaining === 0 && line.asn.status === 'IN_PROGRESS') {
        await tx.advanceShippingNotice.updateMany({
          where: { id: asnId, tenantId: context.tenantId, status: 'IN_PROGRESS' },
          data: { status: 'COMPLETED', version: { increment: 1 } },
        });
      }
      return tx.advanceShippingNotice.findUnique({
        where: { id: asnId },
        include: { lines: true },
      });
    });
  }

  fulfillments(context: TenantContext): Promise<unknown> {
    return this.db.fulfillmentOrder.findMany({
      where: { tenantId: context.tenantId },
      include: { lines: true, packages: true, shipments: { include: { events: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFulfillment(context: TenantContext, input: CreateFulfillmentDto): Promise<unknown> {
    const split = await this.db.orderSplit.findFirst({
      where: { id: input.orderSplitId, tenantId: context.tenantId, status: 'ACCEPTED' },
      include: { order: { include: { lines: true } } },
    });
    await this.requireFacility(context, input.facilityId);
    if (!split) throw new NotFoundException('Accepted order split not found');
    const relevant = split.order.lines.filter(
      (line) => line.sellerId === split.sellerId && line.supplierId === split.supplierId,
    );
    const items = await this.db.inventoryItem.findMany({
      where: {
        tenantId: context.tenantId,
        facilityId: input.facilityId,
        productRef: { in: relevant.map((line) => line.variantId) },
      },
    });
    if (items.length !== relevant.length) throw new ConflictException('Inventory is unavailable');
    return this.db.fulfillmentOrder.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        orderSplitId: split.id,
        facilityId: input.facilityId,
        slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null,
        lines: {
          create: relevant.map((line) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            orderLineId: line.id,
            inventoryItemId: items.find((item) => item.productRef === line.variantId)!.id,
            quantity: line.quantity,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async pick(context: TenantContext, id: string, binId?: string): Promise<unknown> {
    const order = await this.requireFulfillment(context, id);
    if (!['PENDING', 'RELEASED', 'PICKING'].includes(order.status)) {
      throw new ConflictException('Fulfillment cannot be picked in its current state');
    }
    return this.db.$transaction(async (tx) => {
      for (const line of order.lines) {
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_inventoryItemId_state: {
              tenantId: context.tenantId,
              inventoryItemId: line.inventoryItemId,
              state: 'ON_HAND',
            },
          },
        });
        if (!balance || balance.quantity < BigInt(line.quantity)) {
          throw new ConflictException('Insufficient inventory');
        }
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: { quantity: { decrement: line.quantity }, version: { increment: 1 } },
        });
        await tx.inventoryBalance.upsert({
          where: {
            tenantId_inventoryItemId_state: {
              tenantId: context.tenantId,
              inventoryItemId: line.inventoryItemId,
              state: 'PICKED',
            },
          },
          create: {
            id: randomUUID(),
            tenantId: context.tenantId,
            inventoryItemId: line.inventoryItemId,
            state: 'PICKED',
            quantity: line.quantity,
          },
          update: { quantity: { increment: line.quantity }, version: { increment: 1 } },
        });
        await tx.fulfillmentLine.update({
          where: { id: line.id },
          data: { pickedQty: line.quantity, binId: binId ?? null },
        });
      }
      return tx.fulfillmentOrder.update({
        where: { id },
        data: { status: 'PICKED', version: { increment: 1 } },
        include: { lines: true },
      });
    });
  }

  async pack(context: TenantContext, id: string, input: PackDto): Promise<unknown> {
    const order = await this.requireFulfillment(context, id);
    if (order.status !== 'PICKED') throw new ConflictException('Fulfillment must be picked first');
    return this.db.$transaction(async (tx) => {
      await Promise.all(
        order.lines.map((line) =>
          tx.fulfillmentLine.update({
            where: { id: line.id },
            data: { packedQty: line.quantity },
          }),
        ),
      );
      const pkg = await tx.fulfillmentPackage.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          fulfillmentOrderId: id,
          code: input.packageCode,
          weightGrams: input.weightGrams,
          dimensions: (input.dimensions ?? null) as Prisma.InputJsonValue,
        },
      });
      await tx.fulfillmentOrder.update({
        where: { id },
        data: { status: 'PACKED', version: { increment: 1 } },
      });
      return pkg;
    });
  }

  async label(context: TenantContext, id: string, input: LabelDto): Promise<unknown> {
    const order = await this.requireFulfillment(context, id);
    if (order.status !== 'PACKED' || order.packages.length !== 1) {
      throw new ConflictException('A packed package is required');
    }
    const shipmentId = randomUUID();
    const label = await this.carrier.createLabel({
      shipmentId,
      tenantId: context.tenantId,
      carrierKey: input.carrierKey,
      serviceLevel: input.serviceLevel,
      weightGrams: order.packages[0]!.weightGrams,
    });
    return this.db.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          id: shipmentId,
          tenantId: context.tenantId,
          fulfillmentOrderId: id,
          packageId: order.packages[0]!.id,
          ...input,
          ...label,
        },
      });
      await tx.fulfillmentOrder.update({
        where: { id },
        data: { status: 'LABELED', version: { increment: 1 } },
      });
      return {
        ...shipment,
        rateMinor: safeIntegerNumber(shipment.rateMinor, 'Shipment rate'),
      };
    });
  }

  transition(
    context: TenantContext,
    id: string,
    next: 'MANIFESTED' | 'DISPATCHED',
  ): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const order = await this.requireFulfillment(context, id);
      const expected = next === 'MANIFESTED' ? 'LABELED' : 'MANIFESTED';
      if (order.status !== expected) throw new ConflictException(`Expected ${expected} status`);
      const now = new Date();
      await tx.shipment.updateMany({
        where: { tenantId: context.tenantId, fulfillmentOrderId: id },
        data:
          next === 'MANIFESTED'
            ? { status: next, manifestedAt: now, version: { increment: 1 } }
            : { status: next, dispatchedAt: now, version: { increment: 1 } },
      });
      return tx.fulfillmentOrder.update({
        where: { id },
        data: { status: next, version: { increment: 1 } },
        include: { shipments: true },
      });
    });
  }

  async tracking(
    context: TenantContext,
    shipmentId: string,
    input: TrackingEventDto,
  ): Promise<unknown> {
    const shipment = await this.db.shipment.findFirst({
      where: { id: shipmentId, tenantId: context.tenantId },
    });
    if (!shipment) throw new NotFoundException('Resource not found');
    const existing = await this.db.trackingEvent.findFirst({
      where: { tenantId: context.tenantId, shipmentId, externalKey: input.externalKey },
    });
    if (existing) return existing;
    return this.db.$transaction(async (tx) => {
      const event = await tx.trackingEvent.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          shipmentId,
          externalKey: input.externalKey,
          code: input.code,
          description: input.description,
          location: input.location ?? null,
          occurredAt: new Date(input.occurredAt),
          payload: (input.payload ?? null) as Prisma.InputJsonValue,
        },
      });
      if (input.code === 'DELIVERED') {
        await tx.shipment.update({
          where: { id: shipmentId },
          data: { status: 'DELIVERED', deliveredAt: new Date(input.occurredAt) },
        });
        await tx.fulfillmentOrder.update({
          where: { id: shipment.fulfillmentOrderId },
          data: { status: 'DELIVERED', version: { increment: 1 } },
        });
      }
      return event;
    });
  }

  publicTracking(context: TenantContext, trackingNumber: string): Promise<unknown> {
    return this.db.shipment
      .findFirst({
        where: { tenantId: context.tenantId, trackingNumber },
        include: { events: { orderBy: { occurredAt: 'asc' } } },
      })
      .then((shipment) => {
        if (!shipment) throw new NotFoundException('Resource not found');
        return {
          trackingNumber: shipment.trackingNumber,
          carrierKey: shipment.carrierKey,
          serviceLevel: shipment.serviceLevel,
          status: shipment.status,
          events: shipment.events,
        };
      });
  }

  private requireIdempotency(value: string) {
    if (value.trim().length < 8 || value.length > 160) {
      throw new ConflictException('A valid Idempotency-Key header is required');
    }
  }

  private assertAsnReceiptReplay(
    receipt: { asnId: string; payloadHash: string },
    asnId: string,
    payloadHash: string,
  ) {
    if (receipt.asnId !== asnId || receipt.payloadHash !== payloadHash) {
      throw new ConflictException('Idempotency-Key was already used for another ASN receipt');
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private async requireFacility(context: TenantContext, id: string) {
    const facility = await this.db.facility.findFirst({
      where: { id, tenantId: context.tenantId, deletedAt: null },
    });
    if (!facility) throw new NotFoundException('Resource not found');
    return facility;
  }

  private async requireFulfillment(context: TenantContext, id: string) {
    const order = await this.db.fulfillmentOrder.findFirst({
      where: { id, tenantId: context.tenantId },
      include: { lines: true, packages: true, shipments: true },
    });
    if (!order) throw new NotFoundException('Resource not found');
    return order;
  }
}

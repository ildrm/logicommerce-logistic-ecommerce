import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import { DATABASE } from '../database/database.module.js';
import { IdentityService } from '../identity/identity.service.js';
import type {
  CreatePartnerCredentialDto,
  CreateWebhookEndpointDto,
  FulfillShopOrderDto,
  SubmitShopOrderDto,
} from './partner.dto.js';
import type { PartnerPrincipal } from './partner-auth.guard.js';
import { WebhookCryptoService } from './webhook-crypto.service.js';

@Injectable()
export class PartnerRepository {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly identity: IdentityService,
    private readonly crypto: WebhookCryptoService,
  ) {}

  credentials(context: TenantContext): Promise<unknown> {
    return this.db.partnerApiCredential.findMany({
      where: { tenantId: context.tenantId },
      select: {
        id: true,
        partnerKind: true,
        partnerId: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        ipPolicy: true,
        rateLimitPerMinute: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        rotatedFromId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCredential(
    context: TenantContext,
    input: CreatePartnerCredentialDto,
  ): Promise<unknown> {
    await this.assertPartner(context, input.partnerKind, input.partnerId);
    return this.issueCredential(context, input);
  }

  async rotateCredential(context: TenantContext, id: string): Promise<unknown> {
    const prior = await this.db.partnerApiCredential.findFirst({
      where: { id, tenantId: context.tenantId, revokedAt: null },
    });
    if (!prior) throw new NotFoundException('Resource not found');
    const next = await this.issueCredential(
      context,
      {
        partnerKind: prior.partnerKind,
        partnerId: prior.partnerId,
        name: `${prior.name} (rotated)`,
        scopes: Array.isArray(prior.scopes)
          ? prior.scopes.filter((v): v is string => typeof v === 'string')
          : [],
        ipPolicy: Array.isArray(prior.ipPolicy)
          ? prior.ipPolicy.filter((v): v is string => typeof v === 'string')
          : [],
        rateLimitPerMinute: prior.rateLimitPerMinute,
      },
      prior.id,
    );
    await this.db.partnerApiCredential.update({
      where: { id: prior.id },
      data: { revokedAt: new Date() },
    });
    return next;
  }

  async revokeCredential(context: TenantContext, id: string): Promise<unknown> {
    const result = await this.db.partnerApiCredential.updateMany({
      where: { id, tenantId: context.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundException('Resource not found');
    return { revoked: true };
  }

  endpoints(context: TenantContext): Promise<unknown> {
    return this.db.webhookEndpoint.findMany({
      where: { tenantId: context.tenantId },
      select: {
        id: true,
        partnerKind: true,
        partnerId: true,
        url: true,
        eventTypes: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEndpoint(context: TenantContext, input: CreateWebhookEndpointDto): Promise<unknown> {
    await this.assertPartner(context, input.partnerKind, input.partnerId);
    const secret = randomBytes(32).toString('base64url');
    const endpoint = await this.db.webhookEndpoint.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        ...input,
        eventTypes: [...new Set(input.eventTypes)],
        secretCiphertext: this.crypto.encrypt(secret),
        secretHash: this.crypto.hash(secret),
      },
      select: {
        id: true,
        partnerKind: true,
        partnerId: true,
        url: true,
        eventTypes: true,
        status: true,
        createdAt: true,
      },
    });
    return { ...endpoint, secret };
  }

  deliveries(context: TenantContext): Promise<unknown> {
    return this.db.webhookDelivery.findMany({
      where: { tenantId: context.tenantId },
      include: { endpoint: { select: { url: true, partnerId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async processDeliveries(context: TenantContext): Promise<unknown> {
    const pending = await this.db.webhookDelivery.findMany({
      where: {
        tenantId: context.tenantId,
        status: { in: ['PENDING', 'RETRYING'] },
        nextAttemptAt: { lte: new Date() },
      },
      include: { endpoint: true },
      take: 100,
    });
    for (const delivery of pending) {
      const secret = this.crypto.decrypt(delivery.endpoint.secretCiphertext);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify(delivery.payload);
      const signature = this.crypto.sign(secret, timestamp, delivery.eventId, body);
      const attempts = delivery.attempts + 1;
      const deliverable =
        delivery.endpoint.status === 'ACTIVE' && delivery.endpoint.url.startsWith('https://');
      await this.db.webhookDelivery.update({
        where: { id: delivery.id },
        data: deliverable
          ? {
              status: 'DELIVERED',
              attempts,
              signature,
              lastStatusCode: 202,
              deliveredAt: new Date(),
            }
          : {
              status: attempts >= 5 ? 'DEAD_LETTER' : 'RETRYING',
              attempts,
              signature,
              lastError: 'Endpoint unavailable',
              nextAttemptAt: new Date(Date.now() + Math.min(3600, 2 ** attempts * 30) * 1_000),
            },
      });
    }
    return { processed: pending.length };
  }

  async replay(context: TenantContext, id: string): Promise<unknown> {
    const original = await this.db.webhookDelivery.findFirst({
      where: { id, tenantId: context.tenantId },
    });
    if (!original) throw new NotFoundException('Resource not found');
    return this.db.webhookDelivery.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        endpointId: original.endpointId,
        eventId: randomUUID(),
        eventType: original.eventType,
        payload: original.payload as Prisma.InputJsonValue,
        replayOfId: original.id,
      },
    });
  }

  catalog(context: TenantContext): Promise<unknown> {
    return this.db.productVariant.findMany({
      where: {
        tenantId: context.tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        product: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        sku: true,
        title: true,
        product: { select: { title: true } },
        offers: { where: { status: 'ACTIVE' }, select: { currency: true, priceMinor: true } },
      },
    });
  }

  inventory(context: TenantContext): Promise<unknown> {
    return this.db.inventoryItem.findMany({
      where: { tenantId: context.tenantId },
      select: {
        productRef: true,
        sku: true,
        facilityId: true,
        balances: { select: { state: true, quantity: true } },
      },
    });
  }

  async submitOrder(
    context: TenantContext,
    partner: PartnerPrincipal,
    input: SubmitShopOrderDto,
  ): Promise<unknown> {
    const prior = await this.db.shopOrder.findFirst({
      where: {
        tenantId: context.tenantId,
        partnerId: partner.partnerId,
        externalKey: input.externalKey,
      },
      include: { lines: true },
    });
    if (prior) return { ...prior, totalMinor: Number(prior.totalMinor), idempotentReplay: true };
    const variants = await this.db.productVariant.findMany({
      where: {
        tenantId: context.tenantId,
        id: { in: input.lines.map((line) => line.variantId) },
        status: 'ACTIVE',
      },
      include: {
        offers: {
          where: { status: 'ACTIVE', currency: input.currency.toUpperCase() },
          orderBy: { priceMinor: 'asc' },
          take: 1,
        },
      },
    });
    if (
      variants.length !== new Set(input.lines.map((line) => line.variantId)).size ||
      variants.some((v) => v.offers.length === 0)
    ) {
      throw new ConflictException('A requested variant has no active offer');
    }
    const lines = input.lines.map((line) => ({
      ...line,
      unitPriceMinor: variants.find((variant) => variant.id === line.variantId)!.offers[0]!
        .priceMinor,
    }));
    const order = await this.db.shopOrder.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        partnerId: partner.partnerId,
        externalKey: input.externalKey,
        currency: input.currency.toUpperCase(),
        totalMinor: lines.reduce(
          (sum, line) => sum + BigInt(line.quantity) * line.unitPriceMinor,
          0n,
        ),
        shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
        lines: {
          create: lines.map((line) => ({ id: randomUUID(), tenantId: context.tenantId, ...line })),
        },
      },
      include: { lines: true },
    });
    await this.enqueue(
      context,
      partner.partnerKind,
      partner.partnerId,
      'shop.order.accepted.v1',
      order.id,
      {
        orderId: order.id,
        externalKey: order.externalKey,
        status: order.status,
      },
    );
    return { ...order, totalMinor: Number(order.totalMinor), idempotentReplay: false };
  }

  async fulfillOrder(
    context: TenantContext,
    partner: PartnerPrincipal,
    id: string,
    input: FulfillShopOrderDto,
  ): Promise<unknown> {
    const order = await this.db.shopOrder.findFirst({
      where: { id, tenantId: context.tenantId, partnerId: partner.partnerId, status: 'ACCEPTED' },
    });
    if (!order) throw new NotFoundException('Resource not found');
    const updated = await this.db.shopOrder.update({
      where: { id },
      data: {
        status: 'FULFILLED',
        shippingAddress: {
          ...(order.shippingAddress as object),
          fulfillment: { trackingNumber: input.trackingNumber, carrier: input.carrier },
        } as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    await this.enqueue(
      context,
      partner.partnerKind,
      partner.partnerId,
      'shop.order.fulfilled.v1',
      updated.id,
      {
        orderId: updated.id,
        status: updated.status,
        ...input,
      },
    );
    return updated;
  }

  async receiveWebhook(
    context: TenantContext,
    endpointId: string,
    timestamp: string,
    eventId: string,
    eventType: string,
    signature: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    const parsed = Number(timestamp);
    if (!Number.isFinite(parsed) || Math.abs(Date.now() / 1000 - parsed) > 300) {
      throw new UnauthorizedException('Webhook timestamp is outside the replay window');
    }
    const endpoint = await this.db.webhookEndpoint.findFirst({
      where: { id: endpointId, tenantId: context.tenantId, status: 'ACTIVE' },
    });
    if (!endpoint) throw new NotFoundException('Resource not found');
    const body = JSON.stringify(payload);
    const secret = this.crypto.decrypt(endpoint.secretCiphertext);
    if (!this.crypto.verify(secret, timestamp, eventId, body, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const existing = await this.db.webhookReceipt.findFirst({
      where: { tenantId: context.tenantId, endpointId, externalEventId: eventId },
    });
    if (existing) return { accepted: true, idempotentReplay: true };
    await this.db.webhookReceipt.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        endpointId,
        externalEventId: eventId,
        eventType,
        payloadHash: createHash('sha256').update(body).digest('hex'),
      },
    });
    return { accepted: true, idempotentReplay: false };
  }

  private async issueCredential(
    context: TenantContext,
    input: CreatePartnerCredentialDto,
    rotatedFromId?: string,
  ) {
    const prefix = `lcp_${randomBytes(6).toString('hex')}`;
    const secret = `${prefix}.${randomBytes(32).toString('base64url')}`;
    const credential = await this.db.partnerApiCredential.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        partnerKind: input.partnerKind,
        partnerId: input.partnerId,
        name: input.name,
        keyPrefix: prefix,
        secretHash: this.identity.credentialHash(secret),
        scopes: [...new Set(input.scopes)],
        ipPolicy: input.ipPolicy ?? [],
        rateLimitPerMinute: input.rateLimitPerMinute ?? 120,
        rotatedFromId: rotatedFromId ?? null,
      },
      select: {
        id: true,
        partnerKind: true,
        partnerId: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMinute: true,
        createdAt: true,
      },
    });
    return { ...credential, secret };
  }

  private async assertPartner(context: TenantContext, kind: string, id: string) {
    const found =
      kind === 'SELLER'
        ? await this.db.seller.count({ where: { id, tenantId: context.tenantId } })
        : kind === 'SUPPLIER'
          ? await this.db.supplier.count({ where: { id, tenantId: context.tenantId } })
          : await this.db.store.count({ where: { id, tenantId: context.tenantId } });
    if (!found) throw new NotFoundException('Resource not found');
  }

  private async enqueue(
    context: TenantContext,
    partnerKind: PartnerPrincipal['partnerKind'],
    partnerId: string,
    eventType: string,
    _subjectId: string,
    payload: Record<string, unknown>,
  ) {
    const endpoints = await this.db.webhookEndpoint.findMany({
      where: { tenantId: context.tenantId, partnerKind, partnerId, status: 'ACTIVE' },
    });
    const subscribed = endpoints.filter(
      (endpoint) => Array.isArray(endpoint.eventTypes) && endpoint.eventTypes.includes(eventType),
    );
    if (subscribed.length) {
      const eventId = randomUUID();
      await this.db.webhookDelivery.createMany({
        data: subscribed.map((endpoint) => ({
          id: randomUUID(),
          tenantId: context.tenantId,
          endpointId: endpoint.id,
          eventId,
          eventType,
          payload: payload as Prisma.InputJsonValue,
        })),
      });
    }
  }
}

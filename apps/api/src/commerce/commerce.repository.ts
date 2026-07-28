import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import { nextInvoiceNumber } from '../billing/invoice-issuance.js';
import type {
  AddCartLineDto,
  CreateAddressDto,
  CreateCartDto,
  CreatePromotionDto,
  InventoryFeedDto,
  UpdateCartLineDto,
} from './commerce.dto.js';
import type { NormalizedAddress } from './commerce-adapters.js';

export type CartSnapshot = {
  id: string;
  storeId: string;
  userId: string;
  status: string;
  currency: string;
  version: number;
  promotionCode: string | null;
  lines: Array<{
    id: string;
    quantity: number;
    unitPriceMinor: number;
    offerVersion: number;
    offer: {
      id: string;
      version: number;
      status: string;
      currency: string;
      priceMinor: number;
      minimumQuantity: number;
      storeId: string;
      sellerId: string;
      supplierId: string;
      variant: { id: string; sku: string; title: string };
    };
  }>;
};

export type CommerceQuote = {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  promotionCode: string | null;
  splitCount: number;
};

type CheckoutInput = {
  cartVersion: number;
  idempotencyKey: string;
  quote: CommerceQuote;
  address: NormalizedAddress;
  paymentReference: string;
  fraudDecision: 'APPROVED';
};

@Injectable()
export class CommerceRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async inventoryFeed(context: TenantContext, principal: AuthPrincipal, input: InventoryFeedDto) {
    return this.database.$transaction(async (transaction) => {
      const prior = await transaction.inventoryFeed.findFirst({
        where: {
          tenantId: context.tenantId,
          source: input.source,
          externalKey: input.externalKey,
        },
        include: { inventoryItem: { include: { balances: true } } },
      });
      if (prior) {
        if (prior.quantity !== BigInt(input.quantity)) {
          throw new ConflictException('Inventory feed key was already used with another quantity');
        }
        return this.inventoryFeedView(prior, true);
      }

      const variant = await transaction.productVariant.findFirst({
        where: {
          id: input.variantId,
          tenantId: context.tenantId,
          status: 'ACTIVE',
          deletedAt: null,
          product: { status: 'ACTIVE', deletedAt: null },
        },
      });
      if (!variant) throw new NotFoundException('Resource not found');

      const item = await transaction.inventoryItem.upsert({
        where: {
          tenantId_facilityId_sku: {
            tenantId: context.tenantId,
            facilityId: input.facilityId,
            sku: variant.sku,
          },
        },
        create: {
          id: randomUUID(),
          tenantId: context.tenantId,
          facilityId: input.facilityId,
          productRef: variant.id,
          sku: variant.sku,
        },
        update: { productRef: variant.id, version: { increment: 1 } },
      });
      const current = await transaction.inventoryBalance.findUnique({
        where: {
          tenantId_inventoryItemId_state: {
            tenantId: context.tenantId,
            inventoryItemId: item.id,
            state: 'ON_HAND',
          },
        },
      });
      const nextQuantity = BigInt(input.quantity);
      const delta = nextQuantity - (current?.quantity ?? 0n);
      await transaction.inventoryBalance.upsert({
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
          quantity: nextQuantity,
        },
        update: { quantity: nextQuantity, version: { increment: 1 } },
      });
      const feed = await transaction.inventoryFeed.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          inventoryItemId: item.id,
          source: input.source,
          externalKey: input.externalKey,
          quantity: nextQuantity,
        },
      });
      if (delta !== 0n) {
        await transaction.stockLedgerEntry.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            inventoryItemId: item.id,
            state: 'ON_HAND',
            quantityDelta: delta,
            operation: 'FEED',
            reasonCode: 'INVENTORY_FEED',
            sourceType: 'INVENTORY_FEED',
            sourceId: feed.id,
            idempotencyKey: `feed:${input.source}:${input.externalKey}`,
            correlationId: context.correlationId,
            actorId: principal.userId,
          },
        });
      }
      await this.audit(
        transaction,
        context,
        principal,
        'inventory.feed.applied',
        'INVENTORY_ITEM',
        item.id,
      );
      await transaction.outboxEvent.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          type: 'inventory.balance.changed.v1',
          subject: `inventory-item/${item.id}`,
          payload: {
            inventoryItemId: item.id,
            variantId: variant.id,
            quantity: input.quantity,
            delta: Number(delta),
          },
          correlationId: context.correlationId,
        },
      });
      return {
        id: feed.id,
        inventoryItemId: item.id,
        variantId: variant.id,
        sku: item.sku,
        facilityId: item.facilityId,
        quantity: input.quantity,
        idempotentReplay: false,
      };
    });
  }

  inventory(context: TenantContext) {
    return this.database.inventoryItem
      .findMany({
        where: { tenantId: context.tenantId },
        orderBy: { updatedAt: 'desc' },
        include: { balances: true },
      })
      .then((items) =>
        items.map((item) => ({
          id: item.id,
          sku: item.sku,
          variantId: item.productRef,
          facilityId: item.facilityId,
          version: item.version,
          balances: Object.fromEntries(
            item.balances.map((balance) => [balance.state, Number(balance.quantity)]),
          ),
        })),
      );
  }

  async inventoryReconciliation(context: TenantContext) {
    const items = await this.database.inventoryItem.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { sku: 'asc' },
      include: {
        balances: true,
        ledgerEntries: { select: { state: true, quantityDelta: true } },
      },
    });
    const results = items.flatMap((item) => {
      const states = new Set([
        ...item.balances.map(({ state }) => state),
        ...item.ledgerEntries.map(({ state }) => state),
      ]);
      return [...states].map((state) => {
        const balance =
          item.balances.find((candidate) => candidate.state === state)?.quantity ?? 0n;
        const ledger = item.ledgerEntries
          .filter((entry) => entry.state === state)
          .reduce((sum, entry) => sum + entry.quantityDelta, 0n);
        return {
          inventoryItemId: item.id,
          sku: item.sku,
          facilityId: item.facilityId,
          state,
          balance: Number(balance),
          ledgerTotal: Number(ledger),
          difference: Number(balance - ledger),
          reconciled: balance === ledger,
        };
      });
    });
    return {
      checkedAt: new Date().toISOString(),
      reconciled: results.every((result) => result.reconciled),
      mismatches: results.filter((result) => !result.reconciled).length,
      results,
    };
  }

  async createCart(context: TenantContext, principal: AuthPrincipal, input: CreateCartDto) {
    const store = await this.database.store.findFirst({
      where: { id: input.storeId, tenantId: context.tenantId, status: 'ACTIVE', deletedAt: null },
    });
    if (!store) throw new NotFoundException('Resource not found');
    const existing = await this.database.cart.findFirst({
      where: {
        tenantId: context.tenantId,
        userId: principal.userId,
        storeId: store.id,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return this.cart(context, principal, existing.id);
    const created = await this.database.cart.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        userId: principal.userId,
        storeId: store.id,
        currency: store.defaultCurrency,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
      },
    });
    await this.audit(this.database, context, principal, 'cart.created', 'CART', created.id);
    return this.cart(context, principal, created.id);
  }

  promotions(context: TenantContext) {
    return this.database.promotion
      .findMany({
        where: { tenantId: context.tenantId },
        orderBy: { createdAt: 'desc' },
      })
      .then((promotions) =>
        promotions.map((promotion) => ({
          ...promotion,
          minimumMinor: Number(promotion.minimumMinor),
        })),
      );
  }

  async createPromotion(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreatePromotionDto,
  ) {
    const store = await this.database.store.findFirst({
      where: {
        id: input.storeId,
        tenantId: context.tenantId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Resource not found');
    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new ConflictException('Promotion end must be after its start');
    }
    if (input.kind === 'PERCENTAGE' && input.value > 100) {
      throw new ConflictException('Percentage promotion cannot exceed 100');
    }
    try {
      const promotion = await this.database.promotion.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          storeId: store.id,
          code: input.code.trim().toUpperCase(),
          name: input.name,
          kind: input.kind,
          value: input.value,
          minimumMinor: BigInt(input.minimumMinor ?? 0),
          startsAt,
          endsAt,
        },
      });
      await this.audit(
        this.database,
        context,
        principal,
        'promotion.created',
        'PROMOTION',
        promotion.id,
      );
      return { ...promotion, minimumMinor: Number(promotion.minimumMinor) };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Promotion code already exists');
      }
      throw error;
    }
  }

  async cart(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
  ): Promise<CartSnapshot> {
    const cart = await this.database.cart.findFirst({
      where: { id: cartId, tenantId: context.tenantId, userId: principal.userId },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' },
          include: {
            offer: {
              include: { variant: { select: { id: true, sku: true, title: true } } },
            },
          },
        },
      },
    });
    if (!cart) throw new NotFoundException('Resource not found');
    return this.cartView(cart);
  }

  async addCartLine(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
    input: AddCartLineDto,
  ) {
    const cart = await this.activeCart(context, principal, cartId);
    const offer = await this.database.offer.findFirst({
      where: {
        id: input.offerId,
        tenantId: context.tenantId,
        storeId: cart.storeId,
        status: 'ACTIVE',
        OR: [{ availableFrom: null }, { availableFrom: { lte: new Date() } }],
        AND: [{ OR: [{ availableTo: null }, { availableTo: { gt: new Date() } }] }],
      },
    });
    if (!offer) throw new NotFoundException('Resource not found');
    if (input.quantity < offer.minimumQuantity) {
      throw new ConflictException(`Minimum quantity is ${offer.minimumQuantity}`);
    }
    await this.database.$transaction([
      this.database.cartLine.upsert({
        where: {
          tenantId_cartId_offerId: {
            tenantId: context.tenantId,
            cartId,
            offerId: offer.id,
          },
        },
        create: {
          id: randomUUID(),
          tenantId: context.tenantId,
          cartId,
          offerId: offer.id,
          quantity: input.quantity,
          unitPriceMinor: offer.priceMinor,
          offerVersion: offer.version,
        },
        update: {
          quantity: input.quantity,
          unitPriceMinor: offer.priceMinor,
          offerVersion: offer.version,
        },
      }),
      this.database.cart.update({
        where: { id: cart.id },
        data: { version: { increment: 1 } },
      }),
    ]);
    return this.cart(context, principal, cartId);
  }

  async updateCartLine(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
    lineId: string,
    input: UpdateCartLineDto,
  ) {
    await this.activeCart(context, principal, cartId);
    const line = await this.database.cartLine.findFirst({
      where: { id: lineId, tenantId: context.tenantId, cartId },
      include: { offer: true },
    });
    if (!line) throw new NotFoundException('Resource not found');
    if (input.quantity < line.offer.minimumQuantity) {
      throw new ConflictException(`Minimum quantity is ${line.offer.minimumQuantity}`);
    }
    await this.database.$transaction([
      this.database.cartLine.update({
        where: { id: line.id },
        data: {
          quantity: input.quantity,
          unitPriceMinor: line.offer.priceMinor,
          offerVersion: line.offer.version,
        },
      }),
      this.database.cart.update({
        where: { id: cartId },
        data: { version: { increment: 1 } },
      }),
    ]);
    return this.cart(context, principal, cartId);
  }

  async removeCartLine(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
    lineId: string,
  ) {
    await this.activeCart(context, principal, cartId);
    const removed = await this.database.cartLine.deleteMany({
      where: { id: lineId, cartId, tenantId: context.tenantId },
    });
    if (removed.count !== 1) throw new NotFoundException('Resource not found');
    await this.database.cart.update({
      where: { id: cartId },
      data: { version: { increment: 1 } },
    });
    return this.cart(context, principal, cartId);
  }

  async promotionDiscount(
    context: TenantContext,
    cart: CartSnapshot,
    code: string | undefined,
    subtotalMinor: number,
  ): Promise<{ code: string | null; amount: number }> {
    if (!code) return { code: null, amount: 0 };
    const now = new Date();
    const promotion = await this.database.promotion.findFirst({
      where: {
        tenantId: context.tenantId,
        storeId: cart.storeId,
        code: code.trim().toUpperCase(),
        isActive: true,
        minimumMinor: { lte: BigInt(subtotalMinor) },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
    });
    if (!promotion) throw new ConflictException('Promotion is invalid or unavailable');
    const amount =
      promotion.kind === 'PERCENTAGE'
        ? Math.round((subtotalMinor * promotion.value) / 100)
        : promotion.value;
    return { code: promotion.code, amount: Math.min(subtotalMinor, amount) };
  }

  async createAddress(context: TenantContext, principal: AuthPrincipal, input: CreateAddressDto) {
    return this.database.customerAddress.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        userId: principal.userId,
        label: input.label,
        recipient: input.recipient,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        region: input.region ?? null,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        phone: input.phone ?? null,
      },
    });
  }

  addresses(context: TenantContext, principal: AuthPrincipal) {
    return this.database.customerAddress.findMany({
      where: { tenantId: context.tenantId, userId: principal.userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async checkout(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
    input: CheckoutInput,
  ) {
    return this.database
      .$transaction(
        async (transaction) => {
          const replay = await transaction.order.findFirst({
            where: { tenantId: context.tenantId, idempotencyKey: input.idempotencyKey },
          });
          if (replay) {
            if (replay.cartId !== cartId || replay.userId !== principal.userId) {
              throw new ConflictException('Idempotency key is already bound to another checkout');
            }
            return this.order(transaction, context, replay.id, principal.userId);
          }

          const cart = await transaction.cart.findFirst({
            where: {
              id: cartId,
              tenantId: context.tenantId,
              userId: principal.userId,
              status: 'ACTIVE',
              expiresAt: { gt: new Date() },
            },
            include: {
              lines: {
                include: {
                  offer: {
                    include: {
                      variant: { select: { id: true, sku: true, title: true } },
                    },
                  },
                },
              },
            },
          });
          if (!cart) throw new NotFoundException('Resource not found');
          if (cart.version !== input.cartVersion) {
            throw new ConflictException('Cart changed during checkout; request a new quote');
          }
          if (cart.lines.length === 0) throw new ConflictException('Cart is empty');

          for (const line of cart.lines) {
            if (
              line.offer.status !== 'ACTIVE' ||
              line.offer.storeId !== cart.storeId ||
              line.offer.currency !== cart.currency ||
              line.offer.version !== line.offerVersion ||
              line.offer.priceMinor !== line.unitPriceMinor
            ) {
              throw new ConflictException('An offer changed; refresh the cart');
            }
          }

          const orderId = randomUUID();
          const order = await transaction.order.create({
            data: {
              id: orderId,
              tenantId: context.tenantId,
              storeId: cart.storeId,
              userId: principal.userId,
              cartId: cart.id,
              number: this.businessNumber('ORD'),
              status: 'PENDING',
              paymentStatus: 'AUTHORIZED',
              currency: input.quote.currency,
              subtotalMinor: BigInt(input.quote.subtotalMinor),
              discountMinor: BigInt(input.quote.discountMinor),
              taxMinor: BigInt(input.quote.taxMinor),
              shippingMinor: BigInt(input.quote.shippingMinor),
              totalMinor: BigInt(input.quote.totalMinor),
              addressSnapshot: input.address as unknown as Prisma.InputJsonValue,
              paymentReference: input.paymentReference,
              fraudDecision: input.fraudDecision,
              idempotencyKey: input.idempotencyKey,
            },
          });

          const groups = new Map<
            string,
            {
              sellerId: string;
              supplierId: string;
              subtotalMinor: bigint;
              lines: Array<{ orderLineId: string; quantity: number; unitPriceMinor: bigint }>;
            }
          >();
          for (const line of cart.lines) {
            const inventoryItem = await transaction.inventoryItem.findFirst({
              where: { tenantId: context.tenantId, productRef: line.offer.variantId },
              orderBy: { createdAt: 'asc' },
            });
            if (!inventoryItem)
              throw new ConflictException(`No inventory exists for ${line.offer.variant.sku}`);

            const changed = await transaction.$executeRaw`
            UPDATE InventoryBalance
            SET quantity = quantity - ${BigInt(line.quantity)}, version = version + 1
            WHERE tenantId = ${context.tenantId}
              AND inventoryItemId = ${inventoryItem.id}
              AND state = 'ON_HAND'
              AND quantity >= ${BigInt(line.quantity)}
          `;
            if (Number(changed) !== 1) {
              throw new ConflictException(`Insufficient inventory for ${line.offer.variant.sku}`);
            }
            await transaction.inventoryBalance.upsert({
              where: {
                tenantId_inventoryItemId_state: {
                  tenantId: context.tenantId,
                  inventoryItemId: inventoryItem.id,
                  state: 'RESERVED',
                },
              },
              create: {
                id: randomUUID(),
                tenantId: context.tenantId,
                inventoryItemId: inventoryItem.id,
                state: 'RESERVED',
                quantity: BigInt(line.quantity),
              },
              update: { quantity: { increment: BigInt(line.quantity) }, version: { increment: 1 } },
            });

            const orderLineId = randomUUID();
            await transaction.orderLine.create({
              data: {
                id: orderLineId,
                tenantId: context.tenantId,
                orderId,
                offerId: line.offerId,
                variantId: line.offer.variantId,
                sellerId: line.offer.sellerId,
                supplierId: line.offer.supplierId,
                sku: line.offer.variant.sku,
                title: line.offer.variant.title,
                quantity: line.quantity,
                unitPriceMinor: line.unitPriceMinor,
                lineTotalMinor: line.unitPriceMinor * BigInt(line.quantity),
              },
            });
            await transaction.inventoryReservation.create({
              data: {
                id: randomUUID(),
                tenantId: context.tenantId,
                inventoryItemId: inventoryItem.id,
                demandType: 'ORDER_LINE',
                demandId: orderLineId,
                quantity: BigInt(line.quantity),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
              },
            });
            await transaction.stockLedgerEntry.createMany({
              data: [
                {
                  id: randomUUID(),
                  tenantId: context.tenantId,
                  inventoryItemId: inventoryItem.id,
                  state: 'ON_HAND',
                  quantityDelta: -BigInt(line.quantity),
                  operation: 'RESERVE',
                  reasonCode: 'CHECKOUT',
                  sourceType: 'ORDER_LINE',
                  sourceId: orderLineId,
                  idempotencyKey: `checkout:${orderId}:${orderLineId}:on-hand`,
                  correlationId: context.correlationId,
                  actorId: principal.userId,
                },
                {
                  id: randomUUID(),
                  tenantId: context.tenantId,
                  inventoryItemId: inventoryItem.id,
                  state: 'RESERVED',
                  quantityDelta: BigInt(line.quantity),
                  operation: 'RESERVE',
                  reasonCode: 'CHECKOUT',
                  sourceType: 'ORDER_LINE',
                  sourceId: orderLineId,
                  idempotencyKey: `checkout:${orderId}:${orderLineId}:reserved`,
                  correlationId: context.correlationId,
                  actorId: principal.userId,
                },
              ],
            });
            const key = `${line.offer.sellerId}:${line.offer.supplierId}`;
            const group = groups.get(key) ?? {
              sellerId: line.offer.sellerId,
              supplierId: line.offer.supplierId,
              subtotalMinor: 0n,
              lines: [],
            };
            group.subtotalMinor += line.unitPriceMinor * BigInt(line.quantity);
            group.lines.push({
              orderLineId,
              quantity: line.quantity,
              unitPriceMinor: line.unitPriceMinor,
            });
            groups.set(key, group);
          }

          for (const group of groups.values()) {
            const split = await transaction.orderSplit.create({
              data: {
                id: randomUUID(),
                tenantId: context.tenantId,
                orderId,
                sellerId: group.sellerId,
                supplierId: group.supplierId,
                subtotalMinor: group.subtotalMinor,
              },
            });
            await transaction.dropshipPurchaseOrder.create({
              data: {
                id: randomUUID(),
                tenantId: context.tenantId,
                orderSplitId: split.id,
                supplierId: group.supplierId,
                number: this.businessNumber('PO'),
                currency: cart.currency,
                totalMinor: group.subtotalMinor,
                lines: {
                  create: group.lines.map((line) => ({
                    id: randomUUID(),
                    tenantId: context.tenantId,
                    orderLineId: line.orderLineId,
                    quantity: line.quantity,
                    unitCostMinor: line.unitPriceMinor,
                  })),
                },
              },
            });
          }
          await transaction.cart.update({
            where: { id: cart.id },
            data: {
              status: 'CHECKED_OUT',
              promotionCode: input.quote.promotionCode,
              version: { increment: 1 },
            },
          });
          const invoiceId = randomUUID();
          const issuedAt = new Date();
          await transaction.billingInvoice.create({
            data: {
              id: invoiceId,
              tenantId: context.tenantId,
              number: await nextInvoiceNumber(transaction, context.tenantId),
              customerId: principal.userId,
              commerceOrderId: order.id,
              sourceType: 'COMMERCE_ORDER',
              sourceId: order.id,
              status: 'PAID',
              currency: input.quote.currency,
              subtotalMinor: input.quote.subtotalMinor,
              taxMinor: input.quote.taxMinor,
              totalMinor: input.quote.totalMinor,
              paidMinor: input.quote.totalMinor,
              billingSnapshot: {
                address: input.address,
                orderNumber: order.number,
                paymentReference: input.paymentReference,
              } as unknown as Prisma.InputJsonValue,
              dueAt: issuedAt,
              paidAt: issuedAt,
              lines: {
                create: cart.lines.map((line) => ({
                  id: randomUUID(),
                  tenantId: context.tenantId,
                  kind: 'PRODUCT',
                  description: line.offer.variant.title,
                  quantity: line.quantity,
                  unitMinor: line.unitPriceMinor,
                  totalMinor: line.unitPriceMinor * BigInt(line.quantity),
                })),
              },
              schedules: {
                create: {
                  id: randomUUID(),
                  tenantId: context.tenantId,
                  kind: 'FULL',
                  amountMinor: input.quote.totalMinor,
                  paidMinor: input.quote.totalMinor,
                  dueAt: issuedAt,
                  status: 'PAID',
                  sequence: 1,
                },
              },
            },
          });
          await this.audit(transaction, context, principal, 'order.created', 'ORDER', order.id);
          await transaction.outboxEvent.create({
            data: {
              id: randomUUID(),
              tenantId: context.tenantId,
              type: 'commerce.order.created.v1',
              subject: `order/${order.id}`,
              payload: {
                orderId: order.id,
                number: order.number,
                totalMinor: input.quote.totalMinor,
                currency: input.quote.currency,
                splitCount: groups.size,
              },
              correlationId: context.correlationId,
            },
          });
          return this.order(transaction, context, order.id, principal.userId);
        },
        { isolationLevel: 'Serializable' },
      )
      .catch((error: unknown) => {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2034'
        ) {
          throw new ConflictException('Inventory unavailable; retry checkout');
        }
        throw error;
      });
  }

  async checkoutReplay(
    context: TenantContext,
    principal: AuthPrincipal,
    cartId: string,
    idempotencyKey: string,
  ): Promise<object | null> {
    const existing = await this.database.order.findFirst({
      where: { tenantId: context.tenantId, idempotencyKey },
      select: { id: true, cartId: true, userId: true },
    });
    if (!existing) return null;
    if (existing.cartId !== cartId || existing.userId !== principal.userId) {
      throw new ConflictException('Idempotency key is already bound to another checkout');
    }
    return this.order(this.database, context, existing.id, principal.userId);
  }

  orders(context: TenantContext) {
    return this.database.order
      .findMany({
        where: { tenantId: context.tenantId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { lines: true, splits: true } } },
      })
      .then((orders) =>
        orders.map((order) => ({
          ...order,
          subtotalMinor: Number(order.subtotalMinor),
          discountMinor: Number(order.discountMinor),
          taxMinor: Number(order.taxMinor),
          shippingMinor: Number(order.shippingMinor),
          totalMinor: Number(order.totalMinor),
        })),
      );
  }

  myOrders(context: TenantContext, principal: AuthPrincipal) {
    return this.database.order
      .findMany({
        where: { tenantId: context.tenantId, userId: principal.userId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { lines: true, splits: true } } },
      })
      .then((orders) =>
        orders.map((order) => ({
          ...order,
          subtotalMinor: Number(order.subtotalMinor),
          discountMinor: Number(order.discountMinor),
          taxMinor: Number(order.taxMinor),
          shippingMinor: Number(order.shippingMinor),
          totalMinor: Number(order.totalMinor),
        })),
      );
  }

  orderForUser(context: TenantContext, principal: AuthPrincipal, orderId: string) {
    return this.order(this.database, context, orderId, principal.userId);
  }

  orderForAdmin(context: TenantContext, orderId: string) {
    return this.order(this.database, context, orderId);
  }

  purchaseOrders(context: TenantContext) {
    return this.database.dropshipPurchaseOrder
      .findMany({
        where: { tenantId: context.tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, key: true, name: true } },
          orderSplit: { select: { id: true, orderId: true, sellerId: true, status: true } },
          lines: {
            include: {
              orderLine: { select: { id: true, sku: true, title: true, quantity: true } },
            },
          },
        },
      })
      .then((orders) => orders.map((order) => this.purchaseOrderView(order)));
  }

  async acceptPurchaseOrder(
    context: TenantContext,
    principal: AuthPrincipal,
    purchaseOrderId: string,
  ) {
    return this.database.$transaction(
      async (transaction) => {
        const purchaseOrder = await transaction.dropshipPurchaseOrder.findFirst({
          where: {
            id: purchaseOrderId,
            tenantId: context.tenantId,
            status: 'PENDING',
          },
          include: {
            orderSplit: true,
            lines: {
              include: {
                orderLine: { select: { id: true, sku: true, title: true, quantity: true } },
              },
            },
          },
        });
        if (!purchaseOrder) throw new NotFoundException('Resource not found');

        for (const line of purchaseOrder.lines) {
          const reservation = await transaction.inventoryReservation.findFirst({
            where: {
              tenantId: context.tenantId,
              demandType: 'ORDER_LINE',
              demandId: line.orderLineId,
              releasedAt: null,
              allocatedAt: null,
            },
          });
          if (!reservation) {
            throw new ConflictException(`Reservation is unavailable for ${line.orderLine.sku}`);
          }
          const changed = await transaction.$executeRaw`
            UPDATE InventoryBalance
            SET quantity = quantity - ${reservation.quantity}, version = version + 1
            WHERE tenantId = ${context.tenantId}
              AND inventoryItemId = ${reservation.inventoryItemId}
              AND state = 'RESERVED'
              AND quantity >= ${reservation.quantity}
          `;
          if (Number(changed) !== 1) {
            throw new ConflictException(
              `Reserved inventory is unavailable for ${line.orderLine.sku}`,
            );
          }
          await transaction.inventoryBalance.upsert({
            where: {
              tenantId_inventoryItemId_state: {
                tenantId: context.tenantId,
                inventoryItemId: reservation.inventoryItemId,
                state: 'ALLOCATED',
              },
            },
            create: {
              id: randomUUID(),
              tenantId: context.tenantId,
              inventoryItemId: reservation.inventoryItemId,
              state: 'ALLOCATED',
              quantity: reservation.quantity,
            },
            update: { quantity: { increment: reservation.quantity }, version: { increment: 1 } },
          });
          await transaction.inventoryReservation.update({
            where: { id: reservation.id },
            data: { allocatedAt: new Date() },
          });
          await transaction.stockLedgerEntry.createMany({
            data: [
              {
                id: randomUUID(),
                tenantId: context.tenantId,
                inventoryItemId: reservation.inventoryItemId,
                state: 'RESERVED',
                quantityDelta: -reservation.quantity,
                operation: 'ALLOCATE',
                reasonCode: 'PURCHASE_ORDER_ACCEPTED',
                sourceType: 'PURCHASE_ORDER_LINE',
                sourceId: line.id,
                idempotencyKey: `po:${purchaseOrder.id}:${line.id}:reserved`,
                correlationId: context.correlationId,
                actorId: principal.userId,
              },
              {
                id: randomUUID(),
                tenantId: context.tenantId,
                inventoryItemId: reservation.inventoryItemId,
                state: 'ALLOCATED',
                quantityDelta: reservation.quantity,
                operation: 'ALLOCATE',
                reasonCode: 'PURCHASE_ORDER_ACCEPTED',
                sourceType: 'PURCHASE_ORDER_LINE',
                sourceId: line.id,
                idempotencyKey: `po:${purchaseOrder.id}:${line.id}:allocated`,
                correlationId: context.correlationId,
                actorId: principal.userId,
              },
            ],
          });
        }
        const accepted = await transaction.dropshipPurchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: { status: 'ACCEPTED', acceptedAt: new Date(), version: { increment: 1 } },
          include: {
            supplier: { select: { id: true, key: true, name: true } },
            orderSplit: { select: { id: true, orderId: true, sellerId: true, status: true } },
            lines: {
              include: {
                orderLine: { select: { id: true, sku: true, title: true, quantity: true } },
              },
            },
          },
        });
        await transaction.orderSplit.update({
          where: { id: purchaseOrder.orderSplitId },
          data: { status: 'ACCEPTED' },
        });
        const pending = await transaction.orderSplit.count({
          where: {
            tenantId: context.tenantId,
            orderId: purchaseOrder.orderSplit.orderId,
            status: 'PENDING',
          },
        });
        if (pending === 0) {
          await transaction.order.update({
            where: { id: purchaseOrder.orderSplit.orderId },
            data: { status: 'CONFIRMED', version: { increment: 1 } },
          });
        }
        await this.audit(
          transaction,
          context,
          principal,
          'purchase-order.accepted',
          'DROPSHIP_PURCHASE_ORDER',
          purchaseOrder.id,
        );
        await transaction.outboxEvent.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            type: 'commerce.purchase-order.accepted.v1',
            subject: `purchase-order/${purchaseOrder.id}`,
            payload: {
              purchaseOrderId: purchaseOrder.id,
              orderId: purchaseOrder.orderSplit.orderId,
            },
            correlationId: context.correlationId,
          },
        });
        return this.purchaseOrderView(accepted);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async activeCart(context: TenantContext, principal: AuthPrincipal, cartId: string) {
    const cart = await this.database.cart.findFirst({
      where: {
        id: cartId,
        tenantId: context.tenantId,
        userId: principal.userId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });
    if (!cart) throw new NotFoundException('Resource not found');
    return cart;
  }

  private cartView(cart: {
    id: string;
    storeId: string;
    userId: string;
    status: string;
    currency: string;
    version: number;
    promotionCode: string | null;
    lines: Array<{
      id: string;
      quantity: number;
      unitPriceMinor: bigint;
      offerVersion: number;
      offer: {
        id: string;
        version: number;
        status: string;
        currency: string;
        priceMinor: bigint;
        minimumQuantity: number;
        storeId: string;
        sellerId: string;
        supplierId: string;
        variant: { id: string; sku: string; title: string };
      };
    }>;
  }): CartSnapshot {
    return {
      id: cart.id,
      storeId: cart.storeId,
      userId: cart.userId,
      status: cart.status,
      currency: cart.currency,
      version: cart.version,
      promotionCode: cart.promotionCode,
      lines: cart.lines.map((line) => ({
        id: line.id,
        quantity: line.quantity,
        unitPriceMinor: Number(line.unitPriceMinor),
        offerVersion: line.offerVersion,
        offer: {
          ...line.offer,
          priceMinor: Number(line.offer.priceMinor),
        },
      })),
    };
  }

  private inventoryFeedView(
    feed: {
      id: string;
      quantity: bigint;
      inventoryItem: {
        id: string;
        productRef: string;
        sku: string;
        facilityId: string;
      };
    },
    idempotentReplay: boolean,
  ) {
    return {
      id: feed.id,
      inventoryItemId: feed.inventoryItem.id,
      variantId: feed.inventoryItem.productRef,
      sku: feed.inventoryItem.sku,
      facilityId: feed.inventoryItem.facilityId,
      quantity: Number(feed.quantity),
      idempotentReplay,
    };
  }

  private async order(
    transaction: Prisma.TransactionClient | DatabaseClient,
    context: TenantContext,
    orderId: string,
    userId?: string,
  ) {
    const order = await transaction.order.findFirst({
      where: {
        id: orderId,
        tenantId: context.tenantId,
        ...(userId ? { userId } : {}),
      },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        splits: {
          orderBy: { createdAt: 'asc' },
          include: { purchaseOrder: { include: { lines: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException('Resource not found');
    return {
      ...order,
      subtotalMinor: Number(order.subtotalMinor),
      discountMinor: Number(order.discountMinor),
      taxMinor: Number(order.taxMinor),
      shippingMinor: Number(order.shippingMinor),
      totalMinor: Number(order.totalMinor),
      lines: order.lines.map((line) => ({
        ...line,
        unitPriceMinor: Number(line.unitPriceMinor),
        lineTotalMinor: Number(line.lineTotalMinor),
      })),
      splits: order.splits.map((split) => ({
        ...split,
        subtotalMinor: Number(split.subtotalMinor),
        purchaseOrder: split.purchaseOrder ? this.purchaseOrderView(split.purchaseOrder) : null,
      })),
    };
  }

  private purchaseOrderView<
    T extends {
      totalMinor: bigint;
      lines: Array<{ unitCostMinor: bigint; [key: string]: unknown }>;
    },
  >(purchaseOrder: T) {
    return {
      ...purchaseOrder,
      totalMinor: Number(purchaseOrder.totalMinor),
      lines: purchaseOrder.lines.map((line) => ({
        ...line,
        unitCostMinor: Number(line.unitCostMinor),
      })),
    };
  }

  private businessNumber(prefix: string): string {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;
  }

  private audit(
    transaction: Prisma.TransactionClient | DatabaseClient,
    context: TenantContext,
    principal: AuthPrincipal,
    action: string,
    entityType: string,
    entityId: string,
  ) {
    return transaction.auditEvent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        actorId: principal.userId,
        actorType: 'USER',
        action,
        entityType,
        entityId,
        requestId: context.correlationId,
        correlationId: context.correlationId,
        authenticationMethod: 'SESSION',
      },
    });
  }
}

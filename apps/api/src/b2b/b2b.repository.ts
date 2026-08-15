import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  safeIntegerNumber,
  type DatabaseClient,
  type Prisma,
  type TenantContext,
} from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import { nextInvoiceNumber } from '../billing/invoice-issuance.js';
import type {
  AcceptBusinessQuoteDto,
  AddBusinessMemberDto,
  AddSellerMemberDto,
  ContractPriceDto,
  CreateBusinessAccountDto,
  CreateBusinessQuoteDto,
  CreateRfqDto,
  FulfillBusinessOrderDto,
} from './b2b.dto.js';

@Injectable()
export class B2BRepository {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  accounts(context: TenantContext): Promise<unknown> {
    return this.db.businessAccount.findMany({
      where: { tenantId: context.tenantId },
      include: { members: true, contractPrices: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createAccount(context: TenantContext, input: CreateBusinessAccountDto): Promise<unknown> {
    return this.db.businessAccount.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        ...input,
        currency: input.currency.toUpperCase(),
      },
    });
  }

  async addMember(
    context: TenantContext,
    accountId: string,
    input: AddBusinessMemberDto,
  ): Promise<unknown> {
    await this.requireAccount(context, accountId);
    const user = await this.db.user.findFirst({
      where: { id: input.userId, tenantId: context.tenantId, isActive: true },
    });
    if (!user) throw new NotFoundException('Resource not found');
    return this.db.businessMember.upsert({
      where: {
        tenantId_accountId_userId: {
          tenantId: context.tenantId,
          accountId,
          userId: input.userId,
        },
      },
      create: { id: randomUUID(), tenantId: context.tenantId, accountId, ...input },
      update: {
        department: input.department,
        role: input.role,
        spendLimitMinor: input.spendLimitMinor,
      },
    });
  }

  async contractPrice(
    context: TenantContext,
    accountId: string,
    input: ContractPriceDto,
  ): Promise<unknown> {
    await this.requireAccount(context, accountId);
    const variant = await this.db.productVariant.findFirst({
      where: { id: input.variantId, tenantId: context.tenantId, status: 'ACTIVE' },
    });
    if (!variant) throw new NotFoundException('Resource not found');
    return this.db.contractPrice.upsert({
      where: {
        tenantId_accountId_variantId_minimumQuantity: {
          tenantId: context.tenantId,
          accountId,
          variantId: input.variantId,
          minimumQuantity: input.minimumQuantity,
        },
      },
      create: { id: randomUUID(), tenantId: context.tenantId, accountId, ...input },
      update: { unitPriceMinor: input.unitPriceMinor, validFrom: new Date(), validTo: null },
    });
  }

  async addSellerMember(
    context: TenantContext,
    sellerId: string,
    input: AddSellerMemberDto,
  ): Promise<unknown> {
    const [seller, user] = await Promise.all([
      this.db.seller.findFirst({
        where: { id: sellerId, tenantId: context.tenantId, status: 'ACTIVE' },
      }),
      this.db.user.findFirst({
        where: { id: input.userId, tenantId: context.tenantId, isActive: true },
      }),
    ]);
    if (!seller || !user) throw new NotFoundException('Resource not found');
    return this.db.sellerMember.upsert({
      where: {
        tenantId_sellerId_userId: {
          tenantId: context.tenantId,
          sellerId,
          userId: input.userId,
        },
      },
      create: { id: randomUUID(), tenantId: context.tenantId, sellerId, userId: input.userId },
      update: {},
    });
  }

  async prices(
    context: TenantContext,
    principal: AuthPrincipal,
    accountId: string,
  ): Promise<unknown> {
    await this.requireMember(context, principal, accountId);
    return this.db.contractPrice
      .findMany({
        where: {
          tenantId: context.tenantId,
          accountId,
          validFrom: { lte: new Date() },
          OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
        },
        orderBy: [{ variantId: 'asc' }, { minimumQuantity: 'desc' }],
      })
      .then((prices) =>
        prices.map((price) => ({
          ...price,
          unitPriceMinor: safeIntegerNumber(price.unitPriceMinor, 'Contract price'),
        })),
      );
  }

  async rfqs(context: TenantContext, principal: AuthPrincipal): Promise<unknown> {
    const sellerIds = await this.sellerIds(context, principal);
    if (sellerIds.length === 0) return [];
    return this.db.requestForQuote.findMany({
      where: { tenantId: context.tenantId },
      include: {
        lines: true,
        quotes: {
          where: { sellerId: { in: sellerIds } },
          include: { lines: true, order: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRfq(
    context: TenantContext,
    principal: AuthPrincipal,
    accountId: string,
    input: CreateRfqDto,
  ): Promise<unknown> {
    const [account, member] = await Promise.all([
      this.requireAccount(context, accountId),
      this.requireMember(context, principal, accountId),
    ]);
    const variants = await this.db.productVariant.count({
      where: { tenantId: context.tenantId, id: { in: input.lines.map((line) => line.variantId) } },
    });
    if (variants !== new Set(input.lines.map((line) => line.variantId)).size) {
      throw new NotFoundException('Resource not found');
    }
    return this.db.requestForQuote.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        accountId,
        requesterId: member.userId,
        currency: account.currency,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000),
        lines: {
          create: input.lines.map((line) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            variantId: line.variantId,
            quantity: line.quantity,
            targetMinor: line.targetMinor ?? null,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async quote(
    context: TenantContext,
    principal: AuthPrincipal,
    rfqId: string,
    input: CreateBusinessQuoteDto,
  ): Promise<unknown> {
    const sellerIds = await this.sellerIds(context, principal);
    const sellerId = input.sellerId ?? (sellerIds.length === 1 ? sellerIds[0] : undefined);
    if (!sellerId || !sellerIds.includes(sellerId)) {
      throw new ForbiddenException('Seller membership is required');
    }
    const rfq = await this.db.requestForQuote.findFirst({
      where: {
        id: rfqId,
        tenantId: context.tenantId,
        status: 'OPEN',
        expiresAt: { gt: new Date() },
      },
      include: { lines: true },
    });
    if (!rfq) throw new NotFoundException('Resource not found');
    if (input.lines.length !== rfq.lines.length)
      throw new ConflictException('Quote must cover every RFQ line');
    const quoted = input.lines.map((line) => {
      const rfqLine = rfq.lines.find((candidate) => candidate.variantId === line.variantId);
      if (!rfqLine) throw new ConflictException('Quote contains an unknown RFQ line');
      return { ...line, quantity: rfqLine.quantity };
    });
    return this.db.businessQuote.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        rfqId,
        sellerId,
        totalMinor: quoted.reduce(
          (sum, line) => sum + BigInt(line.unitPriceMinor) * BigInt(line.quantity),
          0n,
        ),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
        terms: (input.terms ?? null) as Prisma.InputJsonValue,
        lines: {
          create: quoted.map((line) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            variantId: line.variantId,
            quantity: line.quantity,
            unitPriceMinor: line.unitPriceMinor,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async acceptQuote(
    context: TenantContext,
    principal: AuthPrincipal,
    quoteId: string,
    input: AcceptBusinessQuoteDto,
  ): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const quote = await tx.businessQuote.findFirst({
        where: {
          id: quoteId,
          tenantId: context.tenantId,
          status: 'SENT',
          validUntil: { gt: new Date() },
        },
        include: { rfq: { include: { account: true } }, lines: true },
      });
      if (!quote) throw new NotFoundException('Resource not found');
      const member = await tx.businessMember.findFirst({
        where: {
          tenantId: context.tenantId,
          accountId: quote.rfq.accountId,
          userId: principal.userId,
        },
      });
      if (!member) throw new ForbiddenException('Business account membership is required');
      if (member.spendLimitMinor > 0 && quote.totalMinor > member.spendLimitMinor) {
        throw new ForbiddenException('Quote exceeds buyer spend limit');
      }
      const requiresApproval = quote.totalMinor > quote.rfq.account.approvalMinor;
      const orderId = randomUUID();
      const order = await tx.businessOrder.create({
        data: {
          id: orderId,
          tenantId: context.tenantId,
          accountId: quote.rfq.accountId,
          quoteId,
          number: `B2B-${orderId.slice(0, 8).toUpperCase()}`,
          purchaseOrderRef: input.purchaseOrderRef,
          status: requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED',
          totalMinor: quote.totalMinor,
          paymentTermsDays: quote.rfq.account.paymentTermsDays,
          approvedBy: requiresApproval ? null : principal.userId,
          approvedAt: requiresApproval ? null : new Date(),
          lines: {
            create: quote.lines.map((line) => ({
              id: randomUUID(),
              tenantId: context.tenantId,
              variantId: line.variantId,
              quantity: line.quantity,
              unitPriceMinor: line.unitPriceMinor,
            })),
          },
        },
        include: { lines: true, account: true },
      });
      await tx.businessQuote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } });
      await tx.requestForQuote.update({ where: { id: quote.rfqId }, data: { status: 'ACCEPTED' } });
      return order;
    });
  }

  async approve(
    context: TenantContext,
    principal: AuthPrincipal,
    orderId: string,
  ): Promise<unknown> {
    const order = await this.db.businessOrder.findFirst({
      where: { id: orderId, tenantId: context.tenantId, status: 'PENDING_APPROVAL' },
    });
    if (!order) throw new NotFoundException('Resource not found');
    const member = await this.db.businessMember.findFirst({
      where: {
        tenantId: context.tenantId,
        accountId: order.accountId,
        userId: principal.userId,
        role: { in: ['APPROVER', 'ADMIN'] },
      },
    });
    if (!member) throw new ForbiddenException('Approver membership is required');
    return this.db.businessOrder.update({
      where: { id: orderId },
      data: {
        status: 'APPROVED',
        approvedBy: principal.userId,
        approvedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async fulfill(
    context: TenantContext,
    principal: AuthPrincipal,
    orderId: string,
    input: FulfillBusinessOrderDto,
  ): Promise<unknown> {
    const sellerIds = await this.sellerIds(context, principal);
    if (sellerIds.length === 0) throw new NotFoundException('Resource not found');
    return this.db.$transaction(async (tx) => {
      const order = await tx.businessOrder.findFirst({
        where: {
          id: orderId,
          tenantId: context.tenantId,
          status: { in: ['APPROVED', 'PARTIALLY_FULFILLED'] },
          quote: { sellerId: { in: sellerIds } },
        },
        include: { lines: true, account: true },
      });
      if (!order) throw new NotFoundException('Resource not found');
      for (const fulfillment of input.lines) {
        const line = order.lines.find((candidate) => candidate.id === fulfillment.lineId);
        if (!line || line.fulfilledQty + fulfillment.quantity > line.quantity) {
          throw new ConflictException('Invalid fulfillment quantity');
        }
        await tx.businessOrderLine.update({
          where: { id: line.id },
          data: { fulfilledQty: { increment: fulfillment.quantity } },
        });
      }
      const fresh = await tx.businessOrderLine.findMany({ where: { orderId } });
      const complete = fresh.every((line) => line.fulfilledQty === line.quantity);
      const updated = await tx.businessOrder.update({
        where: { id: orderId },
        data: { status: complete ? 'FULFILLED' : 'PARTIALLY_FULFILLED', version: { increment: 1 } },
        include: { lines: true },
      });
      if (complete) {
        const invoiceId = randomUUID();
        const dueAt = new Date(Date.now() + order.paymentTermsDays * 24 * 60 * 60 * 1_000);
        await tx.businessInvoice.create({
          data: {
            id: invoiceId,
            tenantId: context.tenantId,
            orderId,
            number: `INV-${invoiceId.slice(0, 8).toUpperCase()}`,
            totalMinor: order.totalMinor,
            dueAt,
          },
        });
        const canonicalId = randomUUID();
        await tx.billingInvoice.create({
          data: {
            id: canonicalId,
            tenantId: context.tenantId,
            number: await nextInvoiceNumber(tx, context.tenantId),
            businessAccountId: order.accountId,
            businessOrderId: order.id,
            sourceType: 'BUSINESS_ORDER',
            sourceId: order.id,
            currency: order.account.currency,
            subtotalMinor: order.totalMinor,
            totalMinor: order.totalMinor,
            billingSnapshot: {
              businessAccountId: order.accountId,
              purchaseOrderRef: order.purchaseOrderRef,
              legacyInvoiceId: invoiceId,
            },
            dueAt,
            lines: {
              create: order.lines.map((line) => ({
                id: randomUUID(),
                tenantId: context.tenantId,
                kind: 'PRODUCT',
                description: `Business order line ${line.variantId}`,
                quantity: line.quantity,
                unitMinor: line.unitPriceMinor,
                totalMinor: line.unitPriceMinor * BigInt(line.quantity),
              })),
            },
            schedules: {
              create: {
                id: randomUUID(),
                tenantId: context.tenantId,
                kind: 'NET_BALANCE',
                amountMinor: order.totalMinor,
                dueAt,
                sequence: 1,
              },
            },
          },
        });
      }
      return updated;
    });
  }

  private async sellerIds(context: TenantContext, principal: AuthPrincipal): Promise<string[]> {
    const memberships = await this.db.sellerMember.findMany({
      where: { tenantId: context.tenantId, userId: principal.userId },
      select: { sellerId: true },
    });
    return memberships.map((membership) => membership.sellerId);
  }

  orders(context: TenantContext): Promise<unknown> {
    return this.db.businessOrder.findMany({
      where: { tenantId: context.tenantId },
      include: { lines: true, invoices: true, account: true, quote: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async requireAccount(context: TenantContext, id: string) {
    const account = await this.db.businessAccount.findFirst({
      where: { id, tenantId: context.tenantId, status: 'ACTIVE' },
    });
    if (!account) throw new NotFoundException('Resource not found');
    return account;
  }

  private async requireMember(context: TenantContext, principal: AuthPrincipal, accountId: string) {
    const member = await this.db.businessMember.findFirst({
      where: { tenantId: context.tenantId, accountId, userId: principal.userId },
    });
    if (!member) throw new ForbiddenException('Business account membership is required');
    return member;
  }
}

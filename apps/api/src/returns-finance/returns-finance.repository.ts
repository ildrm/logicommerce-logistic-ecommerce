import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  safeIntegerNumber,
  type DatabaseClient,
  type Prisma,
  type TenantContext,
} from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import type {
  CalculateSettlementDto,
  CreateReturnDto,
  InspectReturnDto,
  PostJournalDto,
  ReceiveReturnDto,
  ReconcileDto,
  ReverseJournalDto,
} from './returns-finance.dto.js';

@Injectable()
export class ReturnsFinanceRepository {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  returns(context: TenantContext, principal: AuthPrincipal, all: boolean): Promise<unknown> {
    return this.db.returnAuthorization.findMany({
      where: {
        tenantId: context.tenantId,
        ...(all ? {} : { customerId: principal.userId }),
      },
      include: { lines: true, inspections: true, dispute: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReturn(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateReturnDto,
  ): Promise<unknown> {
    const order = await this.db.order.findFirst({
      where: { id: input.orderId, tenantId: context.tenantId, userId: principal.userId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException('Resource not found');
    const requestedIds = new Set(input.lines.map((line) => line.orderLineId));
    if (requestedIds.size !== input.lines.length)
      throw new ConflictException('Each order line can appear only once');
    for (const requested of input.lines) {
      const line = order.lines.find((candidate) => candidate.id === requested.orderLineId);
      if (!line || requested.quantity > line.quantity)
        throw new ConflictException('Invalid return quantity');
    }
    const id = randomUUID();
    return this.db.returnAuthorization.create({
      data: {
        id,
        tenantId: context.tenantId,
        orderId: order.id,
        customerId: principal.userId,
        number: `RMA-${id.slice(0, 8).toUpperCase()}`,
        reasonCode: input.reasonCode,
        requestedOutcome: input.requestedOutcome,
        lines: {
          create: input.lines.map((line) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            orderLineId: line.orderLineId,
            quantity: line.quantity,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async approveReturn(
    context: TenantContext,
    principal: AuthPrincipal,
    returnId: string,
  ): Promise<unknown> {
    const record = await this.requireReturn(context, returnId);
    if (record.status !== 'REQUESTED')
      throw new ConflictException('Return is not awaiting approval');
    return this.db.returnAuthorization.update({
      where: { id: record.id },
      data: {
        status: 'LABEL_ISSUED',
        carrierKey: 'deterministic-reverse',
        trackingNumber: `RET${record.id.replaceAll('-', '').slice(0, 18).toUpperCase()}`,
        labelUrl: `https://labels.invalid/returns/${record.id}.pdf`,
        approvedBy: principal.userId,
        approvedAt: new Date(),
        version: { increment: 1 },
      },
      include: { lines: true },
    });
  }

  async receiveReturn(
    context: TenantContext,
    returnId: string,
    input: ReceiveReturnDto,
  ): Promise<unknown> {
    const record = await this.requireReturn(context, returnId);
    if (!['LABEL_ISSUED', 'IN_TRANSIT'].includes(record.status))
      throw new ConflictException('Return cannot be received from its current state');
    for (const received of input.lines) {
      const line = record.lines.find((candidate) => candidate.id === received.lineId);
      if (!line || received.quantity > line.quantity)
        throw new ConflictException('Invalid received return quantity');
    }
    return this.db.$transaction(async (tx) => {
      for (const received of input.lines) {
        await tx.returnLine.update({
          where: { id: received.lineId },
          data: { receivedQuantity: received.quantity },
        });
      }
      return tx.returnAuthorization.update({
        where: { id: record.id },
        data: { status: 'RECEIVED', receivedAt: new Date(), version: { increment: 1 } },
        include: { lines: true },
      });
    });
  }

  async inspectReturn(
    context: TenantContext,
    principal: AuthPrincipal,
    returnId: string,
    input: InspectReturnDto,
  ): Promise<unknown> {
    const record = await this.requireReturn(context, returnId);
    if (record.status !== 'RECEIVED')
      throw new ConflictException('Only received returns can be inspected');
    if (input.lines.length !== record.lines.length)
      throw new ConflictException('Inspection must resolve every return line');
    return this.db.$transaction(async (tx) => {
      let refundMinor = 0n;
      for (const resolution of input.lines) {
        const line = record.lines.find((candidate) => candidate.id === resolution.lineId);
        if (!line || line.receivedQuantity !== line.quantity)
          throw new ConflictException('Every returned unit must be received before resolution');
        refundMinor += BigInt(resolution.refundMinor);
        await tx.returnLine.update({
          where: { id: line.id },
          data: {
            disposition: resolution.disposition,
            resolution: resolution.resolution,
            refundMinor: resolution.refundMinor,
          },
        });
        if (resolution.disposition === 'RESTOCK') {
          const orderLine = await tx.orderLine.findFirst({
            where: { id: line.orderLineId, tenantId: context.tenantId },
          });
          const item = orderLine
            ? await tx.inventoryItem.findFirst({
                where: { tenantId: context.tenantId, productRef: orderLine.variantId },
              })
            : null;
          if (!item) throw new ConflictException('Return inventory item is unavailable');
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
              quantity: line.quantity,
            },
            update: { quantity: { increment: line.quantity }, version: { increment: 1 } },
          });
          await tx.stockLedgerEntry.create({
            data: {
              id: randomUUID(),
              tenantId: context.tenantId,
              inventoryItemId: item.id,
              state: 'ON_HAND',
              quantityDelta: line.quantity,
              operation: 'RETURN_RESTOCK',
              reasonCode: 'RETURN_INSPECTED',
              sourceType: 'RETURN_LINE',
              sourceId: line.id,
              idempotencyKey: `return:${record.id}:restock:${line.id}`,
              correlationId: context.correlationId,
              actorId: principal.userId,
            },
          });
        }
      }
      await tx.returnInspection.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          returnAuthorizationId: record.id,
          inspectorId: principal.userId,
          conditionCode: input.conditionCode,
          evidence: (input.evidence ?? null) as Prisma.InputJsonValue,
          note: input.note ?? null,
        },
      });
      if (refundMinor > 0n) {
        const refundAmount = safeIntegerNumber(refundMinor, 'Return refund');
        const [refundAccount, cashAccount] = await Promise.all([
          tx.financialAccount.findFirst({
            where: { tenantId: context.tenantId, code: '5000', currency: 'USD' },
          }),
          tx.financialAccount.findFirst({
            where: { tenantId: context.tenantId, code: '1000', currency: 'USD' },
          }),
        ]);
        if (!refundAccount || !cashAccount)
          throw new ConflictException('Finance chart is not configured');
        await this.postJournalInTransaction(tx, context, principal, {
          sourceType: 'RETURN',
          sourceId: record.id,
          description: `Refund for ${record.number}`,
          currency: 'USD',
          idempotencyKey: `return:${record.id}:refund`,
          lines: [
            { accountId: refundAccount.id, debitMinor: refundAmount, creditMinor: 0 },
            { accountId: cashAccount.id, debitMinor: 0, creditMinor: refundAmount },
          ],
        });
      }
      return tx.returnAuthorization.update({
        where: { id: record.id },
        data: { status: 'RESOLVED', resolvedAt: new Date(), version: { increment: 1 } },
        include: { lines: true, inspections: true },
      });
    });
  }

  accounts(context: TenantContext): Promise<unknown> {
    return this.db.financialAccount.findMany({
      where: { tenantId: context.tenantId, active: true },
      orderBy: { code: 'asc' },
    });
  }

  journals(context: TenantContext): Promise<unknown> {
    return this.db.journalEntry.findMany({
      where: { tenantId: context.tenantId },
      include: { lines: { include: { account: true } } },
      orderBy: { postedAt: 'desc' },
    });
  }

  postJournal(
    context: TenantContext,
    principal: AuthPrincipal,
    input: PostJournalDto,
  ): Promise<unknown> {
    return this.db.$transaction((tx) =>
      this.postJournalInTransaction(tx, context, principal, input),
    );
  }

  async reverseJournal(
    context: TenantContext,
    principal: AuthPrincipal,
    entryId: string,
    input: ReverseJournalDto,
  ): Promise<unknown> {
    const entry = await this.db.journalEntry.findFirst({
      where: { id: entryId, tenantId: context.tenantId, status: 'POSTED' },
      include: { lines: true },
    });
    if (!entry) throw new NotFoundException('Resource not found');
    if (entry.reversalOfId) throw new ConflictException('A reversal cannot be reversed directly');
    return this.db.$transaction((tx) =>
      this.postJournalInTransaction(tx, context, principal, {
        sourceType: 'JOURNAL_REVERSAL',
        sourceId: entry.id,
        description: input.reason,
        currency: entry.currency,
        idempotencyKey: input.idempotencyKey,
        reversalOfId: entry.id,
        lines: entry.lines.map((line) => ({
          accountId: line.accountId,
          debitMinor: safeIntegerNumber(line.creditMinor, 'Journal credit'),
          creditMinor: safeIntegerNumber(line.debitMinor, 'Journal debit'),
          memo: `Reversal of ${entry.number}`,
        })),
      }),
    );
  }

  settlements(context: TenantContext): Promise<unknown> {
    return this.db.settlement.findMany({
      where: { tenantId: context.tenantId },
      include: { lines: { include: { journalEntry: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async calculateSettlement(
    context: TenantContext,
    input: CalculateSettlementDto,
  ): Promise<unknown> {
    const start = new Date(input.periodStart);
    const end = new Date(input.periodEnd);
    if (start >= end) throw new ConflictException('Settlement period is invalid');
    const journals = await this.db.journalEntry.findMany({
      where: {
        tenantId: context.tenantId,
        currency: input.currency.toUpperCase(),
        postedAt: { gte: start, lt: end },
        sourceId: input.partnerId,
      },
      include: { lines: { include: { account: true } } },
    });
    const gross = journals.reduce(
      (sum, journal) =>
        sum +
        journal.lines.reduce(
          (lineSum, line) =>
            lineSum + (line.account.code === '2000' ? line.creditMinor - line.debitMinor : 0n),
          0n,
        ),
      0n,
    );
    const fees = gross > 0n ? (gross * 3n) / 100n : 0n;
    const net = gross - fees - BigInt(input.reserveMinor) + BigInt(input.adjustmentMinor);
    return this.db.settlement.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        partnerKind: input.partnerKind,
        partnerId: input.partnerId,
        periodStart: start,
        periodEnd: end,
        currency: input.currency.toUpperCase(),
        grossMinor: gross,
        feesMinor: fees,
        reserveMinor: input.reserveMinor,
        adjustmentMinor: input.adjustmentMinor,
        netMinor: net,
        lines: {
          create: journals.map((journal) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            journalEntryId: journal.id,
            kind: journal.sourceType,
            amountMinor: journal.lines.reduce(
              (sum, line) =>
                sum + (line.account.code === '2000' ? line.creditMinor - line.debitMinor : 0n),
              0n,
            ),
          })),
        },
      },
      include: { lines: true },
    });
  }

  async approveSettlement(
    context: TenantContext,
    principal: AuthPrincipal,
    settlementId: string,
  ): Promise<unknown> {
    const settlement = await this.db.settlement.findFirst({
      where: { id: settlementId, tenantId: context.tenantId, status: 'CALCULATED' },
    });
    if (!settlement) throw new NotFoundException('Resource not found');
    return this.db.settlement.update({
      where: { id: settlement.id },
      data: {
        status: 'APPROVED',
        approvedBy: principal.userId,
        approvedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async paySettlement(context: TenantContext, settlementId: string): Promise<unknown> {
    const settlement = await this.db.settlement.findFirst({
      where: { id: settlementId, tenantId: context.tenantId, status: 'APPROVED' },
    });
    if (!settlement) throw new NotFoundException('Resource not found');
    return this.db.settlement.update({
      where: { id: settlement.id },
      data: { status: 'PAID', paidAt: new Date(), version: { increment: 1 } },
    });
  }

  reconcile(
    context: TenantContext,
    principal: AuthPrincipal,
    input: ReconcileDto,
  ): Promise<unknown> {
    const difference = input.providerMinor - input.expectedMinor;
    return this.db.reconciliationRun.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        providerKey: input.providerKey,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        currency: input.currency.toUpperCase(),
        expectedMinor: input.expectedMinor,
        providerMinor: input.providerMinor,
        differenceMinor: difference,
        status: difference === 0 ? 'MATCHED' : 'EXCEPTION',
        evidence: (input.evidence ?? null) as Prisma.InputJsonValue,
        createdBy: principal.userId,
      },
    });
  }

  private async postJournalInTransaction(
    tx: Prisma.TransactionClient,
    context: TenantContext,
    principal: AuthPrincipal,
    input: PostJournalDto & { reversalOfId?: string },
  ): Promise<unknown> {
    const debit = input.lines.reduce((sum, line) => sum + BigInt(line.debitMinor), 0n);
    const credit = input.lines.reduce((sum, line) => sum + BigInt(line.creditMinor), 0n);
    if (debit <= 0n || debit !== credit)
      throw new ConflictException('Journal debits and credits must be equal and non-zero');
    if (input.lines.some((line) => line.debitMinor > 0 === line.creditMinor > 0))
      throw new ConflictException('Each journal line must contain exactly one side');
    const accounts = await tx.financialAccount.findMany({
      where: {
        tenantId: context.tenantId,
        id: { in: input.lines.map((line) => line.accountId) },
        currency: input.currency.toUpperCase(),
        active: true,
      },
    });
    if (accounts.length !== new Set(input.lines.map((line) => line.accountId)).size)
      throw new NotFoundException('Resource not found');
    const existing = await tx.journalEntry.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: context.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { lines: true },
    });
    if (existing) return existing;
    const id = randomUUID();
    return tx.journalEntry.create({
      data: {
        id,
        tenantId: context.tenantId,
        number: `JE-${id.slice(0, 8).toUpperCase()}`,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        description: input.description,
        currency: input.currency.toUpperCase(),
        idempotencyKey: input.idempotencyKey,
        reversalOfId: input.reversalOfId ?? null,
        postedBy: principal.userId,
        lines: {
          create: input.lines.map((line) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            accountId: line.accountId,
            debitMinor: line.debitMinor,
            creditMinor: line.creditMinor,
            memo: line.memo ?? null,
          })),
        },
      },
      include: { lines: true },
    });
  }

  private async requireReturn(context: TenantContext, returnId: string) {
    const record = await this.db.returnAuthorization.findFirst({
      where: { id: returnId, tenantId: context.tenantId },
      include: { lines: true },
    });
    if (!record) throw new NotFoundException('Resource not found');
    return record;
  }
}

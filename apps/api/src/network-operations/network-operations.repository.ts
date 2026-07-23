import { createHash, randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import type {
  AssignClientInventoryDto,
  ApproveRouteDto,
  CreateControlTowerExceptionDto,
  CreateLogisticsClientDto,
  CreateLogisticsContractDto,
  IssueLogisticsInvoiceDto,
  RecommendRouteDto,
  RecordBillableEventDto,
} from './network-operations.dto.js';

@Injectable()
export class NetworkOperationsRepository {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  clients(context: TenantContext): Promise<unknown> {
    return this.db.logisticsClient.findMany({
      where: { tenantId: context.tenantId },
      include: { contracts: true, inventory: true, invoices: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createClient(context: TenantContext, input: CreateLogisticsClientDto): Promise<unknown> {
    return this.db.logisticsClient.create({
      data: { id: randomUUID(), tenantId: context.tenantId, ...input },
    });
  }

  async createContract(
    context: TenantContext,
    clientId: string,
    input: CreateLogisticsContractDto,
  ): Promise<unknown> {
    await this.requireClient(context, clientId);
    return this.db.logisticsContract.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        clientId,
        name: input.name,
        serviceCatalog: input.serviceCatalog as Prisma.InputJsonValue,
        rateCard: input.rateCard as Prisma.InputJsonValue,
        sla: input.sla as Prisma.InputJsonValue,
        effectiveAt: new Date(input.effectiveAt),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
  }

  async assignInventory(
    context: TenantContext,
    clientId: string,
    input: AssignClientInventoryDto,
  ): Promise<unknown> {
    await this.requireClient(context, clientId);
    const item = await this.db.inventoryItem.findFirst({
      where: { id: input.inventoryItemId, tenantId: context.tenantId },
    });
    if (!item) throw new NotFoundException('Resource not found');
    const otherAllocations = await this.db.clientInventory.aggregate({
      where: {
        tenantId: context.tenantId,
        inventoryItemId: item.id,
        NOT: { clientId },
      },
      _sum: { allocatedQty: true },
    });
    const onHand = await this.db.inventoryBalance.findUnique({
      where: {
        tenantId_inventoryItemId_state: {
          tenantId: context.tenantId,
          inventoryItemId: item.id,
          state: 'ON_HAND',
        },
      },
    });
    if (
      BigInt(input.allocatedQty) + (otherAllocations._sum.allocatedQty ?? 0n) >
      (onHand?.quantity ?? 0n)
    )
      throw new ConflictException('Client allocation exceeds isolated on-hand inventory');
    return this.db.clientInventory.upsert({
      where: {
        tenantId_clientId_inventoryItemId: {
          tenantId: context.tenantId,
          clientId,
          inventoryItemId: item.id,
        },
      },
      create: {
        id: randomUUID(),
        tenantId: context.tenantId,
        clientId,
        inventoryItemId: item.id,
        facilityId: item.facilityId,
        allocatedQty: input.allocatedQty,
      },
      update: { allocatedQty: input.allocatedQty },
    });
  }

  async recordBillableEvent(
    context: TenantContext,
    clientId: string,
    input: RecordBillableEventDto,
  ): Promise<unknown> {
    const contract = await this.db.logisticsContract.findFirst({
      where: {
        id: input.contractId,
        clientId,
        tenantId: context.tenantId,
        status: 'ACTIVE',
        effectiveAt: { lte: new Date(input.occurredAt) },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date(input.occurredAt) } }],
      },
    });
    if (!contract) throw new NotFoundException('Resource not found');
    return this.db.billableEvent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        clientId,
        contractId: contract.id,
        eventType: input.eventType,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        quantity: input.quantity,
        unitPriceMinor: input.unitPriceMinor,
        totalMinor: input.quantity * input.unitPriceMinor,
        currency: input.currency.toUpperCase(),
        occurredAt: new Date(input.occurredAt),
      },
    });
  }

  async issueInvoice(
    context: TenantContext,
    clientId: string,
    input: IssueLogisticsInvoiceDto,
  ): Promise<unknown> {
    const start = new Date(input.periodStart);
    const end = new Date(input.periodEnd);
    if (start >= end) throw new ConflictException('Invoice period is invalid');
    const events = await this.db.billableEvent.findMany({
      where: {
        tenantId: context.tenantId,
        clientId,
        contractId: input.contractId,
        status: 'UNBILLED',
        occurredAt: { gte: start, lt: end },
      },
    });
    if (events.length === 0) throw new ConflictException('No unbilled events exist');
    const currencies = new Set(events.map((event) => event.currency));
    if (currencies.size !== 1) throw new ConflictException('Invoice events must share a currency');
    return this.db.$transaction(async (tx) => {
      const id = randomUUID();
      const invoice = await tx.logisticsInvoice.create({
        data: {
          id,
          tenantId: context.tenantId,
          clientId,
          contractId: input.contractId,
          number: `3PL-${id.slice(0, 8).toUpperCase()}`,
          periodStart: start,
          periodEnd: end,
          currency: events[0]!.currency,
          totalMinor: events.reduce((sum, event) => sum + Number(event.totalMinor), 0),
          dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
        },
      });
      await tx.billableEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) }, tenantId: context.tenantId },
        data: { status: 'BILLED', invoiceId: invoice.id },
      });
      return invoice;
    });
  }

  exceptions(context: TenantContext): Promise<unknown> {
    return this.db.controlTowerException.findMany({
      where: { tenantId: context.tenantId },
      include: { recommendations: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createException(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateControlTowerExceptionDto,
  ): Promise<unknown> {
    const fulfillment = await this.db.fulfillmentOrder.findFirst({
      where: { id: input.fulfillmentOrderId, tenantId: context.tenantId },
    });
    if (!fulfillment) throw new NotFoundException('Resource not found');
    return this.db.$transaction(async (tx) => {
      const exception = await tx.controlTowerException.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          fulfillmentOrderId: fulfillment.id,
          code: input.code,
          severity: input.severity,
          context: input.context as Prisma.InputJsonValue,
          openedBy: principal.userId,
        },
      });
      await tx.fulfillmentOrder.update({
        where: { id: fulfillment.id },
        data: { status: 'EXCEPTION', exceptionCode: input.code, version: { increment: 1 } },
      });
      return exception;
    });
  }

  async recommend(
    context: TenantContext,
    exceptionId: string,
    input: RecommendRouteDto,
  ): Promise<unknown> {
    const exception = await this.requireException(context, exceptionId);
    const facility = await this.db.facility.findFirst({
      where: { id: input.facilityId, tenantId: context.tenantId, status: 'OPEN', deletedAt: null },
    });
    if (!facility) throw new NotFoundException('Resource not found');
    const canonical = JSON.stringify({
      exceptionId: exception.id,
      facilityId: input.facilityId,
      providerKey: input.providerKey,
      costMinor: input.costMinor,
      slaHours: input.slaHours,
      carbonGrams: input.carbonGrams,
    });
    return this.db.routingRecommendation.upsert({
      where: {
        tenantId_exceptionId_inputHash: {
          tenantId: context.tenantId,
          exceptionId,
          inputHash: createHash('sha256').update(canonical).digest('hex'),
        },
      },
      create: {
        id: randomUUID(),
        tenantId: context.tenantId,
        exceptionId,
        facilityId: input.facilityId,
        providerKey: input.providerKey,
        costMinor: input.costMinor,
        slaHours: input.slaHours,
        carbonGrams: input.carbonGrams,
        rationale: input.rationale as Prisma.InputJsonValue,
        inputHash: createHash('sha256').update(canonical).digest('hex'),
      },
      update: {},
    });
  }

  async approve(
    context: TenantContext,
    principal: AuthPrincipal,
    recommendationId: string,
    input: ApproveRouteDto,
  ): Promise<unknown> {
    const recommendation = await this.db.routingRecommendation.findFirst({
      where: { id: recommendationId, tenantId: context.tenantId, status: 'PROPOSED' },
      include: { exception: true },
    });
    if (!recommendation) throw new NotFoundException('Resource not found');
    return this.db.$transaction(async (tx) => {
      await tx.routingRecommendation.updateMany({
        where: {
          tenantId: context.tenantId,
          exceptionId: recommendation.exceptionId,
          status: 'PROPOSED',
          NOT: { id: recommendation.id },
        },
        data: { status: 'REJECTED' },
      });
      const approved = await tx.routingRecommendation.update({
        where: { id: recommendation.id },
        data: { status: 'APPROVED', approvedBy: principal.userId, approvedAt: new Date() },
      });
      await this.audit(tx, context, principal, 'routing.approved', approved.id, input.reason, {
        exceptionId: recommendation.exceptionId,
        fromFacilityId: recommendation.exception.fulfillmentOrderId,
        toFacilityId: recommendation.facilityId,
        costMinor: Number(recommendation.costMinor),
        slaHours: recommendation.slaHours,
      });
      return approved;
    });
  }

  async execute(
    context: TenantContext,
    principal: AuthPrincipal,
    recommendationId: string,
  ): Promise<unknown> {
    const recommendation = await this.db.routingRecommendation.findFirst({
      where: { id: recommendationId, tenantId: context.tenantId, status: 'APPROVED' },
      include: { exception: true },
    });
    if (!recommendation) throw new NotFoundException('Resource not found');
    const fulfillment = await this.db.fulfillmentOrder.findFirst({
      where: {
        id: recommendation.exception.fulfillmentOrderId,
        tenantId: context.tenantId,
        status: 'EXCEPTION',
      },
      include: { lines: true },
    });
    if (!fulfillment) throw new ConflictException('Fulfillment is no longer reroutable');
    const orderLines = await this.db.orderLine.findMany({
      where: {
        tenantId: context.tenantId,
        id: { in: fulfillment.lines.map((line) => line.orderLineId) },
      },
    });
    const alternatives = await this.db.inventoryItem.findMany({
      where: {
        tenantId: context.tenantId,
        facilityId: recommendation.facilityId,
        productRef: { in: orderLines.map((line) => line.variantId) },
      },
    });
    if (alternatives.length !== orderLines.length)
      throw new ConflictException('Recommended facility cannot fulfill every line');
    return this.db.$transaction(async (tx) => {
      for (const line of fulfillment.lines) {
        const orderLine = orderLines.find((candidate) => candidate.id === line.orderLineId)!;
        const alternative = alternatives.find(
          (candidate) => candidate.productRef === orderLine.variantId,
        )!;
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_inventoryItemId_state: {
              tenantId: context.tenantId,
              inventoryItemId: alternative.id,
              state: 'ON_HAND',
            },
          },
        });
        if (!balance || balance.quantity < BigInt(line.quantity))
          throw new ConflictException('Recommended facility inventory changed');
        await tx.fulfillmentLine.update({
          where: { id: line.id },
          data: { inventoryItemId: alternative.id, binId: null },
        });
      }
      await tx.fulfillmentOrder.update({
        where: { id: fulfillment.id },
        data: {
          facilityId: recommendation.facilityId,
          status: 'RELEASED',
          exceptionCode: null,
          version: { increment: 1 },
        },
      });
      await tx.routingRecommendation.update({
        where: { id: recommendation.id },
        data: { status: 'EXECUTED', executedAt: new Date() },
      });
      await tx.controlTowerException.update({
        where: { id: recommendation.exceptionId },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
      await this.audit(tx, context, principal, 'routing.executed', recommendation.id, null, {
        fulfillmentOrderId: fulfillment.id,
        fromFacilityId: fulfillment.facilityId,
        toFacilityId: recommendation.facilityId,
      });
      return tx.fulfillmentOrder.findUnique({
        where: { id: fulfillment.id },
        include: { lines: true },
      });
    });
  }

  private async audit(
    tx: Prisma.TransactionClient,
    context: TenantContext,
    principal: AuthPrincipal,
    action: string,
    entityId: string,
    reason: string | null,
    metadata: Record<string, unknown>,
  ) {
    await tx.auditEvent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        actorId: principal.userId,
        actorType: 'USER',
        action,
        entityType: 'RoutingRecommendation',
        entityId,
        reason,
        requestId: context.correlationId,
        correlationId: context.correlationId,
        metadata: metadata as Prisma.InputJsonValue,
        authenticationMethod: 'SESSION',
        approvalReference: action === 'routing.approved' ? entityId : null,
      },
    });
  }

  private async requireClient(context: TenantContext, id: string) {
    const client = await this.db.logisticsClient.findFirst({
      where: { id, tenantId: context.tenantId, status: 'ACTIVE' },
    });
    if (!client) throw new NotFoundException('Resource not found');
    return client;
  }

  private async requireException(context: TenantContext, id: string) {
    const exception = await this.db.controlTowerException.findFirst({
      where: { id, tenantId: context.tenantId, status: 'OPEN' },
    });
    if (!exception) throw new NotFoundException('Resource not found');
    return exception;
  }
}

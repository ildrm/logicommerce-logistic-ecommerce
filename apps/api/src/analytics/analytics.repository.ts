import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, TenantContext } from '@logicommerce/database';
import { DATABASE } from '../database/database.module.js';

type Severity = 'critical' | 'high' | 'medium' | 'info';
type ExceptionSignal = {
  severity: Severity;
  process: string;
  issue: string;
  count: number;
  owner: string;
  href: string;
};

const DAY = 86_400_000;
const TERMINAL_FULFILLMENT = new Set(['DELIVERED', 'CANCELLED']);
const TERMINAL_RETURN = new Set(['RESOLVED', 'REJECTED', 'CANCELLED']);

function asNumber(value: bigint | number | null | undefined): number {
  return Number(value ?? 0);
}

function percentage(total: number, exceptions: number): number | null {
  if (total === 0) return null;
  return Math.max(0, Math.round((1 - exceptions / total) * 1_000) / 10);
}

function dailySeries(days: number, rows: readonly { createdAt: Date }[], now: Date) {
  const values = new Map<string, number>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * DAY).toISOString().slice(0, 10);
    values.set(date, 0);
  }
  for (const row of rows) {
    const date = row.createdAt.toISOString().slice(0, 10);
    if (values.has(date)) values.set(date, (values.get(date) ?? 0) + 1);
  }
  return [...values].map(([date, value]) => ({ date, value }));
}

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async overview(context: TenantContext, days: number) {
    const now = new Date();
    const start = new Date(now.getTime() - days * DAY);
    const tenantId = context.tenantId;

    const [
      orderRows,
      orderCount,
      fulfillments,
      shipments,
      returns,
      inventory,
      controlExceptions,
      webhookDeadLetters,
      c2cDisputes,
      overdueInvoices,
      settlements,
      reconciliations,
      slos,
      optimizationRuns,
      recommendations,
      auditEvents,
      privacyOverdue,
      c2cTransactions,
      businessOrders,
      partnerOrders,
      logisticsClients,
      activeProducts,
      activeCarts,
      activeUsers,
    ] = await Promise.all([
      this.db.order.findMany({
        where: { tenantId, createdAt: { gte: start } },
        select: { createdAt: true, status: true, totalMinor: true },
        orderBy: { createdAt: 'asc' },
        take: 5_000,
      }),
      this.db.order.count({ where: { tenantId, createdAt: { gte: start } } }),
      this.db.fulfillmentOrder.findMany({
        where: { tenantId },
        select: { status: true, slaDueAt: true, createdAt: true, exceptionCode: true },
        orderBy: { createdAt: 'asc' },
        take: 5_000,
      }),
      this.db.shipment.findMany({
        where: { tenantId },
        select: { status: true, createdAt: true, deliveredAt: true },
        orderBy: { createdAt: 'asc' },
        take: 5_000,
      }),
      this.db.returnAuthorization.findMany({
        where: { tenantId },
        select: { status: true, createdAt: true, resolvedAt: true },
        orderBy: { createdAt: 'asc' },
        take: 5_000,
      }),
      this.db.inventoryBalance.groupBy({
        by: ['state'],
        where: { tenantId },
        _sum: { quantity: true },
      }),
      this.db.controlTowerException.findMany({
        where: { tenantId, status: 'OPEN' },
        select: { code: true, severity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1_000,
      }),
      this.db.webhookDelivery.count({ where: { tenantId, status: 'DEAD_LETTER' } }),
      this.db.c2CDispute.count({ where: { tenantId, status: 'OPEN' } }),
      this.db.businessInvoice.count({
        where: { tenantId, status: { not: 'PAID' }, dueAt: { lt: now } },
      }),
      this.db.settlement.findMany({
        where: { tenantId },
        select: {
          status: true,
          grossMinor: true,
          feesMinor: true,
          reserveMinor: true,
          netMinor: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 2_000,
      }),
      this.db.reconciliationRun.findMany({
        where: { tenantId, createdAt: { gte: start } },
        select: { status: true, differenceMinor: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 2_000,
      }),
      this.db.serviceLevelObjective.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { observations: { orderBy: { windowEnd: 'desc' }, take: 1 } },
        orderBy: { name: 'asc' },
      }),
      this.db.optimizationRun.count({ where: { tenantId, createdAt: { gte: start } } }),
      this.db.optimizationRecommendation.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.db.auditEvent.findMany({
        where: { tenantId },
        select: { action: true, entityType: true, occurredAt: true },
        orderBy: { occurredAt: 'desc' },
        take: 8,
      }),
      this.db.privacyRequest.count({
        where: { tenantId, status: { not: 'COMPLETED' }, dueAt: { lt: now } },
      }),
      this.db.c2CTransaction.count({ where: { tenantId, createdAt: { gte: start } } }),
      this.db.businessOrder.count({ where: { tenantId, createdAt: { gte: start } } }),
      this.db.shopOrder.count({ where: { tenantId, createdAt: { gte: start } } }),
      this.db.logisticsClient.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.db.product.count({
        where: { tenantId, status: 'ACTIVE', deletedAt: null },
      }),
      this.db.cart.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.db.user.count({ where: { tenantId, isActive: true } }),
    ]);

    const overdueFulfillment = fulfillments.filter(
      (item) =>
        item.slaDueAt !== null &&
        item.slaDueAt < now &&
        !TERMINAL_FULFILLMENT.has(item.status),
    ).length;
    const fulfillmentExceptions = fulfillments.filter(
      (item) => item.status === 'EXCEPTION' || item.exceptionCode !== null,
    ).length;
    const atRiskShipments = new Set(
      fulfillments
        .filter(
          (item) =>
            item.status === 'EXCEPTION' ||
            (item.slaDueAt !== null &&
              item.slaDueAt < now &&
              !TERMINAL_FULFILLMENT.has(item.status)),
        )
        .map((_, index) => index),
    ).size;
    const openReturns = returns.filter((item) => !TERMINAL_RETURN.has(item.status)).length;
    const agingReturns = returns.filter(
      (item) => !TERMINAL_RETURN.has(item.status) && now.getTime() - item.createdAt.getTime() > 7 * DAY,
    ).length;
    const reconciliationDifference = reconciliations.reduce(
      (sum, item) => sum + Math.abs(asNumber(item.differenceMinor)),
      0,
    );
    const settlementExposure = settlements
      .filter((item) => item.status !== 'PAID')
      .reduce((sum, item) => sum + asNumber(item.netMinor), 0);
    const inventoryByState = Object.fromEntries(
      inventory.map((item) => [item.state, asNumber(item._sum.quantity)]),
    ) as Record<string, number>;
    const inventoryRisk =
      (inventoryByState.BACKORDERED ?? 0) +
      (inventoryByState.QUARANTINED ?? 0) +
      (inventoryByState.DAMAGED ?? 0) +
      (inventoryByState.LOST ?? 0) +
      (inventoryByState.EXPIRED ?? 0);

    const signals = ([
      {
        severity: 'critical',
        process: 'Fulfillment',
        issue: 'Orders beyond their fulfillment SLA',
        count: overdueFulfillment,
        owner: 'Fulfillment team',
        href: '/operations?focus=fulfillment',
      },
      {
        severity: 'high',
        process: 'Network',
        issue: 'Open control-tower exceptions',
        count: controlExceptions.length,
        owner: 'Network control',
        href: '/operations?focus=network',
      },
      {
        severity: 'high',
        process: 'Integrations',
        issue: 'Webhook deliveries in dead letter',
        count: webhookDeadLetters,
        owner: 'Integration team',
        href: '/platform?focus=integrations',
      },
      {
        severity: 'high',
        process: 'Inventory',
        issue: 'Units in risk or backorder states',
        count: inventoryRisk,
        owner: 'Inventory team',
        href: '/operations?focus=inventory',
      },
      {
        severity: 'medium',
        process: 'Returns',
        issue: 'Open returns aging beyond seven days',
        count: agingReturns,
        owner: 'Returns team',
        href: '/operations?focus=returns',
      },
      {
        severity: 'medium',
        process: 'B2B',
        issue: 'Business invoices past due',
        count: overdueInvoices,
        owner: 'Finance team',
        href: '/operations?focus=b2b',
      },
      {
        severity: 'medium',
        process: 'C2C',
        issue: 'Buyer-protection disputes awaiting resolution',
        count: c2cDisputes,
        owner: 'Marketplace team',
        href: '/operations?focus=c2c',
      },
      {
        severity: 'high',
        process: 'Finance',
        issue: 'Reconciliation difference',
        count: reconciliationDifference,
        owner: 'Finance team',
        href: '/operations?focus=finance',
      },
      {
        severity: 'critical',
        process: 'Privacy',
        issue: 'Privacy requests past due',
        count: privacyOverdue,
        owner: 'Compliance team',
        href: '/platform?focus=governance',
      },
    ] satisfies ExceptionSignal[]).filter((signal) => signal.count > 0);

    const scorePenalty = signals.reduce((sum, signal) => {
      const weight = signal.severity === 'critical' ? 8 : signal.severity === 'high' ? 4 : 2;
      return sum + Math.min(20, weight + Math.log10(signal.count + 1) * weight);
    }, 0);
    const healthScore = Math.max(0, Math.round((100 - scorePenalty) * 10) / 10);
    const orderGmvMinor = orderRows.reduce((sum, order) => sum + asNumber(order.totalMinor), 0);
    const cancelledOrders = orderRows.filter((order) => order.status === 'CANCELLED').length;
    const delivered = shipments.filter((shipment) => shipment.status === 'DELIVERED').length;
    const returnResolved = returns.filter((item) => item.status === 'RESOLVED').length;
    const settlementIssues =
      settlements.filter((item) => item.status !== 'PAID').length +
      reconciliations.filter((item) => asNumber(item.differenceMinor) !== 0).length;
    const recommendationCounts = Object.fromEntries(
      recommendations.map((item) => [item.status, item._count._all]),
    ) as Record<string, number>;

    return {
      generatedAt: now.toISOString(),
      window: { days, start: start.toISOString(), end: now.toISOString() },
      dataQuality: {
        status: orderCount > orderRows.length ? 'partial' : 'live',
        truncatedDomains: orderCount > orderRows.length ? ['orders'] : [],
      },
      health: {
        score: healthScore,
        state: healthScore >= 95 ? 'healthy' : healthScore >= 85 ? 'attention' : 'at-risk',
        activeExceptions: signals.reduce((sum, signal) => sum + signal.count, 0),
        criticalSignals: signals.filter((signal) => signal.severity === 'critical').length,
      },
      kpis: {
        orders: orderCount,
        orderGmvMinor,
        atRiskShipments,
        openReturns,
        settlementExposureMinor: settlementExposure,
      },
      trends: {
        orders: dailySeries(days, orderRows, now),
        fulfillment: dailySeries(
          days,
          fulfillments.filter((item) => item.createdAt >= start),
          now,
        ),
        returns: dailySeries(
          days,
          returns.filter((item) => item.createdAt >= start),
          now,
        ),
      },
      exceptions: signals.sort((left, right) => {
        const rank = { critical: 0, high: 1, medium: 2, info: 3 };
        return rank[left.severity] - rank[right.severity] || right.count - left.count;
      }),
      processHealth: [
        { key: 'orders', label: 'Order intake', total: orderCount, exceptions: cancelledOrders, healthyPercent: percentage(orderCount, cancelledOrders) },
        { key: 'inventory', label: 'Inventory', total: Object.values(inventoryByState).reduce((sum, value) => sum + value, 0), exceptions: inventoryRisk, healthyPercent: percentage(Object.values(inventoryByState).reduce((sum, value) => sum + value, 0), inventoryRisk) },
        { key: 'fulfillment', label: 'Fulfillment', total: fulfillments.length, exceptions: Math.max(fulfillmentExceptions, overdueFulfillment), healthyPercent: percentage(fulfillments.length, Math.max(fulfillmentExceptions, overdueFulfillment)) },
        { key: 'delivery', label: 'Delivery', total: shipments.length, exceptions: shipments.length - delivered, healthyPercent: percentage(shipments.length, shipments.length - delivered) },
        { key: 'returns', label: 'Returns', total: returns.length, exceptions: openReturns, healthyPercent: percentage(returns.length, openReturns) },
        { key: 'settlement', label: 'Settlement', total: settlements.length + reconciliations.length, exceptions: settlementIssues, healthyPercent: percentage(settlements.length + reconciliations.length, settlementIssues) },
      ],
      inventory: {
        states: inventoryByState,
        totalUnits: Object.values(inventoryByState).reduce((sum, value) => sum + value, 0),
        riskUnits: inventoryRisk,
      },
      finance: {
        currency: 'USD',
        gmvMinor: orderGmvMinor,
        settlementExposureMinor: settlementExposure,
        reconciliationDifferenceMinor: reconciliationDifference,
        reservesMinor: settlements.reduce((sum, item) => sum + asNumber(item.reserveMinor), 0),
        feesMinor: settlements.reduce((sum, item) => sum + asNumber(item.feesMinor), 0),
      },
      network: {
        optimizationRuns,
        proposed: recommendationCounts.PROPOSED ?? 0,
        approved: recommendationCounts.APPROVED ?? 0,
        executed: recommendationCounts.EXECUTED ?? 0,
        rolledBack: recommendationCounts.ROLLED_BACK ?? 0,
      },
      domainActivity: [
        { key: 'identity', label: 'Identity', value: activeUsers, context: 'active users', href: '/account' },
        { key: 'catalog', label: 'Catalog', value: activeProducts, context: 'active products', href: '/storefront' },
        { key: 'commerce', label: 'Commerce', value: orderCount, context: `orders in ${days} days`, href: '/operations?focus=commerce' },
        { key: 'carts', label: 'Checkout', value: activeCarts, context: 'active carts', href: '/operations?focus=commerce' },
        { key: 'fulfillment', label: 'Fulfillment', value: fulfillments.length, context: 'work records', href: '/operations?focus=fulfillment' },
        { key: 'c2c', label: 'C2C', value: c2cTransactions, context: `transactions in ${days} days`, href: '/operations?focus=c2c' },
        { key: 'b2b', label: 'B2B', value: businessOrders, context: `orders in ${days} days`, href: '/operations?focus=b2b' },
        { key: 'partners', label: 'Shop APIs', value: partnerOrders, context: `partner orders in ${days} days`, href: '/operations?focus=integrations' },
        { key: 'returns', label: 'Returns', value: returns.filter((item) => item.createdAt >= start).length, context: `requests in ${days} days`, href: '/operations?focus=returns' },
        { key: 'logistics', label: '3PL / 4PL', value: logisticsClients, context: 'active clients', href: '/operations?focus=network' },
        { key: 'optimization', label: 'Optimization', value: optimizationRuns, context: `runs in ${days} days`, href: '/operations?focus=optimization' },
        { key: 'reliability', label: 'Reliability', value: slos.length, context: 'active objectives', href: '/platform?focus=reliability' },
      ],
      slos: slos.map((slo) => {
        const observation = slo.observations[0];
        return {
          key: slo.key,
          name: slo.name,
          target: slo.target,
          windowDays: slo.windowDays,
          value: observation?.value ?? null,
          sampleSize: observation?.sampleSize ?? 0,
          status: observation?.status ?? 'NO_DATA',
          observedAt: observation?.recordedAt?.toISOString() ?? null,
        };
      }),
      activity: auditEvents.map((event) => ({
        action: event.action,
        entityType: event.entityType,
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  }
}

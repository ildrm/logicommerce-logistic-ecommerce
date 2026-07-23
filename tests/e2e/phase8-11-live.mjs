import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const tenantId = '00000000-0000-4000-8000-000000000001';
const isolationTenantId = '00000000-0000-4000-8000-000000000009';
const storeId = '00000000-0000-4000-8000-000000000401';
const supplierId = '00000000-0000-4000-8000-000000000405';
const sellerId = '00000000-0000-4000-8000-000000000406';
const variantId = '00000000-0000-4000-8000-000000000408';
const offerId = '00000000-0000-4000-8000-000000000409';
const inventoryItemId = '00000000-0000-4000-8000-000000000411';
const primaryFacilityId = '00000000-0000-4000-8000-000000000417';

async function login() {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({
      email: 'admin@demo.logicommerce.local',
      password: 'ChangeMe-Local-Only-2026',
    }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).accessToken;
}

function api(path, token, init = {}, tenant = tenantId) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'x-tenant-id': tenant,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });
}

async function json(response, expected) {
  assert.equal(response.status, expected, await response.clone().text());
  return response.json();
}

async function createOrder(token, suffix) {
  const cart = await json(
    await api('/commerce/carts', token, {
      method: 'POST',
      body: JSON.stringify({ storeId }),
    }),
    201,
  );
  await json(
    await api(`/commerce/carts/${cart.id}/lines`, token, {
      method: 'POST',
      body: JSON.stringify({ offerId, quantity: 1 }),
    }),
    201,
  );
  const order = await json(
    await api(`/commerce/carts/${cart.id}/checkout`, token, {
      method: 'POST',
      headers: { 'idempotency-key': `phase8-11-checkout-${suffix}` },
      body: JSON.stringify({
        paymentToken: 'tok_phase8_11',
        address: {
          recipient: 'Phase 8-11 Test',
          line1: '1 Evidence Way',
          city: 'Demo City',
          postalCode: '10001',
          countryCode: 'US',
        },
      }),
    }),
    201,
  );
  const purchaseOrders = await json(await api('/commerce/purchase-orders', token), 200);
  const purchaseOrder = purchaseOrders.find(
    (candidate) => candidate.orderSplit.orderId === order.id,
  );
  assert.ok(purchaseOrder);
  await json(
    await api(`/commerce/purchase-orders/${purchaseOrder.id}/accept`, token, { method: 'PUT' }),
    200,
  );
  return order;
}

async function phase8(token, suffix) {
  const order = await createOrder(token, `${suffix}-return`);
  const authorization = await json(
    await api('/returns-finance/returns', token, {
      method: 'POST',
      body: JSON.stringify({
        orderId: order.id,
        reasonCode: 'NOT_AS_EXPECTED',
        requestedOutcome: 'REFUND',
        lines: [{ orderLineId: order.lines[0].id, quantity: 1 }],
      }),
    }),
    201,
  );
  const crossTenant = await api('/returns-finance/returns', token, {}, isolationTenantId);
  assert.notEqual(crossTenant.status, 200);
  const approved = await json(
    await api(`/returns-finance/returns/${authorization.id}/approve`, token, { method: 'POST' }),
    201,
  );
  assert.match(approved.labelUrl, /^https:\/\/labels\.invalid/);
  await json(
    await api(`/returns-finance/returns/${authorization.id}/receive`, token, {
      method: 'POST',
      body: JSON.stringify({ lines: [{ lineId: authorization.lines[0].id, quantity: 1 }] }),
    }),
    201,
  );
  const resolved = await json(
    await api(`/returns-finance/returns/${authorization.id}/inspect`, token, {
      method: 'POST',
      body: JSON.stringify({
        conditionCode: 'OPEN_BOX',
        evidence: { photoDigest: createHash('sha256').update(suffix).digest('hex') },
        note: 'Complete return with reusable inventory.',
        lines: [
          {
            lineId: authorization.lines[0].id,
            disposition: 'RESTOCK',
            resolution: 'REFUND',
            refundMinor: 4900,
          },
        ],
      }),
    }),
    201,
  );
  assert.equal(resolved.status, 'RESOLVED');

  const accounts = await json(await api('/returns-finance/accounts', token), 200);
  const cash = accounts.find((account) => account.code === '1000');
  const payable = accounts.find((account) => account.code === '2000');
  assert.ok(cash && payable);
  const capture = await json(
    await api('/returns-finance/journals', token, {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'ORDER_CAPTURE',
        sourceId: sellerId,
        description: `Seller payable capture ${suffix}`,
        currency: 'USD',
        idempotencyKey: `phase8-capture-${suffix}`,
        lines: [
          { accountId: cash.id, debitMinor: 4900, creditMinor: 0 },
          { accountId: payable.id, debitMinor: 0, creditMinor: 4900 },
        ],
      }),
    }),
    201,
  );
  assert.equal(
    capture.lines.reduce((sum, line) => sum + line.debitMinor - line.creditMinor, 0),
    0,
  );
  const settlement = await json(
    await api('/returns-finance/settlements/calculate', token, {
      method: 'POST',
      body: JSON.stringify({
        partnerKind: 'SELLER',
        partnerId: sellerId,
        periodStart: new Date(Date.now() - 60_000).toISOString(),
        periodEnd: new Date(Date.now() + 60_000).toISOString(),
        currency: 'USD',
        reserveMinor: 100,
        adjustmentMinor: 0,
      }),
    }),
    201,
  );
  assert.equal(settlement.grossMinor, 4900);
  const settlementApproved = await json(
    await api(`/returns-finance/settlements/${settlement.id}/approve`, token, { method: 'POST' }),
    201,
  );
  assert.equal(settlementApproved.status, 'APPROVED');
  const paid = await json(
    await api(`/returns-finance/settlements/${settlement.id}/pay`, token, { method: 'POST' }),
    201,
  );
  assert.equal(paid.status, 'PAID');
}

async function provisionAlternativeFacility(token, suffix) {
  const facility = await json(
    await api('/fulfillment/facilities', token, {
      method: 'POST',
      body: JSON.stringify({
        key: `alternate-${suffix}`,
        name: `Alternate ${suffix}`,
        address: { line1: '2 Network Way', city: 'Demo City', countryCode: 'US' },
      }),
    }),
    201,
  );
  const bin = await json(
    await api(`/fulfillment/facilities/${facility.id}/bins`, token, {
      method: 'POST',
      body: JSON.stringify({ code: 'ALT-01', kind: 'PICK_FACE', capacity: 100 }),
    }),
    201,
  );
  const asn = await json(
    await api('/fulfillment/asns', token, {
      method: 'POST',
      body: JSON.stringify({
        facilityId: facility.id,
        supplierId,
        reference: `ALT-ASN-${suffix}`,
        lines: [{ variantId, quantity: 5 }],
      }),
    }),
    201,
  );
  await json(
    await api(`/fulfillment/asns/${asn.id}/receive`, token, {
      method: 'POST',
      headers: { 'idempotency-key': `alternate-receive-${suffix}` },
      body: JSON.stringify({
        lines: [{ lineId: asn.lines[0].id, acceptedQty: 5, rejectedQty: 0, inspection: 'PASSED' }],
      }),
    }),
    201,
  );
  await json(
    await api(`/fulfillment/asns/${asn.id}/putaway`, token, {
      method: 'POST',
      body: JSON.stringify({ lineId: asn.lines[0].id, binId: bin.id }),
    }),
    201,
  );
  return facility;
}

async function phase9(token, suffix) {
  const client = await json(
    await api('/network-operations/clients', token, {
      method: 'POST',
      body: JSON.stringify({ key: `client-${suffix}`, name: `Client ${suffix}` }),
    }),
    201,
  );
  const contract = await json(
    await api(`/network-operations/clients/${client.id}/contracts`, token, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Warehousing and fulfillment',
        serviceCatalog: { receiving: true, storage: true, fulfillment: true },
        rateCard: { PICK: 25, STORAGE: 10 },
        sla: { dispatchHours: 24 },
        effectiveAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    }),
    201,
  );
  await json(
    await api(`/network-operations/clients/${client.id}/inventory`, token, {
      method: 'POST',
      body: JSON.stringify({ inventoryItemId, allocatedQty: 1 }),
    }),
    201,
  );
  await json(
    await api(`/network-operations/clients/${client.id}/billable-events`, token, {
      method: 'POST',
      body: JSON.stringify({
        contractId: contract.id,
        eventType: 'PICK',
        sourceType: 'FULFILLMENT',
        sourceId: randomUUID(),
        quantity: 2,
        unitPriceMinor: 25,
        currency: 'USD',
        occurredAt: new Date().toISOString(),
      }),
    }),
    201,
  );
  const invoice = await json(
    await api(`/network-operations/clients/${client.id}/invoices`, token, {
      method: 'POST',
      body: JSON.stringify({
        contractId: contract.id,
        periodStart: new Date(Date.now() - 60_000).toISOString(),
        periodEnd: new Date(Date.now() + 60_000).toISOString(),
      }),
    }),
    201,
  );
  assert.equal(invoice.totalMinor, 50);

  const alternative = await provisionAlternativeFacility(token, suffix);
  const order = await createOrder(token, `${suffix}-route`);
  const fulfillment = await json(
    await api('/fulfillment/orders', token, {
      method: 'POST',
      body: JSON.stringify({ orderSplitId: order.splits[0].id, facilityId: primaryFacilityId }),
    }),
    201,
  );
  const exception = await json(
    await api('/network-operations/control-tower/exceptions', token, {
      method: 'POST',
      body: JSON.stringify({
        fulfillmentOrderId: fulfillment.id,
        code: 'PRIMARY_CAPACITY',
        severity: 'HIGH',
        context: { requiredQuantity: 1 },
      }),
    }),
    201,
  );
  const recommendation = await json(
    await api(
      `/network-operations/control-tower/exceptions/${exception.id}/recommendations`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          facilityId: alternative.id,
          providerKey: 'alternate-provider',
          costMinor: 250,
          slaHours: 12,
          carbonGrams: 90,
          rationale: { feasible: true, comparedWithPrimary: true },
        }),
      },
    ),
    201,
  );
  assert.equal(
    (
      await api(
        `/network-operations/control-tower/recommendations/${recommendation.id}/execute`,
        token,
        { method: 'POST' },
      )
    ).status,
    404,
  );
  await json(
    await api(
      `/network-operations/control-tower/recommendations/${recommendation.id}/approve`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'Lowest feasible SLA-adjusted route.' }),
      },
    ),
    201,
  );
  const rerouted = await json(
    await api(
      `/network-operations/control-tower/recommendations/${recommendation.id}/execute`,
      token,
      { method: 'POST' },
    ),
    201,
  );
  assert.equal(rerouted.facilityId, alternative.id);
  assert.equal(rerouted.status, 'RELEASED');
}

async function phase10(token, suffix) {
  const model = await json(
    await api('/optimization/models', token, {
      method: 'POST',
      body: JSON.stringify({
        key: `network-${suffix}`,
        version: 1,
        nodes: [
          { key: 'origin', kind: 'FACILITY', capacity: 100 },
          { key: 'destination', kind: 'MARKET', capacity: 100 },
        ],
        lanes: [
          {
            from: 'origin',
            to: 'destination',
            carrierKey: 'green',
            capacity: 50,
            costMinor: 300,
            carbonGrams: 40,
            slaHours: 24,
          },
          {
            from: 'origin',
            to: 'destination',
            carrierKey: 'fast',
            capacity: 50,
            costMinor: 450,
            carbonGrams: 90,
            slaHours: 8,
          },
        ],
        carriers: [{ key: 'green' }, { key: 'fast' }],
      }),
    }),
    201,
  );
  const payload = {
    objectiveVersion: 'cost-carbon-sla-v1',
    inputSnapshot: { demand: 20, availableCapacity: 100, forecastVersion: '2026-07-23' },
    constraints: { minimumCapacity: 20, maxSlaHours: 48 },
    costWeight: 1,
    carbonWeight: 2,
    slaWeight: 5,
  };
  const first = await json(
    await api(`/optimization/models/${model.id}/runs`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    201,
  );
  const repeated = await json(
    await api(`/optimization/models/${model.id}/runs`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    201,
  );
  assert.equal(repeated.id, first.id);
  assert.equal(repeated.outputHash, first.outputHash);
  const recommendation = first.recommendations[0];
  await json(
    await api(`/optimization/recommendations/${recommendation.id}/approve`, token, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Approved for measured rollout.' }),
    }),
    201,
  );
  await json(
    await api(`/optimization/recommendations/${recommendation.id}/execute`, token, {
      method: 'POST',
    }),
    201,
  );
  const outcome = await json(
    await api(`/optimization/recommendations/${recommendation.id}/outcome`, token, {
      method: 'POST',
      body: JSON.stringify({ actual: { costMinor: 315, carbonGrams: 42, slaHours: 23 } }),
    }),
    201,
  );
  assert.equal(outcome.variance.costMinor, 15);
  const rolledBack = await json(
    await api(`/optimization/recommendations/${recommendation.id}/rollback`, token, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Rollback path exercised after outcome capture.' }),
    }),
    201,
  );
  assert.equal(rolledBack.status, 'ROLLED_BACK');
}

async function phase11(token, suffix) {
  const slo = await json(
    await api('/operability/slos', token, {
      method: 'POST',
      body: JSON.stringify({
        key: `phase11-${suffix}`,
        name: 'Phase 11 availability evidence',
        target: 0.9995,
        windowDays: 30,
        indicatorQuery: 'successful_requests / total_requests',
      }),
    }),
    201,
  );
  const observation = await json(
    await api(`/operability/slos/${slo.id}/observations`, token, {
      method: 'POST',
      body: JSON.stringify({
        value: 0.9998,
        sampleSize: 10000,
        windowStart: new Date(Date.now() - 60_000).toISOString(),
        windowEnd: new Date().toISOString(),
      }),
    }),
    201,
  );
  assert.equal(observation.status, 'MET');
  const exercise = await json(
    await api('/operability/recovery-exercises', token, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'BACKUP_RESTORE',
        backupReference: `backup-${suffix}`,
        environment: 'integration',
      }),
    }),
    201,
  );
  const completed = await json(
    await api(`/operability/recovery-exercises/${exercise.id}/complete`, token, {
      method: 'POST',
      body: JSON.stringify({
        measuredRpoMinutes: 10,
        measuredRtoMinutes: 45,
        evidence: { checksumVerified: true, smokeTests: 'passed' },
      }),
    }),
    201,
  );
  assert.equal(completed.status, 'PASSED');
  await json(
    await api('/operability/retention-policies', token, {
      method: 'PUT',
      body: JSON.stringify({
        dataClass: `phase11-${suffix}`,
        retentionDays: 365,
        legalHold: true,
        action: 'ANONYMIZE',
      }),
    }),
    200,
  );
  const privacy = await json(
    await api('/operability/privacy-requests', token, {
      method: 'POST',
      body: JSON.stringify({
        subjectRef: createHash('sha256').update(`subject-${suffix}`).digest('hex'),
        kind: 'ACCESS',
      }),
    }),
    201,
  );
  const privacyCompleted = await json(
    await api(`/operability/privacy-requests/${privacy.id}/complete`, token, {
      method: 'POST',
      body: JSON.stringify({
        evidence: { exportDigest: createHash('sha256').update('export').digest('hex') },
      }),
    }),
    201,
  );
  assert.equal(privacyCompleted.status, 'COMPLETED');
  const metrics = await json(await api('/operability/metrics', token), 200);
  assert.ok(metrics.routes.length > 0);
  assert.equal(JSON.stringify(metrics).includes('ChangeMe-Local-Only-2026'), false);
}

const token = await login();
const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
await phase8(token, suffix);
await phase9(token, suffix);
await phase10(token, suffix);
await phase11(token, suffix);
console.log('Phase 8-11 live integration passed.');

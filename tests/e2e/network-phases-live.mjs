import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';

const applicationUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const tenant = '00000000-0000-4000-8000-000000000001';
const isolationTenant = '00000000-0000-4000-8000-000000000009';
const password = 'ChangeMe-Local-Only-2026';
const storeId = '00000000-0000-4000-8000-000000000401';
const sellerId = '00000000-0000-4000-8000-000000000406';
const supplierId = '00000000-0000-4000-8000-000000000405';
const variantId = '00000000-0000-4000-8000-000000000408';
const offerId = '00000000-0000-4000-8000-000000000409';
const facilityId = '00000000-0000-4000-8000-000000000417';
const binId = '00000000-0000-4000-8000-000000000418';
const adminUserId = '00000000-0000-4000-8000-000000000101';

async function login(email) {
  const response = await fetch(`${applicationUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).accessToken;
}

function api(path, token, init = {}, tenantId = tenant) {
  return fetch(`${applicationUrl}/api/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });
}

async function json(response, status) {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
}

function partnerApi(path, secret, init = {}) {
  return fetch(`${applicationUrl}/api/v1${path}`, {
    ...init,
    headers: {
      'x-partner-api-key': secret,
      'x-tenant-id': tenant,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });
}

async function createAcceptedOrder(adminToken, suffix) {
  const cart = await json(
    await api('/commerce/carts', adminToken, {
      method: 'POST',
      body: JSON.stringify({ storeId }),
    }),
    201,
  );
  await json(
    await api(`/commerce/carts/${cart.id}/lines`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ offerId, quantity: 1 }),
    }),
    201,
  );
  const order = await json(
    await api(`/commerce/carts/${cart.id}/checkout`, adminToken, {
      method: 'POST',
      headers: { 'idempotency-key': `network-checkout-${suffix}` },
      body: JSON.stringify({
        paymentToken: 'tok_network_phases_2026',
        address: {
          recipient: 'Network Test',
          line1: '1 Logistics Way',
          city: 'Demo City',
          postalCode: '10001',
          countryCode: 'US',
        },
      }),
    }),
    201,
  );
  const purchaseOrders = await json(await api('/commerce/purchase-orders', adminToken), 200);
  const purchaseOrder = purchaseOrders.find(({ orderSplit }) => orderSplit.orderId === order.id);
  assert.ok(purchaseOrder);
  await json(
    await api(`/commerce/purchase-orders/${purchaseOrder.id}/accept`, adminToken, {
      method: 'PUT',
    }),
    200,
  );
  return order;
}

async function phase4(adminToken, suffix) {
  const asn = await json(
    await api('/fulfillment/asns', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        facilityId,
        supplierId,
        reference: `ASN-${suffix}`,
        lines: [{ variantId, quantity: 4 }],
      }),
    }),
    201,
  );
  const received = await json(
    await api(`/fulfillment/asns/${asn.id}/receive`, adminToken, {
      method: 'POST',
      headers: { 'idempotency-key': `asn-receive-${suffix}` },
      body: JSON.stringify({
        lines: [{ lineId: asn.lines[0].id, acceptedQty: 4, rejectedQty: 0, inspection: 'PASSED' }],
      }),
    }),
    201,
  );
  assert.equal(received.lines[0].acceptedQty, 4);
  const putaway = await json(
    await api(`/fulfillment/asns/${asn.id}/putaway`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ lineId: asn.lines[0].id, binId }),
    }),
    201,
  );
  assert.equal(putaway.status, 'COMPLETED');

  const order = await createAcceptedOrder(adminToken, suffix);
  const fulfillment = await json(
    await api('/fulfillment/orders', adminToken, {
      method: 'POST',
      body: JSON.stringify({ orderSplitId: order.splits[0].id, facilityId }),
    }),
    201,
  );
  await json(
    await api(`/fulfillment/orders/${fulfillment.id}/pick`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ binId }),
    }),
    201,
  );
  await json(
    await api(`/fulfillment/orders/${fulfillment.id}/pack`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ packageCode: `PKG-${suffix}`, weightGrams: 800 }),
    }),
    201,
  );
  const shipment = await json(
    await api(`/fulfillment/orders/${fulfillment.id}/label`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ carrierKey: 'local-carrier', serviceLevel: 'ground' }),
    }),
    201,
  );
  await json(
    await api(`/fulfillment/orders/${fulfillment.id}/manifest`, adminToken, { method: 'POST' }),
    201,
  );
  await json(
    await api(`/fulfillment/orders/${fulfillment.id}/dispatch`, adminToken, { method: 'POST' }),
    201,
  );
  await json(
    await api(`/fulfillment/shipments/${shipment.id}/tracking-events`, adminToken, {
      method: 'POST',
      body: JSON.stringify({
        externalKey: `delivered-${suffix}`,
        code: 'DELIVERED',
        description: 'Delivered to recipient',
        occurredAt: new Date().toISOString(),
      }),
    }),
    201,
  );
  const tracking = await json(
    await fetch(`${applicationUrl}/api/v1/tracking/${shipment.trackingNumber}`, {
      headers: { 'x-tenant-id': tenant },
    }),
    200,
  );
  assert.equal(tracking.status, 'DELIVERED');
  assert.notEqual(
    (
      await fetch(`${applicationUrl}/api/v1/tracking/${shipment.trackingNumber}`, {
        headers: { 'x-tenant-id': isolationTenant },
      })
    ).status,
    200,
  );
}

async function phase5(adminToken, viewerToken, suffix) {
  await json(
    await api('/c2c/seller/verify', adminToken, {
      method: 'POST',
      body: JSON.stringify({ verificationToken: `approved-${suffix}` }),
    }),
    201,
  );
  const listing = await json(
    await api('/c2c/listings', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        title: `Field kit resale ${suffix}`,
        description: 'A carefully used field kit with all original modular inserts.',
        conditionCode: 'GOOD',
        priceMinor: 3200,
        currency: 'USD',
        media: ['https://example.test/used-field-kit.jpg'],
      }),
    }),
    201,
  );
  await json(await api(`/c2c/listings/${listing.id}/submit`, adminToken, { method: 'POST' }), 201);
  await json(
    await api(`/c2c/listings/${listing.id}/moderate`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVE' }),
    }),
    201,
  );
  const offer = await json(
    await api(`/c2c/listings/${listing.id}/offers`, viewerToken, {
      method: 'POST',
      body: JSON.stringify({ amountMinor: 2900 }),
    }),
    201,
  );
  const transaction = await json(
    await api(`/c2c/offers/${offer.id}/accept`, adminToken, { method: 'POST' }),
    201,
  );
  await json(
    await api(`/c2c/transactions/${transaction.id}/shipment`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ trackingNumber: `C2C-${suffix}`, carrier: 'local-carrier' }),
    }),
    201,
  );
  await json(
    await api(`/c2c/transactions/${transaction.id}/delivered`, viewerToken, { method: 'POST' }),
    201,
  );
  await json(
    await api(`/c2c/transactions/${transaction.id}/release-payout`, adminToken, { method: 'POST' }),
    201,
  );
  const review = await json(
    await api(`/c2c/transactions/${transaction.id}/reviews`, viewerToken, {
      method: 'POST',
      body: JSON.stringify({ rating: 5, comment: 'Accurate condition and prompt shipping.' }),
    }),
    201,
  );
  assert.equal(review.rating, 5);
}

async function phase6(adminToken, suffix) {
  const account = await json(
    await api('/b2b/accounts', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        key: `field-team-${suffix}`,
        name: `Field Team ${suffix}`,
        currency: 'USD',
        creditLimitMinor: 500000,
        approvalMinor: 1000,
        paymentTermsDays: 30,
      }),
    }),
    201,
  );
  await json(
    await api(`/b2b/accounts/${account.id}/members`, adminToken, {
      method: 'POST',
      body: JSON.stringify({
        userId: adminUserId,
        department: 'Operations',
        role: 'APPROVER',
        spendLimitMinor: 500000,
      }),
    }),
    201,
  );
  await json(
    await api(`/b2b/accounts/${account.id}/contract-prices`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ variantId, minimumQuantity: 10, unitPriceMinor: 4200 }),
    }),
    201,
  );
  const rfq = await json(
    await api(`/b2b/accounts/${account.id}/rfqs`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ lines: [{ variantId, quantity: 12, targetMinor: 4100 }] }),
    }),
    201,
  );
  const quote = await json(
    await api(`/b2b/rfqs/${rfq.id}/quotes`, adminToken, {
      method: 'POST',
      body: JSON.stringify({
        sellerId,
        lines: [{ variantId, unitPriceMinor: 4150 }],
        terms: { incoterm: 'DAP' },
      }),
    }),
    201,
  );
  const order = await json(
    await api(`/b2b/quotes/${quote.id}/accept`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ purchaseOrderRef: `PO-${suffix}` }),
    }),
    201,
  );
  assert.equal(order.status, 'PENDING_APPROVAL');
  await json(await api(`/b2b/orders/${order.id}/approve`, adminToken, { method: 'POST' }), 201);
  const partial = await json(
    await api(`/b2b/orders/${order.id}/fulfill`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ lines: [{ lineId: order.lines[0].id, quantity: 5 }] }),
    }),
    201,
  );
  assert.equal(partial.status, 'PARTIALLY_FULFILLED');
  const complete = await json(
    await api(`/b2b/orders/${order.id}/fulfill`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ lines: [{ lineId: order.lines[0].id, quantity: 7 }] }),
    }),
    201,
  );
  assert.equal(complete.status, 'FULFILLED');
  const orders = await json(await api('/b2b/orders', adminToken), 200);
  assert.equal(orders.find(({ id }) => id === order.id).invoices.length, 1);
}

async function phase7(adminToken, suffix) {
  const credential = await json(
    await api('/partners/credentials', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        partnerKind: 'SHOP',
        partnerId: storeId,
        name: `Shop integration ${suffix}`,
        scopes: ['catalog.read', 'inventory.read', 'orders.write', 'fulfillment.write'],
        rateLimitPerMinute: 120,
      }),
    }),
    201,
  );
  assert.equal((await partnerApi('/shop/catalog', credential.secret)).status, 200);
  assert.equal((await partnerApi('/shop/inventory', credential.secret)).status, 200);
  const endpoint = await json(
    await api('/partners/webhook-endpoints', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        partnerKind: 'SHOP',
        partnerId: storeId,
        url: 'https://shop-hooks.local/orders',
        eventTypes: ['shop.order.accepted.v1', 'shop.order.fulfilled.v1'],
      }),
    }),
    201,
  );
  const payload = {
    externalKey: `external-${suffix}`,
    currency: 'USD',
    shippingAddress: { line1: '2 Partner Road', city: 'Demo City', countryCode: 'US' },
    lines: [{ variantId, quantity: 2 }],
  };
  const first = await json(
    await partnerApi('/shop/orders', credential.secret, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    201,
  );
  const replay = await json(
    await partnerApi('/shop/orders', credential.secret, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    201,
  );
  assert.equal(replay.id, first.id);
  assert.equal(replay.idempotentReplay, true);
  await json(
    await partnerApi(`/shop/orders/${first.id}/fulfill`, credential.secret, {
      method: 'POST',
      body: JSON.stringify({ trackingNumber: `SHOP-${suffix}`, carrier: 'local-carrier' }),
    }),
    201,
  );
  const processed = await json(
    await api('/partners/webhook-deliveries/process', adminToken, { method: 'POST' }),
    201,
  );
  assert.ok(processed.processed >= 2);
  const deliveries = await json(await api('/partners/webhook-deliveries', adminToken), 200);
  const delivery = deliveries.find(({ endpointId }) => endpointId === endpoint.id);
  assert.equal(delivery.status, 'DELIVERED');
  assert.match(delivery.signature, /^[0-9a-f]{64}$/u);

  const inboundPayload = { status: 'acknowledged', orderId: first.id };
  const body = JSON.stringify(inboundPayload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const eventId = randomUUID();
  const signature = createHmac('sha256', endpoint.secret)
    .update(`${timestamp}.${eventId}.${body}`)
    .digest('hex');
  const inbound = () =>
    fetch(`${applicationUrl}/api/v1/partner-webhooks/${endpoint.id}`, {
      method: 'POST',
      headers: {
        'x-tenant-id': tenant,
        'content-type': 'application/json',
        'x-webhook-timestamp': timestamp,
        'x-webhook-id': eventId,
        'x-webhook-event': 'shop.order.acknowledged.v1',
        'x-webhook-signature': signature,
      },
      body,
    });
  assert.equal((await json(await inbound(), 201)).idempotentReplay, false);
  assert.equal((await json(await inbound(), 201)).idempotentReplay, true);
  const rotated = await json(
    await api(`/partners/credentials/${credential.id}/rotate`, adminToken, { method: 'POST' }),
    201,
  );
  assert.equal((await partnerApi('/shop/catalog', credential.secret)).status, 401);
  assert.equal((await partnerApi('/shop/catalog', rotated.secret)).status, 200);
}

async function run() {
  const suffix = Date.now();
  const [adminToken, viewerToken] = await Promise.all([
    login('admin@demo.logicommerce.local'),
    login('viewer@demo.logicommerce.local'),
  ]);
  await phase4(adminToken, suffix);
  await phase5(adminToken, viewerToken, suffix);
  await phase6(adminToken, suffix);
  await phase7(adminToken, suffix);
  console.log(
    JSON.stringify({
      phase4:
        'receive -> putaway -> pick -> pack -> label -> manifest -> dispatch -> deliver passed',
      phase5: 'verify -> moderate -> negotiate -> protect -> payout -> review passed',
      phase6: 'RFQ -> quote -> approval -> PO -> partial fulfillment -> invoice passed',
      phase7: 'scoped API -> idempotent order -> signed webhook -> rotate passed',
    }),
  );
}

await run();

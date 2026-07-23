import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const applicationUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const tenantA = '00000000-0000-4000-8000-000000000001';
const tenantB = '00000000-0000-4000-8000-000000000009';
const password = 'ChangeMe-Local-Only-2026';

async function login(email, userPassword = password) {
  const response = await fetch(`${applicationUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: userPassword }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).accessToken;
}

function api(path, accessToken, init = {}, tenantId = tenantA) {
  return fetch(`${applicationUrl}/api/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'x-tenant-id': tenantId,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });
}

async function json(response, expectedStatus) {
  assert.equal(response.status, expectedStatus, await response.clone().text());
  return response.json();
}

async function createCustomer(adminToken, roleId, suffix, ordinal) {
  const email = `commerce-${suffix}-${ordinal}@demo.logicommerce.local`;
  await json(
    await api('/identity/users', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        email,
        displayName: `Commerce Customer ${ordinal}`,
        password,
        roleIds: [roleId],
      }),
    }),
    201,
  );
  return { email, token: await login(email) };
}

async function checkout(token, cartId, idempotencyKey, promotionCode) {
  return api(`/commerce/carts/${cartId}/checkout`, token, {
    method: 'POST',
    headers: { 'idempotency-key': idempotencyKey },
    body: JSON.stringify({
      promotionCode,
      paymentToken: 'tok_phase_three_live_2026',
      address: {
        recipient: 'Commerce Test',
        line1: '100 Test Avenue',
        city: 'Test City',
        region: 'CA',
        postalCode: '90001',
        countryCode: 'US',
      },
    }),
  });
}

async function run() {
  const suffix = Date.now();
  const adminToken = await login('admin@demo.logicommerce.local');
  const stores = await json(await api('/catalog/stores', adminToken), 200);
  const store = stores.find(({ key }) => key === 'demo-store');
  assert.ok(store);
  const storeDomain = await json(
    await api(`/catalog/stores/${store.id}/domains`, adminToken, {
      method: 'POST',
      body: JSON.stringify({
        hostname: `phase-${suffix}.example.test`,
        isPrimary: false,
      }),
    }),
    201,
  );
  assert.equal(storeDomain.verifiedAt, null);
  const { suppliers, sellers } = await json(await api('/catalog/partners', adminToken), 200);
  const supplier = suppliers.find(({ key }) => key === 'northstar-supply');
  const seller = sellers.find(({ key }) => key === 'demo-merchant');
  assert.ok(supplier);
  assert.ok(seller);

  const submission = await json(
    await api('/catalog/submissions', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        storeId: store.id,
        supplierId: supplier.id,
        slug: `phase-commerce-${suffix}`,
        title: `Concurrency Field Unit ${suffix}`,
        description: 'A single-stock product used to verify transactional checkout behavior.',
        locale: 'en',
        seo: { title: `Concurrency Field Unit ${suffix}` },
        media: [
          {
            url: 'https://example.test/concurrency-field-unit.jpg',
            altText: 'Concurrency field unit',
          },
        ],
        attributes: { finish: 'forest-green' },
        variants: [
          {
            sku: `CONC-${suffix}`,
            title: 'Single stock unit',
            attributes: { finish: 'forest-green' },
          },
        ],
      }),
    }),
    201,
  );
  assert.equal(
    (
      await api(`/catalog/submissions/${submission.id}/submit`, adminToken, {
        method: 'PUT',
      })
    ).status,
    200,
  );
  const product = await json(
    await api(`/catalog/submissions/${submission.id}/approve`, adminToken, {
      method: 'PUT',
      body: JSON.stringify({ note: 'Phase 2 live acceptance' }),
    }),
    200,
  );
  assert.equal(product.variants.length, 1);
  const variant = product.variants[0];

  const offer = await json(
    await api('/catalog/offers', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        storeId: store.id,
        variantId: variant.id,
        sellerId: seller.id,
        supplierId: supplier.id,
        currency: 'USD',
        priceMinor: 1250,
        minimumQuantity: 1,
      }),
    }),
    201,
  );
  assert.equal(
    (
      await api(`/catalog/offers/${offer.id}/publish`, adminToken, {
        method: 'PUT',
      })
    ).status,
    200,
  );
  const facilityId = randomUUID();
  const feedKey = `phase3-${suffix}`;
  const feed = await json(
    await api('/commerce/inventory/feeds', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        variantId: variant.id,
        facilityId,
        source: 'phase-live-test',
        externalKey: feedKey,
        quantity: 1,
      }),
    }),
    201,
  );
  assert.equal(feed.quantity, 1);
  const replayedFeed = await json(
    await api('/commerce/inventory/feeds', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        variantId: variant.id,
        facilityId,
        source: 'phase-live-test',
        externalKey: feedKey,
        quantity: 1,
      }),
    }),
    201,
  );
  assert.equal(replayedFeed.idempotentReplay, true);
  const promotionCode = `PHASE${suffix}`;
  const promotion = await json(
    await api('/commerce/promotions', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        storeId: store.id,
        code: promotionCode,
        name: 'Phase acceptance discount',
        kind: 'PERCENTAGE',
        value: 10,
      }),
    }),
    201,
  );
  assert.equal(promotion.code, promotionCode);

  const found = await json(
    await api(
      `/storefront/stores/${store.key}/products?q=${encodeURIComponent(String(suffix))}`,
      adminToken,
    ),
    200,
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].variants[0].availableQuantity, 1);

  const roles = await json(await api('/identity/roles', adminToken), 200);
  const tenantAdmin = roles.find(({ key }) => key === 'tenant-admin');
  assert.ok(tenantAdmin);
  const [customerA, customerB] = await Promise.all([
    createCustomer(adminToken, tenantAdmin.id, suffix, 1),
    createCustomer(adminToken, tenantAdmin.id, suffix, 2),
  ]);
  const [cartA, cartB] = await Promise.all(
    [customerA, customerB].map(async (customer) => {
      const cart = await json(
        await api('/commerce/carts', customer.token, {
          method: 'POST',
          body: JSON.stringify({ storeId: store.id }),
        }),
        201,
      );
      return json(
        await api(`/commerce/carts/${cart.id}/lines`, customer.token, {
          method: 'POST',
          body: JSON.stringify({ offerId: offer.id, quantity: 1 }),
        }),
        201,
      );
    }),
  );
  const quote = await json(
    await api(`/commerce/carts/${cartA.id}/quote`, customerA.token, {
      method: 'POST',
      body: JSON.stringify({ promotionCode }),
    }),
    201,
  );
  assert.equal(quote.discountMinor, 125);
  assert.equal(quote.totalMinor, 1938);

  const keyA = `checkout-${suffix}-customer-a`;
  const keyB = `checkout-${suffix}-customer-b`;
  const responses = await Promise.all([
    checkout(customerA.token, cartA.id, keyA, promotionCode),
    checkout(customerB.token, cartB.id, keyB, promotionCode),
  ]);
  assert.deepEqual(
    responses.map(({ status }) => status).sort((left, right) => left - right),
    [201, 409],
  );
  const winnerIndex = responses.findIndex(({ status }) => status === 201);
  const winner = await responses[winnerIndex].json();
  const winnerCustomer = winnerIndex === 0 ? customerA : customerB;
  const winnerCart = winnerIndex === 0 ? cartA : cartB;
  const winnerKey = winnerIndex === 0 ? keyA : keyB;
  assert.equal(winner.lines.length, 1);
  assert.equal(winner.splits.length, 1);
  assert.ok(winner.splits[0].purchaseOrder);

  const replay = await json(
    await checkout(winnerCustomer.token, winnerCart.id, winnerKey, promotionCode),
    201,
  );
  assert.equal(replay.id, winner.id);

  const purchaseOrders = await json(await api('/commerce/purchase-orders', adminToken), 200);
  const purchaseOrder = purchaseOrders.find(({ orderSplit }) => orderSplit.orderId === winner.id);
  assert.ok(purchaseOrder);
  const accepted = await json(
    await api(`/commerce/purchase-orders/${purchaseOrder.id}/accept`, adminToken, {
      method: 'PUT',
    }),
    200,
  );
  assert.equal(accepted.status, 'ACCEPTED');
  const confirmed = await json(await api(`/commerce/orders/${winner.id}`, adminToken), 200);
  assert.equal(confirmed.status, 'CONFIRMED');

  const inventory = await json(await api('/commerce/inventory', adminToken), 200);
  const item = inventory.find(({ variantId }) => variantId === variant.id);
  assert.ok(item);
  assert.equal(item.balances.ON_HAND, 0);
  assert.equal(item.balances.RESERVED, 0);
  assert.equal(item.balances.ALLOCATED, 1);
  assert.ok(Object.values(item.balances).every((quantity) => quantity >= 0));
  const reconciliation = await json(
    await api('/commerce/inventory/reconciliation', adminToken),
    200,
  );
  const productResults = reconciliation.results.filter(
    ({ inventoryItemId }) => inventoryItemId === item.id,
  );
  assert.ok(productResults.every(({ reconciled }) => reconciled));

  const crossTenant = await api(`/commerce/orders/${winner.id}`, adminToken, {}, tenantB);
  assert.notEqual(crossTenant.status, 200);
  assert.doesNotMatch(await crossTenant.text(), new RegExp(winner.number, 'u'));

  console.log(
    JSON.stringify({
      phase2: 'supplier submission -> approval -> offer -> storefront passed',
      phase3: 'feed -> concurrent checkout -> PO acceptance passed',
      winningOrder: winner.number,
      concurrencyStatuses: responses.map(({ status }) => status),
      reconciliation: 'passed',
      tenantIsolation: 'passed',
    }),
  );
}

await run();

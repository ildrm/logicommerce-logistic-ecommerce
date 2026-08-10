import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const tenantId = '00000000-0000-4000-8000-000000000001';
const isolationTenantId = '00000000-0000-4000-8000-000000000009';

async function login(email = 'admin@demo.logicommerce.local') {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ email, password: 'ChangeMe-Local-Only-2026' }),
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

const suffix = Date.now().toString(36);
const admin = await login();
const viewer = await login('viewer@demo.logicommerce.local');

const request = await json(
  await api('/freight/requests', admin, {
    method: 'POST',
    body: JSON.stringify({
      serviceLevel: 'STANDARD',
      preferredModes: ['ROAD', 'SEA'],
      incoterm: 'DAP',
      insuranceRequired: true,
      customsRequired: true,
      stops: [
        {
          sequence: 1,
          kind: 'PICKUP',
          locationType: 'PORT',
          name: 'Origin terminal',
          city: 'Istanbul',
          countryCode: 'TR',
          locationCode: 'TRIST',
        },
        {
          sequence: 2,
          kind: 'DELIVERY',
          locationType: 'ADDRESS',
          name: 'Destination warehouse',
          city: 'Berlin',
          countryCode: 'DE',
        },
      ],
      cargoItems: [
        {
          description: 'Crated industrial machinery',
          commodityCode: '8479',
          packageType: 'CRATE',
          packageCount: 2,
          weightGrams: 2_500_000,
          volumeCubicCm: 5_000_000,
          declaredValueMinor: 250_000_00,
          currency: 'USD',
          hazardous: false,
          stackable: false,
        },
      ],
    }),
  }),
  201,
);
assert.equal(request.status, 'DRAFT');
const submitted = await json(
  await api(`/freight/requests/${request.id}/submit`, admin, { method: 'POST' }),
  201,
);
assert.equal(submitted.status, 'SUBMITTED');

const uploadBody = Buffer.from('%PDF-1.4\n% LogiCommerce test cargo document\n%%EOF\n');
const uploadChecksum = createHash('sha256').update(uploadBody).digest('hex');
const uploadIntent = await json(
  await api(`/freight/requests/${request.id}/documents/upload-url`, admin, {
    method: 'POST',
    body: JSON.stringify({
      kind: 'CARGO',
      fileName: 'cargo-test.pdf',
      contentType: 'application/pdf',
      sizeBytes: uploadBody.length,
      checksum: uploadChecksum,
    }),
  }),
  201,
);
const objectUpload = await fetch(uploadIntent.upload.url, {
  method: 'PUT',
  headers: uploadIntent.upload.headers,
  body: uploadBody,
});
assert.equal(objectUpload.ok, true, await objectUpload.clone().text());
const completedDocument = await json(
  await api(
    `/freight/requests/${request.id}/documents/${uploadIntent.document.id}/complete`,
    admin,
    { method: 'POST' },
  ),
  201,
);
assert.equal(completedDocument.scanStatus, 'CLEAN');
assert.equal(completedDocument.checksum, uploadChecksum);

const crossTenant = await api(`/freight/requests/${request.id}`, admin, {}, isolationTenantId);
assert.notEqual(crossTenant.status, 200);
const deniedDispatch = await api('/dispatch/board', viewer);
assert.equal(deniedDispatch.status, 403);

const estimate = await json(
  await api(`/freight/operations/requests/${request.id}/estimate`, admin, { method: 'POST' }),
  201,
);
assert.ok(['ESTIMATED', 'NEEDS_REVIEW'].includes(estimate.status));

const quote = await json(
  await api(`/freight/operations/requests/${request.id}/quotes`, admin, {
    method: 'POST',
    body: JSON.stringify({
      currency: 'USD',
      taxMinor: 2500,
      paymentPolicy: 'PREPAY',
      paymentTermsDays: 0,
      validUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      lines: [
        {
          kind: 'LINEHAUL',
          description: 'Reviewed multimodal freight service',
          quantity: 1,
          unitMinor: 125_000,
          taxable: true,
        },
      ],
    }),
  }),
  201,
);
const published = await json(
  await api(`/freight/operations/quotes/${quote.id}/publish`, admin, { method: 'POST' }),
  201,
);
assert.equal(published.status, 'PUBLISHED');

const accepted = await json(
  await api(`/freight/quotes/${quote.id}/accept`, admin, { method: 'POST' }),
  201,
);
assert.equal(accepted.booking.status, 'AWAITING_PAYMENT');
assert.match(accepted.invoice.number, /^INV-\d{4}-\d{6}$/);

const payment = await json(
  await api(`/billing/invoices/${accepted.invoice.id}/payment-sessions`, admin, {
    method: 'POST',
    headers: { 'idempotency-key': `phase12-payment-${suffix}` },
    body: JSON.stringify({ provider: 'MOCK' }),
  }),
  201,
);
assert.equal(payment.status, 'COMPLETED');

const carrier = await json(
  await api('/dispatch/carriers', admin, {
    method: 'POST',
    body: JSON.stringify({
      key: `carrier-${suffix}`,
      name: `Phase 12 Carrier ${suffix}`,
      kind: 'SUBCONTRACTED',
      modes: ['ROAD'],
    }),
  }),
  201,
);
const driver = await json(
  await api('/dispatch/drivers', admin, {
    method: 'POST',
    body: JSON.stringify({
      carrierId: carrier.id,
      displayName: 'Phase 12 Driver',
      phone: '+49 555 010 2026',
    }),
  }),
  201,
);
assert.equal('phoneCiphertext' in driver, false);
const vehicle = await json(
  await api('/dispatch/vehicles', admin, {
    method: 'POST',
    body: JSON.stringify({
      carrierId: carrier.id,
      registration: `P12-${suffix}`.toUpperCase(),
      equipmentType: 'TRACTOR_TRAILER',
      capacityKg: 20_000,
    }),
  }),
  201,
);

const refreshedRequest = await json(await api(`/freight/requests/${request.id}`, admin), 200);
const leg = await json(
  await api(`/freight/operations/bookings/${accepted.booking.id}/legs`, admin, {
    method: 'POST',
    body: JSON.stringify({
      sequence: 1,
      mode: 'ROAD',
      originStopId: refreshedRequest.stops[0].id,
      destinationStopId: refreshedRequest.stops[1].id,
      carrierId: carrier.id,
      plannedDepartureAt: new Date().toISOString(),
      plannedArrivalAt: new Date(Date.now() + 86_400_000).toISOString(),
    }),
  }),
  201,
);
const assignment = await json(
  await api(`/dispatch/legs/${leg.id}/assignments`, admin, {
    method: 'POST',
    body: JSON.stringify({
      carrierId: carrier.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      checkInIntervalMinutes: 240,
    }),
  }),
  201,
);
await json(
  await api(`/dispatch/assignments/${assignment.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ action: 'START' }),
  }),
  201,
);
const checkInKey = randomUUID();
const checkIn = await json(
  await api(`/dispatch/assignments/${assignment.id}/check-ins`, admin, {
    method: 'POST',
    body: JSON.stringify({
      source: 'PHONE',
      outcome: 'REACHED',
      locationText: 'Near Sofia ring road',
      reportedAt: new Date().toISOString(),
      estimatedArrivalAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
      note: 'Driver reports normal progress.',
      externalKey: checkInKey,
    }),
  }),
  201,
);
assert.equal(checkIn.source, 'PHONE');
const duplicateCheckIn = await json(
  await api(`/dispatch/assignments/${assignment.id}/check-ins`, admin, {
    method: 'POST',
    body: JSON.stringify({
      source: 'PHONE',
      outcome: 'REACHED',
      locationText: 'Near Sofia ring road',
      reportedAt: new Date().toISOString(),
      externalKey: checkInKey,
    }),
  }),
  201,
);
assert.equal(duplicateCheckIn.id, checkIn.id);

await json(
  await api(`/dispatch/assignments/${assignment.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ action: 'COMPLETE' }),
  }),
  201,
);
await json(
  await api(`/freight/operations/bookings/${accepted.booking.id}/proof-of-delivery`, admin, {
    method: 'POST',
    body: JSON.stringify({
      recipient: 'Berlin receiving desk',
      deliveredAt: new Date().toISOString(),
      note: 'Signed paper POD verified by operations.',
    }),
  }),
  201,
);
const completed = await json(
  await api(`/freight/operations/bookings/${accepted.booking.id}/complete`, admin, {
    method: 'POST',
  }),
  201,
);
assert.equal(completed.status, 'COMPLETED');

const invoiceDocument = await api(`/billing/invoices/${accepted.invoice.id}/document`, admin);
assert.equal(invoiceDocument.status, 200);
assert.equal(invoiceDocument.headers.get('content-type'), 'application/pdf');
assert.equal((await invoiceDocument.arrayBuffer()).byteLength > 100, true);

const overview = await json(await api('/analytics/overview?days=30', admin), 200);
assert.ok(overview.transportation);
assert.ok(overview.domainActivity.some(({ key }) => key === 'freight'));

console.log('Phase 12 live freight, payment, dispatch, tenancy, and analytics checks passed.');

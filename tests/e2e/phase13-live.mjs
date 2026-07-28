import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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

async function json(response, expected = 200) {
  assert.equal(response.status, expected, await response.clone().text());
  return response.json();
}

const suffix = Date.now().toString(36);
const numericSuffix = String(Date.now()).slice(-8);
const admin = await login();
const viewer = await login('viewer@demo.logicommerce.local');

const locations = await json(await api('/international-logistics/locations', admin));
const rotterdam = locations.find(({ unLocode }) => unLocode === 'NLRTM');
const singapore = locations.find(({ unLocode }) => unLocode === 'SGSIN');
assert.ok(rotterdam && singapore);

const deniedNetwork = await api('/logistics-network', viewer);
assert.equal(deniedNetwork.status, 403);
const crossTenantLocations = await api(
  '/international-logistics/locations',
  admin,
  {},
  isolationTenantId,
);
assert.notEqual(crossTenantLocations.status, 200);

const network = await json(await api('/logistics-network', admin));
const originHub = network.hubs.find(({ code }) => code === 'RTM-GATEWAY');
const destinationHub = network.hubs.find(({ code }) => code === 'SIN-GATEWAY');
assert.ok(originHub && destinationHub);

const freightRequest = await json(
  await api('/freight/requests', admin, {
    method: 'POST',
    body: JSON.stringify({
      serviceLevel: 'STANDARD',
      preferredModes: ['SEA'],
      incoterm: 'CIP',
      insuranceRequired: true,
      customsRequired: true,
      stops: [
        {
          sequence: 1,
          kind: 'PICKUP',
          locationType: 'PORT',
          name: 'Rotterdam export terminal',
          city: 'Rotterdam',
          countryCode: 'NL',
          locationCode: 'NLRTM',
        },
        {
          sequence: 2,
          kind: 'DELIVERY',
          locationType: 'PORT',
          name: 'Singapore import terminal',
          city: 'Singapore',
          countryCode: 'SG',
          locationCode: 'SGSIN',
        },
      ],
      cargoItems: [
        {
          description: 'Consolidated machinery components',
          commodityCode: '847990',
          packageType: 'PALLET',
          packageCount: 4,
          weightGrams: 800_000,
          volumeCubicCm: 2_400_000,
          declaredValueMinor: 50_000_00,
          currency: 'USD',
          stackable: true,
        },
      ],
    }),
  }),
  201,
);
await json(
  await api(`/freight/requests/${freightRequest.id}/submit`, admin, { method: 'POST' }),
  201,
);

const freightQuote = await json(
  await api(`/freight/operations/requests/${freightRequest.id}/quotes`, admin, {
    method: 'POST',
    body: JSON.stringify({
      currency: 'USD',
      taxMinor: 0,
      paymentPolicy: 'PREPAY',
      paymentTermsDays: 0,
      validUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      lines: [
        {
          kind: 'CONSOLIDATED_SEA_FREIGHT',
          description: 'Consolidated international sea freight',
          quantity: 1,
          unitMinor: 180_000,
          taxable: false,
        },
      ],
    }),
  }),
  201,
);
await json(
  await api(`/freight/operations/quotes/${freightQuote.id}/publish`, admin, { method: 'POST' }),
  201,
);
const freightAcceptance = await json(
  await api(`/freight/quotes/${freightQuote.id}/accept`, admin, { method: 'POST' }),
  201,
);
await json(
  await api(`/billing/invoices/${freightAcceptance.invoice.id}/payment-sessions`, admin, {
    method: 'POST',
    headers: { 'idempotency-key': `phase13-freight-${suffix}` },
    body: JSON.stringify({ provider: 'MOCK' }),
  }),
  201,
);

const insuranceCatalog = await json(await api('/insurance/catalog', admin));
const insuranceProduct = insuranceCatalog
  .flatMap(({ products }) => products)
  .find(({ code }) => code === 'ICC-A-MULTIMODAL');
assert.ok(insuranceProduct);
const insuranceQuote = await json(
  await api('/insurance/operations/quotes', admin, {
    method: 'POST',
    body: JSON.stringify({
      requestId: freightRequest.id,
      productId: insuranceProduct.id,
      coverageStartAt: new Date(Date.now() - 60_000).toISOString(),
      coverageEndAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      validUntil: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      taxMinor: 250,
    }),
  }),
  201,
);
assert.equal(insuranceQuote.status, 'QUOTED');
const policyBinding = await json(
  await api(`/insurance/quotes/${insuranceQuote.id}/accept`, admin, { method: 'POST' }),
  201,
);
assert.equal(policyBinding.status, 'AWAITING_PAYMENT');
assert.match(policyBinding.invoiceNumber, /^INV-\d{4}-\d{6}$/);
await json(
  await api(`/billing/invoices/${policyBinding.invoiceId}/payment-sessions`, admin, {
    method: 'POST',
    headers: { 'idempotency-key': `phase13-insurance-${suffix}` },
    body: JSON.stringify({ provider: 'MOCK' }),
  }),
  201,
);
const customerInsurance = await json(await api('/insurance/mine', admin));
const activePolicy = customerInsurance.policies.find(({ id }) => id === policyBinding.id);
assert.equal(activePolicy.status, 'ACTIVE');

const claim = await json(
  await api(`/insurance/policies/${activePolicy.id}/claims`, admin, {
    method: 'POST',
    body: JSON.stringify({
      cause: 'DAMAGE',
      lossOccurredAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      lossLocation: 'Rotterdam consolidation terminal',
      description: 'External packaging damage identified during consolidation intake.',
      claimedAmountMinor: 25_000,
      currency: 'USD',
      evidence: { inspectionReference: `SURVEY-${suffix}` },
    }),
  }),
  201,
);
const submittedClaim = await json(
  await api(`/insurance/claims/${claim.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ status: 'SUBMITTED', version: claim.version }),
  }),
  201,
);
assert.equal(submittedClaim.status, 'SUBMITTED');
const deniedClaimOperations = await api(
  `/insurance/operations/claims/${claim.id}/transition`,
  viewer,
  {
    method: 'POST',
    body: JSON.stringify({ status: 'UNDER_REVIEW', version: submittedClaim.version }),
  },
);
assert.equal(deniedClaimOperations.status, 403);
const reviewingClaim = await json(
  await api(`/insurance/operations/claims/${claim.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ status: 'UNDER_REVIEW', version: submittedClaim.version }),
  }),
  201,
);
assert.equal(reviewingClaim.status, 'UNDER_REVIEW');

const consignor = await json(
  await api('/international-logistics/parties', admin, {
    method: 'POST',
    body: JSON.stringify({
      kind: 'ORGANIZATION',
      legalName: `Phase 13 Exporter ${suffix}`,
      identifiers: { eori: `NL${numericSuffix}` },
      address: { city: 'Rotterdam', countryCode: 'NL' },
    }),
  }),
  201,
);
const consignee = await json(
  await api('/international-logistics/parties', admin, {
    method: 'POST',
    body: JSON.stringify({
      kind: 'ORGANIZATION',
      legalName: `Phase 13 Importer ${suffix}`,
      address: { city: 'Singapore', countryCode: 'SG' },
    }),
  }),
  201,
);
const consignment = await json(
  await api('/international-logistics/consignments', admin, {
    method: 'POST',
    body: JSON.stringify({
      bookingId: freightAcceptance.booking.id,
      ginc: `GINC-${suffix}`,
      consignorId: consignor.id,
      consigneeId: consignee.id,
      originLocationId: rotterdam.id,
      destinationLocationId: singapore.id,
      transportContractType: 'MULTIMODAL',
      serviceLevel: 'STANDARD',
      incoterm: 'CIP',
      packageCount: 4,
      grossWeightGrams: 800_000,
      grossVolumeCubicCm: 2_400_000,
      goodsDescription: 'Machinery components',
      commodityCodes: ['847990'],
      customsStatus: 'REQUIRED',
    }),
  }),
  201,
);
const document = await json(
  await api(`/international-logistics/consignments/${consignment.id}/documents`, admin, {
    method: 'POST',
    body: JSON.stringify({
      type: 'MULTIMODAL_TRANSPORT_DOCUMENT',
      number: `MTD-${suffix}`,
      standard: 'UN/CEFACT MMT',
      standardVersion: 'D23B',
      payload: { consignor: consignor.legalName, consignee: consignee.legalName },
    }),
  }),
  201,
);
await json(
  await api(`/international-logistics/documents/${document.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ status: 'ISSUED' }),
  }),
  201,
);
const customs = await json(
  await api(`/international-logistics/consignments/${consignment.id}/customs-filings`, admin, {
    method: 'POST',
    body: JSON.stringify({
      type: 'GOODS_DECLARATION',
      direction: 'EXPORT',
      customsOfficeCode: 'NLRTM',
      dataModelVersion: 'WCO-DM',
      declaration: { commodityCode: '847990', grossMassGrams: 800_000 },
    }),
  }),
  201,
);
const lodgedCustoms = await json(
  await api(`/international-logistics/customs-filings/${customs.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({
      status: 'LODGED',
      version: customs.version,
      mrn: `MRN-${suffix}`,
    }),
  }),
  201,
);
assert.equal(lodgedCustoms.status, 'LODGED');

const freshRequest = await json(await api(`/freight/requests/${freightRequest.id}`, admin));
const cargoItem = freshRequest.cargoItems[0];
const handlingUnit = await json(
  await api('/logistics-network/handling-units', admin, {
    method: 'POST',
    body: JSON.stringify({
      externalIdentifier: `PALLET-${suffix}`,
      type: 'PALLET',
      currentHubId: originHub.id,
      grossWeightGrams: 800_000,
      volumeCubicCm: 2_400_000,
    }),
  }),
  201,
);
await json(
  await api(`/logistics-network/handling-units/${handlingUnit.id}/contents`, admin, {
    method: 'POST',
    body: JSON.stringify({
      cargoItemId: cargoItem.id,
      packageCount: 4,
      weightGrams: 800_000,
      volumeCubicCm: 2_400_000,
    }),
  }),
  201,
);
await json(
  await api(`/logistics-network/handling-units/${handlingUnit.id}/events`, admin, {
    method: 'POST',
    body: JSON.stringify({
      hubId: originHub.id,
      type: 'RECEIVED',
      condition: 'GOOD',
      locationText: 'Inbound consolidation lane',
      occurredAt: new Date().toISOString(),
      source: 'SCAN',
      externalKey: `receive-${suffix}`,
    }),
  }),
  201,
);

const plan = await json(
  await api('/logistics-network/consolidations', admin, {
    method: 'POST',
    body: JSON.stringify({
      mode: 'SEA',
      serviceLevel: 'STANDARD',
      originHubId: originHub.id,
      destinationHubId: destinationHub.id,
      cutoffAt: new Date(Date.now() + 86_400_000).toISOString(),
      plannedDepartureAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      plannedArrivalAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      maxWeightGrams: 1_000_000,
      maxVolumeCubicCm: 3_000_000,
      equipmentType: 'LCL',
    }),
  }),
  201,
);
await json(
  await api(`/logistics-network/consolidations/${plan.id}/members`, admin, {
    method: 'POST',
    body: JSON.stringify({
      bookingId: freightAcceptance.booking.id,
      consignmentId: consignment.id,
      allocatedWeightGrams: 800_000,
      allocatedVolumeCubicCm: 2_400_000,
      packageCount: 4,
      finalDestination: 'Singapore',
    }),
  }),
  201,
);
const capacityDenied = await api(`/logistics-network/consolidations/${plan.id}/members`, admin, {
  method: 'POST',
  body: JSON.stringify({
    bookingId: freightAcceptance.booking.id,
    allocatedWeightGrams: 300_000,
    packageCount: 1,
  }),
});
assert.notEqual(capacityDenied.status, 201);
await json(
  await api(`/logistics-network/consolidations/${plan.id}/loads`, admin, {
    method: 'POST',
    body: JSON.stringify({ handlingUnitId: handlingUnit.id, loadSequence: 1 }),
  }),
  201,
);
const planAfterMember = (await json(await api('/logistics-network', admin))).plans.find(
  ({ id }) => id === plan.id,
);
const closedPlan = await json(
  await api(`/logistics-network/consolidations/${plan.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ status: 'CLOSED', version: planAfterMember.version }),
  }),
  201,
);
const loadedPlan = await json(
  await api(`/logistics-network/consolidations/${plan.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ status: 'LOADED', version: closedPlan.version }),
  }),
  201,
);
assert.equal(loadedPlan.status, 'LOADED');

const linehaul = await json(
  await api('/logistics-network/linehauls', admin, {
    method: 'POST',
    body: JSON.stringify({
      mode: 'SEA',
      originLocationId: rotterdam.id,
      destinationLocationId: singapore.id,
      conveyanceReference: `VESSEL-${suffix}`,
      scheduledDepartureAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      scheduledArrivalAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      maxWeightGrams: 5_000_000,
    }),
  }),
  201,
);
await json(
  await api(`/logistics-network/linehauls/${linehaul.id}/allocations`, admin, {
    method: 'POST',
    body: JSON.stringify({
      consolidationPlanId: plan.id,
      allocatedWeightGrams: 800_000,
      allocatedVolumeCubicCm: 2_400_000,
    }),
  }),
  201,
);

const postalMine = await json(await api('/postal/mine', admin));
const postalOperator = postalMine.operators.find(({ code }) => code === 'DEMOPOST');
const postalProduct = postalOperator.products.find(({ code }) => code === 'INTL-PARCEL');
assert.ok(postalProduct);
const postalItem = await json(
  await api('/postal/items', admin, {
    method: 'POST',
    body: JSON.stringify({
      operatorId: postalOperator.id,
      productId: postalProduct.id,
      serviceIndicator: 'CP',
      serial: numericSuffix,
      originCountryCode: 'NL',
      destinationCountryCode: 'SG',
      sender: { name: 'Phase 13 Sender', city: 'Rotterdam' },
      recipient: { name: 'Phase 13 Recipient', city: 'Singapore' },
      contentDescription: 'Commercial sample components',
      weightGrams: 2_000,
      declaredValueMinor: 15_000,
      currency: 'USD',
      customsData: { category: 'COMMERCIAL_SAMPLE', hsCode: '847990' },
    }),
  }),
  201,
);
assert.match(postalItem.s10Identifier, /^[A-Z]{2}\d{9}[A-Z]{2}$/);
const receptacle = await json(
  await api('/postal/operations/receptacles', admin, {
    method: 'POST',
    body: JSON.stringify({
      operatorId: postalOperator.id,
      receptacleId: `REC-${suffix}`,
      type: 'BAG',
      mailCategory: 'PARCEL',
      originImpcCode: 'NLRTMA',
      destinationImpcCode: 'SGSINA',
    }),
  }),
  201,
);
await json(
  await api(`/postal/operations/receptacles/${receptacle.id}/items`, admin, {
    method: 'POST',
    body: JSON.stringify({ itemId: postalItem.id }),
  }),
  201,
);
const closedReceptacle = await json(
  await api(`/postal/operations/receptacles/${receptacle.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ status: 'CLOSED', version: receptacle.version }),
  }),
  201,
);
const dispatch = await json(
  await api('/postal/operations/dispatches', admin, {
    method: 'POST',
    body: JSON.stringify({
      operatorId: postalOperator.id,
      dispatchId: `DSP-${suffix}`,
      originImpcCode: 'NLRTMA',
      destinationImpcCode: 'SGSINA',
      mailCategory: 'PARCEL',
      dispatchNumber: Number(numericSuffix),
      scheduledDepartureAt: new Date(Date.now() + 86_400_000).toISOString(),
    }),
  }),
  201,
);
await json(
  await api(`/postal/operations/dispatches/${dispatch.id}/receptacles`, admin, {
    method: 'POST',
    body: JSON.stringify({ receptacleId: closedReceptacle.id, sequence: 1 }),
  }),
  201,
);
const closedDispatch = await json(
  await api(`/postal/operations/dispatches/${dispatch.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ status: 'CLOSED', version: dispatch.version }),
  }),
  201,
);
await json(
  await api(`/postal/operations/dispatches/${dispatch.id}/transition`, admin, {
    method: 'POST',
    body: JSON.stringify({ status: 'HANDED_OVER', version: closedDispatch.version }),
  }),
  201,
);
const eventKey = randomUUID();
const postalEvent = await json(
  await api('/postal/operations/events', admin, {
    method: 'POST',
    body: JSON.stringify({
      itemId: postalItem.id,
      dispatchId: dispatch.id,
      standard: 'UPU_EMSEVT',
      code: 'EMC',
      description: 'Item departed the originating exchange office',
      locationCode: 'NLRTMA',
      occurredAt: new Date().toISOString(),
      source: 'EDI',
      externalKey: eventKey,
    }),
  }),
  201,
);
const duplicateEvent = await json(
  await api('/postal/operations/events', admin, {
    method: 'POST',
    body: JSON.stringify({
      itemId: postalItem.id,
      standard: 'UPU_EMSEVT',
      code: 'EMC',
      description: 'Duplicate provider transmission',
      occurredAt: new Date().toISOString(),
      source: 'EDI',
      externalKey: eventKey,
    }),
  }),
  201,
);
assert.equal(duplicateEvent.id, postalEvent.id);

const overview = await json(await api('/analytics/overview?days=30', admin));
assert.ok(overview.international);
assert.ok(overview.international.handlingUnits >= 1);
assert.ok(overview.international.postalItems >= 1);
assert.ok(overview.domainActivity.some(({ key }) => key === 'consolidation'));
assert.ok(overview.domainActivity.some(({ key }) => key === 'insurance'));
assert.ok(overview.domainActivity.some(({ key }) => key === 'postal'));

console.log(
  'Phase 13 international insurance, customs, consolidation, handling, postal, tenancy, and analytics checks passed.',
);

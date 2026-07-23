import { hash } from 'argon2';
import { createDatabaseClient } from '../src/index.js';

const database = createDatabaseClient();

const tenantId = '00000000-0000-4000-8000-000000000001';
const isolationTenantId = '00000000-0000-4000-8000-000000000009';
const userId = '00000000-0000-4000-8000-000000000101';
const roleId = '00000000-0000-4000-8000-000000000201';
const viewerUserId = '00000000-0000-4000-8000-000000000103';
const viewerRoleId = '00000000-0000-4000-8000-000000000202';

async function seed() {
  const passwordHash = await hash('ChangeMe-Local-Only-2026');

  await database.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      slug: 'platform-demo',
      name: 'LogiCommerce Demo',
      domains: {
        create: {
          id: '00000000-0000-4000-8000-000000000002',
          hostname: 'localhost',
          isPrimary: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  await database.tenant.upsert({
    where: { id: isolationTenantId },
    update: {},
    create: {
      id: isolationTenantId,
      slug: 'isolation-test',
      name: 'Isolation Test Tenant',
    },
  });

  const permissions = await Promise.all(
    (
      [
        [
          '00000000-0000-4000-8000-000000000301',
          'tenant.configure',
          'Configure the active tenant.',
        ],
        [
          '00000000-0000-4000-8000-000000000302',
          'identity.roles.manage',
          'Manage tenant roles and grants.',
        ],
        [
          '00000000-0000-4000-8000-000000000303',
          'identity.users.manage',
          'Manage tenant users and role assignments.',
        ],
        [
          '00000000-0000-4000-8000-000000000304',
          'identity.credentials.manage',
          'Manage tenant machine credentials.',
        ],
        [
          '00000000-0000-4000-8000-000000000305',
          'store.manage',
          'Manage tenant stores, categories, and catalog attributes.',
        ],
        ['00000000-0000-4000-8000-000000000306', 'catalog.submit', 'Submit supplier product data.'],
        [
          '00000000-0000-4000-8000-000000000307',
          'catalog.approve',
          'Approve or reject supplier product submissions.',
        ],
        [
          '00000000-0000-4000-8000-000000000308',
          'offer.manage',
          'Manage seller offers and publication.',
        ],
        [
          '00000000-0000-4000-8000-000000000309',
          'inventory.manage',
          'Process inventory feeds and reconciliation.',
        ],
        [
          '00000000-0000-4000-8000-000000000310',
          'cart.use',
          'Manage the authenticated customer cart and checkout.',
        ],
        [
          '00000000-0000-4000-8000-000000000311',
          'order.manage',
          'Read and administer tenant orders.',
        ],
        [
          '00000000-0000-4000-8000-000000000312',
          'purchase-order.manage',
          'Accept and manage dropship purchase orders.',
        ],
        ['00000000-0000-4000-8000-000000000313', 'facility.manage', 'Manage facilities and bins.'],
        [
          '00000000-0000-4000-8000-000000000314',
          'receiving.manage',
          'Receive, inspect, and put away inbound inventory.',
        ],
        [
          '00000000-0000-4000-8000-000000000315',
          'fulfillment.manage',
          'Pick and pack fulfillment orders.',
        ],
        [
          '00000000-0000-4000-8000-000000000316',
          'shipment.manage',
          'Label, manifest, and dispatch shipments.',
        ],
        [
          '00000000-0000-4000-8000-000000000317',
          'tracking.ingest',
          'Ingest normalized carrier tracking events.',
        ],
        [
          '00000000-0000-4000-8000-000000000318',
          'c2c.trade',
          'Buy and sell through the peer marketplace.',
        ],
        [
          '00000000-0000-4000-8000-000000000319',
          'c2c.moderate',
          'Moderate listings, disputes, and payouts.',
        ],
        [
          '00000000-0000-4000-8000-000000000320',
          'b2b.manage',
          'Manage business accounts and procurement policy.',
        ],
        [
          '00000000-0000-4000-8000-000000000321',
          'b2b.buy',
          'Create RFQs and accept business quotes.',
        ],
        ['00000000-0000-4000-8000-000000000322', 'b2b.sell', 'Quote and fulfill business orders.'],
        [
          '00000000-0000-4000-8000-000000000323',
          'b2b.approve',
          'Approve controlled business purchases.',
        ],
        [
          '00000000-0000-4000-8000-000000000324',
          'partner.manage',
          'Manage scoped seller, supplier, and Shop API credentials.',
        ],
        [
          '00000000-0000-4000-8000-000000000325',
          'webhook.manage',
          'Manage webhook endpoints, retries, and replay.',
        ],
        [
          '00000000-0000-4000-8000-000000000326',
          'return.use',
          'Request and inspect customer returns.',
        ],
        [
          '00000000-0000-4000-8000-000000000327',
          'return.manage',
          'Authorize, receive, inspect, and resolve returns.',
        ],
        [
          '00000000-0000-4000-8000-000000000328',
          'finance.manage',
          'Post balanced journals and reconcile providers.',
        ],
        [
          '00000000-0000-4000-8000-000000000329',
          'settlement.manage',
          'Calculate settlement statements and reserves.',
        ],
        [
          '00000000-0000-4000-8000-000000000330',
          'settlement.approve',
          'Approve calculated settlements.',
        ],
        [
          '00000000-0000-4000-8000-000000000331',
          'settlement.pay',
          'Release approved settlement payouts.',
        ],
        [
          '00000000-0000-4000-8000-000000000332',
          '3pl.manage',
          'Manage logistics clients and contracts.',
        ],
        [
          '00000000-0000-4000-8000-000000000333',
          '3pl.operate',
          'Operate isolated client inventory.',
        ],
        [
          '00000000-0000-4000-8000-000000000334',
          '3pl.bill',
          'Record billable logistics events and invoices.',
        ],
        [
          '00000000-0000-4000-8000-000000000335',
          '4pl.control',
          'Operate the logistics control tower.',
        ],
        [
          '00000000-0000-4000-8000-000000000336',
          '4pl.approve',
          'Approve control-tower rerouting decisions.',
        ],
        [
          '00000000-0000-4000-8000-000000000337',
          'optimization.manage',
          'Manage network models, runs, and outcomes.',
        ],
        [
          '00000000-0000-4000-8000-000000000338',
          'optimization.approve',
          'Approve or reject network recommendations.',
        ],
        [
          '00000000-0000-4000-8000-000000000339',
          'optimization.execute',
          'Execute and roll back approved recommendations.',
        ],
        [
          '00000000-0000-4000-8000-000000000340',
          'operability.read',
          'Read platform metrics, SLOs, and recovery evidence.',
        ],
        [
          '00000000-0000-4000-8000-000000000341',
          'operability.manage',
          'Manage SLO evidence and recovery exercises.',
        ],
        [
          '00000000-0000-4000-8000-000000000342',
          'privacy.manage',
          'Manage retention, legal hold, and privacy workflows.',
        ],
      ] as const
    ).map(([id, key, description]) =>
      database.permission.upsert({
        where: { key },
        update: { description },
        create: { id, key, description },
      }),
    ),
  );

  await database.role.upsert({
    where: { tenantId_key: { tenantId, key: 'tenant-admin' } },
    update: {},
    create: { id: roleId, tenantId, key: 'tenant-admin', name: 'Tenant administrator' },
  });

  await database.role.upsert({
    where: { tenantId_key: { tenantId, key: 'viewer' } },
    update: {},
    create: { id: viewerRoleId, tenantId, key: 'viewer', name: 'Read-only viewer' },
  });

  await Promise.all(
    permissions.map((permission) =>
      database.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permission.id } },
        update: {},
        create: { roleId, permissionId: permission.id },
      }),
    ),
  );

  const c2cTrade = permissions.find((permission) => permission.key === 'c2c.trade');
  if (c2cTrade) {
    await database.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: viewerRoleId, permissionId: c2cTrade.id } },
      update: {},
      create: { roleId: viewerRoleId, permissionId: c2cTrade.id },
    });
  }

  await database.user.upsert({
    where: { tenantId_email: { tenantId, email: 'admin@demo.logicommerce.local' } },
    update: {},
    create: {
      id: userId,
      tenantId,
      email: 'admin@demo.logicommerce.local',
      displayName: 'Demo Tenant Admin',
      verifiedAt: new Date(),
      identities: {
        create: {
          id: '00000000-0000-4000-8000-000000000102',
          tenantId,
          kind: 'PASSWORD',
          provider: 'local',
          providerUserId: 'admin@demo.logicommerce.local',
          passwordHash,
        },
      },
      userRoles: { create: { tenantId, roleId } },
    },
  });

  await database.user.upsert({
    where: { tenantId_email: { tenantId, email: 'viewer@demo.logicommerce.local' } },
    update: {},
    create: {
      id: viewerUserId,
      tenantId,
      email: 'viewer@demo.logicommerce.local',
      displayName: 'Demo Read-only Viewer',
      verifiedAt: new Date(),
      identities: {
        create: {
          id: '00000000-0000-4000-8000-000000000104',
          tenantId,
          kind: 'PASSWORD',
          provider: 'local',
          providerUserId: 'viewer@demo.logicommerce.local',
          passwordHash,
        },
      },
      userRoles: { create: { tenantId, roleId: viewerRoleId } },
    },
  });

  const storeId = '00000000-0000-4000-8000-000000000401';
  const categoryId = '00000000-0000-4000-8000-000000000402';
  const attributeId = '00000000-0000-4000-8000-000000000403';
  const attributeOptionId = '00000000-0000-4000-8000-000000000404';
  const supplierId = '00000000-0000-4000-8000-000000000405';
  const sellerId = '00000000-0000-4000-8000-000000000406';
  const productId = '00000000-0000-4000-8000-000000000407';
  const variantId = '00000000-0000-4000-8000-000000000408';
  const offerId = '00000000-0000-4000-8000-000000000409';
  const inventoryItemId = '00000000-0000-4000-8000-000000000411';
  const facilityId = '00000000-0000-4000-8000-000000000417';
  const binId = '00000000-0000-4000-8000-000000000418';

  await database.store.upsert({
    where: { tenantId_key: { tenantId, key: 'demo-store' } },
    update: { status: 'ACTIVE' },
    create: {
      id: storeId,
      tenantId,
      key: 'demo-store',
      name: 'LogiCommerce Demo Store',
      status: 'ACTIVE',
      branding: { accent: '#14532d', tone: 'editorial' },
      seo: { title: 'Field-tested commerce essentials' },
    },
  });

  await database.category.upsert({
    where: { tenantId_storeId_slug: { tenantId, storeId, slug: 'field-essentials' } },
    update: {},
    create: {
      id: categoryId,
      tenantId,
      storeId,
      slug: 'field-essentials',
      name: 'Field essentials',
    },
  });

  await database.attributeDefinition.upsert({
    where: { tenantId_storeId_key: { tenantId, storeId, key: 'finish' } },
    update: {},
    create: {
      id: attributeId,
      tenantId,
      storeId,
      key: 'finish',
      name: 'Finish',
      kind: 'SELECT',
      isVariant: true,
    },
  });

  await database.attributeOption.upsert({
    where: {
      tenantId_attributeId_value: { tenantId, attributeId, value: 'forest-green' },
    },
    update: {},
    create: {
      id: attributeOptionId,
      tenantId,
      attributeId,
      value: 'forest-green',
      label: 'Forest green',
    },
  });

  await database.supplier.upsert({
    where: { tenantId_key: { tenantId, key: 'northstar-supply' } },
    update: {},
    create: {
      id: supplierId,
      tenantId,
      key: 'northstar-supply',
      name: 'Northstar Supply',
    },
  });

  await database.seller.upsert({
    where: { tenantId_key: { tenantId, key: 'demo-merchant' } },
    update: {},
    create: { id: sellerId, tenantId, key: 'demo-merchant', name: 'Demo Merchant' },
  });

  await database.product.upsert({
    where: { tenantId_storeId_slug: { tenantId, storeId, slug: 'modular-field-kit' } },
    update: { status: 'ACTIVE' },
    create: {
      id: productId,
      tenantId,
      storeId,
      categoryId,
      supplierId,
      slug: 'modular-field-kit',
      title: 'Modular Field Kit',
      description:
        'A compact, repairable organizer designed for travel, workshops, and daily carry.',
      status: 'ACTIVE',
      seo: { title: 'Modular Field Kit', description: 'Repairable everyday organization.' },
    },
  });

  await database.productTranslation.upsert({
    where: { tenantId_productId_locale: { tenantId, productId, locale: 'en' } },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000414',
      tenantId,
      productId,
      locale: 'en',
      title: 'Modular Field Kit',
      description: 'A compact, repairable organizer for work and travel.',
    },
  });

  await database.productMedia.upsert({
    where: { id: '00000000-0000-4000-8000-000000000415' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000415',
      tenantId,
      productId,
      url: '/product-placeholder.svg',
      altText: 'Modular field kit in forest green',
    },
  });

  await database.productAttributeValue.upsert({
    where: {
      tenantId_productId_attributeId: { tenantId, productId, attributeId },
    },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000416',
      tenantId,
      productId,
      attributeId,
      optionId: attributeOptionId,
    },
  });

  await database.productVariant.upsert({
    where: { tenantId_sku: { tenantId, sku: 'FIELD-KIT-GREEN' } },
    update: { status: 'ACTIVE' },
    create: {
      id: variantId,
      tenantId,
      productId,
      sku: 'FIELD-KIT-GREEN',
      title: 'Forest green',
      attributes: { finish: 'forest-green' },
    },
  });

  await database.offer.upsert({
    where: {
      tenantId_storeId_variantId_sellerId: { tenantId, storeId, variantId, sellerId },
    },
    update: { status: 'ACTIVE', priceMinor: 4900n },
    create: {
      id: offerId,
      tenantId,
      storeId,
      variantId,
      sellerId,
      supplierId,
      currency: 'USD',
      priceMinor: 4900n,
      compareAtMinor: 5900n,
      status: 'ACTIVE',
    },
  });

  await database.promotion.upsert({
    where: { tenantId_storeId_code: { tenantId, storeId, code: 'WELCOME10' } },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000410',
      tenantId,
      storeId,
      code: 'WELCOME10',
      name: 'Welcome 10%',
      kind: 'PERCENTAGE',
      value: 10,
    },
  });

  await database.inventoryItem.upsert({
    where: { id: inventoryItemId },
    update: { facilityId, productRef: variantId },
    create: {
      id: inventoryItemId,
      tenantId,
      facilityId,
      sku: 'FIELD-KIT-GREEN',
      productRef: variantId,
    },
  });

  await database.facility.upsert({
    where: { tenantId_key: { tenantId, key: 'demo-warehouse' } },
    update: {},
    create: {
      id: facilityId,
      tenantId,
      key: 'demo-warehouse',
      name: 'Demo Warehouse',
      address: { line1: '1 Logistics Way', city: 'Demo City', countryCode: 'US' },
    },
  });

  await database.facilityBin.upsert({
    where: { tenantId_facilityId_code: { tenantId, facilityId, code: 'A-01-01' } },
    update: {},
    create: { id: binId, tenantId, facilityId, code: 'A-01-01', kind: 'PICK_FACE', capacity: 1000 },
  });

  await database.inventoryBalance.upsert({
    where: {
      tenantId_inventoryItemId_state: {
        tenantId,
        inventoryItemId,
        state: 'ON_HAND',
      },
    },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000412',
      tenantId,
      inventoryItemId,
      state: 'ON_HAND',
      quantity: 25n,
    },
  });

  await database.stockLedgerEntry.upsert({
    where: {
      tenantId_idempotencyKey: { tenantId, idempotencyKey: 'seed:FIELD-KIT-GREEN:on-hand' },
    },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000413',
      tenantId,
      inventoryItemId,
      state: 'ON_HAND',
      quantityDelta: 25n,
      operation: 'SEED',
      reasonCode: 'DEMO_FIXTURE',
      sourceType: 'SEED',
      sourceId: inventoryItemId,
      idempotencyKey: 'seed:FIELD-KIT-GREEN:on-hand',
      correlationId: '00000000-0000-4000-8000-000000000413',
    },
  });

  for (const [id, code, name, type] of [
    ['00000000-0000-4000-8000-000000000501', '1000', 'Cash and payment clearing', 'ASSET'],
    ['00000000-0000-4000-8000-000000000502', '2000', 'Seller payable', 'LIABILITY'],
    ['00000000-0000-4000-8000-000000000503', '2100', 'Settlement reserve', 'LIABILITY'],
    ['00000000-0000-4000-8000-000000000504', '4000', 'Marketplace revenue', 'REVENUE'],
    ['00000000-0000-4000-8000-000000000505', '5000', 'Refund and adjustment expense', 'EXPENSE'],
    ['00000000-0000-4000-8000-000000000506', '5100', 'Provider and payment fees', 'EXPENSE'],
  ] as const) {
    await database.financialAccount.upsert({
      where: { tenantId_code_currency: { tenantId, code, currency: 'USD' } },
      update: { name, type, active: true },
      create: { id, tenantId, code, name, type, currency: 'USD' },
    });
  }

  await database.serviceLevelObjective.upsert({
    where: { tenantId_key: { tenantId, key: 'api-availability' } },
    update: { target: 0.9995, windowDays: 30 },
    create: {
      id: '00000000-0000-4000-8000-000000000511',
      tenantId,
      key: 'api-availability',
      name: 'API availability',
      target: 0.9995,
      windowDays: 30,
      indicatorQuery: 'successful_requests / total_requests',
    },
  });

  await database.dataRetentionPolicy.upsert({
    where: { tenantId_dataClass: { tenantId, dataClass: 'audit-events' } },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000512',
      tenantId,
      dataClass: 'audit-events',
      retentionDays: 2555,
      action: 'ARCHIVE',
      approvedBy: userId,
    },
  });
}

seed()
  .then(() => database.$disconnect())
  .catch(async (error: unknown) => {
    console.error('Seed failed', error instanceof Error ? error.message : 'Unknown error');
    await database.$disconnect();
    process.exitCode = 1;
  });

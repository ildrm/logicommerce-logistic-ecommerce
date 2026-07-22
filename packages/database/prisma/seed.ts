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

  const permission = await database.permission.upsert({
    where: { key: 'tenant.configure' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000301',
      key: 'tenant.configure',
      description: 'Configure the active tenant.',
    },
  });

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

  await database.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId: permission.id } },
    update: {},
    create: { roleId, permissionId: permission.id },
  });

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
}

seed()
  .then(() => database.$disconnect())
  .catch(async (error: unknown) => {
    console.error('Seed failed', error instanceof Error ? error.message : 'Unknown error');
    await database.$disconnect();
    process.exitCode = 1;
  });

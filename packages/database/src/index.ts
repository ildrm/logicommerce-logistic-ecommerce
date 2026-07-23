import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/client/client.js';

export type TenantContext = {
  readonly tenantId: string;
  readonly actorId: string | null;
  readonly correlationId: string;
};

export function requireTenantId(context: TenantContext): string {
  if (context.tenantId.length === 0) throw new Error('Tenant context is required');
  return context.tenantId;
}

export function tenantScopedWhere<T extends object, K extends string = 'tenantId'>(
  context: TenantContext,
  where: T,
  tenantKey: K = 'tenantId' as K,
): T & Record<K, string> {
  return { ...where, [tenantKey]: requireTenantId(context) } as T & Record<K, string>;
}

export function createDatabaseClient() {
  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? '3306'),
    user: process.env.DATABASE_USER ?? 'logicommerce',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? 'logicommerce',
    connectionLimit: 10,
    allowPublicKeyRetrieval:
      process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true' ||
      process.env.NODE_ENV !== 'production',
  });
  return new PrismaClient({ adapter });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export * from '../generated/client/client.js';

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

export function safeIntegerNumber(value: bigint | number, label = 'Integer'): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) {
    throw new RangeError(`${label} exceeds JavaScript's safe integer range`);
  }
  return converted;
}

export function tenantScopedWhere<T extends object, K extends string = 'tenantId'>(
  context: TenantContext,
  where: T,
  tenantKey: K = 'tenantId' as K,
): T & Record<K, string> {
  return { ...where, [tenantKey]: requireTenantId(context) } as T & Record<K, string>;
}

export function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const adapter = new PrismaMariaDb(connectionString);
  return new PrismaClient({ adapter });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export * from '../generated/client/client.js';

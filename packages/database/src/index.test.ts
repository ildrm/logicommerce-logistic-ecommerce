import { describe, expect, it } from 'vitest';
import {
  createDatabaseClient,
  requireTenantId,
  safeIntegerNumber,
  tenantScopedWhere,
} from './index.js';

describe('tenant scope', () => {
  const context = { tenantId: 'tenant-a', actorId: null, correlationId: 'request-1' };

  it('overrides untrusted tenant values', () => {
    expect(tenantScopedWhere(context, { tenantId: 'tenant-b', id: 'order-1' })).toEqual({
      tenantId: 'tenant-a',
      id: 'order-1',
    });
  });

  it('rejects missing context', () => {
    expect(() => requireTenantId({ ...context, tenantId: '' })).toThrow(
      'Tenant context is required',
    );
  });

  it('supports tenant-root models whose scope key is id', () => {
    expect(tenantScopedWhere(context, { status: 'ACTIVE' }, 'id')).toEqual({
      id: 'tenant-a',
      status: 'ACTIVE',
    });
  });

  it('requires the same DATABASE_URL used by Prisma migrations', () => {
    const current = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(() => createDatabaseClient()).toThrow('DATABASE_URL is required');
    } finally {
      if (current === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = current;
    }
  });

  it('refuses to silently round database integers', () => {
    expect(safeIntegerNumber(9_007_199_254_740_991n)).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => safeIntegerNumber(9_007_199_254_740_992n, 'Money')).toThrow(
      'Money exceeds JavaScript',
    );
  });
});

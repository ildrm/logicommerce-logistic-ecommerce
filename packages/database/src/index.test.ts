import { describe, expect, it } from 'vitest';
import { requireTenantId, tenantScopedWhere } from './index.js';

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
});

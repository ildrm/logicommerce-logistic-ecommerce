import { describe, expect, it } from 'vitest';
import { TenantContextService } from './tenant-context.service.js';

describe('TenantContextService', () => {
  it('does not leak context outside its request scope', () => {
    const service = new TenantContextService();
    service.run({ tenantId: 'tenant-a', actorId: null, correlationId: 'request-a' }, () => {
      expect(service.get().tenantId).toBe('tenant-a');
    });
    expect(() => service.get()).toThrow('Tenant context is unavailable');
  });
});

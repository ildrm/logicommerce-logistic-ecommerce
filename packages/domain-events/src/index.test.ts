import { describe, expect, it } from 'vitest';
import { createDomainEvent } from './index.js';

describe('createDomainEvent', () => {
  it('creates a versioned privacy-minimal envelope', () => {
    const event = createDomainEvent({
      id: 'evt-1',
      type: 'inventory.reserved',
      tenantId: 'tenant-1',
      correlationId: 'correlation-1',
      subject: 'inventory/item-1',
      data: { quantity: 1 },
      occurredAt: new Date('2026-07-21T00:00:00.000Z'),
    });

    expect(event.version).toBe(1);
    expect(event.actorId).toBeNull();
    expect(event.occurredAt).toBe('2026-07-21T00:00:00.000Z');
  });
});

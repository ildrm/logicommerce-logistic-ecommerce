import { describe, expect, it } from 'vitest';
import { applyStockDelta, InventoryInvariantError, scoreRoutingCandidates } from './index.js';

const balances = {
  EXPECTED: 0n,
  INBOUND: 0n,
  ON_HAND: 1n,
  RESERVED: 0n,
  ALLOCATED: 0n,
  QUARANTINED: 0n,
  DAMAGED: 0n,
  EXPIRED: 0n,
  RECALLED: 0n,
};

describe('inventory invariants', () => {
  it('prevents negative state balances by default', () => {
    expect(() => applyStockDelta(balances, { state: 'ON_HAND', quantity: -2n })).toThrow(
      InventoryInvariantError,
    );
  });
});

describe('deterministic routing', () => {
  it('rejects ineligible candidates and produces stable ordering', () => {
    const result = scoreRoutingCandidates(
      [
        {
          id: 'b',
          legallyEligible: true,
          inventoryAvailable: true,
          promiseScore: 8,
          capacityScore: 8,
          costScore: 5,
          riskScore: 7,
          carbonScore: 4,
        },
        {
          id: 'a',
          legallyEligible: true,
          inventoryAvailable: true,
          promiseScore: 8,
          capacityScore: 8,
          costScore: 5,
          riskScore: 7,
          carbonScore: 4,
        },
        {
          id: 'blocked',
          legallyEligible: false,
          inventoryAvailable: true,
          promiseScore: 10,
          capacityScore: 10,
          costScore: 10,
          riskScore: 10,
          carbonScore: 10,
        },
      ],
      { promise: 4, capacity: 3, cost: 2, risk: 2, carbon: 1 },
    );

    expect(result.map(({ id }) => id)).toEqual(['a', 'b']);
  });
});

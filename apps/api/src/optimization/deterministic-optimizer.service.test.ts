import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  DeterministicOptimizerService,
  sha256,
} from './deterministic-optimizer.service.js';

describe('DeterministicOptimizerService', () => {
  it('canonicalizes object keys and produces reproducible digests', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe(
      canonicalJson({ a: { b: 3, y: 2 }, z: 1 }),
    );
    expect(sha256({ z: 1, a: 2 })).toBe(sha256({ a: 2, z: 1 }));
  });

  it('filters infeasible lanes and breaks equal scores deterministically', () => {
    const service = new DeterministicOptimizerService();
    const lanes = [
      {
        from: 'a',
        to: 'b',
        carrierKey: 'zeta',
        capacity: 5,
        costMinor: 100,
        carbonGrams: 10,
        slaHours: 2,
      },
      {
        from: 'a',
        to: 'b',
        carrierKey: 'alpha',
        capacity: 5,
        costMinor: 100,
        carbonGrams: 10,
        slaHours: 2,
      },
      {
        from: 'a',
        to: 'c',
        carrierKey: 'cheap',
        capacity: 1,
        costMinor: 1,
        carbonGrams: 1,
        slaHours: 1,
      },
    ];
    const result = service.recommend(lanes, { cost: 1, carbon: 1, sla: 1 }, { minimumCapacity: 2 });
    expect(result).toHaveLength(2);
    expect(result[0]?.plan.carrierKey).toBe('alpha');
    expect(result[1]?.plan.carrierKey).toBe('zeta');
    expect(result[0]?.explanation.claim).toContain('mathematical optimality is not claimed');
  });
});

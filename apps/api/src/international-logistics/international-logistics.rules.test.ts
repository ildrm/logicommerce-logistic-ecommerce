import { describe, expect, it } from 'vitest';
import {
  assertCapacity,
  assertTransition,
  buildS10Identifier,
  isValidS10Identifier,
  isValidSscc,
  normalizeUnLocode,
  s10CheckDigit,
  ssccCheckDigit,
} from './international-logistics.rules.js';

describe('international logistics rules', () => {
  it('builds and validates UPU S10 identifiers', () => {
    const identifier = buildS10Identifier('CP', '12345678', 'DE');
    expect(identifier).toHaveLength(13);
    expect(identifier).toBe(`CP12345678${s10CheckDigit('12345678')}DE`);
    expect(isValidS10Identifier(identifier)).toBe(true);
    expect(isValidS10Identifier(`${identifier.slice(0, 10)}9${identifier.slice(11)}`)).toBe(false);
  });

  it('validates GS1 SSCC identifiers', () => {
    const body = '12345678901234567';
    const sscc = `${body}${ssccCheckDigit(body)}`;
    expect(isValidSscc(sscc)).toBe(true);
    const invalidDigit = (ssccCheckDigit(body) + 1) % 10;
    expect(isValidSscc(`${body}${invalidDigit}`)).toBe(false);
  });

  it('normalizes UN/LOCODE and rejects ambiguous digits', () => {
    expect(normalizeUnLocode('de ham')).toBe('DEHAM');
    expect(() => normalizeUnLocode('DEH01')).toThrow(/UN\/LOCODE/u);
  });

  it('enforces consolidation capacity and workflow transitions', () => {
    expect(() => assertCapacity(1_000n, 1_000n, 600n, 500n, 401n, 100n)).toThrow(
      /weight capacity/u,
    );
    expect(() => assertCapacity(1_000n, 1_000n, 600n, 500n, 400n, 500n)).not.toThrow();
    expect(() => assertTransition('CONSOLIDATION', 'OPEN', 'CLOSED')).not.toThrow();
    expect(() => assertTransition('POSTAL_DISPATCH', 'OPEN', 'RECEIVED')).toThrow(
      /Invalid postal_dispatch transition/u,
    );
  });
});

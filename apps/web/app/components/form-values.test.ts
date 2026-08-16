import { describe, expect, it } from 'vitest';
import { scaledDecimalFormValue } from './form-values.js';

describe('scaledDecimalFormValue', () => {
  it('converts decimal currency without floating-point rounding', () => {
    expect(scaledDecimalFormValue('10.01', 2, 'Amount')).toBe(1001);
    expect(scaledDecimalFormValue('0.29', 2, 'Amount')).toBe(29);
  });

  it('pads supported fractional units', () => {
    expect(scaledDecimalFormValue('1.5', 3, 'Weight')).toBe(1500);
  });

  it('rejects excess precision, negative values, and unsafe integers', () => {
    expect(() => scaledDecimalFormValue('1.001', 2, 'Amount')).toThrow('at most 2');
    expect(() => scaledDecimalFormValue('-1', 2, 'Amount')).toThrow('non-negative');
    expect(() => scaledDecimalFormValue('90071992547410', 2, 'Amount')).toThrow('too large');
  });
});

import { describe, expect, it } from 'vitest';
import { moneySchema, paginationSchema } from './index.js';

describe('shared validation', () => {
  it('rejects floating point numbers for money', () => {
    expect(moneySchema.safeParse({ amount: 12.3, currency: 'USD' }).success).toBe(false);
  });

  it('caps page size', () => {
    expect(paginationSchema.safeParse({ page: 1, perPage: 101 }).success).toBe(false);
  });
});

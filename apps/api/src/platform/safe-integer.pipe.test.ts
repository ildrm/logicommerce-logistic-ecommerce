import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { SafeIntegerPipe } from './safe-integer.pipe.js';

describe('SafeIntegerPipe', () => {
  const pipe = new SafeIntegerPipe();

  it('accepts nested safe integers', () => {
    const input = { amountMinor: Number.MAX_SAFE_INTEGER, lines: [{ quantity: 2 }] };
    expect(pipe.transform(input)).toBe(input);
  });

  it('rejects an integer that JSON cannot represent precisely', () => {
    expect(() => pipe.transform({ amountMinor: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
      BadRequestException,
    );
  });
});

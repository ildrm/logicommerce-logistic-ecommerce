import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { JsonSafeInterceptor } from './json-safe.interceptor.js';

describe('JsonSafeInterceptor', () => {
  it('preserves precision by stringifying unsafe bigints only', async () => {
    const interceptor = new JsonSafeInterceptor();
    const result = await firstValueFrom(
      interceptor.intercept({} as never, { handle: () => of({ safe: 10n, unsafe: 2n ** 63n }) }),
    );
    expect(result).toEqual({ safe: 10, unsafe: '9223372036854775808' });
  });

  it('preserves binary document responses', async () => {
    const interceptor = new JsonSafeInterceptor();
    const document = Buffer.from('%PDF-1.4');
    const output = await firstValueFrom(
      interceptor.intercept({} as never, {
        handle: () => of(document),
      }),
    );

    expect(output).toBe(document);
  });
});

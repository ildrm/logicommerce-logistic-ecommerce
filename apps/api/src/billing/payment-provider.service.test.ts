import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentProviderService } from './payment-provider.service.js';

const originalEnvironment = { ...process.env };

function configure(overrides: Record<string, string> = {}) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'mysql://user:password@localhost:3306/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-32-characters',
    JWT_REFRESH_PEPPER: 'refresh-pepper-that-is-at-least-32-characters',
    FIELD_ENCRYPTION_KEY: 'field-encryption-key-at-least-32-characters',
    CORS_ORIGINS: 'http://localhost:8080',
    PAYMENT_ADAPTER: 'mock',
    STRIPE_WEBHOOK_SECRET: 'stripe-webhook-secret',
    COINBASE_WEBHOOK_SECRET: 'coinbase-webhook-secret',
    ...overrides,
  });
}

describe('PaymentProviderService', () => {
  beforeEach(() => configure());
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) delete process.env[key];
    }
    Object.assign(process.env, originalEnvironment);
  });

  it('creates hosted-looking mock sessions only outside production', async () => {
    const session = await new PaymentProviderService().createSession({
      provider: 'MOCK',
      idempotencyKey: 'payment-test-1',
      amountMinor: 12_500,
      currency: 'USD',
      invoiceId: '00000000-0000-4000-8000-000000000001',
      invoiceNumber: 'INV-2026-000001',
    });
    expect(session.reference).toMatch(/^mock_/u);
    expect(session.checkoutUrl).toContain('/freight?mockPayment=');
  });

  it('fails startup when mock payments are enabled in production', () => {
    configure({ NODE_ENV: 'production', PAYMENT_ADAPTER: 'mock' });
    expect(() => new PaymentProviderService()).toThrow(/PAYMENT_ADAPTER: mock is forbidden/u);
  });

  it('verifies Stripe signatures and rejects stale or replay-shaped signatures', () => {
    const service = new PaymentProviderService();
    const body = '{"id":"evt_test"}';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', 'stripe-webhook-secret')
      .update(`${timestamp}.${body}`)
      .digest('hex');
    expect(service.verifyStripe(body, `t=${timestamp},v1=${signature}`)).toBe(true);
    expect(service.verifyStripe(body, `t=${timestamp},v1=retired,v1=${signature}`)).toBe(true);
    expect(service.verifyStripe(`${body}x`, `t=${timestamp},v1=${signature}`)).toBe(false);
    expect(service.verifyStripe(body, `t=${timestamp - 600},v1=${signature}`)).toBe(false);
  });

  it('verifies Coinbase signed header payloads', () => {
    const service = new PaymentProviderService();
    const body = '{"id":"checkout_test"}';
    const timestamp = Math.floor(Date.now() / 1000);
    const headerNames = 'content-type x-hook0-id';
    const headers = { 'content-type': 'application/json', 'x-hook0-id': 'hook_test' };
    const signed = `${timestamp}.${headerNames}.application/json.hook_test.${body}`;
    const signature = createHmac('sha256', 'coinbase-webhook-secret').update(signed).digest('hex');
    expect(
      service.verifyCoinbase(body, `t=${timestamp},h=${headerNames},v1=${signature}`, headers),
    ).toBe(true);
    expect(
      service.verifyCoinbase(
        `${body}x`,
        `t=${timestamp},h=${headerNames},v1=${signature}`,
        headers,
      ),
    ).toBe(false);
    const legacy = createHmac('sha256', 'coinbase-webhook-secret')
      .update(`${timestamp}.${body}`)
      .digest('hex');
    expect(service.verifyCoinbase(body, `t=${timestamp},v1=${legacy}`, headers)).toBe(false);
  });

  it('uses the Coinbase sandbox URL and a deterministic UUIDv4 idempotency key', async () => {
    configure({
      PAYMENT_ADAPTER: 'coinbase',
      COINBASE_API_KEY_ID: 'key-id',
      COINBASE_API_KEY_SECRET: 'test-secret',
      COINBASE_API_BASE_URL: 'https://business.coinbase.com/sandbox/api/v1',
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '68f7a946db0529ea9b6d3a12',
          url: 'https://payments.coinbase.com/payment-links/test',
          expiresAt: '2026-12-31T23:59:59Z',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new PaymentProviderService();
    Object.assign(service, { coinbaseJwt: () => 'test-jwt' });

    await service.createSession({
      provider: 'COINBASE',
      idempotencyKey: 'customer-supplied-key',
      amountMinor: 12_500,
      currency: 'USD',
      invoiceId: '00000000-0000-4000-8000-000000000001',
      invoiceNumber: 'INV-2026-000001',
    });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://business.coinbase.com/sandbox/api/v1/checkouts');
    expect(new Headers(request.headers).get('x-idempotency-key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it('rejects insecure hosted-checkout URLs returned by a provider', async () => {
    configure({
      PAYMENT_ADAPTER: 'coinbase',
      COINBASE_API_KEY_ID: 'key-id',
      COINBASE_API_KEY_SECRET: 'test-secret',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'checkout-test',
            url: 'http://attacker.example/checkout',
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const service = new PaymentProviderService();
    Object.assign(service, { coinbaseJwt: () => 'test-jwt' });

    await expect(
      service.createSession({
        provider: 'COINBASE',
        idempotencyKey: 'customer-supplied-key',
        amountMinor: 12_500,
        currency: 'USD',
        invoiceId: '00000000-0000-4000-8000-000000000001',
        invoiceNumber: 'INV-2026-000001',
      }),
    ).rejects.toThrow('checkout session creation failed');
  });

  it('calls the singular Coinbase refund endpoint and reads the nested refund result', async () => {
    configure({
      PAYMENT_ADAPTER: 'coinbase',
      COINBASE_API_KEY_ID: 'key-id',
      COINBASE_API_KEY_SECRET: 'test-secret',
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refund: { id: 'refund-1', status: 'PENDING' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new PaymentProviderService();
    Object.assign(service, { coinbaseJwt: () => 'test-jwt' });

    const result = await service.refund({
      refundId: '00000000-0000-4000-8000-000000000010',
      provider: 'COINBASE',
      providerReference: '68f7a946db0529ea9b6d3a12',
      amountMinor: 2_500,
      reason: 'Customer request',
      idempotencyKey: 'refund-request-key',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://business.coinbase.com/api/v1/checkouts/68f7a946db0529ea9b6d3a12/refund',
    );
    expect(result).toEqual({ reference: 'refund-1', status: 'PENDING' });
  });

  it('binds Stripe refunds to the local durable refund identity', async () => {
    configure({ PAYMENT_ADAPTER: 'stripe', STRIPE_SECRET_KEY: 'stripe-test-secret' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ payment_intent: 'pi_test' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 're_test', status: 'pending' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await new PaymentProviderService().refund({
      refundId: '00000000-0000-4000-8000-000000000010',
      provider: 'STRIPE',
      providerReference: 'cs_test',
      amountMinor: 2_500,
      reason: 'Customer request',
      idempotencyKey: 'refund-request-key',
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const body = request.body as URLSearchParams;
    expect(body.get('metadata[logicommerce_refund_id]')).toBe(
      '00000000-0000-4000-8000-000000000010',
    );
  });
});

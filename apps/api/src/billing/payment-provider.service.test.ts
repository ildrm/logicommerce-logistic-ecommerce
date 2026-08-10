import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  });
});

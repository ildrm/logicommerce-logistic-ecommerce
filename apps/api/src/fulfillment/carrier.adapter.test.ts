import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeterministicCarrierAdapter, HttpCarrierAdapter } from './carrier.adapter.js';

const originalEnvironment = { ...process.env };
const input = {
  shipmentId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  carrierKey: 'parcel-express',
  serviceLevel: 'priority',
  weightGrams: 1_200,
};

describe('carrier adapters', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://user:password@localhost:3306/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-32-characters',
      JWT_REFRESH_PEPPER: 'refresh-pepper-that-is-at-least-32-characters',
      FIELD_ENCRYPTION_KEY: 'field-encryption-key-at-least-32-characters',
      CORS_ORIGINS: 'http://localhost:8080',
      CARRIER_ADAPTER: 'http',
      CARRIER_PROVIDER_URL: 'https://carrier.example.test',
      CARRIER_PROVIDER_TOKEN: 'carrier-provider-token-test',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) delete process.env[key];
    }
    Object.assign(process.env, originalEnvironment);
  });

  it('returns the same development label for the same shipment', async () => {
    const adapter = new DeterministicCarrierAdapter();
    expect(await adapter.createLabel(input)).toEqual(await adapter.createLabel(input));
  });

  it('sends an idempotent bounded request to the configured carrier', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trackingNumber: 'TRACK-1',
          labelUrl: 'https://carrier.example.test/labels/1.pdf',
          rateMinor: 925,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(new HttpCarrierAdapter().createLabel(input)).resolves.toMatchObject({
      trackingNumber: 'TRACK-1',
      rateMinor: 925,
    });
    const [url, request] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url).toEqual(new URL('https://carrier.example.test/v1/labels'));
    expect(request.method).toBe('POST');
    expect(request.redirect).toBe('manual');
    expect(request.headers).toMatchObject({ 'idempotency-key': input.shipmentId });
  });
});

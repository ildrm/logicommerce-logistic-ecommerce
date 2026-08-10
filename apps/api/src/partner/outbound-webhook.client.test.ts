import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => vi.fn());
const request = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({ lookup }));
vi.mock('node:https', () => ({ request }));

import {
  DeterministicOutboundWebhookClient,
  HttpOutboundWebhookClient,
  createOutboundWebhookClient,
} from './outbound-webhook.client.js';

const originalEnvironment = { ...process.env };

describe('OutboundWebhookClient', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      DATABASE_URL: 'mysql://user:password@localhost:3306/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'A9!access-token_Prod-7xQ2mL8vN4cR6yT1kP5sD3fH0wE7uJ9z',
      JWT_REFRESH_PEPPER: 'B8!refresh-pepper_Prod-6wE1nK9uM3zS7pV2jG5rC4xQ0tL8hF',
      FIELD_ENCRYPTION_KEY: 'C7!field-encryption_Prod-5qW2bJ8tL4xN9mR1vH6kD3sA0yP7eG',
      CORS_ORIGINS: 'https://app.example.com',
      COOKIE_SECURE: 'true',
      PUBLIC_BASE_URL: 'https://app.example.com',
      PAYMENT_ADAPTER: 'stripe',
      STRIPE_SECRET_KEY: 'stripe-secret-production',
      STRIPE_WEBHOOK_SECRET: 'stripe-webhook-production',
      COMMERCE_ADAPTER: 'http',
      COMMERCE_PROVIDER_URL: 'https://commerce.example.com',
      COMMERCE_PROVIDER_TOKEN: 'commerce-provider-token-production',
      CARRIER_ADAPTER: 'http',
      CARRIER_PROVIDER_URL: 'https://carrier.example.com',
      CARRIER_PROVIDER_TOKEN: 'carrier-provider-token-production',
      IDENTITY_VERIFICATION_ADAPTER: 'http',
      IDENTITY_VERIFICATION_URL: 'https://identity.example.com',
      IDENTITY_VERIFICATION_TOKEN: 'identity-provider-token-production',
      C2C_PAYMENT_ADAPTER: 'http',
      C2C_PAYMENT_PROVIDER_URL: 'https://escrow.example.com',
      C2C_PAYMENT_PROVIDER_TOKEN: 'escrow-provider-token-production',
      S3_PUBLIC_ENDPOINT: 'https://objects.example.com',
      S3_SECRET_KEY: 'D6!object-storage_Prod-4rT1cM9wK3xV8pQ2jH7nS5aL0zE6uB',
      DOCUMENT_SCANNER_ADAPTER: 'http',
      DOCUMENT_SCANNER_URL: 'https://scanner.example.com',
      DOCUMENT_SCANNER_TOKEN: 'document-scanner-token-production',
      EMAIL_ADAPTER: 'smtp',
      SMTP_USER: 'mailer',
      SMTP_PASSWORD: 'smtp-password-production',
      SMTP_FROM: 'no-reply@example.com',
      PARTNER_WEBHOOK_ADAPTER: 'http',
      PARTNER_WEBHOOK_ALLOWED_HOSTS: '*.example.com',
    });
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    request.mockImplementation(
      (
        _url: URL,
        _options: object,
        callback: (
          response: EventEmitter & { statusCode: number; destroy: (error: Error) => void },
        ) => void,
      ) => {
        const outbound = new EventEmitter() as EventEmitter & { end: (body: Buffer) => void };
        outbound.end = () => {
          const response = new EventEmitter() as EventEmitter & {
            statusCode: number;
            destroy: (error: Error) => void;
          };
          response.statusCode = 204;
          response.destroy = (error) => response.emit('error', error);
          callback(response);
          queueMicrotask(() => response.emit('end'));
        };
        return outbound;
      },
    );
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) delete process.env[key];
    }
    Object.assign(process.env, originalEnvironment);
    vi.clearAllMocks();
  });

  it('pins the validated public address into the HTTPS request lookup', async () => {
    await expect(
      new HttpOutboundWebhookClient().deliver({
        url: 'https://hooks.example.com/events',
        eventId: 'event-1',
        eventType: 'order.created',
        timestamp: new Date().toISOString(),
        signature: 'sha256=test',
        body: '{}',
      }),
    ).resolves.toBe(204);

    const options = request.mock.calls[0]?.[1] as {
      lookup: (
        hostname: string,
        options: object,
        callback: (error: null, address: string, family: number) => void,
      ) => void;
    };
    const callback = vi.fn();
    options.lookup('hooks.example.com', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });

  it('rejects a destination when any resolved address is prohibited', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);

    await expect(
      new HttpOutboundWebhookClient().validateDestination('https://hooks.example.com/events'),
    ).rejects.toThrow('Webhook endpoint resolves to a prohibited network');
    expect(request).not.toHaveBeenCalled();
  });

  it('uses a network-free deterministic transport outside production', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PARTNER_WEBHOOK_ADAPTER = 'deterministic';
    const client = createOutboundWebhookClient();

    expect(client).toBeInstanceOf(DeterministicOutboundWebhookClient);
    await expect(client.validateDestination('https://shop-hooks.local/orders')).resolves.toBe(
      undefined,
    );
    await expect(
      client.deliver({
        url: 'https://shop-hooks.local/orders',
        eventId: 'event-1',
        eventType: 'order.created',
        timestamp: new Date().toISOString(),
        signature: 'sha256=test',
        body: '{}',
      }),
    ).resolves.toBe(202);
    expect(lookup).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});

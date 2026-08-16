import { createHash, randomBytes, randomUUID, sign as cryptoSign } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { parseEnvironment } from '@logicommerce/config';
import { boundedJson } from '../platform/bounded-http.js';
import { verifyCoinbaseSignature, verifyStripeSignature } from './payment-signatures.js';

type SessionInput = {
  provider: 'STRIPE' | 'COINBASE' | 'MOCK';
  idempotencyKey: string;
  amountMinor: number;
  currency: string;
  invoiceId: string;
  invoiceNumber: string;
};

@Injectable()
export class PaymentProviderService {
  private readonly environment = parseEnvironment(process.env);

  constructor() {
    if (this.environment.NODE_ENV === 'production' && this.environment.PAYMENT_ADAPTER === 'mock') {
      throw new Error('PAYMENT_ADAPTER=mock is forbidden in production');
    }
  }

  async createSession(input: SessionInput) {
    if (input.provider === 'MOCK') {
      if (this.environment.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Mock payments are disabled');
      }
      const reference = `mock_${randomUUID()}`;
      return {
        reference,
        checkoutUrl: `${this.environment.PUBLIC_BASE_URL}/freight?mockPayment=${reference}`,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      };
    }
    if (!this.providerEnabled(input.provider)) {
      throw new ServiceUnavailableException(`${input.provider} is not configured`);
    }
    return input.provider === 'STRIPE'
      ? this.createStripeSession(input)
      : this.createCoinbaseSession(input);
  }

  async refund(input: {
    refundId: string;
    provider: string;
    providerReference: string;
    amountMinor: number;
    reason: string;
    idempotencyKey: string;
  }) {
    if (input.provider === 'MOCK') {
      return { reference: `mockrefund_${randomUUID()}`, status: 'COMPLETED' };
    }
    if (input.provider === 'STRIPE') {
      const key = this.environment.STRIPE_SECRET_KEY;
      if (!key) throw new ServiceUnavailableException('Stripe is not configured');
      const { response: sessionResponse, body: session } = await this.requestJson<{
        payment_intent?: string;
        error?: unknown;
      }>(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(input.providerReference)}`,
        { headers: { authorization: `Bearer ${key}` } },
      );
      if (
        !sessionResponse.ok ||
        typeof session.payment_intent !== 'string' ||
        !session.payment_intent
      ) {
        throw new BadGatewayException('Stripe payment could not be resolved');
      }
      const form = new URLSearchParams({
        payment_intent: session.payment_intent,
        amount: String(input.amountMinor),
        reason: 'requested_by_customer',
        'metadata[logicommerce_refund_id]': input.refundId,
      });
      const { response, body: result } = await this.requestJson<{
        id?: string;
        status?: string;
      }>('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/x-www-form-urlencoded',
          'idempotency-key': input.idempotencyKey,
        },
        body: form,
      });
      if (!response.ok || typeof result.id !== 'string' || !result.id) {
        throw new BadGatewayException('Stripe refund failed');
      }
      return {
        reference: result.id,
        status: result.status === 'succeeded' ? 'COMPLETED' : 'PENDING',
      };
    }
    const url = this.coinbaseUrl(
      `/checkouts/${encodeURIComponent(input.providerReference)}/refund`,
    );
    const token = this.coinbaseJwt('POST', url);
    const { response, body: result } = await this.requestJson<{
      refund?: { id?: string; status?: string };
    }>(url.toString(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-idempotency-key': this.coinbaseIdempotencyKey('refund', input.idempotencyKey),
      },
      body: JSON.stringify({
        amount: (input.amountMinor / 100).toFixed(2),
        currency: 'USDC',
        reason: input.reason,
      }),
    });
    if (!response.ok || typeof result.refund?.id !== 'string' || !result.refund.id) {
      throw new BadGatewayException('Coinbase refund failed');
    }
    return {
      reference: result.refund.id,
      status: result.refund.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
    };
  }

  verifyStripe(body: string, signature: string) {
    const secret = this.environment.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException('Stripe webhook is not configured');
    return verifyStripeSignature(body, signature, secret);
  }

  verifyCoinbase(body: string, signature: string, headers: Record<string, string>) {
    const secret = this.environment.COINBASE_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException('Coinbase webhook is not configured');
    return verifyCoinbaseSignature(body, signature, headers, secret);
  }

  private providerEnabled(provider: 'STRIPE' | 'COINBASE') {
    const adapter = this.environment.PAYMENT_ADAPTER;
    return adapter === 'multi' || adapter === provider.toLowerCase();
  }

  private async createStripeSession(input: SessionInput) {
    const key = this.environment.STRIPE_SECRET_KEY;
    if (!key) throw new ServiceUnavailableException('Stripe is not configured');
    const form = new URLSearchParams({
      mode: 'payment',
      success_url: `${this.environment.PUBLIC_BASE_URL}/freight?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.environment.PUBLIC_BASE_URL}/freight?payment=cancelled`,
      client_reference_id: input.invoiceId,
      'metadata[invoiceId]': input.invoiceId,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(input.amountMinor),
      'line_items[0][price_data][product_data][name]': `Invoice ${input.invoiceNumber}`,
    });
    const { response, body: result } = await this.requestJson<{
      id?: string;
      url?: string;
      expires_at?: number;
    }>('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': input.idempotencyKey,
      },
      body: form,
    });
    if (
      !response.ok ||
      typeof result.id !== 'string' ||
      !result.id ||
      !this.isHttpsUrl(result.url) ||
      (result.expires_at !== undefined &&
        (!Number.isSafeInteger(result.expires_at) || result.expires_at <= 0))
    ) {
      throw new BadGatewayException('Stripe checkout session creation failed');
    }
    return {
      reference: result.id,
      checkoutUrl: result.url,
      expiresAt: new Date((result.expires_at ?? Math.floor(Date.now() / 1000) + 1800) * 1000),
    };
  }

  private async createCoinbaseSession(input: SessionInput) {
    if (input.currency !== 'USD') {
      throw new BadRequestException(
        'Crypto checkout currently supports USD invoices settled as USDC',
      );
    }
    const url = this.coinbaseUrl('/checkouts');
    const token = this.coinbaseJwt('POST', url);
    const { response, body: result } = await this.requestJson<{
      id?: string;
      url?: string;
      expiresAt?: string;
    }>(url.toString(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-idempotency-key': this.coinbaseIdempotencyKey('checkout', input.idempotencyKey),
      },
      body: JSON.stringify({
        amount: (input.amountMinor / 100).toFixed(2),
        currency: 'USDC',
        description: `Invoice ${input.invoiceNumber}`,
        metadata: { invoiceId: input.invoiceId, invoiceNumber: input.invoiceNumber },
        successRedirectUrl: `${this.environment.PUBLIC_BASE_URL}/freight?payment=success`,
        failRedirectUrl: `${this.environment.PUBLIC_BASE_URL}/freight?payment=failed`,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    });
    if (
      !response.ok ||
      typeof result.id !== 'string' ||
      !result.id ||
      !this.isHttpsUrl(result.url) ||
      (result.expiresAt !== undefined && !this.isValidDate(result.expiresAt))
    ) {
      throw new BadGatewayException('Coinbase checkout session creation failed');
    }
    return {
      reference: result.id,
      checkoutUrl: result.url,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : new Date(Date.now() + 30 * 60_000),
    };
  }

  private coinbaseJwt(method: string, url: URL) {
    const keyId = this.environment.COINBASE_API_KEY_ID;
    const secret = this.environment.COINBASE_API_KEY_SECRET?.replaceAll('\\n', '\n');
    if (!keyId || !secret) throw new ServiceUnavailableException('Coinbase is not configured');
    const now = Math.floor(Date.now() / 1000);
    const encoded = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encoded({
      alg: 'ES256',
      kid: keyId,
      nonce: randomBytes(16).toString('hex'),
      typ: 'JWT',
    });
    const payload = encoded({
      sub: keyId,
      iss: 'cdp',
      nbf: now,
      exp: now + 120,
      uri: `${method} ${url.host}${url.pathname}`,
    });
    const unsigned = `${header}.${payload}`;
    const signature = cryptoSign('sha256', Buffer.from(unsigned), {
      key: secret,
      dsaEncoding: 'ieee-p1363',
    }).toString('base64url');
    return `${unsigned}.${signature}`;
  }

  private coinbaseUrl(path: string): URL {
    return new URL(`${this.environment.COINBASE_API_BASE_URL}${path}`);
  }

  private coinbaseIdempotencyKey(purpose: string, value: string): string {
    const bytes = createHash('sha256').update(`${purpose}:${value}`).digest().subarray(0, 16);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  private isHttpsUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }

  private isValidDate(value: unknown): value is string {
    return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
  }

  private async requestJson<T>(url: string, init: RequestInit) {
    return boundedJson<T>(url, init, {
      timeoutMs: this.environment.PROVIDER_HTTP_TIMEOUT_MS,
      maxResponseBytes: this.environment.PROVIDER_HTTP_MAX_RESPONSE_BYTES,
    });
  }
}

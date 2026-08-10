import { randomUUID } from 'node:crypto';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { parseEnvironment, type Environment } from '@logicommerce/config';
import { boundedJson } from '../platform/bounded-http.js';

export const MARKETPLACE_PAYMENT = Symbol('MARKETPLACE_PAYMENT');

export type HoldPaymentInput = {
  paymentToken: string;
  amountMinor: number;
  currency: string;
  tenantId: string;
  buyerUserId: string;
  listingId: string;
  idempotencyKey: string;
  expiresAt: Date;
};

export interface MarketplacePaymentPort {
  hold(input: HoldPaymentInput): Promise<{ provider: string; reference: string }>;
  release(reference: string, idempotencyKey: string): Promise<void>;
}

export class DeterministicMarketplacePaymentAdapter implements MarketplacePaymentPort {
  hold(input: HoldPaymentInput) {
    if (!input.paymentToken.startsWith('tok_')) {
      throw new BadRequestException('Marketplace payment hold failed');
    }
    return Promise.resolve({ provider: 'LOCAL', reference: `local-hold:${randomUUID()}` });
  }

  release(reference: string, idempotencyKey: string) {
    void reference;
    void idempotencyKey;
    return Promise.resolve();
  }
}

export class HttpMarketplacePaymentAdapter implements MarketplacePaymentPort {
  private readonly baseUrl: URL;

  constructor(private readonly environment: Environment) {
    if (!environment.C2C_PAYMENT_PROVIDER_URL || !environment.C2C_PAYMENT_PROVIDER_TOKEN) {
      throw new Error('The HTTP marketplace-payment provider is not completely configured');
    }
    this.baseUrl = new URL(environment.C2C_PAYMENT_PROVIDER_URL);
  }

  async hold(input: HoldPaymentInput) {
    const { response, body } = await boundedJson<{
      held?: unknown;
      provider?: unknown;
      reference?: unknown;
    }>(
      new URL('/v1/escrow/holds', this.baseUrl),
      {
        method: 'POST',
        headers: this.headers(input.idempotencyKey),
        body: JSON.stringify({ ...input, expiresAt: input.expiresAt.toISOString() }),
      },
      this.httpOptions(),
    );
    if (
      !response.ok ||
      body.held !== true ||
      typeof body.provider !== 'string' ||
      !body.provider ||
      typeof body.reference !== 'string' ||
      !body.reference
    ) {
      throw new BadRequestException('Marketplace payment hold failed');
    }
    return { provider: body.provider, reference: body.reference };
  }

  async release(reference: string, idempotencyKey: string) {
    const { response, body } = await boundedJson<{ released?: unknown }>(
      new URL('/v1/escrow/holds/release', this.baseUrl),
      {
        method: 'POST',
        headers: this.headers(`release:${idempotencyKey}`),
        body: JSON.stringify({ reference }),
      },
      this.httpOptions(),
    );
    if (!response.ok || body.released !== true) {
      throw new BadGatewayException('Marketplace payment release was not acknowledged');
    }
  }

  private headers(idempotencyKey: string) {
    return {
      authorization: `Bearer ${this.environment.C2C_PAYMENT_PROVIDER_TOKEN}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    };
  }

  private httpOptions() {
    return {
      timeoutMs: this.environment.PROVIDER_HTTP_TIMEOUT_MS,
      maxResponseBytes: this.environment.PROVIDER_HTTP_MAX_RESPONSE_BYTES,
    };
  }
}

export function createMarketplacePaymentAdapter(): MarketplacePaymentPort {
  const environment = parseEnvironment(process.env);
  return environment.C2C_PAYMENT_ADAPTER === 'http'
    ? new HttpMarketplacePaymentAdapter(environment)
    : new DeterministicMarketplacePaymentAdapter();
}

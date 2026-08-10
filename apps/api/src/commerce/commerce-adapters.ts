import { randomUUID } from 'node:crypto';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { parseEnvironment, type Environment } from '@logicommerce/config';
import { boundedJson } from '../platform/bounded-http.js';
import type { AddressDto } from './commerce.dto.js';

export const COMMERCE_ADAPTER = Symbol('COMMERCE_ADAPTER');

export type NormalizedAddress = AddressDto & {
  validatedBy: 'deterministic-local-v1' | 'external-provider-v1';
};

export interface AddressValidationPort {
  validate(address: AddressDto): Promise<NormalizedAddress>;
}

export interface TaxQuotePort {
  quoteTax(taxableMinor: number, address: NormalizedAddress): Promise<number>;
}

export interface ShippingQuotePort {
  quoteShipping(splitCount: number, address: NormalizedAddress): Promise<number>;
}

export interface FraudDecisionPort {
  assess(input: { totalMinor: number; userId: string }): Promise<'APPROVED' | 'REJECTED'>;
}

export interface PaymentPort {
  authorize(input: {
    paymentToken: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ reference: string }>;
  void(reference: string): Promise<void>;
}

export type CommerceAdapter = AddressValidationPort &
  TaxQuotePort &
  ShippingQuotePort &
  FraudDecisionPort &
  PaymentPort;

export class DeterministicCommerceAdapter implements CommerceAdapter {
  validate(address: AddressDto): Promise<NormalizedAddress> {
    const postalCode = address.postalCode.trim().toUpperCase();
    if (postalCode.length < 2) throw new BadRequestException('Address validation failed');
    return Promise.resolve({
      ...address,
      recipient: address.recipient.trim(),
      line1: address.line1.trim(),
      city: address.city.trim(),
      postalCode,
      countryCode: address.countryCode.toUpperCase(),
      validatedBy: 'deterministic-local-v1',
    });
  }

  quoteTax(value: number, address: NormalizedAddress): Promise<number> {
    void address;
    return Promise.resolve(Math.round(value * 0.1));
  }

  quoteShipping(splitCount: number, address: NormalizedAddress): Promise<number> {
    void address;
    return Promise.resolve(Math.max(1, splitCount) * 700);
  }

  assess(input: { totalMinor: number; userId: string }): Promise<'APPROVED' | 'REJECTED'> {
    return Promise.resolve(input.totalMinor <= 5_000_000 ? 'APPROVED' : 'REJECTED');
  }

  authorize(input: {
    paymentToken: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ reference: string }> {
    if (!input.paymentToken.startsWith('tok_')) {
      throw new BadRequestException('Payment authorization failed');
    }
    return Promise.resolve({ reference: `mockpay_${randomUUID()}` });
  }

  void(reference: string): Promise<void> {
    void reference;
    return Promise.resolve();
  }
}

type ProviderResponse = Record<string, unknown>;

export class HttpCommerceAdapter implements CommerceAdapter {
  private readonly baseUrl: URL;

  constructor(private readonly environment: Environment) {
    if (!environment.COMMERCE_PROVIDER_URL || !environment.COMMERCE_PROVIDER_TOKEN) {
      throw new Error('The HTTP commerce provider is not completely configured');
    }
    this.baseUrl = new URL(environment.COMMERCE_PROVIDER_URL);
  }

  async validate(address: AddressDto): Promise<NormalizedAddress> {
    const body = await this.post('/v1/address/validate', { address });
    const candidate = body.address;
    if (!candidate || typeof candidate !== 'object') {
      throw new BadGatewayException('Commerce provider returned an invalid address');
    }
    const normalized = candidate as Partial<AddressDto>;
    if (
      !normalized.recipient ||
      !normalized.line1 ||
      !normalized.city ||
      !normalized.postalCode ||
      !normalized.countryCode
    ) {
      throw new BadGatewayException('Commerce provider returned an incomplete address');
    }
    return { ...address, ...normalized, validatedBy: 'external-provider-v1' };
  }

  async quoteTax(taxableMinor: number, address: NormalizedAddress): Promise<number> {
    const body = await this.post('/v1/tax/quote', { taxableMinor, address });
    if (!Number.isSafeInteger(body.amountMinor) || Number(body.amountMinor) < 0) {
      throw new BadGatewayException('Commerce provider returned an invalid tax quote');
    }
    return Number(body.amountMinor);
  }

  async quoteShipping(splitCount: number, address: NormalizedAddress): Promise<number> {
    const body = await this.post('/v1/shipping/quote', { splitCount, address });
    if (!Number.isSafeInteger(body.amountMinor) || Number(body.amountMinor) < 0) {
      throw new BadGatewayException('Commerce provider returned an invalid shipping quote');
    }
    return Number(body.amountMinor);
  }

  async assess(input: { totalMinor: number; userId: string }): Promise<'APPROVED' | 'REJECTED'> {
    const body = await this.post('/v1/fraud/assess', input);
    if (body.decision !== 'APPROVED' && body.decision !== 'REJECTED') {
      throw new BadGatewayException('Commerce provider returned an invalid fraud decision');
    }
    return body.decision;
  }

  async authorize(input: {
    paymentToken: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ reference: string }> {
    const body = await this.post('/v1/payments/authorize', input, input.idempotencyKey);
    if (body.authorized !== true || typeof body.reference !== 'string' || !body.reference) {
      throw new BadRequestException('Payment authorization failed');
    }
    return { reference: body.reference };
  }

  async void(reference: string): Promise<void> {
    const body = await this.post('/v1/payments/void', { reference }, `void:${reference}`);
    if (body.voided !== true) throw new BadGatewayException('Payment void was not acknowledged');
  }

  private async post(path: string, payload: unknown, idempotencyKey?: string) {
    const url = new URL(path, this.baseUrl);
    const { response, body } = await boundedJson<ProviderResponse>(
      url,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.environment.COMMERCE_PROVIDER_TOKEN}`,
          'content-type': 'application/json',
          ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        },
        body: JSON.stringify(payload),
      },
      {
        timeoutMs: this.environment.PROVIDER_HTTP_TIMEOUT_MS,
        maxResponseBytes: this.environment.PROVIDER_HTTP_MAX_RESPONSE_BYTES,
      },
    );
    if (!response.ok) throw new BadGatewayException('Commerce provider request failed');
    return body;
  }
}

export function createCommerceAdapter(): CommerceAdapter {
  const environment = parseEnvironment(process.env);
  return environment.COMMERCE_ADAPTER === 'http'
    ? new HttpCommerceAdapter(environment)
    : new DeterministicCommerceAdapter();
}

import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { AddressDto } from './commerce.dto.js';

export type NormalizedAddress = AddressDto & { validatedBy: 'deterministic-local-v1' };

export interface AddressValidationPort {
  validate(address: AddressDto): Promise<NormalizedAddress>;
}

export interface TaxQuotePort {
  quote(taxableMinor: number, address: NormalizedAddress): Promise<number>;
}

export interface ShippingQuotePort {
  quote(splitCount: number, address: NormalizedAddress): Promise<number>;
}

export interface FraudDecisionPort {
  assess(input: { totalMinor: number; userId: string }): Promise<'APPROVED' | 'REJECTED'>;
}

export interface PaymentPort {
  authorize(input: {
    paymentToken: string;
    amountMinor: number;
    currency: string;
  }): Promise<{ reference: string }>;
  void(reference: string): Promise<void>;
}

@Injectable()
export class DeterministicAddressAdapter implements AddressValidationPort {
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
}

@Injectable()
export class DeterministicTaxAdapter implements TaxQuotePort {
  quote(taxableMinor: number, address: NormalizedAddress): Promise<number> {
    void address;
    return Promise.resolve(Math.round(taxableMinor * 0.1));
  }
}

@Injectable()
export class DeterministicShippingAdapter implements ShippingQuotePort {
  quote(splitCount: number, address: NormalizedAddress): Promise<number> {
    void address;
    return Promise.resolve(Math.max(1, splitCount) * 700);
  }
}

@Injectable()
export class DeterministicFraudAdapter implements FraudDecisionPort {
  assess(input: { totalMinor: number; userId: string }): Promise<'APPROVED' | 'REJECTED'> {
    return Promise.resolve(input.totalMinor <= 5_000_000 ? 'APPROVED' : 'REJECTED');
  }
}

@Injectable()
export class DeterministicPaymentAdapter implements PaymentPort {
  authorize(input: {
    paymentToken: string;
    amountMinor: number;
    currency: string;
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

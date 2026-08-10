import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { parseEnvironment } from '@logicommerce/config';
import { boundedJson } from '../platform/bounded-http.js';

export const CARRIER_ADAPTER = Symbol('CARRIER_ADAPTER');

export interface CarrierLabelInput {
  shipmentId: string;
  tenantId: string;
  carrierKey: string;
  serviceLevel: string;
  weightGrams: number;
}

export interface CarrierLabel {
  trackingNumber: string;
  labelUrl: string;
  rateMinor: number;
}

export interface CarrierPort {
  createLabel(input: CarrierLabelInput): Promise<CarrierLabel>;
}

@Injectable()
export class DeterministicCarrierAdapter implements CarrierPort {
  createLabel(input: CarrierLabelInput): Promise<CarrierLabel> {
    const token = createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 18);
    return Promise.resolve({
      trackingNumber: `LC${token.toUpperCase()}`,
      labelUrl: `https://labels.local/${input.carrierKey}/${token}.pdf`,
      rateMinor: 500 + Math.ceil(input.weightGrams / 500) * 125,
    });
  }
}

@Injectable()
export class HttpCarrierAdapter implements CarrierPort {
  private readonly environment = parseEnvironment(process.env);

  async createLabel(input: CarrierLabelInput): Promise<CarrierLabel> {
    const { response, body } = await boundedJson<CarrierLabel>(
      new URL('/v1/labels', this.environment.CARRIER_PROVIDER_URL),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.environment.CARRIER_PROVIDER_TOKEN}`,
          'content-type': 'application/json',
          'idempotency-key': input.shipmentId,
        },
        body: JSON.stringify(input),
      },
      {
        timeoutMs: this.environment.PROVIDER_HTTP_TIMEOUT_MS,
        maxResponseBytes: this.environment.PROVIDER_HTTP_MAX_RESPONSE_BYTES,
      },
    );
    if (!response.ok) throw new Error(`Carrier provider rejected label (${response.status})`);
    if (
      !body.trackingNumber ||
      !body.labelUrl?.startsWith('https://') ||
      !Number.isSafeInteger(body.rateMinor) ||
      body.rateMinor < 0
    ) {
      throw new Error('Carrier provider returned an invalid label');
    }
    return body;
  }
}

export function createCarrierAdapter(): CarrierPort {
  const environment = parseEnvironment(process.env);
  return environment.CARRIER_ADAPTER === 'http'
    ? new HttpCarrierAdapter()
    : new DeterministicCarrierAdapter();
}

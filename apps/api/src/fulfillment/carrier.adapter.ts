import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeterministicCarrierAdapter {
  createLabel(input: {
    shipmentId: string;
    carrierKey: string;
    serviceLevel: string;
    weightGrams: number;
  }) {
    const token = createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 18);
    return {
      trackingNumber: `LC${token.toUpperCase()}`,
      labelUrl: `https://labels.local/${input.carrierKey}/${token}.pdf`,
      rateMinor: 500 + Math.ceil(input.weightGrams / 500) * 125,
    };
  }
}

import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { CARRIER_ADAPTER, createCarrierAdapter } from './carrier.adapter.js';
import { FulfillmentController, TrackingController } from './fulfillment.controller.js';
import { FulfillmentRepository } from './fulfillment.repository.js';

@Module({
  imports: [TenantContextModule],
  controllers: [FulfillmentController, TrackingController],
  providers: [
    FulfillmentRepository,
    { provide: CARRIER_ADAPTER, useFactory: createCarrierAdapter },
  ],
})
export class FulfillmentModule {}

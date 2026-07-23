import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { DeterministicCarrierAdapter } from './carrier.adapter.js';
import { FulfillmentController, TrackingController } from './fulfillment.controller.js';
import { FulfillmentRepository } from './fulfillment.repository.js';

@Module({
  imports: [TenantContextModule],
  controllers: [FulfillmentController, TrackingController],
  providers: [FulfillmentRepository, DeterministicCarrierAdapter],
})
export class FulfillmentModule {}

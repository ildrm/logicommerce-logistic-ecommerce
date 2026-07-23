import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import {
  DeterministicAddressAdapter,
  DeterministicFraudAdapter,
  DeterministicPaymentAdapter,
  DeterministicShippingAdapter,
  DeterministicTaxAdapter,
} from './commerce-adapters.js';
import { CommerceController } from './commerce.controller.js';
import { CommerceRepository } from './commerce.repository.js';
import { CommerceService } from './commerce.service.js';

@Module({
  imports: [TenantContextModule],
  controllers: [CommerceController],
  providers: [
    CommerceRepository,
    CommerceService,
    DeterministicAddressAdapter,
    DeterministicTaxAdapter,
    DeterministicShippingAdapter,
    DeterministicFraudAdapter,
    DeterministicPaymentAdapter,
  ],
})
export class CommerceModule {}

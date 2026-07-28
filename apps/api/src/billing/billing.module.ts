import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import {
  BillingController,
  BillingOperationsController,
  PaymentWebhookController,
} from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { PaymentProviderService } from './payment-provider.service.js';

@Module({
  imports: [TenantContextModule],
  controllers: [BillingController, BillingOperationsController, PaymentWebhookController],
  providers: [BillingService, PaymentProviderService],
  exports: [BillingService],
})
export class BillingModule {}

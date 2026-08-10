import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { C2CController, C2CPublicController } from './c2c.controller.js';
import { C2CRepository } from './c2c.repository.js';
import { C2CPaymentReleaseScheduler } from './c2c-payment-release.scheduler.js';
import {
  IDENTITY_VERIFICATION,
  createIdentityVerificationAdapter,
} from './identity-verification.adapter.js';
import {
  MARKETPLACE_PAYMENT,
  createMarketplacePaymentAdapter,
} from './marketplace-payment.adapter.js';

@Module({
  imports: [TenantContextModule],
  controllers: [C2CPublicController, C2CController],
  providers: [
    C2CRepository,
    C2CPaymentReleaseScheduler,
    { provide: IDENTITY_VERIFICATION, useFactory: createIdentityVerificationAdapter },
    { provide: MARKETPLACE_PAYMENT, useFactory: createMarketplacePaymentAdapter },
  ],
})
export class C2CModule {}

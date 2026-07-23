import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { PartnerAuthGuard } from './partner-auth.guard.js';
import {
  PartnerAdminController,
  PartnerWebhookController,
  ShopApiController,
} from './partner.controller.js';
import { PartnerRepository } from './partner.repository.js';
import { WebhookCryptoService } from './webhook-crypto.service.js';

@Module({
  imports: [TenantContextModule, IdentityModule],
  controllers: [PartnerAdminController, ShopApiController, PartnerWebhookController],
  providers: [PartnerRepository, PartnerAuthGuard, WebhookCryptoService],
})
export class PartnerModule {}

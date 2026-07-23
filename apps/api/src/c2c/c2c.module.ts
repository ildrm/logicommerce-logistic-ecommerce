import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { C2CController, C2CPublicController } from './c2c.controller.js';
import { C2CRepository } from './c2c.repository.js';
import { DeterministicIdentityVerificationAdapter } from './identity-verification.adapter.js';

@Module({
  imports: [TenantContextModule],
  controllers: [C2CPublicController, C2CController],
  providers: [C2CRepository, DeterministicIdentityVerificationAdapter],
})
export class C2CModule {}

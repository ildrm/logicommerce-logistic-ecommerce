import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { COMMERCE_ADAPTER, createCommerceAdapter } from './commerce-adapters.js';
import { CommerceController } from './commerce.controller.js';
import { CommerceRepository } from './commerce.repository.js';
import { CommerceService } from './commerce.service.js';

@Module({
  imports: [TenantContextModule],
  controllers: [CommerceController],
  providers: [
    CommerceRepository,
    CommerceService,
    { provide: COMMERCE_ADAPTER, useFactory: createCommerceAdapter },
  ],
})
export class CommerceModule {}

import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { B2BController } from './b2b.controller.js';
import { B2BRepository } from './b2b.repository.js';

@Module({
  imports: [TenantContextModule],
  controllers: [B2BController],
  providers: [B2BRepository],
})
export class B2BModule {}

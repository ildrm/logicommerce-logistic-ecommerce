import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { NetworkOperationsController } from './network-operations.controller.js';
import { NetworkOperationsRepository } from './network-operations.repository.js';

@Module({
  imports: [TenantContextModule],
  controllers: [NetworkOperationsController],
  providers: [NetworkOperationsRepository],
})
export class NetworkOperationsModule {}

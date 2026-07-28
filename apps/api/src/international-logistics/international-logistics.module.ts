import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import {
  InsuranceController,
  InsuranceOperationsController,
  InternationalLogisticsController,
  LogisticsNetworkController,
  PostalController,
  PostalOperationsController,
} from './international-logistics.controller.js';
import { InternationalLogisticsRepository } from './international-logistics.repository.js';

@Module({
  imports: [TenantContextModule],
  controllers: [
    InternationalLogisticsController,
    InsuranceController,
    InsuranceOperationsController,
    LogisticsNetworkController,
    PostalController,
    PostalOperationsController,
  ],
  providers: [InternationalLogisticsRepository],
})
export class InternationalLogisticsModule {}

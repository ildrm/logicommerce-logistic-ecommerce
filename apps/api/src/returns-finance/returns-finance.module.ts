import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { ReturnsFinanceController } from './returns-finance.controller.js';
import { ReturnsFinanceRepository } from './returns-finance.repository.js';

@Module({
  imports: [TenantContextModule],
  controllers: [ReturnsFinanceController],
  providers: [ReturnsFinanceRepository],
})
export class ReturnsFinanceModule {}

import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { DeterministicOptimizerService } from './deterministic-optimizer.service.js';
import { OptimizationController } from './optimization.controller.js';
import { OptimizationRepository } from './optimization.repository.js';

@Module({
  imports: [TenantContextModule],
  controllers: [OptimizationController],
  providers: [OptimizationRepository, DeterministicOptimizerService],
})
export class OptimizationModule {}

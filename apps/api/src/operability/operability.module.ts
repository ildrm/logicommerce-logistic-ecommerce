import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { OperabilityController } from './operability.controller.js';
import { OperabilityRepository } from './operability.repository.js';
import { RequestMetricsInterceptor } from './request-metrics.interceptor.js';
import { RequestMetricsService } from './request-metrics.service.js';

@Module({
  imports: [TenantContextModule],
  controllers: [OperabilityController],
  providers: [
    OperabilityRepository,
    RequestMetricsService,
    { provide: APP_INTERCEPTOR, useClass: RequestMetricsInterceptor },
  ],
})
export class OperabilityModule {}

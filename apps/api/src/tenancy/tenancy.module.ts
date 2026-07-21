import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { TenantContextMiddleware } from './tenant-context.middleware.js';
import { TenantContextService } from './tenant-context.service.js';
import { TenantRepository } from './tenant.repository.js';
import { TenancyController } from './tenancy.controller.js';
import { TenancyService } from './tenancy.service.js';

@Module({
  controllers: [TenancyController],
  providers: [TenantContextMiddleware, TenantContextService, TenantRepository, TenancyService],
  exports: [TenantContextService],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('{*path}');
  }
}

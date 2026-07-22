import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TenantContextModule } from './tenant-context.module.js';
import { TenantContextMiddleware } from './tenant-context.middleware.js';
import { TenantResolver } from './tenant-resolver.js';
import { TenantRepository } from './tenant.repository.js';
import { TenancyController } from './tenancy.controller.js';
import { TenancyService } from './tenancy.service.js';

@Module({
  imports: [TenantContextModule, AuthModule],
  controllers: [TenancyController],
  providers: [TenantContextMiddleware, TenantResolver, TenantRepository, TenancyService],
  exports: [TenantResolver],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('{*path}');
  }
}

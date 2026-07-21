import { MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { TenantContextMiddleware } from './tenancy/tenant-context.middleware.js';
import { TenancyModule } from './tenancy/tenancy.module.js';

@Module({ imports: [DatabaseModule, HealthModule, TenancyModule] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: 'api/v1/{*path}', method: RequestMethod.ALL });
  }
}

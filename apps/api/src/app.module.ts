import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';

@Module({ imports: [DatabaseModule, HealthModule, TenancyModule, AuthModule] })
export class AppModule {}

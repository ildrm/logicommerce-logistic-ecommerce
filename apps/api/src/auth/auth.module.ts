import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AUTH_OPTIONS, loadAuthOptions } from './auth.config.js';
import { AuthRepository } from './auth.repository.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { AuthService } from './auth.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { AUTH_STORE } from './auth.types.js';
import { PasswordService } from './password.service.js';
import { PermissionGuard } from './permission.guard.js';

@Global()
@Module({
  imports: [TenantContextModule, RedisModule],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_OPTIONS, useFactory: loadAuthOptions },
    AuthRepository,
    { provide: AUTH_STORE, useExisting: AuthRepository },
    AuthTokenService,
    AuthRateLimitService,
    PasswordService,
    AuthService,
    AuthGuard,
    PermissionGuard,
  ],
  exports: [AuthGuard, PermissionGuard, AuthTokenService, AUTH_STORE],
})
export class AuthModule {}

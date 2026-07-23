import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { IDENTITY_PROVIDERS } from './identity-provider.port.js';
import { MachineAuthGuard } from './machine-auth.guard.js';
import { MachineIdentityController } from './machine-identity.controller.js';
import { MachineScopeGuard } from './machine-scope.guard.js';

@Module({
  imports: [AuthModule, TenantContextModule],
  controllers: [IdentityController, MachineIdentityController],
  providers: [
    IdentityService,
    MachineAuthGuard,
    MachineScopeGuard,
    { provide: IDENTITY_PROVIDERS, useValue: [] },
  ],
  exports: [IdentityService, MachineAuthGuard, MachineScopeGuard, IDENTITY_PROVIDERS],
})
export class IdentityModule {}

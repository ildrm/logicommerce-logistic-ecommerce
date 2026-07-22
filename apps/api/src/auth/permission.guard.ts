import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import { AUTH_STORE, type AuthStore } from './auth.types.js';
import { REQUIRED_PERMISSIONS } from './require-permissions.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_STORE) private readonly store: AuthStore,
    private readonly contexts: TenantContextService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<readonly string[]>(REQUIRED_PERMISSIONS, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);
    const request = executionContext.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.auth;
    const missing = required?.filter((permission) => !principal?.permissions.includes(permission));
    if (!principal || !required?.length || missing?.length) {
      const context = this.contexts.get();
      await this.store.recordAudit(context, {
        action: 'auth.permission.denied',
        entityId: context.tenantId,
        ...(principal ? { actorId: principal.userId } : {}),
        reason: missing?.join(',') || 'PERMISSION_DECLARATION_REQUIRED',
      });
      throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}

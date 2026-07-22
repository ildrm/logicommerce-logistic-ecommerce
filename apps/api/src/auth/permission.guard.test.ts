import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { PermissionGuard } from './permission.guard.js';
import type { AuthStore } from './auth.types.js';

const principal = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  sessionId: 'session-a',
  roles: ['tenant-admin'],
  permissions: ['tenant.configure'],
};

describe('PermissionGuard', () => {
  let recordAudit: ReturnType<typeof vi.fn<AuthStore['recordAudit']>>;
  let contexts: TenantContextService;

  beforeEach(() => {
    recordAudit = vi.fn<AuthStore['recordAudit']>();
    contexts = new TenantContextService();
  });

  it('allows a principal with every declared permission', async () => {
    const guard = new PermissionGuard(
      { getAllAndOverride: vi.fn().mockReturnValue(['tenant.configure']) } as unknown as Reflector,
      { recordAudit } as unknown as AuthStore,
      contexts,
    );
    await contexts.run(
      { tenantId: 'tenant-a', actorId: 'user-a', correlationId: 'request-a' },
      async () => {
        await expect(guard.canActivate(execution(principal))).resolves.toBe(true);
      },
    );
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it('audits and denies a missing permission', async () => {
    const guard = new PermissionGuard(
      { getAllAndOverride: vi.fn().mockReturnValue(['audit.read']) } as unknown as Reflector,
      { recordAudit } as unknown as AuthStore,
      contexts,
    );
    await contexts.run(
      { tenantId: 'tenant-a', actorId: 'user-a', correlationId: 'request-a' },
      async () => {
        await expect(guard.canActivate(execution(principal))).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' }),
      expect.objectContaining({
        action: 'auth.permission.denied',
        actorId: 'user-a',
        reason: 'audit.read',
      }),
    );
  });
});

function execution(auth: typeof principal): ExecutionContext {
  return {
    getHandler: () => execution,
    getClass: () => PermissionGuard,
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  } as unknown as ExecutionContext;
}

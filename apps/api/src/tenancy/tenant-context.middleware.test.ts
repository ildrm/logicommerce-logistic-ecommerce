import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantContextMiddleware } from './tenant-context.middleware.js';
import { TenantContextService } from './tenant-context.service.js';
import type { TenantResolver } from './tenant-resolver.js';

const tenantA = '00000000-0000-4000-8000-000000000001';
const tenantB = '00000000-0000-4000-8000-000000000009';
const originalEnvironment = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnvironment;
});

describe('TenantContextMiddleware', () => {
  it('does not require tenant resolution for health probes', async () => {
    process.env.NODE_ENV = 'production';
    const resolveVerifiedHostname = vi.fn();
    const contexts = new TenantContextService();
    const middleware = new TenantContextMiddleware(contexts, {
      resolveVerifiedHostname,
    } as unknown as TenantResolver);
    const healthRequest = request('127.0.0.1');
    (healthRequest as IncomingMessage & { originalUrl?: string }).originalUrl =
      '/api/v1/health/live';
    const next = vi.fn();

    await middleware.use(healthRequest, {} as ServerResponse, next);

    expect(next).toHaveBeenCalledOnce();
    expect(resolveVerifiedHostname).not.toHaveBeenCalled();
  });

  it('resolves a verified hostname when no development bridge is supplied', async () => {
    process.env.NODE_ENV = 'production';
    const resolveVerifiedHostname = vi.fn().mockResolvedValue(tenantA);
    const contexts = new TenantContextService();
    const middleware = new TenantContextMiddleware(contexts, {
      resolveVerifiedHostname,
    } as unknown as TenantResolver);
    let resolved: string | undefined;

    await middleware.use(request('shop.example.com'), {} as ServerResponse, () => {
      resolved = contexts.get().tenantId;
    });

    expect(resolveVerifiedHostname).toHaveBeenCalledWith('shop.example.com');
    expect(resolved).toBe(tenantA);
  });

  it('ignores an untrusted tenant header in production', async () => {
    process.env.NODE_ENV = 'production';
    const contexts = new TenantContextService();
    const middleware = new TenantContextMiddleware(contexts, {
      resolveVerifiedHostname: vi.fn().mockResolvedValue(tenantA),
    } as unknown as TenantResolver);
    let resolved: string | undefined;

    await middleware.use(request('shop.example.com', tenantB), {} as ServerResponse, () => {
      resolved = contexts.get().tenantId;
    });

    expect(resolved).toBe(tenantA);
  });

  it('retains the explicit tenant header only as a development bridge', async () => {
    process.env.NODE_ENV = 'development';
    const resolveVerifiedHostname = vi.fn();
    const contexts = new TenantContextService();
    const middleware = new TenantContextMiddleware(contexts, {
      resolveVerifiedHostname,
    } as unknown as TenantResolver);
    let resolved: string | undefined;

    await middleware.use(request('localhost', tenantB), {} as ServerResponse, () => {
      resolved = contexts.get().tenantId;
    });

    expect(resolveVerifiedHostname).not.toHaveBeenCalled();
    expect(resolved).toBe(tenantB);
  });
});

function request(hostname: string, tenantId?: string): IncomingMessage {
  return {
    headers: {
      host: hostname,
      'x-request-id': '00000000-0000-4000-8000-000000000099',
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    },
  } as unknown as IncomingMessage;
}

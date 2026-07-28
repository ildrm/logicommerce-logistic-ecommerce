import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Injectable, UnauthorizedException, type NestMiddleware } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service.js';
import { TenantResolver } from './tenant-resolver.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private readonly contexts: TenantContextService,
    private readonly tenants: TenantResolver,
  ) {}

  async use(request: IncomingMessage, _reply: ServerResponse, next: () => void): Promise<void> {
    const originalUrl = (request as IncomingMessage & { originalUrl?: string }).originalUrl;
    if (this.isInfrastructurePath(originalUrl ?? request.url)) {
      next();
      return;
    }
    const supplied = request.headers['x-tenant-id']?.toString();
    const developmentBridge = process.env.NODE_ENV !== 'production' ? supplied : undefined;
    if (developmentBridge && !UUID_PATTERN.test(developmentBridge)) {
      throw new UnauthorizedException('A verified tenant context is required');
    }
    const tenantId =
      developmentBridge ?? (await this.tenants.resolveVerifiedHostname(this.hostname(request)));
    if (!tenantId || !UUID_PATTERN.test(tenantId)) {
      throw new UnauthorizedException('A verified tenant context is required');
    }
    const requestId = request.headers['x-request-id']?.toString() ?? randomUUID();
    this.contexts.run({ tenantId, actorId: null, correlationId: requestId }, next);
  }

  private hostname(request: IncomingMessage): string {
    const forwardedHost = request.headers['x-forwarded-host'];
    const authority =
      (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',', 1)[0]?.trim() ??
      request.headers.host;
    if (!authority) return '';
    if (authority.startsWith('[')) return authority.slice(1, authority.indexOf(']'));
    return authority.split(':', 1)[0] ?? '';
  }

  private isInfrastructurePath(url: string | undefined): boolean {
    return (
      /^\/(?:api\/)?(?:v\d+\/)?health(?:\/|$)/u.test(url ?? '') ||
      url?.startsWith('/api/docs') === true ||
      /^\/api\/v\d+\/payments\/webhooks(?:\/|$)/u.test(url ?? '')
    );
  }
}

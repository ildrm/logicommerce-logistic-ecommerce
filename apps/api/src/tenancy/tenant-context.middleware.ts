import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException, type NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { TenantContextService } from './tenant-context.service.js';

const DEMO_TENANT_ID = '00000000-0000-4000-8000-000000000001';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly contexts: TenantContextService) {}

  use(request: FastifyRequest, _reply: FastifyReply, next: () => void): void {
    const supplied = request.headers['x-tenant-id']?.toString();
    const tenantId =
      supplied ?? (process.env.NODE_ENV === 'development' ? DEMO_TENANT_ID : undefined);
    if (!tenantId || !UUID_PATTERN.test(tenantId)) {
      throw new UnauthorizedException('A verified tenant context is required');
    }
    const requestId = request.headers['x-request-id']?.toString() ?? randomUUID();
    this.contexts.run({ tenantId, actorId: null, correlationId: requestId }, next);
  }
}

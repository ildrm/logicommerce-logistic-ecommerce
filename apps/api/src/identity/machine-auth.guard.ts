import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { DatabaseClient } from '@logicommerce/database';
import { Inject } from '@nestjs/common';
import { DATABASE } from '../database/database.module.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { IdentityService } from './identity.service.js';

export type MachinePrincipal = {
  readonly credentialId: string;
  readonly tenantId: string;
  readonly scopes: readonly string[];
};

export type MachineRequest = FastifyRequest & { machine?: MachinePrincipal };

@Injectable()
export class MachineAuthGuard implements CanActivate {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly contexts: TenantContextService,
    private readonly identity: IdentityService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext.switchToHttp().getRequest<MachineRequest>();
    const secret = request.headers['x-api-key']?.toString();
    const [prefix] = secret?.split('.', 1) ?? [];
    if (!secret || !prefix) throw new UnauthorizedException('Machine authentication is required');
    const tenantId = this.contexts.get().tenantId;
    const credential = await this.database.apiCredential.findFirst({
      where: {
        tenantId,
        keyPrefix: prefix,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, secretHash: true, scopes: true },
    });
    const candidate = this.identity.credentialHash(secret);
    if (!credential || !this.same(candidate, credential.secretHash)) {
      throw new UnauthorizedException('Invalid machine credential');
    }
    const scopes = Array.isArray(credential.scopes)
      ? credential.scopes.filter((scope): scope is string => typeof scope === 'string')
      : [];
    request.machine = { credentialId: credential.id, tenantId, scopes };
    await this.database.apiCredential.updateMany({
      where: { id: credential.id, tenantId },
      data: { lastUsedAt: new Date() },
    });
    return true;
  }

  private same(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}

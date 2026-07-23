import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { DatabaseClient } from '@logicommerce/database';
import { DATABASE } from '../database/database.module.js';
import { IdentityService } from '../identity/identity.service.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { PARTNER_SCOPES } from './partner-scope.decorator.js';

export type PartnerPrincipal = {
  credentialId: string;
  tenantId: string;
  partnerKind: 'SELLER' | 'SUPPLIER' | 'SHOP';
  partnerId: string;
  scopes: string[];
};
export type PartnerRequest = FastifyRequest & { partner?: PartnerPrincipal };

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  private readonly windows = new Map<string, { minute: number; count: number }>();

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly contexts: TenantContextService,
    private readonly identity: IdentityService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<PartnerRequest>();
    const secret = request.headers['x-partner-api-key']?.toString();
    const [prefix] = secret?.split('.', 1) ?? [];
    if (!secret || !prefix) throw new UnauthorizedException('Partner authentication is required');
    const tenantId = this.contexts.get().tenantId;
    const credential = await this.db.partnerApiCredential.findFirst({
      where: {
        tenantId,
        keyPrefix: prefix,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    const candidate = this.identity.credentialHash(secret);
    if (!credential || !this.same(candidate, credential.secretHash)) {
      throw new UnauthorizedException('Invalid partner credential');
    }
    const remote = request.ip;
    const allowed = Array.isArray(credential.ipPolicy)
      ? credential.ipPolicy.filter((value): value is string => typeof value === 'string')
      : [];
    if (allowed.length > 0 && !allowed.includes(remote))
      throw new ForbiddenException('IP policy denied');
    this.consumeRate(credential.id, credential.rateLimitPerMinute);
    const scopes = Array.isArray(credential.scopes)
      ? credential.scopes.filter((value): value is string => typeof value === 'string')
      : [];
    const required =
      this.reflector.getAllAndOverride<string[]>(PARTNER_SCOPES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.some((scope) => !scopes.includes(scope)))
      throw new ForbiddenException('Partner scope denied');
    request.partner = {
      credentialId: credential.id,
      tenantId,
      partnerKind: credential.partnerKind,
      partnerId: credential.partnerId,
      scopes,
    };
    await this.db.partnerApiCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });
    return true;
  }

  private consumeRate(id: string, limit: number) {
    const minute = Math.floor(Date.now() / 60_000);
    const current = this.windows.get(id);
    const next =
      !current || current.minute !== minute
        ? { minute, count: 1 }
        : { minute, count: current.count + 1 };
    this.windows.set(id, next);
    if (next.count > limit) throw new ForbiddenException('Partner rate limit exceeded');
  }

  private same(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

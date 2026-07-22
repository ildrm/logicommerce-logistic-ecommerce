import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { AUTH_STORE, type AuthPrincipal, type AuthStore } from './auth.types.js';

export type AuthenticatedRequest = FastifyRequest & { auth?: AuthPrincipal };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: AuthTokenService,
    @Inject(AUTH_STORE) private readonly store: AuthStore,
    private readonly contexts: TenantContextService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer authentication is required');
    }
    const principal = this.tokens.verifyAccessToken(authorization.slice(7));
    if (principal.tenantId !== this.contexts.get().tenantId) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (!(await this.store.isSessionActive(principal, new Date()))) {
      throw new UnauthorizedException('Session is no longer active');
    }
    request.auth = principal;
    this.contexts.setActor(principal.userId);
    return true;
  }
}

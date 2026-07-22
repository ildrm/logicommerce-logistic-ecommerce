import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type {
  AuthSession,
  AuthenticationResult,
  AuthenticatedUser,
} from '@logicommerce/api-contracts';
import type { TenantContext } from '@logicommerce/database';
import { AuthTokenService } from './auth-token.service.js';
import {
  AUTH_STORE,
  type AuthPrincipal,
  type AuthStore,
  type SessionMetadata,
} from './auth.types.js';
import { PasswordService } from './password.service.js';

export type LoginInput = { readonly email: string; readonly password: string };
export type IssuedAuthentication = AuthenticationResult & { readonly refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_STORE) private readonly store: AuthStore,
    private readonly passwords: PasswordService,
    private readonly tokens: AuthTokenService,
  ) {}

  async login(
    context: TenantContext,
    input: LoginInput,
    metadata: { readonly userAgent?: string; readonly ip?: string },
  ): Promise<IssuedAuthentication> {
    const email = input.email.trim().toLowerCase();
    const user = await this.store.findPasswordUser(context, email);
    const passwordValid = await this.passwords.verify(user?.passwordHash ?? null, input.password);
    if (!user || !passwordValid) {
      await this.store.recordAudit(context, {
        action: 'auth.login.failed',
        entityId: context.tenantId,
        reason: 'INVALID_CREDENTIALS',
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    const authenticatedUser = this.publicUser(user);

    const sessionId = randomUUID();
    const refreshToken = this.tokens.createRefreshToken();
    const refreshTokenHash = this.tokens.hashRefreshToken(refreshToken);
    await this.store.createSession(context, {
      userId: authenticatedUser.id,
      sessionId,
      refreshTokenId: randomUUID(),
      familyId: randomUUID(),
      refreshTokenHash,
      expiresAt: this.tokens.refreshExpiresAt(),
      metadata: this.sessionMetadata(metadata),
    });
    const principal = this.principal(authenticatedUser, sessionId);
    await this.store.recordAudit(context, {
      action: 'auth.login.succeeded',
      entityId: authenticatedUser.id,
      actorId: authenticatedUser.id,
    });
    return this.authentication(principal, authenticatedUser, refreshToken);
  }

  async refresh(context: TenantContext, refreshToken: string): Promise<IssuedAuthentication> {
    const replacement = this.tokens.createRefreshToken();
    const rotation = await this.store.rotateRefreshToken(context, {
      currentHash: this.tokens.hashRefreshToken(refreshToken),
      replacementId: randomUUID(),
      replacementHash: this.tokens.hashRefreshToken(replacement),
      expiresAt: this.tokens.refreshExpiresAt(),
      now: new Date(),
    });
    if (rotation.status !== 'rotated') {
      if (rotation.status === 'reused') {
        await this.store.recordAudit(context, {
          action: 'auth.refresh.reuse-detected',
          entityId: context.tenantId,
          reason: 'REFRESH_TOKEN_REUSE',
        });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.authentication(rotation.principal, rotation.user, replacement);
  }

  async me(principal: AuthPrincipal): Promise<AuthenticatedUser> {
    const user = await this.store.findUser(principal);
    if (!user) throw new UnauthorizedException('Authenticated user is unavailable');
    return user;
  }

  async sessions(principal: AuthPrincipal): Promise<readonly AuthSession[]> {
    const sessions = await this.store.listSessions(principal);
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === principal.sessionId,
    }));
  }

  async logout(context: TenantContext, principal: AuthPrincipal): Promise<void> {
    await this.store.revokeSession(principal, principal.sessionId, new Date());
    await this.store.recordAudit(context, {
      action: 'auth.logout',
      entityId: principal.sessionId,
      actorId: principal.userId,
    });
  }

  async logoutAll(context: TenantContext, principal: AuthPrincipal): Promise<void> {
    await this.store.revokeAllSessions(principal, new Date());
    await this.store.recordAudit(context, {
      action: 'auth.logout-all',
      entityId: principal.userId,
      actorId: principal.userId,
    });
  }

  async revokeSession(
    context: TenantContext,
    principal: AuthPrincipal,
    sessionId: string,
  ): Promise<void> {
    const revoked = await this.store.revokeSession(principal, sessionId, new Date());
    if (!revoked) throw new NotFoundException('Resource not found');
    await this.store.recordAudit(context, {
      action: 'auth.session.revoked',
      entityId: sessionId,
      actorId: principal.userId,
    });
  }

  private authentication(
    principal: AuthPrincipal,
    user: AuthenticatedUser,
    refreshToken: string,
  ): IssuedAuthentication {
    return {
      accessToken: this.tokens.createAccessToken(principal),
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTtlSeconds(),
      user,
      refreshToken,
    };
  }

  private principal(user: AuthenticatedUser, sessionId: string): AuthPrincipal {
    return {
      userId: user.id,
      tenantId: user.tenantId,
      sessionId,
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  private publicUser(user: AuthenticatedUser): AuthenticatedUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  private sessionMetadata(input: {
    readonly userAgent?: string;
    readonly ip?: string;
  }): SessionMetadata {
    return {
      userAgentHash: input.userAgent
        ? createHash('sha256').update(input.userAgent).digest('hex')
        : null,
      ipPrefix: input.ip ? this.maskIp(input.ip) : null,
    };
  }

  private maskIp(ip: string): string {
    if (ip.includes(':')) return `${ip.split(':').slice(0, 4).join(':')}::/64`;
    const octets = ip.split('.');
    return octets.length === 4 ? `${octets.slice(0, 3).join('.')}.0/24` : 'unknown';
  }
}

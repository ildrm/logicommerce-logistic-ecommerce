import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@logicommerce/api-contracts';
import type { DatabaseClient, TenantContext } from '@logicommerce/database';
import { tenantScopedWhere } from '@logicommerce/database';
import { DATABASE } from '../database/database.module.js';
import type {
  AuthPrincipal,
  AuthStore,
  PasswordUser,
  RefreshRotation,
  StoredSession,
} from './auth.types.js';

const userSelection = {
  id: true,
  tenantId: true,
  email: true,
  displayName: true,
  userRoles: {
    select: {
      tenantId: true,
      role: {
        select: {
          tenantId: true,
          key: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  },
} as const;

type SelectedUser = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  userRoles: readonly {
    tenantId: string;
    role: {
      tenantId: string;
      key: string;
      permissions: readonly { permission: { key: string } }[];
    };
  }[];
};

@Injectable()
export class AuthRepository implements AuthStore {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async registerCustomer(
    context: TenantContext,
    input: Parameters<AuthStore['registerCustomer']>[1],
  ): ReturnType<AuthStore['registerCustomer']> {
    try {
      return await this.database.$transaction(async (transaction) => {
        const tenant = await transaction.tenant.findFirst({
          where: { id: context.tenantId, status: 'ACTIVE' },
          select: { selfRegistrationEnabled: true },
        });
        if (!tenant?.selfRegistrationEnabled) return { status: 'disabled' } as const;
        const role = await transaction.role.findFirst({
          where: { tenantId: context.tenantId, key: 'customer' },
          select: { id: true },
        });
        if (!role) return { status: 'unavailable' } as const;
        const user = await transaction.user.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            email: input.email,
            displayName: input.displayName,
            identities: {
              create: {
                id: randomUUID(),
                tenantId: context.tenantId,
                kind: 'PASSWORD',
                provider: 'local',
                providerUserId: input.email,
                passwordHash: input.passwordHash,
              },
            },
            userRoles: { create: { tenantId: context.tenantId, roleId: role.id } },
          },
          select: userSelection,
        });
        return { status: 'created', user: this.mapUser(user) } as const;
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return { status: 'exists' };
      }
      throw error;
    }
  }

  async findPasswordUser(context: TenantContext, email: string): Promise<PasswordUser | null> {
    const identity = await this.database.userIdentity.findFirst({
      where: tenantScopedWhere(context, {
        kind: 'PASSWORD' as const,
        provider: 'local',
        providerUserId: email,
        passwordHash: { not: null },
        user: { isActive: true, tenantId: context.tenantId, tenant: { status: 'ACTIVE' as const } },
      }),
      select: { passwordHash: true, user: { select: userSelection } },
    });
    if (!identity?.passwordHash) return null;
    return { ...this.mapUser(identity.user), passwordHash: identity.passwordHash };
  }

  async findUserById(context: TenantContext, userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.database.user.findFirst({
      where: { id: userId, tenantId: context.tenantId, isActive: true },
      select: userSelection,
    });
    return user ? this.mapUser(user) : null;
  }

  async createSession(
    context: TenantContext,
    input: Parameters<AuthStore['createSession']>[1],
  ): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      await transaction.userSession.create({
        data: {
          id: input.sessionId,
          tenantId: context.tenantId,
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          userAgentHash: input.metadata.userAgentHash,
          ipPrefix: input.metadata.ipPrefix,
          expiresAt: input.expiresAt,
        },
      });
      await transaction.refreshToken.create({
        data: {
          id: input.refreshTokenId,
          tenantId: context.tenantId,
          sessionId: input.sessionId,
          tokenHash: input.refreshTokenHash,
          familyId: input.familyId,
          expiresAt: input.expiresAt,
        },
      });
    });
  }

  async rotateRefreshToken(
    context: TenantContext,
    input: Parameters<AuthStore['rotateRefreshToken']>[1],
  ): Promise<RefreshRotation> {
    return this.database.$transaction(async (transaction) => {
      const token = await transaction.refreshToken.findUnique({
        where: { tokenHash: input.currentHash },
        select: {
          id: true,
          tenantId: true,
          familyId: true,
          expiresAt: true,
          consumedAt: true,
          revokedAt: true,
          session: {
            select: {
              id: true,
              revokedAt: true,
              expiresAt: true,
              user: { select: { ...userSelection, isActive: true } },
            },
          },
        },
      });
      if (!token || token.tenantId !== context.tenantId) return { status: 'invalid' };

      if (token.consumedAt) {
        await transaction.refreshToken.updateMany({
          where: { tenantId: context.tenantId, familyId: token.familyId, revokedAt: null },
          data: { revokedAt: input.now },
        });
        await transaction.userSession.updateMany({
          where: { id: token.session.id, tenantId: context.tenantId, revokedAt: null },
          data: { revokedAt: input.now },
        });
        return { status: 'reused' };
      }

      if (
        token.revokedAt ||
        token.expiresAt <= input.now ||
        token.session.revokedAt ||
        token.session.expiresAt <= input.now ||
        !token.session.user.isActive
      ) {
        return { status: 'invalid' };
      }

      const claimed = await transaction.refreshToken.updateMany({
        where: { id: token.id, tenantId: context.tenantId, consumedAt: null, revokedAt: null },
        data: { consumedAt: input.now, replacedById: input.replacementId },
      });
      if (claimed.count !== 1) {
        await transaction.refreshToken.updateMany({
          where: { tenantId: context.tenantId, familyId: token.familyId, revokedAt: null },
          data: { revokedAt: input.now },
        });
        await transaction.userSession.updateMany({
          where: { id: token.session.id, tenantId: context.tenantId, revokedAt: null },
          data: { revokedAt: input.now },
        });
        return { status: 'reused' };
      }

      await transaction.refreshToken.create({
        data: {
          id: input.replacementId,
          tenantId: context.tenantId,
          sessionId: token.session.id,
          tokenHash: input.replacementHash,
          familyId: token.familyId,
          expiresAt: input.expiresAt,
        },
      });
      await transaction.userSession.update({
        where: { id: token.session.id },
        data: { refreshTokenHash: input.replacementHash, lastSeenAt: input.now },
      });

      const user = this.mapUser(token.session.user);
      return {
        status: 'rotated',
        principal: {
          userId: user.id,
          tenantId: user.tenantId,
          sessionId: token.session.id,
          roles: user.roles,
          permissions: user.permissions,
        },
        user,
      };
    });
  }

  async isSessionActive(principal: AuthPrincipal, now: Date): Promise<boolean> {
    const session = await this.database.userSession.findFirst({
      where: {
        id: principal.sessionId,
        tenantId: principal.tenantId,
        userId: principal.userId,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { isActive: true },
      },
      select: { id: true },
    });
    return session !== null;
  }

  async findUser(principal: AuthPrincipal): Promise<AuthenticatedUser | null> {
    const user = await this.database.user.findFirst({
      where: { id: principal.userId, tenantId: principal.tenantId, isActive: true },
      select: userSelection,
    });
    return user ? this.mapUser(user) : null;
  }

  listSessions(principal: AuthPrincipal): Promise<readonly StoredSession[]> {
    return this.database.userSession.findMany({
      where: { tenantId: principal.tenantId, userId: principal.userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true },
    });
  }

  async revokeSession(principal: AuthPrincipal, sessionId: string, now: Date): Promise<boolean> {
    const revoked = await this.database.userSession.updateMany({
      where: {
        id: sessionId,
        tenantId: principal.tenantId,
        userId: principal.userId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    if (revoked.count === 1) {
      await this.database.refreshToken.updateMany({
        where: { sessionId, tenantId: principal.tenantId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    return revoked.count === 1;
  }

  async revokeAllSessions(principal: AuthPrincipal, now: Date): Promise<void> {
    const sessions = await this.database.userSession.findMany({
      where: { tenantId: principal.tenantId, userId: principal.userId, revokedAt: null },
      select: { id: true },
    });
    const sessionIds = sessions.map(({ id }) => id);
    await this.database.$transaction([
      this.database.userSession.updateMany({
        where: { id: { in: sessionIds }, tenantId: principal.tenantId, userId: principal.userId },
        data: { revokedAt: now },
      }),
      this.database.refreshToken.updateMany({
        where: { sessionId: { in: sessionIds }, tenantId: principal.tenantId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  async recordAudit(
    context: TenantContext,
    input: Parameters<AuthStore['recordAudit']>[1],
  ): Promise<void> {
    await this.database.auditEvent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        actorId: input.actorId ?? null,
        actorType: input.actorId ? 'USER' : 'ANONYMOUS',
        action: input.action,
        entityType: 'AUTHENTICATION',
        entityId: input.entityId,
        reason: input.reason ?? null,
        requestId: context.correlationId,
        correlationId: context.correlationId,
        authenticationMethod: 'PASSWORD',
      },
    });
  }

  private mapUser(user: SelectedUser): AuthenticatedUser {
    const tenantRoles = user.userRoles.filter(
      (userRole) => userRole.tenantId === user.tenantId && userRole.role.tenantId === user.tenantId,
    );
    const roles = tenantRoles.map(({ role }) => role.key);
    const permissions = [
      ...new Set(
        tenantRoles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)),
      ),
    ];
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      roles,
      permissions,
    };
  }
}

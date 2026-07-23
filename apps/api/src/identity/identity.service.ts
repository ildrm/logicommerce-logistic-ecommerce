import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DatabaseClient, TenantContext } from '@logicommerce/database';
import { parseEnvironment } from '@logicommerce/config';
import { DATABASE } from '../database/database.module.js';
import { PasswordService } from '../auth/password.service.js';
import { AUTH_STORE, type AuthPrincipal, type AuthStore } from '../auth/auth.types.js';
import type { CreateCredentialDto, CreateRoleDto, CreateUserDto } from './identity.dto.js';

@Injectable()
export class IdentityService {
  private readonly credentialPepper = parseEnvironment(process.env).JWT_REFRESH_PEPPER;

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(AUTH_STORE) private readonly audits: AuthStore,
    private readonly passwords: PasswordService,
  ) {}

  permissions(): Promise<unknown> {
    return this.database.permission.findMany({ orderBy: { key: 'asc' } });
  }

  roles(context: TenantContext): Promise<unknown> {
    return this.database.role.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { key: 'asc' },
      include: {
        permissions: { select: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  }

  async createRole(context: TenantContext, principal: AuthPrincipal, input: CreateRoleDto) {
    try {
      const role = await this.database.role.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
        },
      });
      await this.audit(context, principal, 'identity.role.created', role.id, input.key);
      return role;
    } catch (error) {
      if (this.isUnique(error)) throw new ConflictException('Role key already exists');
      throw error;
    }
  }

  async setPermissions(
    context: TenantContext,
    principal: AuthPrincipal,
    roleId: string,
    permissionKeys: readonly string[],
  ) {
    const role = await this.database.role.findFirst({
      where: { id: roleId, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException('Resource not found');
    const keys = [...new Set(permissionKeys)];
    const permissions = await this.database.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== keys.length) throw new NotFoundException('Resource not found');
    await this.database.$transaction([
      this.database.rolePermission.deleteMany({ where: { roleId } }),
      this.database.rolePermission.createMany({
        data: permissions.map(({ id }) => ({ roleId, permissionId: id })),
      }),
      this.database.userSession.updateMany({
        where: {
          tenantId: context.tenantId,
          user: { userRoles: { some: { roleId } } },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit(
      context,
      principal,
      'identity.role.permissions-changed',
      roleId,
      keys.join(','),
    );
    return { id: roleId, permissionKeys: permissions.map(({ key }) => key).sort() };
  }

  users(context: TenantContext): Promise<unknown> {
    return this.database.user.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        verifiedAt: true,
        userRoles: { select: { role: { select: { id: true, key: true, name: true } } } },
      },
    });
  }

  async createUser(context: TenantContext, principal: AuthPrincipal, input: CreateUserDto) {
    const email = input.email.trim().toLowerCase();
    const roleIds = [...new Set(input.roleIds)];
    await this.assertRoles(context, roleIds);
    try {
      const user = await this.database.user.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          email,
          displayName: input.displayName,
          identities: {
            create: {
              id: randomUUID(),
              tenantId: context.tenantId,
              kind: 'PASSWORD',
              provider: 'local',
              providerUserId: email,
              passwordHash: await this.passwords.hash(input.password),
            },
          },
          userRoles: {
            create: roleIds.map((roleId) => ({ tenantId: context.tenantId, roleId })),
          },
        },
        select: { id: true, email: true, displayName: true, isActive: true, verifiedAt: true },
      });
      await this.audit(context, principal, 'identity.user.created', user.id, email);
      return user;
    } catch (error) {
      if (this.isUnique(error)) throw new ConflictException('User already exists');
      throw error;
    }
  }

  async setUserRoles(
    context: TenantContext,
    principal: AuthPrincipal,
    userId: string,
    roleIdsInput: readonly string[],
  ) {
    const user = await this.database.user.findFirst({
      where: { id: userId, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Resource not found');
    const roleIds = [...new Set(roleIdsInput)];
    await this.assertRoles(context, roleIds);
    await this.database.$transaction([
      this.database.userRole.deleteMany({ where: { tenantId: context.tenantId, userId } }),
      this.database.userRole.createMany({
        data: roleIds.map((roleId) => ({ tenantId: context.tenantId, userId, roleId })),
      }),
      this.database.userSession.updateMany({
        where: { tenantId: context.tenantId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit(context, principal, 'identity.user.roles-changed', userId, roleIds.join(','));
    return { id: userId, roleIds };
  }

  credentials(context: TenantContext): Promise<unknown> {
    return this.database.apiCredential.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async createCredential(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateCredentialDto,
  ) {
    const prefix = `lc_${randomBytes(6).toString('hex')}`;
    const secret = randomBytes(32).toString('base64url');
    const credential = await this.database.apiCredential.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        name: input.name,
        keyPrefix: prefix,
        secretHash: this.credentialHash(`${prefix}.${secret}`),
        scopes: [...new Set(input.scopes)],
      },
      select: { id: true, name: true, keyPrefix: true, scopes: true, createdAt: true },
    });
    await this.audit(context, principal, 'identity.credential.created', credential.id, prefix);
    return { ...credential, secret: `${prefix}.${secret}` };
  }

  async revokeCredential(context: TenantContext, principal: AuthPrincipal, credentialId: string) {
    const result = await this.database.apiCredential.updateMany({
      where: { id: credentialId, tenantId: context.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundException('Resource not found');
    await this.audit(context, principal, 'identity.credential.revoked', credentialId);
  }

  credentialHash(secret: string): string {
    return createHmac('sha256', this.credentialPepper).update(secret).digest('hex');
  }

  private async assertRoles(context: TenantContext, roleIds: readonly string[]): Promise<void> {
    const count = await this.database.role.count({
      where: { tenantId: context.tenantId, id: { in: [...roleIds] } },
    });
    if (count !== roleIds.length) throw new NotFoundException('Resource not found');
  }

  private audit(
    context: TenantContext,
    principal: AuthPrincipal,
    action: string,
    entityId: string,
    reason?: string,
  ) {
    return this.audits.recordAudit(context, {
      action,
      entityId,
      actorId: principal.userId,
      ...(reason ? { reason } : {}),
    });
  }

  private isUnique(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}

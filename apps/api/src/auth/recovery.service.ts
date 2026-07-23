import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, TenantContext } from '@logicommerce/database';
import { parseEnvironment } from '@logicommerce/config';
import { DATABASE } from '../database/database.module.js';
import { PasswordService } from './password.service.js';
import { AUTH_STORE, type AuthStore } from './auth.types.js';
import { IdentityMailAdapter, type IdentityMailPurpose } from './identity-mail.adapter.js';

@Injectable()
export class RecoveryService {
  private readonly pepper = parseEnvironment(process.env).JWT_REFRESH_PEPPER;

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(AUTH_STORE) private readonly authStore: AuthStore,
    private readonly passwords: PasswordService,
    private readonly mail: IdentityMailAdapter,
  ) {}

  async request(context: TenantContext, emailInput: string, purpose: IdentityMailPurpose) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.database.user.findFirst({
      where: { tenantId: context.tenantId, email, isActive: true },
      select: { id: true },
    });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await this.database.$transaction([
        this.database.identityToken.updateMany({
          where: { tenantId: context.tenantId, email, purpose, consumedAt: null },
          data: { consumedAt: new Date() },
        }),
        this.database.identityToken.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            userId: user.id,
            email,
            purpose,
            tokenHash: this.hash(token),
            expiresAt: new Date(Date.now() + this.ttl(purpose)),
          },
        }),
      ]);
      await this.mail.send(email, purpose, token);
    }
    return { accepted: true } as const;
  }

  async verifyEmail(context: TenantContext, token: string): Promise<void> {
    const claimed = await this.claim(context, token, 'EMAIL_VERIFICATION');
    await this.database.user.updateMany({
      where: { id: claimed.userId, tenantId: context.tenantId },
      data: { verifiedAt: new Date() },
    });
    await this.authStore.recordAudit(context, {
      action: 'auth.email.verified',
      entityId: claimed.userId,
      actorId: claimed.userId,
    });
  }

  async resetPassword(context: TenantContext, token: string, password: string): Promise<void> {
    const claimed = await this.claim(context, token, 'PASSWORD_RESET');
    const passwordHash = await this.passwords.hash(password);
    const now = new Date();
    await this.database.$transaction([
      this.database.userIdentity.updateMany({
        where: {
          tenantId: context.tenantId,
          userId: claimed.userId,
          kind: 'PASSWORD',
          provider: 'local',
        },
        data: { passwordHash },
      }),
      this.database.userSession.updateMany({
        where: { tenantId: context.tenantId, userId: claimed.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.database.refreshToken.updateMany({
        where: { tenantId: context.tenantId, session: { userId: claimed.userId }, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    await this.authStore.recordAudit(context, {
      action: 'auth.password.reset',
      entityId: claimed.userId,
      actorId: claimed.userId,
    });
  }

  async consumePasswordless(context: TenantContext, token: string) {
    const claimed = await this.claim(context, token, 'PASSWORDLESS_LOGIN');
    const user = await this.authStore.findUserById(context, claimed.userId);
    if (!user) throw new BadRequestException('Invalid or expired token');
    return user;
  }

  private async claim(context: TenantContext, token: string, purpose: IdentityMailPurpose) {
    return this.database.$transaction(async (transaction) => {
      const record = await transaction.identityToken.findUnique({
        where: { tokenHash: this.hash(token) },
        select: {
          id: true,
          tenantId: true,
          userId: true,
          purpose: true,
          expiresAt: true,
          consumedAt: true,
        },
      });
      if (
        !record ||
        record.tenantId !== context.tenantId ||
        record.purpose !== purpose ||
        !record.userId ||
        record.consumedAt ||
        record.expiresAt <= new Date()
      ) {
        throw new BadRequestException('Invalid or expired token');
      }
      const claimed = await transaction.identityToken.updateMany({
        where: { id: record.id, tenantId: context.tenantId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) throw new BadRequestException('Invalid or expired token');
      return { userId: record.userId };
    });
  }

  private hash(token: string): string {
    return createHmac('sha256', this.pepper).update(token).digest('hex');
  }

  private ttl(purpose: IdentityMailPurpose): number {
    return purpose === 'PASSWORD_RESET'
      ? 30 * 60_000
      : purpose === 'PASSWORDLESS_LOGIN'
        ? 10 * 60_000
        : 24 * 60 * 60_000;
  }
}

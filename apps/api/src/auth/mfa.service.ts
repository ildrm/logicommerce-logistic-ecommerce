import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { DatabaseClient, TenantContext } from '@logicommerce/database';
import { parseEnvironment } from '@logicommerce/config';
import { DATABASE } from '../database/database.module.js';
import { AUTH_STORE, type AuthPrincipal, type AuthStore } from './auth.types.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class MfaService {
  private readonly encryptionKey = createHash('sha256')
    .update(parseEnvironment(process.env).FIELD_ENCRYPTION_KEY)
    .digest();

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(AUTH_STORE) private readonly audits: AuthStore,
  ) {}

  async enroll(context: TenantContext, principal: AuthPrincipal, currentCode?: string) {
    const secret = this.base32(randomBytes(20));
    const confirmed = await this.credential(context.tenantId, principal.userId, true);
    if (confirmed) {
      if (!currentCode) throw new UnauthorizedException('Current MFA code is required');
      await this.assertLogin(context, principal.userId, currentCode);
    }
    const credential = await this.database.mfaCredential.upsert({
      where: {
        tenantId_userId_kind: {
          tenantId: context.tenantId,
          userId: principal.userId,
          kind: 'TOTP',
        },
      },
      update: confirmed
        ? { pendingSecretCiphertext: this.encrypt(secret), pendingCreatedAt: new Date() }
        : {
            secretCiphertext: this.encrypt(secret),
            pendingSecretCiphertext: null,
            pendingCreatedAt: null,
            confirmedAt: null,
            lastUsedStep: null,
          },
      create: {
        id: randomUUID(),
        tenantId: context.tenantId,
        userId: principal.userId,
        kind: 'TOTP',
        secretCiphertext: this.encrypt(secret),
      },
      select: { id: true },
    });
    if (!confirmed) {
      await this.database.mfaRecoveryCode.deleteMany({
        where: { tenantId: context.tenantId, credentialId: credential.id },
      });
    }
    const user = await this.database.user.findFirstOrThrow({
      where: { id: principal.userId, tenantId: context.tenantId },
      select: { email: true },
    });
    await this.audits.recordAudit(context, {
      action: 'auth.mfa.enrollment-started',
      entityId: principal.userId,
      actorId: principal.userId,
    });
    return {
      secret,
      otpauthUri: `otpauth://totp/LogiCommerce:${encodeURIComponent(user.email)}?secret=${secret}&issuer=LogiCommerce&algorithm=SHA1&digits=6&period=30`,
    };
  }

  async confirm(context: TenantContext, principal: AuthPrincipal, code: string) {
    const credential = await this.credential(context.tenantId, principal.userId, false);
    if (
      credential?.pendingSecretCiphertext &&
      (!credential.pendingCreatedAt ||
        credential.pendingCreatedAt < new Date(Date.now() - 10 * 60_000))
    ) {
      throw new UnauthorizedException('MFA enrollment expired');
    }
    const candidateSecret = credential?.pendingSecretCiphertext ?? credential?.secretCiphertext;
    const candidate = candidateSecret
      ? this.validTotp(this.decrypt(candidateSecret), code)
      : { valid: false as const };
    if (!credential || !candidate.valid || candidate.step === undefined) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    const confirmedStep = candidate.step;
    const recoveryCodes = Array.from({ length: 8 }, () => this.recoveryCode());
    await this.database.$transaction(async (transaction) => {
      await transaction.mfaCredential.updateMany({
        where: { id: credential.id, tenantId: context.tenantId, userId: principal.userId },
        data: {
          ...(credential.pendingSecretCiphertext
            ? { secretCiphertext: credential.pendingSecretCiphertext }
            : {}),
          pendingSecretCiphertext: null,
          pendingCreatedAt: null,
          confirmedAt: new Date(),
          lastUsedStep: confirmedStep,
        },
      });
      await transaction.mfaRecoveryCode.deleteMany({
        where: { tenantId: context.tenantId, credentialId: credential.id },
      });
      await transaction.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({
          id: randomUUID(),
          tenantId: context.tenantId,
          credentialId: credential.id,
          codeHash: this.secretHash(recoveryCode),
        })),
      });
    });
    await this.audits.recordAudit(context, {
      action: 'auth.mfa.enabled',
      entityId: principal.userId,
      actorId: principal.userId,
    });
    return { recoveryCodes };
  }

  async assertLogin(
    context: TenantContext,
    userId: string,
    code: string | undefined,
  ): Promise<void> {
    const credential = await this.credential(context.tenantId, userId, true);
    if (!credential) return;
    if (!code) throw new UnauthorizedException('MFA code is required');

    if (/^\d{6}$/u.test(code)) {
      const candidate = this.validTotp(this.decrypt(credential.secretCiphertext), code);
      if (candidate.valid && candidate.step !== undefined) {
        const claimed = await this.database.mfaCredential.updateMany({
          where: {
            id: credential.id,
            tenantId: context.tenantId,
            OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: candidate.step } }],
          },
          data: { lastUsedStep: candidate.step },
        });
        if (claimed.count === 1) return;
      }
    } else {
      const claimed = await this.database.mfaRecoveryCode.updateMany({
        where: {
          tenantId: context.tenantId,
          credentialId: credential.id,
          codeHash: this.secretHash(code.toUpperCase()),
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      if (claimed.count === 1) return;
    }
    throw new UnauthorizedException('Invalid MFA code');
  }

  async status(principal: AuthPrincipal) {
    const credential = await this.credential(principal.tenantId, principal.userId, true);
    return { enabled: credential !== null };
  }

  private credential(tenantId: string, userId: string, confirmed: boolean) {
    return this.database.mfaCredential.findFirst({
      where: {
        tenantId,
        userId,
        kind: 'TOTP',
        ...(confirmed ? { confirmedAt: { not: null } } : {}),
      },
      select: {
        id: true,
        secretCiphertext: true,
        pendingSecretCiphertext: true,
        pendingCreatedAt: true,
      },
    });
  }

  private validTotp(secret: string, code: string): { valid: boolean; step?: bigint } {
    const nowStep = Math.floor(Date.now() / 30_000);
    for (const offset of [-1, 0, 1]) {
      const step = BigInt(nowStep + offset);
      const expected = this.totp(secret, step);
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return { valid: true, step };
    }
    return { valid: false };
  }

  private totp(secret: string, step: bigint): string {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(step);
    const digest = createHmac('sha1', this.base32Decode(secret)).update(counter).digest();
    const offset = (digest.at(-1) ?? 0) & 0x0f;
    const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return binary.toString().padStart(6, '0');
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  private decrypt(value: string): string {
    const [version, iv, tag, ciphertext] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !ciphertext)
      throw new Error('Invalid encrypted MFA secret');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private secretHash(value: string): string {
    return createHmac('sha256', this.encryptionKey).update(value).digest('hex');
  }

  private recoveryCode(): string {
    const raw = this.base32(randomBytes(5)).slice(0, 8).replace(/[01]/gu, '2');
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }

  private base32(input: Buffer): string {
    let bits = '';
    for (const byte of input) bits += byte.toString(2).padStart(8, '0');
    return (bits.match(/.{1,5}/gu) ?? [])
      .map((chunk) => ALPHABET[Number.parseInt(chunk.padEnd(5, '0'), 2)])
      .join('');
  }

  private base32Decode(input: string): Buffer {
    const bits = [...input]
      .map((character) => ALPHABET.indexOf(character).toString(2).padStart(5, '0'))
      .join('');
    return Buffer.from((bits.match(/.{8}/gu) ?? []).map((byte) => Number.parseInt(byte, 2)));
  }
}

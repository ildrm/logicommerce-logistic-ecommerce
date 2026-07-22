import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@logicommerce/api-contracts';
import { AuthTokenService } from './auth-token.service.js';
import { AuthService } from './auth.service.js';
import type { AuthStore } from './auth.types.js';
import type { PasswordService } from './password.service.js';

const context = { tenantId: 'tenant-1', actorId: null, correlationId: 'request-1' };
const user: AuthenticatedUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@example.com',
  displayName: 'Admin',
  roles: ['tenant-admin'],
  permissions: ['tenant.configure'],
};

describe('AuthService', () => {
  let store: AuthStore;
  let passwordVerify: ReturnType<typeof vi.fn>;
  let findPasswordUser: ReturnType<typeof vi.fn<AuthStore['findPasswordUser']>>;
  let createSession: ReturnType<typeof vi.fn<AuthStore['createSession']>>;
  let rotateRefreshToken: ReturnType<typeof vi.fn<AuthStore['rotateRefreshToken']>>;
  let recordAudit: ReturnType<typeof vi.fn<AuthStore['recordAudit']>>;
  let service: AuthService;

  beforeEach(() => {
    findPasswordUser = vi.fn<AuthStore['findPasswordUser']>();
    createSession = vi.fn<AuthStore['createSession']>();
    rotateRefreshToken = vi.fn<AuthStore['rotateRefreshToken']>();
    recordAudit = vi.fn<AuthStore['recordAudit']>();
    store = {
      findPasswordUser,
      createSession,
      rotateRefreshToken,
      isSessionActive: vi.fn(),
      findUser: vi.fn(),
      listSessions: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllSessions: vi.fn(),
      recordAudit,
    };
    passwordVerify = vi.fn();
    const passwords = { verify: passwordVerify } as unknown as PasswordService;
    const tokens = new AuthTokenService({
      accessSecret: 'access-secret-that-is-at-least-32-characters',
      refreshPepper: 'refresh-pepper-that-is-at-least-32-characters',
      accessTtlSeconds: 900,
      refreshTtlSeconds: 2_592_000,
      cookieSecure: false,
      loginRateLimitMax: 10,
      refreshRateLimitMax: 30,
      rateLimitWindowSeconds: 60,
    });
    service = new AuthService(store, passwords, tokens);
  });

  it('normalizes the email, verifies the password, persists a hashed session, and audits login', async () => {
    findPasswordUser.mockResolvedValue({ ...user, passwordHash: 'hash' });
    passwordVerify.mockResolvedValue(true);

    const result = await service.login(
      context,
      { email: '  ADMIN@EXAMPLE.COM ', password: 'password-value' },
      { userAgent: 'test-agent', ip: '192.168.10.55' },
    );

    expect(findPasswordUser).toHaveBeenCalledWith(context, 'admin@example.com');
    const sessionInput = createSession.mock.calls[0]?.[1];
    expect(sessionInput?.userId).toBe(user.id);
    expect(sessionInput?.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(sessionInput?.metadata.ipPrefix).toBe('192.168.10.0/24');
    expect(result.user).toEqual(user);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(result.refreshToken).not.toBe('');
    expect(recordAudit).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ action: 'auth.login.succeeded', actorId: user.id }),
    );
  });

  it('uses the same verifier path and generic error for an unknown identity', async () => {
    findPasswordUser.mockResolvedValue(null);
    passwordVerify.mockResolvedValue(false);

    await expect(
      service.login(context, { email: 'missing@example.com', password: 'password-value' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(passwordVerify).toHaveBeenCalledWith(null, 'password-value');
    expect(recordAudit).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ action: 'auth.login.failed', reason: 'INVALID_CREDENTIALS' }),
    );
  });

  it('rejects reuse, relying on the repository transaction to revoke the token family', async () => {
    rotateRefreshToken.mockResolvedValue({ status: 'reused' });

    await expect(service.refresh(context, 'previous-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(recordAudit).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ action: 'auth.refresh.reuse-detected' }),
    );
  });
});

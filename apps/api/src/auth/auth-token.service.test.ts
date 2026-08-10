import { describe, expect, it } from 'vitest';
import { AuthTokenService } from './auth-token.service.js';

const options = {
  accessSecret: 'access-secret-that-is-at-least-32-characters',
  refreshPepper: 'refresh-pepper-that-is-at-least-32-characters',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 2_592_000,
  cookieSecure: true,
  loginRateLimitMax: 10,
  refreshRateLimitMax: 30,
  recoveryRateLimitMax: 5,
  rateLimitWindowSeconds: 60,
};

const principal = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  sessionId: 'session-1',
  roles: ['tenant-admin'],
  permissions: ['tenant.configure'],
};

describe('AuthTokenService', () => {
  const tokens = new AuthTokenService(options);
  const now = new Date('2026-07-22T00:00:00.000Z');

  it('signs and verifies a tenant and session-bound access token', () => {
    const token = tokens.createAccessToken(principal, now);
    expect(tokens.verifyAccessToken(token, now)).toEqual(principal);
  });

  it('rejects tampered and expired access tokens', () => {
    const token = tokens.createAccessToken(principal, now);
    expect(() => tokens.verifyAccessToken(`${token.slice(0, -1)}x`, now)).toThrow(
      'Invalid access token',
    );
    expect(() => tokens.verifyAccessToken(token, new Date('2026-07-22T00:16:00.000Z'))).toThrow(
      'Invalid access token',
    );
  });

  it('hashes opaque refresh tokens and emits a hardened cookie', () => {
    const refreshToken = tokens.createRefreshToken();
    expect(refreshToken).not.toContain('.');
    expect(tokens.hashRefreshToken(refreshToken)).toHaveLength(64);
    expect(tokens.refreshCookie(refreshToken)).toContain('HttpOnly; SameSite=Strict');
    expect(tokens.refreshCookie(refreshToken)).toContain('; Secure');
  });
});

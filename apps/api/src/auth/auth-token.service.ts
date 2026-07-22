import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_OPTIONS, type AuthOptions } from './auth.config.js';
import type { AuthPrincipal } from './auth.types.js';

type AccessClaims = {
  iss: 'logicommerce';
  aud: 'logicommerce-api';
  sub: string;
  tid: string;
  sid: string;
  roles: readonly string[];
  permissions: readonly string[];
  iat: number;
  exp: number;
  jti: string;
};

@Injectable()
export class AuthTokenService {
  constructor(@Inject(AUTH_OPTIONS) private readonly options: AuthOptions) {}

  createAccessToken(principal: AuthPrincipal, now = new Date()): string {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const claims: AccessClaims = {
      iss: 'logicommerce',
      aud: 'logicommerce-api',
      sub: principal.userId,
      tid: principal.tenantId,
      sid: principal.sessionId,
      roles: principal.roles,
      permissions: principal.permissions,
      iat: issuedAt,
      exp: issuedAt + this.options.accessTtlSeconds,
      jti: randomUUID(),
    };
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encode(claims);
    return `${header}.${payload}.${this.signature(`${header}.${payload}`)}`;
  }

  verifyAccessToken(token: string, now = new Date()): AuthPrincipal {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid access token');
    const [header, payload, suppliedSignature] = parts as [string, string, string];
    const expectedSignature = this.signature(`${header}.${payload}`);
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Invalid access token');
    }

    let claims: Partial<AccessClaims>;
    try {
      claims = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as Partial<AccessClaims>;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (
      claims.iss !== 'logicommerce' ||
      claims.aud !== 'logicommerce-api' ||
      typeof claims.sub !== 'string' ||
      typeof claims.tid !== 'string' ||
      typeof claims.sid !== 'string' ||
      typeof claims.exp !== 'number' ||
      claims.exp <= nowSeconds ||
      !Array.isArray(claims.roles) ||
      !Array.isArray(claims.permissions)
    ) {
      throw new UnauthorizedException('Invalid access token');
    }
    return {
      userId: claims.sub,
      tenantId: claims.tid,
      sessionId: claims.sid,
      roles: claims.roles,
      permissions: claims.permissions,
    };
  }

  createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).update(this.options.refreshPepper).digest('hex');
  }

  accessTtlSeconds(): number {
    return this.options.accessTtlSeconds;
  }

  refreshExpiresAt(now = new Date()): Date {
    return new Date(now.getTime() + this.options.refreshTtlSeconds * 1000);
  }

  refreshCookie(token: string): string {
    const domain = this.options.cookieDomain ? `; Domain=${this.options.cookieDomain}` : '';
    const secure = this.options.cookieSecure ? '; Secure' : '';
    return `logicommerce_refresh=${encodeURIComponent(token)}; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=${this.options.refreshTtlSeconds}${domain}${secure}`;
  }

  clearRefreshCookie(): string {
    const domain = this.options.cookieDomain ? `; Domain=${this.options.cookieDomain}` : '';
    const secure = this.options.cookieSecure ? '; Secure' : '';
    return `logicommerce_refresh=; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=0${domain}${secure}`;
  }

  private signature(value: string): string {
    return createHmac('sha256', this.options.accessSecret).update(value).digest('base64url');
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}

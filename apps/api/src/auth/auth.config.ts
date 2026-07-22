import { parseEnvironment } from '@logicommerce/config';

export type AuthOptions = {
  readonly accessSecret: string;
  readonly refreshPepper: string;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
  readonly cookieSecure: boolean;
  readonly cookieDomain?: string;
  readonly loginRateLimitMax: number;
  readonly refreshRateLimitMax: number;
  readonly rateLimitWindowSeconds: number;
};

export const AUTH_OPTIONS = Symbol('AUTH_OPTIONS');

export function loadAuthOptions(): AuthOptions {
  const environment = parseEnvironment(process.env);
  return {
    accessSecret: environment.JWT_ACCESS_SECRET,
    refreshPepper: environment.JWT_REFRESH_PEPPER,
    accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: environment.JWT_REFRESH_TTL_SECONDS,
    cookieSecure: environment.COOKIE_SECURE,
    loginRateLimitMax: environment.AUTH_LOGIN_RATE_LIMIT_MAX,
    refreshRateLimitMax: environment.AUTH_REFRESH_RATE_LIMIT_MAX,
    rateLimitWindowSeconds: environment.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    ...(environment.COOKIE_DOMAIN ? { cookieDomain: environment.COOKIE_DOMAIN } : {}),
  };
}

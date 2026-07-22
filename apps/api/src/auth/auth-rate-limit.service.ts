import { createHash } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { TenantContext } from '@logicommerce/database';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';
import { AUTH_OPTIONS, type AuthOptions } from './auth.config.js';

const INCREMENT_WITH_EXPIRY = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

@Injectable()
export class AuthRateLimitService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(AUTH_OPTIONS) private readonly options: AuthOptions,
  ) {}

  async assertLoginAllowed(context: TenantContext, email: string, ip: string): Promise<void> {
    await this.consume(
      `auth:login:${this.hash(`${context.tenantId}:${email.trim().toLowerCase()}:${ip}`)}`,
      this.options.loginRateLimitMax,
    );
  }

  async assertRefreshAllowed(context: TenantContext, ip: string): Promise<void> {
    await this.consume(
      `auth:refresh:${this.hash(`${context.tenantId}:${ip}`)}`,
      this.options.refreshRateLimitMax,
    );
  }

  private async consume(key: string, maximum: number): Promise<void> {
    let count: number;
    try {
      const result = await this.redis.eval(
        INCREMENT_WITH_EXPIRY,
        1,
        key,
        this.options.rateLimitWindowSeconds,
      );
      count = Number(result);
    } catch {
      throw new ServiceUnavailableException('Authentication protection is temporarily unavailable');
    }
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new ServiceUnavailableException('Authentication protection is temporarily unavailable');
    }
    if (count > maximum) {
      throw new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

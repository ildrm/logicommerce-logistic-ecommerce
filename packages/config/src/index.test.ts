import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './index.js';

const valid = {
  DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_PEPPER: 'b'.repeat(32),
  CORS_ORIGINS: 'http://localhost:3000',
};

describe('parseEnvironment', () => {
  it('fails fast when secrets are missing', () => {
    expect(() => parseEnvironment({ DATABASE_URL: valid.DATABASE_URL })).toThrow(
      'Invalid application configuration',
    );
  });

  it('parses valid configuration', () => {
    expect(parseEnvironment(valid).API_PORT).toBe(3001);
    expect(parseEnvironment(valid).JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(parseEnvironment(valid).AUTH_LOGIN_RATE_LIMIT_MAX).toBe(10);
  });
});

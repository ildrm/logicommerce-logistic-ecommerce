import pino, { type LoggerOptions } from 'pino';

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'refreshToken',
      '*.refreshToken',
      'authorization',
      'headers.authorization',
      'apiSecret',
      '*.apiSecret',
      'bankAccount',
      '*.bankAccount',
    ],
    censor: '[REDACTED]',
  },
};

export function createLogger(service: string) {
  return pino({
    ...options,
    base: { service, environment: process.env.NODE_ENV ?? 'development' },
  });
}

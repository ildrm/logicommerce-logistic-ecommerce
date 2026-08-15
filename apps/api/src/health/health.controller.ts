import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthStatus } from '@logicommerce/api-contracts';
import type { DatabaseClient } from '@logicommerce/database';
import type { Redis } from 'ioredis';
import { DATABASE } from '../database/database.module.js';
import { REDIS } from '../redis/redis.module.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness' })
  live(): HealthStatus {
    return { status: 'ok', service: 'api', version: '0.1.0', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Dependency readiness' })
  async ready(): Promise<HealthStatus> {
    await Promise.all([this.database.$queryRaw`SELECT 1`, this.redis.ping()]);
    return { status: 'ok', service: 'api', version: '0.1.0', timestamp: new Date().toISOString() };
  }

  @Get('details')
  @ApiOperation({ summary: 'Development-only detailed health' })
  details(): HealthStatus & { environment: string } {
    if (process.env.NODE_ENV !== 'development') throw new NotFoundException('Resource not found');
    return { ...this.live(), environment: process.env.NODE_ENV ?? 'development' };
  }
}

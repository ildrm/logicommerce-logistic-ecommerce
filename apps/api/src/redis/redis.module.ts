import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { parseEnvironment } from '@logicommerce/config';
import { Redis } from 'ioredis';

export const REDIS = Symbol('REDIS');

@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () => {
        const environment = parseEnvironment(process.env);
        return new Redis(environment.REDIS_URL, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}

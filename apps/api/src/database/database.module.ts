import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabaseClient, type DatabaseClient } from '@logicommerce/database';

export const DATABASE = Symbol('DATABASE');

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}
  async onApplicationShutdown() {
    await this.database.$disconnect();
  }
}

@Global()
@Module({
  providers: [{ provide: DATABASE, useFactory: createDatabaseClient }, DatabaseLifecycle],
  exports: [DATABASE],
})
export class DatabaseModule {}

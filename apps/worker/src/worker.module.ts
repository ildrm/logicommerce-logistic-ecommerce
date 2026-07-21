import { Module } from '@nestjs/common';
import { createDatabaseClient } from '@logicommerce/database';
import { DATABASE, OutboxPublisher, WorkerHealth } from './worker.services.js';

@Module({
  providers: [
    { provide: DATABASE, useFactory: createDatabaseClient },
    OutboxPublisher,
    WorkerHealth,
  ],
})
export class WorkerModule {}

import { Module } from '@nestjs/common';
import { createDatabaseClient } from '@logicommerce/database';
import {
  DATABASE,
  OutboxPublisher,
  ReservationExpirySweeper,
  WorkerHealth,
} from './worker.services.js';

@Module({
  providers: [
    { provide: DATABASE, useFactory: createDatabaseClient },
    OutboxPublisher,
    ReservationExpirySweeper,
    WorkerHealth,
  ],
})
export class WorkerModule {}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadEnvironmentFiles, parseEnvironment } from '@logicommerce/config';
import { createLogger } from '@logicommerce/observability';
import { WorkerModule } from './worker.module.js';

async function bootstrap() {
  loadEnvironmentFiles();
  parseEnvironment(process.env);
  const logger = createLogger('worker');
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.enableShutdownHooks();
  logger.info('Worker application started');
}

void bootstrap();

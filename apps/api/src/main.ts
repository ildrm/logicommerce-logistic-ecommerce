import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { parseEnvironment } from '@logicommerce/config';
import { createLogger } from '@logicommerce/observability';
import { AppModule } from './app.module.js';
import { JsonSafeInterceptor } from './platform/json-safe.interceptor.js';
import { ProblemDetailsFilter } from './platform/problem-details.filter.js';

async function bootstrap() {
  const environment = parseEnvironment(process.env);
  const logger = createLogger('api');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 1_048_576,
      requestTimeout: 30_000,
      connectionTimeout: 10_000,
      keepAliveTimeout: 72_000,
    }),
    { bufferLogs: true, rawBody: true },
  );

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity:
      process.env.NODE_ENV === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
  });
  await app.register(cors, {
    origin: environment.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      const requestId = request.headers['x-request-id']?.toString() ?? randomUUID();
      request.headers['x-request-id'] = requestId;
      void reply.header('x-request-id', requestId);
      done();
    });
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter(logger));
  app.useGlobalInterceptors(new JsonSafeInterceptor());

  const openApi = new DocumentBuilder()
    .setTitle('LogiCommerce API')
    .setDescription('Tenant-scoped commerce and logistics API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'machineCredential')
    .addApiKey({ type: 'apiKey', name: 'Idempotency-Key', in: 'header' }, 'idempotency')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, openApi));

  await app.listen(environment.API_PORT, '0.0.0.0');
  logger.info({ port: environment.API_PORT }, 'API listening');
}

void bootstrap();

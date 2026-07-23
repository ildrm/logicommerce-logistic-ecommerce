import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, finalize } from 'rxjs';
import { RequestMetricsService } from './request-metrics.service.js';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: RequestMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = performance.now();
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    return next.handle().pipe(
      finalize(() => {
        const route = request.routeOptions?.url ?? request.url.split('?')[0] ?? 'unknown';
        this.metrics.record(request.method, route, reply.statusCode, performance.now() - started);
      }),
    );
  }
}

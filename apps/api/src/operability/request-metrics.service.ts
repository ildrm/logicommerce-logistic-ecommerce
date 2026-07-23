import { Injectable } from '@nestjs/common';

type RouteMetric = {
  count: number;
  errors: number;
  totalDurationMs: number;
  maximumDurationMs: number;
};

@Injectable()
export class RequestMetricsService {
  private readonly startedAt = new Date();
  private readonly routes = new Map<string, RouteMetric>();

  record(method: string, route: string, statusCode: number, durationMs: number): void {
    const key = `${method.toUpperCase()} ${route}`;
    const metric = this.routes.get(key) ?? {
      count: 0,
      errors: 0,
      totalDurationMs: 0,
      maximumDurationMs: 0,
    };
    metric.count += 1;
    metric.errors += statusCode >= 500 ? 1 : 0;
    metric.totalDurationMs += durationMs;
    metric.maximumDurationMs = Math.max(metric.maximumDurationMs, durationMs);
    this.routes.set(key, metric);
  }

  snapshot() {
    return {
      startedAt: this.startedAt.toISOString(),
      processUptimeSeconds: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      routes: [...this.routes.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([route, metric]) => ({
          route,
          count: metric.count,
          errors: metric.errors,
          averageDurationMs:
            metric.count === 0
              ? 0
              : Math.round((metric.totalDurationMs / metric.count) * 100) / 100,
          maximumDurationMs: Math.round(metric.maximumDurationMs * 100) / 100,
        })),
    };
  }
}

import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { createLogger } from '@logicommerce/observability';
import { C2CRepository } from './c2c.repository.js';

const logger = createLogger('c2c-payment-release-scheduler');

@Injectable()
export class C2CPaymentReleaseScheduler implements OnModuleInit, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly repository: C2CRepository) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), 5_000);
    void this.run();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      const processed = await this.repository.processPaymentReleases();
      if (processed > 0) logger.info({ processed }, 'C2C payment releases processed');
    } catch (error) {
      logger.error({ err: error }, 'C2C payment release sweep failed; retrying');
    } finally {
      this.running = false;
    }
  }
}

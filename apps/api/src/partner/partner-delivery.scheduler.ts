import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { createLogger } from '@logicommerce/observability';
import { PartnerRepository } from './partner.repository.js';

const logger = createLogger('partner-webhook-scheduler');

@Injectable()
export class PartnerDeliveryScheduler implements OnModuleInit, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly repository: PartnerRepository) {}

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
      const processed = await this.repository.processAllDeliveries();
      if (processed > 0) logger.info({ processed }, 'Partner webhook deliveries processed');
    } catch (error) {
      logger.error({ err: error }, 'Partner webhook delivery sweep failed; retrying');
    } finally {
      this.running = false;
    }
  }
}

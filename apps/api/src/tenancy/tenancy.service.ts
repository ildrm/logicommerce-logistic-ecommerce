import { Injectable, NotFoundException } from '@nestjs/common';
import type { TenantSummary } from '@logicommerce/api-contracts';
import { TenantContextService } from './tenant-context.service.js';
import { TenantRepository } from './tenant.repository.js';

@Injectable()
export class TenancyService {
  constructor(
    private readonly contexts: TenantContextService,
    private readonly tenants: TenantRepository,
  ) {}

  async current(): Promise<TenantSummary> {
    const tenant = await this.tenants.findCurrent(this.contexts.get());
    if (!tenant) throw new NotFoundException('Resource not found');
    return tenant;
  }
}

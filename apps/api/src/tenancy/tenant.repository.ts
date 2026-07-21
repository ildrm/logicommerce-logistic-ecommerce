import { Inject, Injectable } from '@nestjs/common';
import type { TenantSummary } from '@logicommerce/api-contracts';
import type { DatabaseClient, TenantContext } from '@logicommerce/database';
import { tenantScopedWhere } from '@logicommerce/database';
import { DATABASE } from '../database/database.module.js';

@Injectable()
export class TenantRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  findCurrent(context: TenantContext): Promise<TenantSummary | null> {
    return this.database.tenant.findFirst({
      where: tenantScopedWhere(context, { status: 'ACTIVE' as const }, 'id'),
      select: { id: true, slug: true, name: true, defaultLocale: true, defaultCurrency: true },
    });
  }
}

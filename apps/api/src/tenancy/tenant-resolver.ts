import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient } from '@logicommerce/database';
import { DATABASE } from '../database/database.module.js';

@Injectable()
export class TenantResolver {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async resolveVerifiedHostname(hostname: string): Promise<string | null> {
    if (hostname.length === 0) return null;
    const domain = await this.database.tenantDomain.findFirst({
      where: {
        hostname: hostname.toLowerCase().replace(/\.$/u, ''),
        verifiedAt: { not: null },
        tenant: { status: 'ACTIVE' },
      },
      select: { tenantId: true },
    });
    return domain?.tenantId ?? null;
  }
}

import { randomUUID } from 'node:crypto';
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
      select: {
        id: true,
        slug: true,
        name: true,
        defaultLocale: true,
        defaultCurrency: true,
        selfRegistrationEnabled: true,
      },
    });
  }

  updateRegistration(context: TenantContext, enabled: boolean): Promise<TenantSummary> {
    return this.database.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.update({
        where: { id: context.tenantId },
        data: { selfRegistrationEnabled: enabled },
        select: {
          id: true,
          slug: true,
          name: true,
          defaultLocale: true,
          defaultCurrency: true,
          selfRegistrationEnabled: true,
        },
      });
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          actorId: context.actorId,
          actorType: 'USER',
          action: 'tenant.registration-settings.updated',
          entityType: 'TENANT',
          entityId: context.tenantId,
          requestId: context.correlationId,
          correlationId: context.correlationId,
          metadata: { selfRegistrationEnabled: enabled },
        },
      });
      return tenant;
    });
  }
}

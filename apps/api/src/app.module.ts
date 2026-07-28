import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { B2BModule } from './b2b/b2b.module.js';
import { BillingModule } from './billing/billing.module.js';
import { C2CModule } from './c2c/c2c.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CommerceModule } from './commerce/commerce.module.js';
import { DatabaseModule } from './database/database.module.js';
import { FulfillmentModule } from './fulfillment/fulfillment.module.js';
import { FreightModule } from './freight/freight.module.js';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { InternationalLogisticsModule } from './international-logistics/international-logistics.module.js';
import { NetworkOperationsModule } from './network-operations/network-operations.module.js';
import { OperabilityModule } from './operability/operability.module.js';
import { OptimizationModule } from './optimization/optimization.module.js';
import { PartnerModule } from './partner/partner.module.js';
import { ReturnsFinanceModule } from './returns-finance/returns-finance.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';

@Module({
  imports: [
    DatabaseModule,
    AnalyticsModule,
    HealthModule,
    TenancyModule,
    AuthModule,
    IdentityModule,
    CatalogModule,
    CommerceModule,
    FulfillmentModule,
    FreightModule,
    InternationalLogisticsModule,
    C2CModule,
    B2BModule,
    BillingModule,
    PartnerModule,
    ReturnsFinanceModule,
    NetworkOperationsModule,
    OptimizationModule,
    OperabilityModule,
  ],
})
export class AppModule {}

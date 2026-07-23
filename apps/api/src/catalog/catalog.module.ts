import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenancy/tenant-context.module.js';
import { CatalogController, StorefrontController } from './catalog.controller.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';
import { CATALOG_SEARCH } from './catalog-search.port.js';
import { MySqlCatalogSearchAdapter } from './mysql-catalog-search.adapter.js';

@Module({
  imports: [TenantContextModule],
  controllers: [CatalogController, StorefrontController],
  providers: [
    CatalogRepository,
    CatalogService,
    { provide: CATALOG_SEARCH, useClass: MySqlCatalogSearchAdapter },
  ],
  exports: [CatalogService],
})
export class CatalogModule {}

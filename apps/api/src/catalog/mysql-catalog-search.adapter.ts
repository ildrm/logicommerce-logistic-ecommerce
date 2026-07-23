import { Injectable } from '@nestjs/common';
import type { TenantContext } from '@logicommerce/database';
import type { StorefrontQueryDto } from './catalog.dto.js';
import type { CatalogSearchPort } from './catalog-search.port.js';
import { CatalogRepository } from './catalog.repository.js';

@Injectable()
export class MySqlCatalogSearchAdapter implements CatalogSearchPort {
  constructor(private readonly catalog: CatalogRepository) {}

  search(context: TenantContext, storeKey: string, query: StorefrontQueryDto) {
    return this.catalog.publicProducts(context, storeKey, query);
  }

  product(context: TenantContext, storeKey: string, slug: string) {
    return this.catalog.publicProductBySlug(context, storeKey, slug);
  }
}

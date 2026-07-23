import type { TenantContext } from '@logicommerce/database';
import type { StorefrontQueryDto } from './catalog.dto.js';

export const CATALOG_SEARCH = Symbol('CATALOG_SEARCH');

export interface CatalogSearchPort {
  search(context: TenantContext, storeKey: string, query: StorefrontQueryDto): Promise<unknown>;
  product(context: TenantContext, storeKey: string, slug: string): Promise<unknown>;
}

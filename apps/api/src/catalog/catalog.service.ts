import { Inject, Injectable } from '@nestjs/common';
import type { TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import type {
  CreateAttributeDto,
  CreateCategoryDto,
  CreateOfferDto,
  CreatePartnerDto,
  CreateStoreDto,
  CreateStoreDomainDto,
  CreateSubmissionDto,
  ReviewSubmissionDto,
  StorefrontQueryDto,
} from './catalog.dto.js';
import { CatalogRepository } from './catalog.repository.js';
import { CATALOG_SEARCH, type CatalogSearchPort } from './catalog-search.port.js';

@Injectable()
export class CatalogService {
  constructor(
    private readonly catalog: CatalogRepository,
    @Inject(CATALOG_SEARCH) private readonly search: CatalogSearchPort,
  ) {}

  stores(context: TenantContext): Promise<unknown> {
    return this.catalog.stores(context);
  }

  createStore(context: TenantContext, principal: AuthPrincipal, input: CreateStoreDto) {
    return this.catalog.createStore(context, principal, input);
  }

  createStoreDomain(
    context: TenantContext,
    principal: AuthPrincipal,
    storeId: string,
    input: CreateStoreDomainDto,
  ) {
    return this.catalog.createStoreDomain(context, principal, storeId, input);
  }

  createCategory(
    context: TenantContext,
    principal: AuthPrincipal,
    storeId: string,
    input: CreateCategoryDto,
  ) {
    return this.catalog.createCategory(context, principal, storeId, input);
  }

  createAttribute(
    context: TenantContext,
    principal: AuthPrincipal,
    storeId: string,
    input: CreateAttributeDto,
  ) {
    return this.catalog.createAttribute(context, principal, storeId, input);
  }

  partners(context: TenantContext) {
    return this.catalog.partners(context);
  }

  createSupplier(context: TenantContext, principal: AuthPrincipal, input: CreatePartnerDto) {
    return this.catalog.createSupplier(context, principal, input);
  }

  createSeller(context: TenantContext, principal: AuthPrincipal, input: CreatePartnerDto) {
    return this.catalog.createSeller(context, principal, input);
  }

  submissions(context: TenantContext): Promise<unknown> {
    return this.catalog.submissions(context);
  }

  createSubmission(context: TenantContext, principal: AuthPrincipal, input: CreateSubmissionDto) {
    return this.catalog.createSubmission(context, principal, input);
  }

  submit(context: TenantContext, principal: AuthPrincipal, submissionId: string) {
    return this.catalog.submit(context, principal, submissionId);
  }

  approve(
    context: TenantContext,
    principal: AuthPrincipal,
    submissionId: string,
    input: ReviewSubmissionDto,
  ) {
    return this.catalog.approve(context, principal, submissionId, input);
  }

  reject(
    context: TenantContext,
    principal: AuthPrincipal,
    submissionId: string,
    input: ReviewSubmissionDto,
  ) {
    return this.catalog.reject(context, principal, submissionId, input);
  }

  offers(context: TenantContext) {
    return this.catalog.offers(context);
  }

  createOffer(context: TenantContext, principal: AuthPrincipal, input: CreateOfferDto) {
    return this.catalog.createOffer(context, principal, input);
  }

  publishOffer(context: TenantContext, principal: AuthPrincipal, offerId: string) {
    return this.catalog.publishOffer(context, principal, offerId);
  }

  publicStores(context: TenantContext) {
    return this.catalog.publicStores(context);
  }

  publicProducts(context: TenantContext, storeKey: string, query: StorefrontQueryDto) {
    return this.search.search(context, storeKey, query);
  }

  publicProduct(context: TenantContext, storeKey: string, slug: string) {
    return this.search.product(context, storeKey, slug);
  }
}

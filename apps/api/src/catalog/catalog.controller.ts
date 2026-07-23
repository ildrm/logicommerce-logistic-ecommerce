import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
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
import { CatalogService } from './catalog.service.js';

@ApiTags('catalog administration')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('stores')
  @RequirePermissions('store.manage')
  stores(): Promise<unknown> {
    return this.catalog.stores(this.contexts.get());
  }

  @Post('stores')
  @RequirePermissions('store.manage')
  createStore(@Body() input: CreateStoreDto, @Req() request: AuthenticatedRequest) {
    return this.catalog.createStore(this.contexts.get(), this.principal(request), input);
  }

  @Post('stores/:storeId/domains')
  @RequirePermissions('store.manage')
  createStoreDomain(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() input: CreateStoreDomainDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.createStoreDomain(
      this.contexts.get(),
      this.principal(request),
      storeId,
      input,
    );
  }

  @Post('stores/:storeId/categories')
  @RequirePermissions('store.manage')
  createCategory(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() input: CreateCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.createCategory(
      this.contexts.get(),
      this.principal(request),
      storeId,
      input,
    );
  }

  @Post('stores/:storeId/attributes')
  @RequirePermissions('store.manage')
  createAttribute(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() input: CreateAttributeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.createAttribute(
      this.contexts.get(),
      this.principal(request),
      storeId,
      input,
    );
  }

  @Get('partners')
  @RequirePermissions('catalog.submit')
  partners() {
    return this.catalog.partners(this.contexts.get());
  }

  @Post('suppliers')
  @RequirePermissions('catalog.submit')
  createSupplier(@Body() input: CreatePartnerDto, @Req() request: AuthenticatedRequest) {
    return this.catalog.createSupplier(this.contexts.get(), this.principal(request), input);
  }

  @Post('sellers')
  @RequirePermissions('offer.manage')
  createSeller(@Body() input: CreatePartnerDto, @Req() request: AuthenticatedRequest) {
    return this.catalog.createSeller(this.contexts.get(), this.principal(request), input);
  }

  @Get('submissions')
  @RequirePermissions('catalog.submit')
  submissions(): Promise<unknown> {
    return this.catalog.submissions(this.contexts.get());
  }

  @Post('submissions')
  @RequirePermissions('catalog.submit')
  createSubmission(@Body() input: CreateSubmissionDto, @Req() request: AuthenticatedRequest) {
    return this.catalog.createSubmission(this.contexts.get(), this.principal(request), input);
  }

  @Put('submissions/:submissionId/submit')
  @RequirePermissions('catalog.submit')
  submit(
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.submit(this.contexts.get(), this.principal(request), submissionId);
  }

  @Put('submissions/:submissionId/approve')
  @RequirePermissions('catalog.approve')
  approve(
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @Body() input: ReviewSubmissionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.approve(this.contexts.get(), this.principal(request), submissionId, input);
  }

  @Put('submissions/:submissionId/reject')
  @RequirePermissions('catalog.approve')
  reject(
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @Body() input: ReviewSubmissionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.reject(this.contexts.get(), this.principal(request), submissionId, input);
  }

  @Get('offers')
  @RequirePermissions('offer.manage')
  offers() {
    return this.catalog.offers(this.contexts.get());
  }

  @Post('offers')
  @RequirePermissions('offer.manage')
  createOffer(@Body() input: CreateOfferDto, @Req() request: AuthenticatedRequest) {
    return this.catalog.createOffer(this.contexts.get(), this.principal(request), input);
  }

  @Put('offers/:offerId/publish')
  @RequirePermissions('offer.manage')
  publishOffer(
    @Param('offerId', new ParseUUIDPipe()) offerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.publishOffer(this.contexts.get(), this.principal(request), offerId);
  }

  private principal(request: AuthenticatedRequest): AuthPrincipal {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

@ApiTags('storefront')
@Controller({ path: 'storefront', version: '1' })
export class StorefrontController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('stores')
  stores() {
    return this.catalog.publicStores(this.contexts.get());
  }

  @Get('stores/:storeKey/products')
  products(@Param('storeKey') storeKey: string, @Query() query: StorefrontQueryDto) {
    return this.catalog.publicProducts(this.contexts.get(), storeKey, query);
  }

  @Get('stores/:storeKey/products/:slug')
  product(@Param('storeKey') storeKey: string, @Param('slug') slug: string) {
    return this.catalog.publicProduct(this.contexts.get(), storeKey, slug);
  }
}

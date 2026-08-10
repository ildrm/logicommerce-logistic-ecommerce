import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
  CreateC2COfferDto,
  CreateDisputeDto,
  CreateListingDto,
  CreateReviewDto,
  ModerateListingDto,
  ResolveDisputeDto,
  ShipmentEvidenceDto,
  VerifySellerDto,
} from './c2c.dto.js';
import { C2CRepository } from './c2c.repository.js';

@ApiTags('c2c public')
@Controller({ path: 'c2c', version: '1' })
export class C2CPublicController {
  constructor(
    private readonly repo: C2CRepository,
    private readonly contexts: TenantContextService,
  ) {}
  @Get('listings') listings() {
    return this.repo.publicListings(this.contexts.get());
  }
}

@ApiTags('c2c')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'c2c', version: '1' })
export class C2CController {
  constructor(
    private readonly repo: C2CRepository,
    private readonly contexts: TenantContextService,
  ) {}

  @Post('seller/verify')
  @RequirePermissions('c2c.trade')
  verify(@Body() input: VerifySellerDto, @Req() req: AuthenticatedRequest) {
    return this.repo.verifySeller(this.contexts.get(), this.principal(req), input);
  }
  @Get('listings/mine')
  @RequirePermissions('c2c.trade')
  mine(@Req() req: AuthenticatedRequest) {
    return this.repo.mine(this.contexts.get(), this.principal(req));
  }
  @Post('listings')
  @RequirePermissions('c2c.trade')
  create(@Body() input: CreateListingDto, @Req() req: AuthenticatedRequest) {
    return this.repo.createListing(this.contexts.get(), this.principal(req), input);
  }
  @Post('listings/:id/submit')
  @RequirePermissions('c2c.trade')
  submit(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.repo.submit(this.contexts.get(), this.principal(req), id);
  }
  @Post('listings/:id/moderate')
  @RequirePermissions('c2c.moderate')
  moderate(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: ModerateListingDto) {
    return this.repo.moderate(this.contexts.get(), id, input);
  }
  @Post('listings/:id/offers')
  @RequirePermissions('c2c.trade')
  offer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateC2COfferDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.repo.offer(
      this.contexts.get(),
      this.principal(req),
      id,
      idempotencyKey ?? '',
      input,
    );
  }
  @Post('offers/:id/accept')
  @RequirePermissions('c2c.trade')
  accept(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.repo.acceptOffer(this.contexts.get(), this.principal(req), id);
  }
  @Post('transactions/:id/shipment')
  @RequirePermissions('c2c.trade')
  shipment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ShipmentEvidenceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.repo.shipment(this.contexts.get(), this.principal(req), id, input);
  }
  @Post('transactions/:id/delivered')
  @RequirePermissions('c2c.trade')
  delivered(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.repo.confirmDelivery(this.contexts.get(), this.principal(req), id);
  }
  @Post('transactions/:id/release-payout')
  @RequirePermissions('c2c.moderate')
  payout(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.repo.releasePayout(this.contexts.get(), id);
  }
  @Post('transactions/:id/disputes')
  @RequirePermissions('c2c.trade')
  dispute(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateDisputeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.repo.dispute(this.contexts.get(), this.principal(req), id, input);
  }
  @Post('disputes/:id/resolve')
  @RequirePermissions('c2c.moderate')
  resolve(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: ResolveDisputeDto) {
    return this.repo.resolveDispute(this.contexts.get(), id, input);
  }
  @Post('transactions/:id/reviews')
  @RequirePermissions('c2c.trade')
  review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateReviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.repo.review(this.contexts.get(), this.principal(req), id, input);
  }

  private principal(req: AuthenticatedRequest) {
    if (!req.auth) throw new Error('Auth guard did not attach a principal');
    return req.auth;
  }
}

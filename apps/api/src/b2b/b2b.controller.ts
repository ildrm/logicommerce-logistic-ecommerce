import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
  AcceptBusinessQuoteDto,
  AddSellerMemberDto,
  AddBusinessMemberDto,
  ContractPriceDto,
  CreateBusinessAccountDto,
  CreateBusinessQuoteDto,
  CreateRfqDto,
  FulfillBusinessOrderDto,
} from './b2b.dto.js';
import { B2BRepository } from './b2b.repository.js';

@ApiTags('b2b')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'b2b', version: '1' })
export class B2BController {
  constructor(
    private readonly repo: B2BRepository,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('accounts')
  @RequirePermissions('b2b.manage')
  accounts() {
    return this.repo.accounts(this.contexts.get());
  }
  @Post('accounts')
  @RequirePermissions('b2b.manage')
  createAccount(@Body() input: CreateBusinessAccountDto) {
    return this.repo.createAccount(this.contexts.get(), input);
  }
  @Post('accounts/:id/members')
  @RequirePermissions('b2b.manage')
  addMember(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: AddBusinessMemberDto) {
    return this.repo.addMember(this.contexts.get(), id, input);
  }
  @Post('accounts/:id/contract-prices')
  @RequirePermissions('b2b.manage')
  price(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: ContractPriceDto) {
    return this.repo.contractPrice(this.contexts.get(), id, input);
  }
  @Post('sellers/:id/members')
  @RequirePermissions('b2b.manage')
  addSellerMember(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: AddSellerMemberDto) {
    return this.repo.addSellerMember(this.contexts.get(), id, input);
  }
  @Get('accounts/:id/contract-prices')
  @RequirePermissions('b2b.buy')
  prices(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.repo.prices(this.contexts.get(), this.principal(req), id);
  }
  @Get('rfqs')
  @RequirePermissions('b2b.sell')
  rfqs(@Req() req: AuthenticatedRequest) {
    return this.repo.rfqs(this.contexts.get(), this.principal(req));
  }
  @Post('accounts/:id/rfqs')
  @RequirePermissions('b2b.buy')
  createRfq(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateRfqDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.repo.createRfq(this.contexts.get(), this.principal(req), id, input);
  }
  @Post('rfqs/:id/quotes')
  @RequirePermissions('b2b.sell')
  quote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateBusinessQuoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.repo.quote(this.contexts.get(), this.principal(req), id, input);
  }
  @Post('quotes/:id/accept')
  @RequirePermissions('b2b.buy')
  accept(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: AcceptBusinessQuoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.repo.acceptQuote(this.contexts.get(), this.principal(req), id, input);
  }
  @Post('orders/:id/approve')
  @RequirePermissions('b2b.approve')
  approve(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.repo.approve(this.contexts.get(), this.principal(req), id);
  }
  @Post('orders/:id/fulfill')
  @RequirePermissions('b2b.sell')
  fulfill(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: FulfillBusinessOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.repo.fulfill(this.contexts.get(), this.principal(req), id, input);
  }
  @Get('orders')
  @RequirePermissions('b2b.manage')
  orders() {
    return this.repo.orders(this.contexts.get());
  }

  private principal(req: AuthenticatedRequest) {
    if (!req.auth) throw new Error('Auth guard did not attach a principal');
    return req.auth;
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
  AssignClientInventoryDto,
  ApproveRouteDto,
  CreateControlTowerExceptionDto,
  CreateLogisticsClientDto,
  CreateLogisticsContractDto,
  IssueLogisticsInvoiceDto,
  RecommendRouteDto,
  RecordBillableEventDto,
} from './network-operations.dto.js';
import { NetworkOperationsRepository } from './network-operations.repository.js';

@ApiTags('network-operations')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'network-operations', version: '1' })
export class NetworkOperationsController {
  constructor(
    private readonly repo: NetworkOperationsRepository,
    private readonly contexts: TenantContextService,
  ) {}
  @Get('clients')
  @RequirePermissions('3pl.manage')
  clients() {
    return this.repo.clients(this.contexts.get());
  }
  @Post('clients')
  @RequirePermissions('3pl.manage')
  createClient(@Body() input: CreateLogisticsClientDto) {
    return this.repo.createClient(this.contexts.get(), input);
  }
  @Post('clients/:id/contracts')
  @RequirePermissions('3pl.manage')
  contract(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateLogisticsContractDto,
  ) {
    return this.repo.createContract(this.contexts.get(), id, input);
  }
  @Post('clients/:id/inventory')
  @RequirePermissions('3pl.operate')
  inventory(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: AssignClientInventoryDto) {
    return this.repo.assignInventory(this.contexts.get(), id, input);
  }
  @Post('clients/:id/billable-events')
  @RequirePermissions('3pl.bill')
  billable(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: RecordBillableEventDto) {
    return this.repo.recordBillableEvent(this.contexts.get(), id, input);
  }
  @Post('clients/:id/invoices')
  @RequirePermissions('3pl.bill')
  invoice(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: IssueLogisticsInvoiceDto) {
    return this.repo.issueInvoice(this.contexts.get(), id, input);
  }
  @Get('control-tower/exceptions')
  @RequirePermissions('4pl.control')
  exceptions() {
    return this.repo.exceptions(this.contexts.get());
  }
  @Post('control-tower/exceptions')
  @RequirePermissions('4pl.control')
  exception(@Req() req: AuthenticatedRequest, @Body() input: CreateControlTowerExceptionDto) {
    return this.repo.createException(this.contexts.get(), this.principal(req), input);
  }
  @Post('control-tower/exceptions/:id/recommendations')
  @RequirePermissions('4pl.control')
  recommend(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: RecommendRouteDto) {
    return this.repo.recommend(this.contexts.get(), id, input);
  }
  @Post('control-tower/recommendations/:id/approve')
  @RequirePermissions('4pl.approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: ApproveRouteDto,
  ) {
    return this.repo.approve(this.contexts.get(), this.principal(req), id, input);
  }
  @Post('control-tower/recommendations/:id/execute')
  @RequirePermissions('4pl.control')
  execute(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.repo.execute(this.contexts.get(), this.principal(req), id);
  }
  private principal(request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

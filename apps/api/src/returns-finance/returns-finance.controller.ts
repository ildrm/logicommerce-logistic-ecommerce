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
  CalculateSettlementDto,
  CreateReturnDto,
  InspectReturnDto,
  PostJournalDto,
  ReceiveReturnDto,
  ReconcileDto,
  ReverseJournalDto,
} from './returns-finance.dto.js';
import { ReturnsFinanceRepository } from './returns-finance.repository.js';

@ApiTags('returns-finance')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'returns-finance', version: '1' })
export class ReturnsFinanceController {
  constructor(
    private readonly repo: ReturnsFinanceRepository,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('returns/mine')
  @RequirePermissions('return.use')
  mine(@Req() req: AuthenticatedRequest) {
    return this.repo.returns(this.contexts.get(), this.principal(req), false);
  }
  @Get('returns')
  @RequirePermissions('return.manage')
  returns(@Req() req: AuthenticatedRequest) {
    return this.repo.returns(this.contexts.get(), this.principal(req), true);
  }
  @Post('returns')
  @RequirePermissions('return.use')
  create(
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateReturnDto,
  ) {
    return this.repo.createReturn(
      this.contexts.get(),
      this.principal(req),
      idempotencyKey ?? '',
      input,
    );
  }
  @Post('returns/:id/approve')
  @RequirePermissions('return.manage')
  approve(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.repo.approveReturn(this.contexts.get(), this.principal(req), id);
  }
  @Post('returns/:id/receive')
  @RequirePermissions('return.manage')
  receive(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: ReceiveReturnDto) {
    return this.repo.receiveReturn(this.contexts.get(), id, input);
  }
  @Post('returns/:id/inspect')
  @RequirePermissions('return.manage')
  inspect(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: InspectReturnDto,
  ) {
    return this.repo.inspectReturn(this.contexts.get(), this.principal(req), id, input);
  }
  @Get('accounts')
  @RequirePermissions('finance.manage')
  accounts() {
    return this.repo.accounts(this.contexts.get());
  }
  @Get('journals')
  @RequirePermissions('finance.manage')
  journals() {
    return this.repo.journals(this.contexts.get());
  }
  @Post('journals')
  @RequirePermissions('finance.manage')
  journal(@Req() req: AuthenticatedRequest, @Body() input: PostJournalDto) {
    return this.repo.postJournal(this.contexts.get(), this.principal(req), input);
  }
  @Post('journals/:id/reverse')
  @RequirePermissions('finance.manage')
  reverse(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: ReverseJournalDto,
  ) {
    return this.repo.reverseJournal(this.contexts.get(), this.principal(req), id, input);
  }
  @Get('settlements')
  @RequirePermissions('settlement.manage')
  settlements() {
    return this.repo.settlements(this.contexts.get());
  }
  @Post('settlements/calculate')
  @RequirePermissions('settlement.manage')
  settlement(@Body() input: CalculateSettlementDto) {
    return this.repo.calculateSettlement(this.contexts.get(), input);
  }
  @Post('settlements/:id/approve')
  @RequirePermissions('settlement.approve')
  approveSettlement(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.repo.approveSettlement(this.contexts.get(), this.principal(req), id);
  }
  @Post('settlements/:id/pay')
  @RequirePermissions('settlement.pay')
  pay(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.repo.paySettlement(this.contexts.get(), id);
  }
  @Post('reconciliations')
  @RequirePermissions('finance.manage')
  reconcile(@Req() req: AuthenticatedRequest, @Body() input: ReconcileDto) {
    return this.repo.reconcile(this.contexts.get(), this.principal(req), input);
  }

  private principal(request: AuthenticatedRequest): AuthenticatedRequest['auth'] & {} {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

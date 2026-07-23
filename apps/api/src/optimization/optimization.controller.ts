import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
  CreateNetworkModelDto,
  OptimizationDecisionDto,
  RecordOptimizationOutcomeDto,
  RunOptimizationDto,
} from './optimization.dto.js';
import { OptimizationRepository } from './optimization.repository.js';

@ApiTags('optimization')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'optimization', version: '1' })
export class OptimizationController {
  constructor(
    private readonly repo: OptimizationRepository,
    private readonly contexts: TenantContextService,
  ) {}
  @Get('models')
  @RequirePermissions('optimization.manage')
  models() {
    return this.repo.models(this.contexts.get());
  }
  @Post('models')
  @RequirePermissions('optimization.manage')
  model(@Req() req: AuthenticatedRequest, @Body() input: CreateNetworkModelDto) {
    return this.repo.createModel(this.contexts.get(), this.principal(req), input);
  }
  @Get('runs')
  @RequirePermissions('optimization.manage')
  runs() {
    return this.repo.runs(this.contexts.get());
  }
  @Post('models/:id/runs')
  @RequirePermissions('optimization.manage')
  run(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: RunOptimizationDto,
  ) {
    return this.repo.run(this.contexts.get(), this.principal(req), id, input);
  }
  @Post('recommendations/:id/approve')
  @RequirePermissions('optimization.approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: OptimizationDecisionDto,
  ) {
    return this.repo.decide(this.contexts.get(), this.principal(req), id, 'APPROVED', input.reason);
  }
  @Post('recommendations/:id/reject')
  @RequirePermissions('optimization.approve')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: OptimizationDecisionDto,
  ) {
    return this.repo.decide(this.contexts.get(), this.principal(req), id, 'REJECTED', input.reason);
  }
  @Post('recommendations/:id/execute')
  @RequirePermissions('optimization.execute')
  execute(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthenticatedRequest) {
    return this.repo.execute(this.contexts.get(), this.principal(req), id);
  }
  @Post('recommendations/:id/rollback')
  @RequirePermissions('optimization.execute')
  rollback(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: OptimizationDecisionDto,
  ) {
    return this.repo.rollback(this.contexts.get(), this.principal(req), id, input.reason);
  }
  @Post('recommendations/:id/outcome')
  @RequirePermissions('optimization.manage')
  outcome(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: RecordOptimizationOutcomeDto,
  ) {
    return this.repo.outcome(this.contexts.get(), this.principal(req), id, input);
  }
  private principal(request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

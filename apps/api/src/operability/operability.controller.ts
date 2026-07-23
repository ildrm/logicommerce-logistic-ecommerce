import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
  CompletePrivacyRequestDto,
  CompleteRecoveryExerciseDto,
  CreateSloDto,
  PrivacyRequestDto,
  RecordSloObservationDto,
  RetentionPolicyDto,
  StartRecoveryExerciseDto,
} from './operability.dto.js';
import { OperabilityRepository } from './operability.repository.js';
import { RequestMetricsService } from './request-metrics.service.js';

@ApiTags('operability')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'operability', version: '1' })
export class OperabilityController {
  constructor(
    private readonly repo: OperabilityRepository,
    private readonly contexts: TenantContextService,
    private readonly metricsService: RequestMetricsService,
  ) {}
  @Get('metrics')
  @RequirePermissions('operability.read')
  metrics() {
    return this.metricsService.snapshot();
  }
  @Get('slos')
  @RequirePermissions('operability.read')
  slos() {
    return this.repo.slos(this.contexts.get());
  }
  @Post('slos')
  @RequirePermissions('operability.manage')
  slo(@Body() input: CreateSloDto) {
    return this.repo.createSlo(this.contexts.get(), input);
  }
  @Post('slos/:id/observations')
  @RequirePermissions('operability.manage')
  observation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RecordSloObservationDto,
  ) {
    return this.repo.observe(this.contexts.get(), id, input);
  }
  @Get('recovery-exercises')
  @RequirePermissions('operability.read')
  recoveryExercises() {
    return this.repo.recoveryExercises(this.contexts.get());
  }
  @Post('recovery-exercises')
  @RequirePermissions('operability.manage')
  recovery(@Req() req: AuthenticatedRequest, @Body() input: StartRecoveryExerciseDto) {
    return this.repo.startRecovery(this.contexts.get(), this.principal(req), input);
  }
  @Post('recovery-exercises/:id/complete')
  @RequirePermissions('operability.manage')
  completeRecovery(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CompleteRecoveryExerciseDto,
  ) {
    return this.repo.completeRecovery(this.contexts.get(), id, input);
  }
  @Get('retention-policies')
  @RequirePermissions('privacy.manage')
  retentionPolicies() {
    return this.repo.retentionPolicies(this.contexts.get());
  }
  @Put('retention-policies')
  @RequirePermissions('privacy.manage')
  retention(@Req() req: AuthenticatedRequest, @Body() input: RetentionPolicyDto) {
    return this.repo.setRetention(this.contexts.get(), this.principal(req), input);
  }
  @Get('privacy-requests')
  @RequirePermissions('privacy.manage')
  privacyRequests() {
    return this.repo.privacyRequests(this.contexts.get());
  }
  @Post('privacy-requests')
  @RequirePermissions('privacy.manage')
  privacy(@Body() input: PrivacyRequestDto) {
    return this.repo.createPrivacy(this.contexts.get(), input);
  }
  @Post('privacy-requests/:id/complete')
  @RequirePermissions('privacy.manage')
  completePrivacy(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: CompletePrivacyRequestDto,
  ) {
    return this.repo.completePrivacy(this.contexts.get(), this.principal(req), id, input.evidence);
  }
  private principal(request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

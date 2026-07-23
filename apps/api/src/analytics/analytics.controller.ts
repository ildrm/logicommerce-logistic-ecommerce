import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { AnalyticsRepository } from './analytics.repository.js';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsRepository,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('overview')
  @RequirePermissions('operability.read')
  overview(
    @Query('days', new DefaultValuePipe(14), ParseIntPipe) days: number,
  ) {
    if (![7, 14, 30].includes(days)) {
      throw new BadRequestException('days must be one of 7, 14, or 30');
    }
    return this.analytics.overview(this.contexts.get(), days);
  }
}

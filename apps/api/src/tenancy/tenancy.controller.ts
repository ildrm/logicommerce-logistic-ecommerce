import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TenantSummary } from '@logicommerce/api-contracts';
import { AuthGuard } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenancyService } from './tenancy.service.js';

@ApiTags('tenancy')
@Controller({ path: 'tenants', version: '1' })
export class TenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get('current')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('tenant.configure')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the active resolved tenant' })
  current(): Promise<TenantSummary> {
    return this.tenancy.current();
  }
}

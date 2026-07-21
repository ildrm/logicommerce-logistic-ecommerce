import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TenantSummary } from '@logicommerce/api-contracts';
import { TenancyService } from './tenancy.service.js';

@ApiTags('tenancy')
@Controller({ path: 'tenants', version: '1' })
export class TenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get('current')
  @ApiOperation({ summary: 'Return the active resolved tenant' })
  current(): Promise<TenantSummary> {
    return this.tenancy.current();
  }
}

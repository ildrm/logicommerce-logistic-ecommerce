import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MachineAuthGuard, type MachineRequest } from './machine-auth.guard.js';
import { RequireMachineScopes } from './machine-scope.decorator.js';
import { MachineScopeGuard } from './machine-scope.guard.js';

@ApiTags('machine identity')
@ApiSecurity('machineCredential')
@UseGuards(MachineAuthGuard, MachineScopeGuard)
@Controller({ path: 'identity/machine', version: '1' })
export class MachineIdentityController {
  @Get('me')
  @RequireMachineScopes('tenant.configure')
  current(@Req() request: MachineRequest) {
    return request.machine;
  }
}

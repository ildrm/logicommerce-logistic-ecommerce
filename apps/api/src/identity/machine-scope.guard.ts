import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { MachineRequest } from './machine-auth.guard.js';
import { MACHINE_SCOPES } from './machine-scope.decorator.js';

@Injectable()
export class MachineScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly string[]>(MACHINE_SCOPES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const principal = context.switchToHttp().getRequest<MachineRequest>().machine;
    if (!principal || !required.every((scope) => principal.scopes.includes(scope))) {
      throw new ForbiddenException('Machine credential lacks a required scope');
    }
    return true;
  }
}

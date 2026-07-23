import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { IdentityMailAdapter } from '../auth/identity-mail.adapter.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
  CreateCredentialDto,
  CreateRoleDto,
  CreateUserDto,
  DeliveryPreviewDto,
  SetPermissionsDto,
  SetUserRolesDto,
} from './identity.dto.js';
import { IdentityService } from './identity.service.js';

@ApiTags('identity administration')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'identity', version: '1' })
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly contexts: TenantContextService,
    private readonly mail: IdentityMailAdapter,
  ) {}

  @Get('permissions')
  @RequirePermissions('identity.roles.manage')
  permissions(): Promise<unknown> {
    return this.identity.permissions();
  }

  @Get('roles')
  @RequirePermissions('identity.roles.manage')
  roles(): Promise<unknown> {
    return this.identity.roles(this.contexts.get());
  }

  @Post('roles')
  @RequirePermissions('identity.roles.manage')
  createRole(@Body() input: CreateRoleDto, @Req() request: AuthenticatedRequest) {
    return this.identity.createRole(this.contexts.get(), this.principal(request), input);
  }

  @Put('roles/:roleId/permissions')
  @RequirePermissions('identity.roles.manage')
  setPermissions(
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Body() input: SetPermissionsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.identity.setPermissions(
      this.contexts.get(),
      this.principal(request),
      roleId,
      input.permissionKeys,
    );
  }

  @Get('users')
  @RequirePermissions('identity.users.manage')
  users(): Promise<unknown> {
    return this.identity.users(this.contexts.get());
  }

  @Post('users')
  @RequirePermissions('identity.users.manage')
  createUser(@Body() input: CreateUserDto, @Req() request: AuthenticatedRequest) {
    return this.identity.createUser(this.contexts.get(), this.principal(request), input);
  }

  @Put('users/:userId/roles')
  @RequirePermissions('identity.users.manage')
  setUserRoles(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() input: SetUserRolesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.identity.setUserRoles(
      this.contexts.get(),
      this.principal(request),
      userId,
      input.roleIds,
    );
  }

  @Get('credentials')
  @RequirePermissions('identity.credentials.manage')
  credentials(): Promise<unknown> {
    return this.identity.credentials(this.contexts.get());
  }

  @Post('credentials')
  @RequirePermissions('identity.credentials.manage')
  createCredential(@Body() input: CreateCredentialDto, @Req() request: AuthenticatedRequest) {
    return this.identity.createCredential(this.contexts.get(), this.principal(request), input);
  }

  @Delete('credentials/:credentialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('identity.credentials.manage')
  revokeCredential(
    @Param('credentialId', new ParseUUIDPipe()) credentialId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.identity.revokeCredential(
      this.contexts.get(),
      this.principal(request),
      credentialId,
    );
  }

  @Get('delivery-preview')
  @RequirePermissions('identity.users.manage')
  deliveryPreview(@Query() input: DeliveryPreviewDto) {
    return this.mail.preview(input.email, input.purpose);
  }

  private principal(request: AuthenticatedRequest): AuthPrincipal {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

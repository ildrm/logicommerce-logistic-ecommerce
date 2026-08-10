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
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticationResult } from '@logicommerce/api-contracts';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { AuthService } from './auth.service.js';
import type { AuthPrincipal } from './auth.types.js';
import { LoginDto } from './login.dto.js';
import { MfaCodeDto, MfaEnrollmentDto } from './mfa.dto.js';
import { MfaService } from './mfa.service.js';
import {
  ConsumeIdentityTokenDto,
  EmailRequestDto,
  PasswordlessConsumeDto,
  ResetPasswordDto,
} from './recovery.dto.js';
import { RecoveryService } from './recovery.service.js';

@ApiTags('authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: AuthTokenService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly contexts: TenantContextService,
    private readonly mfa: MfaService,
    private readonly recovery: RecoveryService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with a tenant-local password identity' })
  async login(
    @Body() input: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<AuthenticationResult> {
    await this.rateLimits.assertLoginAllowed(this.contexts.get(), input.email, request.ip);
    const result = await this.auth.login(this.contexts.get(), input, {
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
      ip: request.ip,
    });
    void response.header('set-cookie', this.tokens.refreshCookie(result.refreshToken));
    return this.publicResult(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the HttpOnly refresh token and issue a new access token' })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<AuthenticationResult> {
    await this.rateLimits.assertRefreshAllowed(this.contexts.get(), request.ip);
    const refreshToken = this.cookie(request.headers.cookie, 'logicommerce_refresh');
    if (!refreshToken) throw new UnauthorizedException('Refresh token is required');
    const result = await this.auth.refresh(this.contexts.get(), refreshToken);
    void response.header('set-cookie', this.tokens.refreshCookie(result.refreshToken));
    return this.publicResult(result);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(this.principal(request));
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  sessions(@Req() request: AuthenticatedRequest) {
    return this.auth.sessions(this.principal(request));
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  revokeSession(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.auth.revokeSession(this.contexts.get(), this.principal(request), sessionId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<void> {
    await this.auth.logout(this.contexts.get(), this.principal(request));
    void response.header('set-cookie', this.tokens.clearRefreshCookie());
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<void> {
    await this.auth.logoutAll(this.contexts.get(), this.principal(request));
    void response.header('set-cookie', this.tokens.clearRefreshCookie());
  }

  @Post('mfa/totp/enroll')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  enrollMfa(@Body() input: MfaEnrollmentDto, @Req() request: AuthenticatedRequest) {
    return this.mfa.enroll(this.contexts.get(), this.principal(request), input.currentCode);
  }

  @Post('mfa/totp/confirm')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  confirmMfa(@Body() input: MfaCodeDto, @Req() request: AuthenticatedRequest) {
    return this.mfa.confirm(this.contexts.get(), this.principal(request), input.code);
  }

  @Get('mfa')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  mfaStatus(@Req() request: AuthenticatedRequest) {
    return this.mfa.status(this.principal(request));
  }

  @Post('email-verification/request')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async requestEmailVerification(@Req() request: AuthenticatedRequest) {
    const user = await this.auth.me(this.principal(request));
    return this.recovery.request(this.contexts.get(), user.email, 'EMAIL_VERIFICATION');
  }

  @Post('email-verification/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  verifyEmail(@Body() input: ConsumeIdentityTokenDto) {
    return this.recovery.verifyEmail(this.contexts.get(), input.token);
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() input: EmailRequestDto) {
    return this.recovery.request(this.contexts.get(), input.email, 'PASSWORD_RESET');
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.recovery.resetPassword(this.contexts.get(), input.token, input.password);
  }

  @Post('passwordless/request')
  requestPasswordless(@Body() input: EmailRequestDto) {
    return this.recovery.request(this.contexts.get(), input.email, 'PASSWORDLESS_LOGIN');
  }

  @Post('passwordless/consume')
  async consumePasswordless(
    @Body() input: PasswordlessConsumeDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<AuthenticationResult> {
    const user = await this.recovery.consumePasswordless(this.contexts.get(), input.token);
    await this.mfa.assertLogin(this.contexts.get(), user.id, input.mfaCode);
    const result = await this.auth.issue(
      this.contexts.get(),
      user,
      {
        ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
        ip: request.ip,
      },
      'auth.passwordless.succeeded',
    );
    void response.header('set-cookie', this.tokens.refreshCookie(result.refreshToken));
    return this.publicResult(result);
  }

  private principal(request: AuthenticatedRequest): AuthPrincipal {
    if (!request.auth) throw new UnauthorizedException('Bearer authentication is required');
    return request.auth;
  }

  private publicResult(
    result: AuthenticationResult & { readonly refreshToken: string },
  ): AuthenticationResult {
    return {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  private cookie(header: string | undefined, name: string): string | undefined {
    for (const part of header?.split(';') ?? []) {
      const [key, ...value] = part.trim().split('=');
      if (key === name) {
        try {
          return decodeURIComponent(value.join('='));
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }
}

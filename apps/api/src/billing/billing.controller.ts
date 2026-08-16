import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { CreatePaymentSessionDto, IssueCreditNoteDto, RefundPaymentDto } from './billing.dto.js';
import { BillingService } from './billing.service.js';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('invoices/mine')
  @RequirePermissions('billing.invoice.read')
  invoices(@Req() request: AuthenticatedRequest) {
    return this.billing.invoices(this.contexts.get(), this.principal(request), false);
  }

  @Get('invoices/:id')
  @RequirePermissions('billing.invoice.read')
  invoice(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.billing.invoice(this.contexts.get(), this.principal(request), id);
  }

  @Get('invoices/:id/document')
  @RequirePermissions('billing.invoice.read')
  async document(
    @Req() request: AuthenticatedRequest,
    @Res() reply: FastifyReply,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const document = await this.billing.document(this.contexts.get(), this.principal(request), id);
    return reply
      .header('content-disposition', `attachment; filename="invoice-${id}.pdf"`)
      .type('application/pdf')
      .send(document);
  }

  @Post('invoices/:id/payment-sessions')
  @RequirePermissions('payment.use')
  payment(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreatePaymentSessionDto,
  ) {
    return this.billing.createPaymentSession(
      this.contexts.get(),
      this.principal(request),
      id,
      idempotencyKey ?? '',
      input,
    );
  }

  private principal(request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

@ApiTags('billing-operations')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'billing/operations', version: '1' })
export class BillingOperationsController {
  constructor(
    private readonly billing: BillingService,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('invoices')
  @RequirePermissions('billing.manage')
  invoices(@Req() request: AuthenticatedRequest) {
    return this.billing.invoices(this.contexts.get(), this.principal(request), true);
  }

  @Post('payments/:id/refunds')
  @RequirePermissions('billing.manage')
  refund(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RefundPaymentDto,
  ) {
    return this.billing.refund(
      this.contexts.get(),
      this.principal(request),
      id,
      idempotencyKey ?? '',
      input,
    );
  }

  @Post('invoices/:id/credit-notes')
  @RequirePermissions('billing.manage')
  creditNote(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: IssueCreditNoteDto,
  ) {
    return this.billing.creditNote(
      this.contexts.get(),
      this.principal(request),
      id,
      idempotencyKey ?? '',
      input,
    );
  }

  private principal(request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

@ApiTags('payment-webhooks')
@Controller({ path: 'payments/webhooks', version: '1' })
export class PaymentWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('stripe')
  stripe(
    @Req() request: FastifyRequest & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    return this.billing.stripeWebhook(request.rawBody ?? Buffer.from(''), signature ?? '');
  }

  @Post('coinbase')
  coinbase(
    @Req() request: FastifyRequest & { rawBody?: Buffer },
    @Headers('x-hook0-signature') signature: string | undefined,
  ) {
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key.toLowerCase(),
        Array.isArray(value) ? value.join(',') : String(value ?? ''),
      ]),
    );
    return this.billing.coinbaseWebhook(
      request.rawBody ?? Buffer.from(''),
      signature ?? '',
      headers,
    );
  }
}

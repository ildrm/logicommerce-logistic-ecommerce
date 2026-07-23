import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { PartnerAuthGuard, type PartnerRequest } from './partner-auth.guard.js';
import {
  CreatePartnerCredentialDto,
  CreateWebhookEndpointDto,
  FulfillShopOrderDto,
  SubmitShopOrderDto,
} from './partner.dto.js';
import { PartnerRepository } from './partner.repository.js';
import { PartnerScopes } from './partner-scope.decorator.js';

@ApiTags('partner administration')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'partners', version: '1' })
export class PartnerAdminController {
  constructor(
    private readonly repo: PartnerRepository,
    private readonly contexts: TenantContextService,
  ) {}
  @Get('credentials')
  @RequirePermissions('partner.manage')
  credentials() {
    return this.repo.credentials(this.contexts.get());
  }
  @Post('credentials')
  @RequirePermissions('partner.manage')
  createCredential(@Body() input: CreatePartnerCredentialDto) {
    return this.repo.createCredential(this.contexts.get(), input);
  }
  @Post('credentials/:id/rotate')
  @RequirePermissions('partner.manage')
  rotate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.repo.rotateCredential(this.contexts.get(), id);
  }
  @Post('credentials/:id/revoke')
  @RequirePermissions('partner.manage')
  revoke(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.repo.revokeCredential(this.contexts.get(), id);
  }
  @Get('webhook-endpoints')
  @RequirePermissions('webhook.manage')
  endpoints() {
    return this.repo.endpoints(this.contexts.get());
  }
  @Post('webhook-endpoints')
  @RequirePermissions('webhook.manage')
  createEndpoint(@Body() input: CreateWebhookEndpointDto) {
    return this.repo.createEndpoint(this.contexts.get(), input);
  }
  @Get('webhook-deliveries')
  @RequirePermissions('webhook.manage')
  deliveries() {
    return this.repo.deliveries(this.contexts.get());
  }
  @Post('webhook-deliveries/process')
  @RequirePermissions('webhook.manage')
  process() {
    return this.repo.processDeliveries(this.contexts.get());
  }
  @Post('webhook-deliveries/:id/replay')
  @RequirePermissions('webhook.manage')
  replay(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.repo.replay(this.contexts.get(), id);
  }
}

@ApiTags('shop API')
@UseGuards(PartnerAuthGuard)
@Controller({ path: 'shop', version: '1' })
export class ShopApiController {
  constructor(
    private readonly repo: PartnerRepository,
    private readonly contexts: TenantContextService,
  ) {}
  @Get('catalog')
  @PartnerScopes('catalog.read')
  catalog() {
    return this.repo.catalog(this.contexts.get());
  }
  @Get('inventory')
  @PartnerScopes('inventory.read')
  inventory() {
    return this.repo.inventory(this.contexts.get());
  }
  @Post('orders')
  @PartnerScopes('orders.write')
  order(@Body() input: SubmitShopOrderDto, @Req() req: PartnerRequest) {
    if (!req.partner) throw new Error('Partner guard did not attach a principal');
    return this.repo.submitOrder(this.contexts.get(), req.partner, input);
  }
  @Post('orders/:id/fulfill')
  @PartnerScopes('fulfillment.write')
  fulfill(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: FulfillShopOrderDto,
    @Req() req: PartnerRequest,
  ) {
    if (!req.partner) throw new Error('Partner guard did not attach a principal');
    return this.repo.fulfillOrder(this.contexts.get(), req.partner, id, input);
  }
}

@ApiTags('partner webhooks')
@Controller({ path: 'partner-webhooks', version: '1' })
export class PartnerWebhookController {
  constructor(
    private readonly repo: PartnerRepository,
    private readonly contexts: TenantContextService,
  ) {}
  @Post(':endpointId')
  receive(
    @Param('endpointId', new ParseUUIDPipe()) endpointId: string,
    @Headers('x-webhook-timestamp') timestamp: string,
    @Headers('x-webhook-id') eventId: string,
    @Headers('x-webhook-event') eventType: string,
    @Headers('x-webhook-signature') signature: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.repo.receiveWebhook(
      this.contexts.get(),
      endpointId,
      timestamp,
      eventId,
      eventType,
      signature,
      payload,
    );
  }
}

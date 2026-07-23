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
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
  CreateAsnDto,
  CreateBinDto,
  CreateFacilityDto,
  CreateFulfillmentDto,
  LabelDto,
  PackDto,
  PickDto,
  PutawayDto,
  ReceiveAsnDto,
  TrackingEventDto,
} from './fulfillment.dto.js';
import { FulfillmentRepository } from './fulfillment.repository.js';

@ApiTags('fulfillment')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'fulfillment', version: '1' })
export class FulfillmentController {
  constructor(
    private readonly repo: FulfillmentRepository,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('facilities')
  @RequirePermissions('facility.manage')
  facilities() {
    return this.repo.facilities(this.contexts.get());
  }

  @Post('facilities')
  @RequirePermissions('facility.manage')
  createFacility(@Body() input: CreateFacilityDto) {
    return this.repo.createFacility(this.contexts.get(), input);
  }

  @Post('facilities/:id/bins')
  @RequirePermissions('facility.manage')
  createBin(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: CreateBinDto) {
    return this.repo.createBin(this.contexts.get(), id, input);
  }

  @Get('asns')
  @RequirePermissions('receiving.manage')
  asns() {
    return this.repo.asns(this.contexts.get());
  }

  @Post('asns')
  @RequirePermissions('receiving.manage')
  createAsn(@Body() input: CreateAsnDto) {
    return this.repo.createAsn(this.contexts.get(), input);
  }

  @Post('asns/:id/receive')
  @RequirePermissions('receiving.manage')
  receive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() input: ReceiveAsnDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return this.repo.receiveAsn(this.contexts.get(), request.auth, id, input, key ?? '');
  }

  @Post('asns/:id/putaway')
  @RequirePermissions('receiving.manage')
  putaway(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: PutawayDto) {
    return this.repo.putaway(this.contexts.get(), id, input);
  }

  @Get('orders')
  @RequirePermissions('fulfillment.manage')
  orders() {
    return this.repo.fulfillments(this.contexts.get());
  }

  @Post('orders')
  @RequirePermissions('fulfillment.manage')
  createOrder(@Body() input: CreateFulfillmentDto) {
    return this.repo.createFulfillment(this.contexts.get(), input);
  }

  @Post('orders/:id/pick')
  @RequirePermissions('fulfillment.manage')
  pick(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: PickDto) {
    return this.repo.pick(this.contexts.get(), id, input.binId);
  }

  @Post('orders/:id/pack')
  @RequirePermissions('fulfillment.manage')
  pack(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: PackDto) {
    return this.repo.pack(this.contexts.get(), id, input);
  }

  @Post('orders/:id/label')
  @RequirePermissions('shipment.manage')
  label(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: LabelDto) {
    return this.repo.label(this.contexts.get(), id, input);
  }

  @Post('orders/:id/manifest')
  @RequirePermissions('shipment.manage')
  manifest(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.repo.transition(this.contexts.get(), id, 'MANIFESTED');
  }

  @Post('orders/:id/dispatch')
  @RequirePermissions('shipment.manage')
  dispatch(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.repo.transition(this.contexts.get(), id, 'DISPATCHED');
  }

  @Post('shipments/:id/tracking-events')
  @RequirePermissions('tracking.ingest')
  tracking(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: TrackingEventDto) {
    return this.repo.tracking(this.contexts.get(), id, input);
  }
}

@ApiTags('tracking')
@Controller({ path: 'tracking', version: '1' })
export class TrackingController {
  constructor(
    private readonly repo: FulfillmentRepository,
    private readonly contexts: TenantContextService,
  ) {}

  @Get(':trackingNumber')
  tracking(@Param('trackingNumber') trackingNumber: string) {
    return this.repo.publicTracking(this.contexts.get(), trackingNumber);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  AssignmentTransitionDto,
  CreateAssignmentDto,
  CreateCarrierDto,
  CreateDriverDto,
  CreateFreightQuoteDto,
  CreateFreightRequestDto,
  CreateLegDto,
  CreateRateCardDto,
  CreateRateRuleDto,
  CreateVehicleDto,
  DriverCheckInDto,
  ProofOfDeliveryDto,
  TransportMilestoneDto,
  UpdateFreightRequestDto,
  UploadDocumentDto,
} from './freight.dto.js';
import { FreightRepository } from './freight.repository.js';

@ApiTags('freight')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'freight', version: '1' })
export class FreightController {
  constructor(
    private readonly freight: FreightRepository,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('requests')
  @RequirePermissions('transport.request.use')
  requests(@Req() request: AuthenticatedRequest): Promise<unknown> {
    return this.freight.requests(this.contexts.get(), this.principal(request), false);
  }

  @Post('requests')
  @RequirePermissions('transport.request.use')
  create(@Req() request: AuthenticatedRequest, @Body() input: CreateFreightRequestDto) {
    return this.freight.createRequest(this.contexts.get(), this.principal(request), input);
  }

  @Get('requests/:id')
  @RequirePermissions('transport.request.use')
  request(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.request(this.contexts.get(), this.principal(request), id);
  }

  @Patch('requests/:id')
  @RequirePermissions('transport.request.use')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateFreightRequestDto,
  ) {
    return this.freight.updateRequest(this.contexts.get(), this.principal(request), id, input);
  }

  @Post('requests/:id/submit')
  @RequirePermissions('transport.request.use')
  submit(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.submit(this.contexts.get(), this.principal(request), id);
  }

  @Post('requests/:id/cancel')
  @RequirePermissions('transport.request.use')
  cancel(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.cancel(this.contexts.get(), this.principal(request), id);
  }

  @Post('requests/:id/documents/upload-url')
  @RequirePermissions('transport.request.use')
  document(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UploadDocumentDto,
  ) {
    return this.freight.registerDocument(this.contexts.get(), this.principal(request), id, input);
  }

  @Post('requests/:id/documents/:documentId/complete')
  @RequirePermissions('transport.request.use')
  completeDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    return this.freight.completeDocument(
      this.contexts.get(),
      this.principal(request),
      id,
      documentId,
    );
  }

  @Get('quotes/:id')
  @RequirePermissions('transport.request.use')
  quote(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.quote(this.contexts.get(), this.principal(request), id);
  }

  @Post('quotes/:id/accept')
  @RequirePermissions('transport.request.use')
  accept(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.acceptQuote(this.contexts.get(), this.principal(request), id);
  }

  @Post('quotes/:id/decline')
  @RequirePermissions('transport.request.use')
  decline(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.declineQuote(this.contexts.get(), this.principal(request), id);
  }

  @Get('bookings/mine')
  @RequirePermissions('transport.request.use')
  bookings(@Req() request: AuthenticatedRequest): Promise<unknown> {
    return this.freight.bookings(this.contexts.get(), this.principal(request), false);
  }

  @Get('bookings/:id')
  @RequirePermissions('transport.request.use')
  booking(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.booking(this.contexts.get(), this.principal(request), id);
  }

  private principal(request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

@ApiTags('freight-operations')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'freight/operations', version: '1' })
export class FreightOperationsController {
  constructor(
    private readonly freight: FreightRepository,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('requests')
  @RequirePermissions('transport.request.manage')
  requests(@Req() request: AuthenticatedRequest): Promise<unknown> {
    return this.freight.requests(this.contexts.get(), this.principal(request), true);
  }

  @Get('bookings')
  @RequirePermissions('transport.dispatch.read')
  bookings(@Req() request: AuthenticatedRequest): Promise<unknown> {
    return this.freight.bookings(this.contexts.get(), this.principal(request), true);
  }

  @Post('requests/:id/estimate')
  @RequirePermissions('transport.quote.manage')
  estimate(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.estimate(this.contexts.get(), this.principal(request), id);
  }

  @Post('requests/:id/quotes')
  @RequirePermissions('transport.quote.manage')
  quote(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateFreightQuoteDto,
  ) {
    return this.freight.createQuote(this.contexts.get(), this.principal(request), id, input);
  }

  @Post('quotes/:id/publish')
  @RequirePermissions('transport.quote.manage')
  publish(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.publishQuote(this.contexts.get(), this.principal(request), id);
  }

  @Get('rate-cards')
  @RequirePermissions('transport.quote.manage')
  rateCards(): Promise<unknown> {
    return this.freight.rateCards(this.contexts.get());
  }

  @Post('rate-cards')
  @RequirePermissions('transport.quote.manage')
  createRateCard(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateRateCardDto,
  ): Promise<unknown> {
    return this.freight.createRateCard(this.contexts.get(), this.principal(request), input);
  }

  @Post('rate-cards/:id/rules')
  @RequirePermissions('transport.quote.manage')
  createRateRule(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: CreateRateRuleDto) {
    return this.freight.createRateRule(this.contexts.get(), id, input);
  }

  @Post('bookings/:id/legs')
  @RequirePermissions('transport.assignment.manage')
  leg(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: CreateLegDto) {
    return this.freight.addLeg(this.contexts.get(), id, input);
  }

  @Post('bookings/:id/milestones')
  @RequirePermissions('transport.assignment.manage')
  milestone(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: TransportMilestoneDto,
  ) {
    return this.freight.milestone(this.contexts.get(), this.principal(request), id, input);
  }

  @Post('bookings/:id/proof-of-delivery')
  @RequirePermissions('transport.assignment.manage')
  proof(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ProofOfDeliveryDto,
  ) {
    return this.freight.proofOfDelivery(this.contexts.get(), this.principal(request), id, input);
  }

  @Post('bookings/:id/complete')
  @RequirePermissions('transport.assignment.manage')
  complete(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.freight.completeBooking(this.contexts.get(), this.principal(request), id);
  }

  private principal(request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

@ApiTags('dispatch')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'dispatch', version: '1' })
export class DispatchController {
  constructor(
    private readonly freight: FreightRepository,
    private readonly contexts: TenantContextService,
  ) {}

  @Get('board')
  @RequirePermissions('transport.dispatch.read')
  board(): Promise<unknown> {
    return this.freight.dispatchBoard(this.contexts.get());
  }

  @Get('carriers')
  @RequirePermissions('transport.dispatch.read')
  carriers(): Promise<unknown> {
    return this.freight.carriers(this.contexts.get());
  }

  @Post('carriers')
  @RequirePermissions('transport.carrier.manage')
  carrier(@Body() input: CreateCarrierDto): Promise<unknown> {
    return this.freight.createCarrier(this.contexts.get(), input);
  }

  @Get('drivers')
  @RequirePermissions('transport.dispatch.read')
  drivers() {
    return this.freight.drivers(this.contexts.get());
  }

  @Post('drivers')
  @RequirePermissions('transport.carrier.manage')
  driver(@Body() input: CreateDriverDto) {
    return this.freight.createDriver(this.contexts.get(), input);
  }

  @Get('vehicles')
  @RequirePermissions('transport.dispatch.read')
  vehicles(): Promise<unknown> {
    return this.freight.vehicles(this.contexts.get());
  }

  @Post('vehicles')
  @RequirePermissions('transport.carrier.manage')
  vehicle(@Body() input: CreateVehicleDto) {
    return this.freight.createVehicle(this.contexts.get(), input);
  }

  @Post('legs/:id/assignments')
  @RequirePermissions('transport.assignment.manage')
  assign(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateAssignmentDto,
  ) {
    return this.freight.assign(this.contexts.get(), this.principal(request), id, input);
  }

  @Post('assignments/:id/transition')
  @RequirePermissions('transport.assignment.manage')
  transition(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: AssignmentTransitionDto,
  ) {
    return this.freight.transitionAssignment(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }

  @Post('assignments/:id/check-ins')
  @RequirePermissions('transport.checkin.write')
  checkIn(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: DriverCheckInDto,
  ) {
    return this.freight.checkIn(this.contexts.get(), this.principal(request), id, input);
  }

  private principal(request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import {
  AddConsolidationLoadDto,
  AddConsolidationMemberDto,
  AddHandlingUnitContentDto,
  AddPostalItemDto,
  AddPostalReceptacleDto,
  AllocateLinehaulDto,
  CreateConsignmentDto,
  CreateConsolidationPlanDto,
  CreateCustomsFilingDto,
  CreateHandlingUnitDto,
  CreateInsuranceClaimDto,
  CreateInsuranceProductDto,
  CreateInsuranceProviderDto,
  CreateInsuranceQuoteDto,
  CreateLinehaulDto,
  CreateLogisticsHubDto,
  CreatePostalConsignmentDto,
  CreatePostalDispatchDto,
  CreatePostalItemDto,
  CreatePostalOperatorDto,
  CreatePostalProductDto,
  CreatePostalReceptacleDto,
  CreateStandardLocationDto,
  CreateTransportDocumentDto,
  CreateTransportPartyDto,
  CustomsTransitionDto,
  HandlingEventDto,
  InsuranceClaimTransitionDto,
  PostalEventDto,
  TransportDocumentTransitionDto,
  VerifyVgmDto,
  WorkflowTransitionDto,
} from './international-logistics.dto.js';
import { InternationalLogisticsRepository } from './international-logistics.repository.js';

abstract class AuthenticatedController {
  protected principal(request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Auth guard did not attach a principal');
    return request.auth;
  }
}

@ApiTags('international-logistics')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'international-logistics', version: '1' })
export class InternationalLogisticsController extends AuthenticatedController {
  constructor(
    private readonly logistics: InternationalLogisticsRepository,
    private readonly contexts: TenantContextService,
  ) {
    super();
  }

  @Get('locations')
  @RequirePermissions('logistics.network.read')
  locations(): Promise<unknown> {
    return this.logistics.locations(this.contexts.get());
  }

  @Post('locations')
  @RequirePermissions('international.reference.manage')
  createLocation(@Req() request: AuthenticatedRequest, @Body() input: CreateStandardLocationDto) {
    return this.logistics.createLocation(this.contexts.get(), this.principal(request), input);
  }

  @Get('parties')
  @RequirePermissions('transport.document.manage')
  parties(): Promise<unknown> {
    return this.logistics.parties(this.contexts.get());
  }

  @Post('parties')
  @RequirePermissions('transport.document.manage')
  createParty(@Req() request: AuthenticatedRequest, @Body() input: CreateTransportPartyDto) {
    return this.logistics.createParty(this.contexts.get(), this.principal(request), input);
  }

  @Get('consignments')
  @RequirePermissions('transport.document.manage')
  consignments(): Promise<unknown> {
    return this.logistics.consignments(this.contexts.get());
  }

  @Post('consignments')
  @RequirePermissions('transport.document.manage')
  createConsignment(@Req() request: AuthenticatedRequest, @Body() input: CreateConsignmentDto) {
    return this.logistics.createConsignment(this.contexts.get(), this.principal(request), input);
  }

  @Post('consignments/:id/documents')
  @RequirePermissions('transport.document.manage')
  createDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateTransportDocumentDto,
  ) {
    return this.logistics.createDocument(this.contexts.get(), this.principal(request), id, input);
  }

  @Post('documents/:id/transition')
  @RequirePermissions('transport.document.manage')
  transitionDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: TransportDocumentTransitionDto,
  ) {
    return this.logistics.transitionDocument(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }

  @Post('consignments/:id/customs-filings')
  @RequirePermissions('customs.manage')
  createCustomsFiling(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateCustomsFilingDto,
  ) {
    return this.logistics.createCustomsFiling(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }

  @Post('customs-filings/:id/transition')
  @RequirePermissions('customs.manage')
  transitionCustomsFiling(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CustomsTransitionDto,
  ) {
    return this.logistics.transitionCustomsFiling(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }
}

@ApiTags('cargo-insurance')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'insurance', version: '1' })
export class InsuranceController extends AuthenticatedController {
  constructor(
    private readonly logistics: InternationalLogisticsRepository,
    private readonly contexts: TenantContextService,
  ) {
    super();
  }

  @Get('catalog')
  @RequirePermissions('insurance.use')
  catalog(): Promise<unknown> {
    return this.logistics.insuranceCatalog(this.contexts.get());
  }

  @Get('mine')
  @RequirePermissions('insurance.use')
  mine(@Req() request: AuthenticatedRequest) {
    return this.logistics.customerInsurance(this.contexts.get(), this.principal(request));
  }

  @Post('quotes/:id/accept')
  @RequirePermissions('insurance.use')
  acceptQuote(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.logistics.acceptInsuranceQuote(this.contexts.get(), this.principal(request), id);
  }

  @Post('policies/:id/claims')
  @RequirePermissions('insurance.use')
  createClaim(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateInsuranceClaimDto,
  ) {
    return this.logistics.createInsuranceClaim(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }

  @Post('claims/:id/transition')
  @RequirePermissions('insurance.use')
  transitionClaim(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: InsuranceClaimTransitionDto,
  ) {
    return this.logistics.transitionInsuranceClaim(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
      false,
    );
  }
}

@ApiTags('cargo-insurance-operations')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'insurance/operations', version: '1' })
export class InsuranceOperationsController extends AuthenticatedController {
  constructor(
    private readonly logistics: InternationalLogisticsRepository,
    private readonly contexts: TenantContextService,
  ) {
    super();
  }

  @Get()
  @RequirePermissions('insurance.claims.manage')
  operations(): Promise<unknown> {
    return this.logistics.insuranceOperations(this.contexts.get());
  }

  @Post('providers')
  @RequirePermissions('insurance.manage')
  createProvider(@Req() request: AuthenticatedRequest, @Body() input: CreateInsuranceProviderDto) {
    return this.logistics.createInsuranceProvider(
      this.contexts.get(),
      this.principal(request),
      input,
    );
  }

  @Post('providers/:id/products')
  @RequirePermissions('insurance.manage')
  createProduct(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateInsuranceProductDto,
  ) {
    return this.logistics.createInsuranceProduct(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }

  @Post('quotes')
  @RequirePermissions('insurance.manage')
  createQuote(@Req() request: AuthenticatedRequest, @Body() input: CreateInsuranceQuoteDto) {
    return this.logistics.createInsuranceQuote(this.contexts.get(), this.principal(request), input);
  }

  @Post('policies/:id/claims')
  @RequirePermissions('insurance.claims.manage')
  createClaim(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateInsuranceClaimDto,
  ) {
    return this.logistics.createInsuranceClaim(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
      true,
    );
  }

  @Post('claims/:id/transition')
  @RequirePermissions('insurance.claims.manage')
  transitionClaim(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: InsuranceClaimTransitionDto,
  ) {
    return this.logistics.transitionInsuranceClaim(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }
}

@ApiTags('logistics-network')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'logistics-network', version: '1' })
export class LogisticsNetworkController extends AuthenticatedController {
  constructor(
    private readonly logistics: InternationalLogisticsRepository,
    private readonly contexts: TenantContextService,
  ) {
    super();
  }

  @Get()
  @RequirePermissions('logistics.network.read')
  overview() {
    return this.logistics.networkOverview(this.contexts.get());
  }

  @Post('hubs')
  @RequirePermissions('logistics.network.manage')
  createHub(@Req() request: AuthenticatedRequest, @Body() input: CreateLogisticsHubDto) {
    return this.logistics.createHub(this.contexts.get(), this.principal(request), input);
  }

  @Post('handling-units')
  @RequirePermissions('logistics.handling.manage')
  createHandlingUnit(@Req() request: AuthenticatedRequest, @Body() input: CreateHandlingUnitDto) {
    return this.logistics.createHandlingUnit(this.contexts.get(), this.principal(request), input);
  }

  @Post('handling-units/:id/vgm')
  @RequirePermissions('logistics.handling.manage')
  verifyVgm(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: VerifyVgmDto,
  ) {
    return this.logistics.verifyHandlingUnitVgm(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }

  @Post('handling-units/:id/contents')
  @RequirePermissions('logistics.handling.manage')
  addContent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: AddHandlingUnitContentDto,
  ) {
    return this.logistics.addHandlingContent(this.contexts.get(), id, input);
  }

  @Post('handling-units/:id/events')
  @RequirePermissions('logistics.handling.manage')
  recordEvent(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: HandlingEventDto,
  ) {
    return this.logistics.recordHandlingEvent(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }

  @Post('consolidations')
  @RequirePermissions('logistics.consolidation.manage')
  createPlan(@Req() request: AuthenticatedRequest, @Body() input: CreateConsolidationPlanDto) {
    return this.logistics.createConsolidationPlan(
      this.contexts.get(),
      this.principal(request),
      input,
    );
  }

  @Post('consolidations/:id/members')
  @RequirePermissions('logistics.consolidation.manage')
  addMember(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: AddConsolidationMemberDto,
  ) {
    return this.logistics.addConsolidationMember(this.contexts.get(), id, input);
  }

  @Post('consolidations/:id/loads')
  @RequirePermissions('logistics.consolidation.manage')
  addLoad(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: AddConsolidationLoadDto) {
    return this.logistics.addConsolidationLoad(this.contexts.get(), id, input);
  }

  @Post('consolidations/:id/transition')
  @RequirePermissions('logistics.consolidation.manage')
  transitionPlan(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: WorkflowTransitionDto,
  ) {
    return this.logistics.transitionConsolidation(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }

  @Post('linehauls')
  @RequirePermissions('logistics.network.manage')
  createLinehaul(@Req() request: AuthenticatedRequest, @Body() input: CreateLinehaulDto) {
    return this.logistics.createLinehaul(this.contexts.get(), this.principal(request), input);
  }

  @Post('linehauls/:id/allocations')
  @RequirePermissions('logistics.consolidation.manage')
  allocate(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: AllocateLinehaulDto) {
    return this.logistics.allocateLinehaul(this.contexts.get(), id, input);
  }
}

@ApiTags('postal')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'postal', version: '1' })
export class PostalController extends AuthenticatedController {
  constructor(
    private readonly logistics: InternationalLogisticsRepository,
    private readonly contexts: TenantContextService,
  ) {
    super();
  }

  @Get('mine')
  @RequirePermissions('postal.use')
  mine(@Req() request: AuthenticatedRequest) {
    return this.logistics.postalOverview(this.contexts.get(), this.principal(request));
  }

  @Post('items')
  @RequirePermissions('postal.use')
  createItem(@Req() request: AuthenticatedRequest, @Body() input: CreatePostalItemDto) {
    return this.logistics.createPostalItem(this.contexts.get(), this.principal(request), input);
  }
}

@ApiTags('postal-operations')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'postal/operations', version: '1' })
export class PostalOperationsController extends AuthenticatedController {
  constructor(
    private readonly logistics: InternationalLogisticsRepository,
    private readonly contexts: TenantContextService,
  ) {
    super();
  }

  @Get()
  @RequirePermissions('postal.operate')
  overview() {
    return this.logistics.postalOverview(this.contexts.get());
  }

  @Post('operators')
  @RequirePermissions('postal.admin')
  createOperator(@Req() request: AuthenticatedRequest, @Body() input: CreatePostalOperatorDto) {
    return this.logistics.createPostalOperator(this.contexts.get(), this.principal(request), input);
  }

  @Post('operators/:id/products')
  @RequirePermissions('postal.admin')
  createProduct(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreatePostalProductDto,
  ) {
    return this.logistics.createPostalProduct(this.contexts.get(), id, input);
  }

  @Post('receptacles')
  @RequirePermissions('postal.operate')
  createReceptacle(@Body() input: CreatePostalReceptacleDto) {
    return this.logistics.createPostalReceptacle(this.contexts.get(), input);
  }

  @Post('receptacles/:id/items')
  @RequirePermissions('postal.operate')
  addItem(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: AddPostalItemDto) {
    return this.logistics.addPostalItem(this.contexts.get(), id, input);
  }

  @Post('receptacles/:id/transition')
  @RequirePermissions('postal.operate')
  transitionReceptacle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: WorkflowTransitionDto,
  ) {
    return this.logistics.transitionReceptacle(this.contexts.get(), id, input);
  }

  @Post('dispatches')
  @RequirePermissions('postal.operate')
  createDispatch(@Body() input: CreatePostalDispatchDto) {
    return this.logistics.createPostalDispatch(this.contexts.get(), input);
  }

  @Post('dispatches/:id/receptacles')
  @RequirePermissions('postal.operate')
  addReceptacle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: AddPostalReceptacleDto,
  ) {
    return this.logistics.addPostalReceptacle(this.contexts.get(), id, input);
  }

  @Post('dispatches/:id/transition')
  @RequirePermissions('postal.operate')
  transitionDispatch(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: WorkflowTransitionDto,
  ) {
    return this.logistics.transitionPostalDispatch(
      this.contexts.get(),
      this.principal(request),
      id,
      input,
    );
  }

  @Post('consignments')
  @RequirePermissions('postal.operate')
  createConsignment(@Body() input: CreatePostalConsignmentDto) {
    return this.logistics.createPostalConsignment(this.contexts.get(), input);
  }

  @Post('consignments/:id/receptacles')
  @RequirePermissions('postal.operate')
  addConsignmentReceptacle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: AddPostalReceptacleDto,
  ) {
    return this.logistics.addReceptacleToConsignment(this.contexts.get(), id, input);
  }

  @Post('events')
  @RequirePermissions('postal.operate')
  recordEvent(@Req() request: AuthenticatedRequest, @Body() input: PostalEventDto) {
    return this.logistics.recordPostalEvent(this.contexts.get(), this.principal(request), input);
  }
}

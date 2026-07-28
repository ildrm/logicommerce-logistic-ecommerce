import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { nextInvoiceNumber } from '../billing/invoice-issuance.js';
import { DATABASE } from '../database/database.module.js';
import type {
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
import {
  assertCapacity,
  assertTransition,
  buildS10Identifier,
  isValidS10Identifier,
  isValidSscc,
  normalizeUnLocode,
} from './international-logistics.rules.js';

const json = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class InternationalLogisticsRepository {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  locations(context: TenantContext) {
    return this.db.standardLocation.findMany({
      where: { tenantId: context.tenantId },
      orderBy: [{ countryCode: 'asc' }, { name: 'asc' }],
    });
  }

  async createLocation(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateStandardLocationDto,
  ) {
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const location = await tx.standardLocation.create({
        data: {
          id,
          tenantId: context.tenantId,
          unLocode: input.unLocode ? normalizeUnLocode(input.unLocode) : null,
          childCode: input.childCode ?? null,
          iataCode: input.iataCode ?? null,
          impcCode: input.impcCode ?? null,
          gln: input.gln ?? null,
          name: input.name,
          countryCode: input.countryCode,
          subdivisionCode: input.subdivisionCode ?? null,
          functions: input.functions,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          timeZone: input.timeZone ?? null,
          standardVersion: input.standardVersion ?? null,
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        'international.location.created',
        'StandardLocation',
        id,
      );
      return location;
    });
  }

  parties(context: TenantContext) {
    return this.db.transportParty.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { legalName: 'asc' },
    });
  }

  async createParty(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateTransportPartyDto,
  ) {
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const party = await tx.transportParty.create({
        data: {
          id,
          tenantId: context.tenantId,
          kind: input.kind,
          legalName: input.legalName,
          ...(input.identifiers ? { identifiers: json(input.identifiers) } : {}),
          address: json(input.address),
          ...(input.contacts ? { contacts: json(input.contacts) } : {}),
        },
      });
      await this.audit(tx, context, principal, 'transport.party.created', 'TransportParty', id);
      return party;
    });
  }

  consignments(context: TenantContext) {
    return this.db.transportConsignment.findMany({
      where: { tenantId: context.tenantId },
      include: {
        consignor: true,
        consignee: true,
        originLocation: true,
        destinationLocation: true,
        documents: { orderBy: { revision: 'desc' } },
        customsFilings: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConsignment(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateConsignmentDto,
  ) {
    await Promise.all([
      this.requireBooking(context, input.bookingId),
      this.requireParty(context, input.consignorId),
      this.requireParty(context, input.consigneeId),
      this.requireLocation(context, input.originLocationId),
      this.requireLocation(context, input.destinationLocationId),
    ]);
    if (input.originLocationId === input.destinationLocationId) {
      throw new ConflictException('Consignment origin and destination must differ');
    }
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const consignment = await tx.transportConsignment.create({
        data: {
          id,
          tenantId: context.tenantId,
          bookingId: input.bookingId,
          number: `CON-${id.slice(0, 8).toUpperCase()}`,
          ginc: input.ginc ?? null,
          gsIn: input.gsIn ?? null,
          consignorId: input.consignorId,
          consigneeId: input.consigneeId,
          originLocationId: input.originLocationId,
          destinationLocationId: input.destinationLocationId,
          transportContractType: input.transportContractType,
          serviceLevel: input.serviceLevel ?? null,
          incoterm: input.incoterm ?? null,
          packageCount: input.packageCount,
          grossWeightGrams: BigInt(input.grossWeightGrams),
          grossVolumeCubicCm: input.grossVolumeCubicCm ? BigInt(input.grossVolumeCubicCm) : null,
          goodsDescription: input.goodsDescription,
          ...(input.commodityCodes ? { commodityCodes: json(input.commodityCodes) } : {}),
          ...(input.dangerousGoods ? { dangerousGoods: json(input.dangerousGoods) } : {}),
          ...(input.temperatureControl
            ? { temperatureControl: json(input.temperatureControl) }
            : {}),
          customsStatus: input.customsStatus ?? 'NOT_REQUIRED',
          createdBy: principal.userId,
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        'transport.consignment.created',
        'TransportConsignment',
        id,
      );
      await this.outbox(tx, context, 'transport.consignment.created.v1', id, {
        consignmentId: id,
        bookingId: input.bookingId,
      });
      return consignment;
    });
  }

  async createDocument(
    context: TenantContext,
    principal: AuthPrincipal,
    consignmentId: string,
    input: CreateTransportDocumentDto,
  ) {
    await this.requireConsignment(context, consignmentId);
    const latest = await this.db.transportDocument.aggregate({
      where: { tenantId: context.tenantId, consignmentId, type: input.type },
      _max: { revision: true },
    });
    const revision = (latest._max.revision ?? 0) + 1;
    if (input.supersedesId) {
      const superseded = await this.db.transportDocument.findFirst({
        where: { id: input.supersedesId, tenantId: context.tenantId, consignmentId },
      });
      if (!superseded || superseded.status === 'VOID') {
        throw new ConflictException('Superseded transport document is unavailable');
      }
    }
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const document = await tx.transportDocument.create({
        data: {
          id,
          tenantId: context.tenantId,
          consignmentId,
          type: input.type,
          number: input.number,
          standard: input.standard,
          standardVersion: input.standardVersion ?? null,
          revision,
          payload: json(input.payload),
          supersedesId: input.supersedesId ?? null,
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        'transport.document.created',
        'TransportDocument',
        id,
      );
      return document;
    });
  }

  async transitionDocument(
    context: TenantContext,
    principal: AuthPrincipal,
    documentId: string,
    input: TransportDocumentTransitionDto,
  ) {
    const document = await this.requireDocument(context, documentId);
    const allowed: Record<string, string[]> = {
      DRAFT: ['ISSUED', 'VOID'],
      ISSUED: ['SIGNED', 'SURRENDERED', 'VOID'],
      SIGNED: ['SURRENDERED', 'VOID'],
      SURRENDERED: ['VOID'],
    };
    if (!allowed[document.status]?.includes(input.status)) {
      throw new ConflictException('Invalid transport document transition');
    }
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const updated = await tx.transportDocument.update({
        where: { id: documentId },
        data: {
          status: input.status,
          ...(input.status === 'ISSUED' ? { issuedAt: now, issuedBy: principal.userId } : {}),
          ...(input.status === 'SIGNED' ? { signedAt: now } : {}),
          ...(input.status === 'SURRENDERED' ? { surrenderedAt: now } : {}),
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        `transport.document.${input.status.toLowerCase()}`,
        'TransportDocument',
        documentId,
      );
      return updated;
    });
  }

  async createCustomsFiling(
    context: TenantContext,
    principal: AuthPrincipal,
    consignmentId: string,
    input: CreateCustomsFilingDto,
  ) {
    await this.requireConsignment(context, consignmentId);
    const latest = await this.db.customsFiling.aggregate({
      where: { tenantId: context.tenantId, consignmentId, type: input.type },
      _max: { version: true },
    });
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const filing = await tx.customsFiling.create({
        data: {
          id,
          tenantId: context.tenantId,
          consignmentId,
          type: input.type,
          direction: input.direction,
          customsOfficeCode: input.customsOfficeCode ?? null,
          dataModelVersion: input.dataModelVersion ?? null,
          declaration: json(input.declaration),
          version: (latest._max.version ?? 0) + 1,
        },
      });
      await this.audit(tx, context, principal, 'customs.filing.created', 'CustomsFiling', id);
      return filing;
    });
  }

  async transitionCustomsFiling(
    context: TenantContext,
    principal: AuthPrincipal,
    filingId: string,
    input: CustomsTransitionDto,
  ) {
    const filing = await this.db.customsFiling.findFirst({
      where: { id: filingId, tenantId: context.tenantId },
    });
    if (!filing) throw new NotFoundException('Resource not found');
    const allowed: Record<string, string[]> = {
      DRAFT: ['LODGED'],
      LODGED: ['HELD', 'RELEASED', 'REJECTED'],
      HELD: ['RELEASED', 'REJECTED'],
    };
    if (!allowed[filing.status]?.includes(input.status)) {
      throw new ConflictException('Invalid customs filing transition');
    }
    const now = new Date();
    const changed = await this.db.customsFiling.updateMany({
      where: { id: filingId, tenantId: context.tenantId, version: input.version },
      data: {
        status: input.status,
        mrn: input.mrn ?? filing.mrn,
        ...(input.response ? { response: json(input.response) } : {}),
        ...(input.status === 'LODGED' ? { lodgedAt: now, lodgedBy: principal.userId } : {}),
        ...(input.status === 'RELEASED' ? { releasedAt: now } : {}),
        ...(input.status === 'REJECTED' ? { rejectedAt: now } : {}),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictException('Customs filing version changed');
    return this.db.customsFiling.findUnique({ where: { id: filingId } });
  }

  insuranceCatalog(context: TenantContext) {
    return this.db.cargoInsuranceProvider.findMany({
      where: { tenantId: context.tenantId },
      include: { products: { orderBy: [{ code: 'asc' }, { version: 'desc' }] } },
      orderBy: { name: 'asc' },
    });
  }

  async createInsuranceProvider(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateInsuranceProviderDto,
  ) {
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const provider = await tx.cargoInsuranceProvider.create({
        data: {
          id,
          tenantId: context.tenantId,
          key: input.key,
          name: input.name,
          kind: input.kind,
          countries: input.countries,
          modes: input.modes,
          currencies: input.currencies,
          ...(input.licenseRefs ? { licenseRefs: json(input.licenseRefs) } : {}),
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        'insurance.provider.created',
        'CargoInsuranceProvider',
        id,
      );
      return provider;
    });
  }

  async createInsuranceProduct(
    context: TenantContext,
    principal: AuthPrincipal,
    providerId: string,
    input: CreateInsuranceProductDto,
  ) {
    const provider = await this.db.cargoInsuranceProvider.findFirst({
      where: { id: providerId, tenantId: context.tenantId, status: 'ACTIVE' },
    });
    if (!provider) throw new NotFoundException('Resource not found');
    const latest = await this.db.cargoInsuranceProduct.aggregate({
      where: { tenantId: context.tenantId, providerId, code: input.code },
      _max: { version: true },
    });
    return this.db.cargoInsuranceProduct.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        providerId,
        code: input.code,
        name: input.name,
        policyType: input.policyType,
        coverageLevel: input.coverageLevel,
        clauses: json(input.clauses),
        ...(input.exclusions ? { exclusions: json(input.exclusions) } : {}),
        supportedModes: json(input.supportedModes),
        supportedCountries: json(input.supportedCountries),
        currency: input.currency,
        rateBasisPoints: input.rateBasisPoints,
        minimumPremiumMinor: BigInt(input.minimumPremiumMinor),
        deductibleType: input.deductibleType,
        deductibleValue: input.deductibleValue,
        valuationUpliftPercent: input.valuationUpliftPercent ?? 10,
        maxInsuredValueMinor: input.maxInsuredValueMinor
          ? BigInt(input.maxInsuredValueMinor)
          : null,
        effectiveAt: new Date(input.effectiveAt),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        version: (latest._max.version ?? 0) + 1,
      },
    });
  }

  async createInsuranceQuote(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateInsuranceQuoteDto,
  ) {
    const [request, product] = await Promise.all([
      this.db.freightRequest.findFirst({
        where: { id: input.requestId, tenantId: context.tenantId },
        include: { cargoItems: true, stops: { orderBy: { sequence: 'asc' } } },
      }),
      this.db.cargoInsuranceProduct.findFirst({
        where: { id: input.productId, tenantId: context.tenantId, status: 'ACTIVE' },
        include: { provider: true },
      }),
    ]);
    if (!request || !product) throw new NotFoundException('Resource not found');
    if (!request.insuranceRequired) {
      throw new ConflictException('The freight request did not request cargo insurance');
    }
    const declaredCurrencies = new Set(request.cargoItems.map((cargo) => cargo.currency));
    if (declaredCurrencies.size !== 1 || !declaredCurrencies.has(product.currency)) {
      throw new ConflictException('Cargo and insurance product currencies must match');
    }
    const modes = Array.isArray(request.preferredModes) ? request.preferredModes : [];
    const supportedModes = Array.isArray(product.supportedModes) ? product.supportedModes : [];
    if (!modes.some((mode) => supportedModes.includes(mode))) {
      throw new ConflictException('Insurance product does not support the requested modes');
    }
    const countries = Array.isArray(product.supportedCountries) ? product.supportedCountries : [];
    const routeCountries = new Set(request.stops.map((stop) => stop.countryCode));
    if (
      countries.length > 0 &&
      [...routeCountries].some((country) => !countries.includes(country))
    ) {
      throw new ConflictException('Insurance product does not support the complete route');
    }
    const declaredValue = request.cargoItems.reduce(
      (total, cargo) => total + cargo.declaredValueMinor,
      0n,
    );
    if (declaredValue <= 0n) throw new ConflictException('Declared cargo value is required');
    const insuredValue =
      (declaredValue * BigInt(100 + product.valuationUpliftPercent) + 99n) / 100n;
    if (product.maxInsuredValueMinor && insuredValue > product.maxInsuredValueMinor) {
      throw new ConflictException('Insurance product maximum insured value exceeded');
    }
    const calculatedPremium = (insuredValue * BigInt(product.rateBasisPoints) + 9_999n) / 10_000n;
    const premium =
      calculatedPremium > product.minimumPremiumMinor
        ? calculatedPremium
        : product.minimumPremiumMinor;
    const tax = BigInt(input.taxMinor ?? 0);
    const start = new Date(input.coverageStartAt);
    const end = new Date(input.coverageEndAt);
    const validUntil = new Date(input.validUntil);
    if (start >= end || validUntil <= new Date()) {
      throw new ConflictException('Insurance coverage or quote validity is invalid');
    }
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const quote = await tx.cargoInsuranceQuote.create({
        data: {
          id,
          tenantId: context.tenantId,
          requestId: request.id,
          productId: product.id,
          number: `INQ-${id.slice(0, 8).toUpperCase()}`,
          currency: product.currency,
          declaredValueMinor: declaredValue,
          insuredValueMinor: insuredValue,
          premiumMinor: premium,
          taxMinor: tax,
          totalMinor: premium + tax,
          coverageStartAt: start,
          coverageEndAt: end,
          clausesSnapshot: json(product.clauses),
          ...(product.exclusions === null ? {} : { exclusionsSnapshot: json(product.exclusions) }),
          deductibleSnapshot: {
            type: product.deductibleType,
            value: product.deductibleValue,
          },
          validUntil,
          createdBy: principal.userId,
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        'insurance.quote.created',
        'CargoInsuranceQuote',
        id,
      );
      await this.outbox(tx, context, 'insurance.quote.created.v1', id, {
        quoteId: id,
        requestId: request.id,
      });
      return quote;
    });
  }

  async customerInsurance(context: TenantContext, principal: AuthPrincipal) {
    const requests = await this.db.freightRequest.findMany({
      where: { tenantId: context.tenantId, requesterId: principal.userId },
      select: { id: true },
    });
    const requestIds = requests.map(({ id }) => id);
    return {
      quotes: await this.db.cargoInsuranceQuote.findMany({
        where: { tenantId: context.tenantId, requestId: { in: requestIds } },
        include: { product: { include: { provider: true } }, policy: true },
        orderBy: { createdAt: 'desc' },
      }),
      policies: await this.db.cargoInsurancePolicy.findMany({
        where: { tenantId: context.tenantId, requestId: { in: requestIds } },
        include: { claims: { include: { events: { orderBy: { occurredAt: 'asc' } } } } },
        orderBy: { issuedAt: 'desc' },
      }),
    };
  }

  async acceptInsuranceQuote(context: TenantContext, principal: AuthPrincipal, quoteId: string) {
    const quote = await this.db.cargoInsuranceQuote.findFirst({
      where: { id: quoteId, tenantId: context.tenantId },
      include: { product: true },
    });
    if (!quote || quote.status !== 'QUOTED' || quote.validUntil <= new Date()) {
      throw new NotFoundException('Resource not found');
    }
    const request = await this.db.freightRequest.findFirst({
      where: {
        id: quote.requestId,
        tenantId: context.tenantId,
        requesterId: principal.userId,
      },
      include: { booking: true },
    });
    if (!request) throw new NotFoundException('Resource not found');
    const billingProfile = await this.db.billingProfile.findUnique({
      where: { tenantId: context.tenantId },
    });
    if (!billingProfile) {
      throw new ConflictException('Tenant billing profile is required before binding coverage');
    }
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const accepted = await tx.cargoInsuranceQuote.updateMany({
        where: { id: quote.id, tenantId: context.tenantId, status: 'QUOTED' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (accepted.count !== 1) throw new ConflictException('Insurance quote changed');
      const invoiceId = randomUUID();
      const invoiceNumber = await nextInvoiceNumber(tx, context.tenantId);
      await tx.billingInvoice.create({
        data: {
          id: invoiceId,
          tenantId: context.tenantId,
          number: invoiceNumber,
          customerId: principal.userId,
          sourceType: 'CARGO_INSURANCE',
          sourceId: id,
          currency: quote.currency,
          subtotalMinor: quote.premiumMinor,
          taxMinor: quote.taxMinor,
          totalMinor: quote.totalMinor,
          billingSnapshot: {
            tenant: {
              legalName: billingProfile.legalName,
              taxIdentifier: billingProfile.taxIdentifier,
              address: billingProfile.address,
            },
            customer: { userId: principal.userId },
            policy: { quoteNumber: quote.number },
          },
          dueAt: new Date(),
          lines: {
            create: {
              id: randomUUID(),
              tenantId: context.tenantId,
              kind: 'CARGO_INSURANCE_PREMIUM',
              description: `Cargo insurance premium · ${quote.number}`,
              quantity: 1,
              unitMinor: quote.premiumMinor,
              totalMinor: quote.premiumMinor,
              taxMinor: quote.taxMinor,
            },
          },
          schedules: {
            create: {
              id: randomUUID(),
              tenantId: context.tenantId,
              kind: 'PREPAY',
              amountMinor: quote.totalMinor,
              dueAt: new Date(),
              sequence: 1,
            },
          },
        },
      });
      const policy = await tx.cargoInsurancePolicy.create({
        data: {
          id,
          tenantId: context.tenantId,
          quoteId: quote.id,
          requestId: request.id,
          bookingId: request.booking?.id ?? null,
          policyNumber: `POL-${id.slice(0, 10).toUpperCase()}`,
          certificateNumber: `CERT-${id.slice(0, 10).toUpperCase()}`,
          status: quote.totalMinor === 0n ? 'ACTIVE' : 'AWAITING_PAYMENT',
          currency: quote.currency,
          insuredValueMinor: quote.insuredValueMinor,
          premiumMinor: quote.premiumMinor,
          deductible: json(quote.deductibleSnapshot),
          clauses: json(quote.clausesSnapshot),
          ...(quote.exclusionsSnapshot === null
            ? {}
            : { exclusions: json(quote.exclusionsSnapshot) }),
          coverageStartAt: quote.coverageStartAt,
          coverageEndAt: quote.coverageEndAt,
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        'insurance.policy.bound',
        'CargoInsurancePolicy',
        id,
      );
      await this.outbox(tx, context, 'insurance.policy.bound.v1', id, {
        policyId: id,
        requestId: request.id,
        invoiceId,
      });
      return { ...policy, invoiceId, invoiceNumber };
    });
  }

  async createInsuranceClaim(
    context: TenantContext,
    principal: AuthPrincipal,
    policyId: string,
    input: CreateInsuranceClaimDto,
    operational = false,
  ) {
    const policy = await this.db.cargoInsurancePolicy.findFirst({
      where: { id: policyId, tenantId: context.tenantId },
    });
    if (!policy) throw new NotFoundException('Resource not found');
    if (policy.status !== 'ACTIVE') {
      throw new ConflictException('Claims require active, paid cargo-insurance coverage');
    }
    if (input.currency !== policy.currency) {
      throw new ConflictException('Claim currency must match the policy currency');
    }
    if (!operational) {
      const request = await this.db.freightRequest.findFirst({
        where: {
          id: policy.requestId,
          tenantId: context.tenantId,
          requesterId: principal.userId,
        },
      });
      if (!request) throw new NotFoundException('Resource not found');
    }
    const lossAt = new Date(input.lossOccurredAt);
    if (lossAt < policy.coverageStartAt || lossAt > policy.coverageEndAt) {
      throw new ConflictException('Loss date is outside the policy coverage period');
    }
    if (BigInt(input.claimedAmountMinor) > policy.insuredValueMinor) {
      throw new ConflictException('Claim exceeds the insured value');
    }
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const claim = await tx.cargoInsuranceClaim.create({
        data: {
          id,
          tenantId: context.tenantId,
          policyId,
          number: `CLM-${id.slice(0, 8).toUpperCase()}`,
          cause: input.cause,
          lossOccurredAt: lossAt,
          discoveredAt: new Date(input.discoveredAt),
          lossLocation: input.lossLocation,
          description: input.description,
          claimedAmountMinor: BigInt(input.claimedAmountMinor),
          currency: input.currency,
          ...(input.evidence ? { evidence: json(input.evidence) } : {}),
          createdBy: principal.userId,
          events: {
            create: {
              id: randomUUID(),
              tenantId: context.tenantId,
              type: 'CREATED',
              toStatus: 'DRAFT',
              actorId: principal.userId,
            },
          },
        },
        include: { events: true },
      });
      await this.audit(
        tx,
        context,
        principal,
        'insurance.claim.created',
        'CargoInsuranceClaim',
        id,
      );
      return claim;
    });
  }

  insuranceOperations(context: TenantContext) {
    return this.db.cargoInsurancePolicy.findMany({
      where: { tenantId: context.tenantId },
      include: {
        quote: { include: { product: { include: { provider: true } } } },
        claims: { include: { events: { orderBy: { occurredAt: 'asc' } } } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async transitionInsuranceClaim(
    context: TenantContext,
    principal: AuthPrincipal,
    claimId: string,
    input: InsuranceClaimTransitionDto,
    operational = true,
  ) {
    const claim = await this.db.cargoInsuranceClaim.findFirst({
      where: { id: claimId, tenantId: context.tenantId },
      include: { policy: true },
    });
    if (!claim) throw new NotFoundException('Resource not found');
    if (!operational) {
      const ownedRequest = await this.db.freightRequest.findFirst({
        where: {
          id: claim.policy.requestId,
          tenantId: context.tenantId,
          requesterId: principal.userId,
        },
      });
      if (!ownedRequest) throw new NotFoundException('Resource not found');
      if (!['SUBMITTED', 'CANCELLED'].includes(input.status)) {
        throw new ConflictException('Customers may only submit or cancel their own draft claim');
      }
    }
    try {
      assertTransition('INSURANCE_CLAIM', claim.status, input.status);
    } catch (error) {
      throw new ConflictException((error as Error).message);
    }
    const approved =
      input.approvedAmountMinor === undefined
        ? (claim.approvedAmountMinor ?? 0n)
        : BigInt(input.approvedAmountMinor);
    const paid =
      input.paidAmountMinor === undefined ? claim.paidAmountMinor : BigInt(input.paidAmountMinor);
    if (approved > claim.claimedAmountMinor || paid > approved) {
      throw new ConflictException('Claim approval or payment exceeds the allowed amount');
    }
    const changed = await this.db.$transaction(async (tx) => {
      const result = await tx.cargoInsuranceClaim.updateMany({
        where: { id: claimId, tenantId: context.tenantId, version: input.version },
        data: {
          status: input.status,
          ...(input.approvedAmountMinor === undefined
            ? {}
            : { approvedAmountMinor: BigInt(input.approvedAmountMinor) }),
          ...(input.paidAmountMinor === undefined
            ? {}
            : { paidAmountMinor: BigInt(input.paidAmountMinor) }),
          ...(input.status === 'SUBMITTED' ? { submittedAt: new Date() } : {}),
          ...(['REJECTED', 'PAID', 'CLOSED'].includes(input.status)
            ? { resolvedAt: new Date() }
            : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('Insurance claim version changed');
      await tx.cargoInsuranceClaimEvent.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          claimId,
          type: 'STATUS_CHANGED',
          fromStatus: claim.status,
          toStatus: input.status,
          note: input.note ?? null,
          ...(input.evidence ? { evidence: json(input.evidence) } : {}),
          actorId: principal.userId,
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        `insurance.claim.${input.status.toLowerCase()}`,
        'CargoInsuranceClaim',
        claimId,
      );
      return result;
    });
    if (changed.count !== 1) throw new ConflictException('Insurance claim version changed');
    return this.db.cargoInsuranceClaim.findUnique({
      where: { id: claimId },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
  }

  networkOverview(context: TenantContext) {
    return Promise.all([
      this.db.logisticsHub.findMany({
        where: { tenantId: context.tenantId },
        include: { location: true },
        orderBy: { name: 'asc' },
      }),
      this.db.handlingUnit.findMany({
        where: { tenantId: context.tenantId },
        include: {
          currentHub: true,
          contents: true,
          events: { orderBy: { occurredAt: 'desc' }, take: 10 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.consolidationPlan.findMany({
        where: { tenantId: context.tenantId },
        include: {
          originHub: true,
          destinationHub: true,
          members: { include: { consignment: true } },
          loads: { include: { handlingUnit: true } },
          linehaulAllocations: { include: { linehaul: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.internationalLinehaul.findMany({
        where: { tenantId: context.tenantId },
        include: {
          originLocation: true,
          destinationLocation: true,
          allocations: { include: { consolidationPlan: true } },
        },
        orderBy: { scheduledDepartureAt: 'desc' },
      }),
    ]).then(([hubs, handlingUnits, plans, linehauls]) => ({
      hubs,
      handlingUnits,
      plans,
      linehauls,
    }));
  }

  async createHub(context: TenantContext, principal: AuthPrincipal, input: CreateLogisticsHubDto) {
    await this.requireLocation(context, input.locationId);
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const hub = await tx.logisticsHub.create({
        data: {
          id,
          tenantId: context.tenantId,
          locationId: input.locationId,
          code: input.code,
          name: input.name,
          type: input.type,
          customsBonded: input.customsBonded ?? false,
          capabilities: json(input.capabilities),
          ...(input.operatingCalendar ? { operatingCalendar: json(input.operatingCalendar) } : {}),
        },
      });
      await this.audit(tx, context, principal, 'logistics.hub.created', 'LogisticsHub', id);
      return hub;
    });
  }

  async createHandlingUnit(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateHandlingUnitDto,
  ) {
    if (input.sscc && !isValidSscc(input.sscc)) {
      throw new ConflictException('SSCC check digit is invalid');
    }
    if (input.parentId) await this.requireHandlingUnit(context, input.parentId);
    if (input.currentHubId) await this.requireHub(context, input.currentHubId);
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const unit = await tx.handlingUnit.create({
        data: {
          id,
          tenantId: context.tenantId,
          sscc: input.sscc ?? null,
          externalIdentifier: input.externalIdentifier ?? null,
          type: input.type,
          parentId: input.parentId ?? null,
          currentHubId: input.currentHubId ?? null,
          owner: input.owner ?? null,
          sealNumber: input.sealNumber ?? null,
          tareWeightGrams: BigInt(input.tareWeightGrams ?? 0),
          grossWeightGrams: BigInt(input.grossWeightGrams),
          volumeCubicCm: input.volumeCubicCm ? BigInt(input.volumeCubicCm) : null,
          ...(input.dimensions ? { dimensions: json(input.dimensions) } : {}),
          ...(input.dangerousGoods ? { dangerousGoods: json(input.dangerousGoods) } : {}),
          ...(input.temperatureControl
            ? { temperatureControl: json(input.temperatureControl) }
            : {}),
        },
      });
      await this.audit(tx, context, principal, 'handling.unit.created', 'HandlingUnit', id);
      return unit;
    });
  }

  async verifyHandlingUnitVgm(
    context: TenantContext,
    principal: AuthPrincipal,
    unitId: string,
    input: VerifyVgmDto,
  ) {
    const unit = await this.requireHandlingUnit(context, unitId);
    if (unit.type !== 'CONTAINER') {
      throw new ConflictException('Verified gross mass applies to packed containers');
    }
    if (BigInt(input.verifiedGrossMassGrams) < unit.tareWeightGrams) {
      throw new ConflictException('Verified gross mass cannot be below container tare weight');
    }
    return this.db.handlingUnit.update({
      where: { id: unitId },
      data: {
        verifiedGrossMassGrams: BigInt(input.verifiedGrossMassGrams),
        vgmMethod: input.method,
        vgmVerifiedBy: principal.userId,
        vgmVerifiedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async addHandlingContent(
    context: TenantContext,
    unitId: string,
    input: AddHandlingUnitContentDto,
  ) {
    await this.requireHandlingUnit(context, unitId);
    const cargo = await this.db.cargoItem.findFirst({
      where: { id: input.cargoItemId, tenantId: context.tenantId },
    });
    if (!cargo) throw new NotFoundException('Resource not found');
    const allocated = await this.db.handlingUnitContent.aggregate({
      where: { tenantId: context.tenantId, cargoItemId: cargo.id },
      _sum: { packageCount: true, weightGrams: true },
    });
    if (
      (allocated._sum.packageCount ?? 0) + input.packageCount > cargo.packageCount ||
      (allocated._sum.weightGrams ?? 0n) + BigInt(input.weightGrams) > cargo.weightGrams
    ) {
      throw new ConflictException('Handling-unit allocation exceeds the cargo item');
    }
    return this.db.handlingUnitContent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        handlingUnitId: unitId,
        cargoItemId: cargo.id,
        packageCount: input.packageCount,
        weightGrams: BigInt(input.weightGrams),
        volumeCubicCm: input.volumeCubicCm ? BigInt(input.volumeCubicCm) : null,
      },
    });
  }

  async recordHandlingEvent(
    context: TenantContext,
    principal: AuthPrincipal,
    unitId: string,
    input: HandlingEventDto,
  ) {
    await Promise.all([
      this.requireHandlingUnit(context, unitId),
      this.requireHub(context, input.hubId),
    ]);
    const statusByEvent: Record<string, string> = {
      RECEIVED: 'AT_HUB',
      BUILT: 'BUILT',
      SEALED: 'SEALED',
      STAGED: 'STAGED',
      LOADED: 'LOADED',
      UNLOADED: 'AT_HUB',
      OPENED: 'OPENED',
      DAMAGED: 'EXCEPTION',
      SHORT: 'EXCEPTION',
      OVER: 'EXCEPTION',
      RELEASED: 'RELEASED',
    };
    return this.db.$transaction(async (tx) => {
      const existing = await tx.handlingEvent.findFirst({
        where: {
          tenantId: context.tenantId,
          handlingUnitId: unitId,
          externalKey: input.externalKey,
        },
      });
      if (existing) return existing;
      const event = await tx.handlingEvent.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          handlingUnitId: unitId,
          hubId: input.hubId,
          type: input.type,
          condition: input.condition ?? null,
          locationText: input.locationText ?? null,
          occurredAt: new Date(input.occurredAt),
          source: input.source,
          externalKey: input.externalKey,
          ...(input.data ? { data: json(input.data) } : {}),
          recordedBy: principal.userId,
        },
      });
      await tx.handlingUnit.update({
        where: { id: unitId },
        data: {
          currentHubId: input.hubId,
          ...(statusByEvent[input.type] ? { status: statusByEvent[input.type] } : {}),
          version: { increment: 1 },
        },
      });
      await this.audit(tx, context, principal, 'handling.event.recorded', 'HandlingUnit', unitId);
      return event;
    });
  }

  async createConsolidationPlan(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateConsolidationPlanDto,
  ) {
    await Promise.all([
      this.requireHub(context, input.originHubId),
      this.requireHub(context, input.destinationHubId),
    ]);
    const cutoff = new Date(input.cutoffAt);
    const departure = new Date(input.plannedDepartureAt);
    const arrival = new Date(input.plannedArrivalAt);
    if (cutoff > departure || departure >= arrival) {
      throw new ConflictException('Consolidation cutoff and schedule are invalid');
    }
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const plan = await tx.consolidationPlan.create({
        data: {
          id,
          tenantId: context.tenantId,
          number: `CNS-${id.slice(0, 8).toUpperCase()}`,
          mode: input.mode,
          serviceLevel: input.serviceLevel ?? null,
          originHubId: input.originHubId,
          destinationHubId: input.destinationHubId,
          cutoffAt: cutoff,
          plannedDepartureAt: departure,
          plannedArrivalAt: arrival,
          maxWeightGrams: input.maxWeightGrams ? BigInt(input.maxWeightGrams) : null,
          maxVolumeCubicCm: input.maxVolumeCubicCm ? BigInt(input.maxVolumeCubicCm) : null,
          equipmentType: input.equipmentType ?? null,
          masterReference: input.masterReference ?? null,
          sealNumber: input.sealNumber ?? null,
          ...(input.route ? { route: json(input.route) } : {}),
          createdBy: principal.userId,
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        'consolidation.plan.created',
        'ConsolidationPlan',
        id,
      );
      return plan;
    });
  }

  async addConsolidationMember(
    context: TenantContext,
    planId: string,
    input: AddConsolidationMemberDto,
  ) {
    const [plan, booking] = await Promise.all([
      this.requirePlan(context, planId),
      this.requireBooking(context, input.bookingId),
    ]);
    if (!['DRAFT', 'OPEN'].includes(plan.status)) {
      throw new ConflictException('Consolidation plan is closed to new members');
    }
    if (plan.cutoffAt <= new Date()) {
      throw new ConflictException('Consolidation cutoff has passed');
    }
    if (!['CONFIRMED', 'PLANNED', 'DISPATCHED', 'IN_TRANSIT'].includes(booking.status)) {
      throw new ConflictException('Booking is not eligible for consolidation');
    }
    if (input.consignmentId) {
      const consignment = await this.requireConsignment(context, input.consignmentId);
      if (consignment.bookingId !== booking.id) {
        throw new ConflictException('Consignment does not belong to the booking');
      }
    }
    const totals = await this.db.consolidationMember.aggregate({
      where: { tenantId: context.tenantId, planId },
      _sum: { allocatedWeightGrams: true, allocatedVolumeCubicCm: true },
    });
    try {
      assertCapacity(
        plan.maxWeightGrams,
        plan.maxVolumeCubicCm,
        totals._sum.allocatedWeightGrams ?? 0n,
        totals._sum.allocatedVolumeCubicCm ?? 0n,
        BigInt(input.allocatedWeightGrams),
        BigInt(input.allocatedVolumeCubicCm ?? 0),
      );
    } catch (error) {
      throw new ConflictException((error as Error).message);
    }
    return this.db.$transaction(async (tx) => {
      const member = await tx.consolidationMember.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          planId,
          bookingId: booking.id,
          consignmentId: input.consignmentId ?? null,
          allocatedWeightGrams: BigInt(input.allocatedWeightGrams),
          allocatedVolumeCubicCm: input.allocatedVolumeCubicCm
            ? BigInt(input.allocatedVolumeCubicCm)
            : null,
          packageCount: input.packageCount,
          loadingPriority: input.loadingPriority ?? 100,
          finalDestination: input.finalDestination ?? null,
        },
      });
      if (plan.status === 'DRAFT') {
        await tx.consolidationPlan.update({
          where: { id: plan.id },
          data: { status: 'OPEN', version: { increment: 1 } },
        });
      }
      return member;
    });
  }

  async addConsolidationLoad(
    context: TenantContext,
    planId: string,
    input: AddConsolidationLoadDto,
  ) {
    const [plan, unit] = await Promise.all([
      this.requirePlan(context, planId),
      this.requireHandlingUnit(context, input.handlingUnitId),
    ]);
    if (!['OPEN', 'CLOSED'].includes(plan.status)) {
      throw new ConflictException('Consolidation plan cannot accept handling units');
    }
    const contentCount = await this.db.handlingUnitContent.count({
      where: { tenantId: context.tenantId, handlingUnitId: unit.id },
    });
    if (contentCount === 0 && !unit.postalReceptacle) {
      throw new ConflictException('Handling unit is empty');
    }
    return this.db.consolidationLoad.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        planId,
        handlingUnitId: unit.id,
        loadSequence: input.loadSequence,
        position: input.position ?? null,
      },
    });
  }

  async transitionConsolidation(
    context: TenantContext,
    principal: AuthPrincipal,
    planId: string,
    input: WorkflowTransitionDto,
  ) {
    const plan = await this.db.consolidationPlan.findFirst({
      where: { id: planId, tenantId: context.tenantId },
      include: { members: true, loads: { include: { handlingUnit: true } } },
    });
    if (!plan) throw new NotFoundException('Resource not found');
    try {
      assertTransition('CONSOLIDATION', plan.status, input.status);
    } catch (error) {
      throw new ConflictException((error as Error).message);
    }
    if (input.status === 'CLOSED' && plan.members.length === 0) {
      throw new ConflictException('A consolidation requires at least one member');
    }
    if (input.status === 'LOADED' && plan.loads.length === 0) {
      throw new ConflictException('A consolidation requires at least one handling unit');
    }
    if (
      input.status === 'LOADED' &&
      plan.mode === 'SEA' &&
      plan.loads.some(
        ({ handlingUnit }) =>
          handlingUnit.type === 'CONTAINER' && !handlingUnit.verifiedGrossMassGrams,
      )
    ) {
      throw new ConflictException('Sea containers require verified gross mass before loading');
    }
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const changed = await tx.consolidationPlan.updateMany({
        where: { id: planId, tenantId: context.tenantId, version: input.version },
        data: {
          status: input.status,
          ...(input.status === 'CLOSED' ? { closedAt: now } : {}),
          ...(input.status === 'DEPARTED' ? { departedAt: now } : {}),
          ...(input.status === 'ARRIVED' ? { arrivedAt: now } : {}),
          ...(input.status === 'DECONSOLIDATED' ? { deconsolidatedAt: now } : {}),
          ...(input.status === 'COMPLETED' ? { completedAt: now } : {}),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('Consolidation version changed');
      if (input.status === 'LOADED') {
        await tx.consolidationLoad.updateMany({
          where: { tenantId: context.tenantId, planId },
          data: { status: 'LOADED', loadedAt: now },
        });
      }
      if (input.status === 'DECONSOLIDATED') {
        await tx.consolidationLoad.updateMany({
          where: { tenantId: context.tenantId, planId },
          data: { status: 'UNLOADED', unloadedAt: now },
        });
        await tx.consolidationMember.updateMany({
          where: { tenantId: context.tenantId, planId },
          data: { status: 'UNLOADED', unloadedAt: now },
        });
      }
      await this.audit(
        tx,
        context,
        principal,
        `consolidation.plan.${input.status.toLowerCase()}`,
        'ConsolidationPlan',
        planId,
      );
      await this.outbox(
        tx,
        context,
        `consolidation.plan.${input.status.toLowerCase()}.v1`,
        planId,
        {
          planId,
        },
      );
      return tx.consolidationPlan.findUnique({
        where: { id: planId },
        include: { members: true, loads: true },
      });
    });
  }

  async createLinehaul(context: TenantContext, principal: AuthPrincipal, input: CreateLinehaulDto) {
    await Promise.all([
      this.requireLocation(context, input.originLocationId),
      this.requireLocation(context, input.destinationLocationId),
    ]);
    const departure = new Date(input.scheduledDepartureAt);
    const arrival = new Date(input.scheduledArrivalAt);
    if (departure >= arrival) throw new ConflictException('Linehaul schedule is invalid');
    const id = randomUUID();
    return this.db.internationalLinehaul.create({
      data: {
        id,
        tenantId: context.tenantId,
        number: `LNH-${id.slice(0, 8).toUpperCase()}`,
        mode: input.mode,
        originLocationId: input.originLocationId,
        destinationLocationId: input.destinationLocationId,
        carrierId: input.carrierId ?? null,
        conveyanceReference: input.conveyanceReference ?? null,
        equipmentIdentifier: input.equipmentIdentifier ?? null,
        scheduledDepartureAt: departure,
        scheduledArrivalAt: arrival,
        maxWeightGrams: input.maxWeightGrams ? BigInt(input.maxWeightGrams) : null,
        maxVolumeCubicCm: input.maxVolumeCubicCm ? BigInt(input.maxVolumeCubicCm) : null,
        ...(input.route ? { route: json(input.route) } : {}),
        createdBy: principal.userId,
      },
    });
  }

  async allocateLinehaul(context: TenantContext, linehaulId: string, input: AllocateLinehaulDto) {
    const [linehaul, plan] = await Promise.all([
      this.db.internationalLinehaul.findFirst({
        where: { id: linehaulId, tenantId: context.tenantId },
      }),
      this.requirePlan(context, input.consolidationPlanId),
    ]);
    if (!linehaul) throw new NotFoundException('Resource not found');
    if (!['SCHEDULED', 'BOOKING'].includes(linehaul.status)) {
      throw new ConflictException('Linehaul is closed to allocations');
    }
    if (linehaul.mode !== plan.mode) {
      throw new ConflictException('Linehaul and consolidation modes must match');
    }
    const totals = await this.db.internationalLinehaulAllocation.aggregate({
      where: { tenantId: context.tenantId, linehaulId },
      _sum: { allocatedWeightGrams: true, allocatedVolumeCubicCm: true },
    });
    try {
      assertCapacity(
        linehaul.maxWeightGrams,
        linehaul.maxVolumeCubicCm,
        totals._sum.allocatedWeightGrams ?? 0n,
        totals._sum.allocatedVolumeCubicCm ?? 0n,
        BigInt(input.allocatedWeightGrams),
        BigInt(input.allocatedVolumeCubicCm ?? 0),
      );
    } catch (error) {
      throw new ConflictException((error as Error).message);
    }
    return this.db.internationalLinehaulAllocation.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        linehaulId,
        consolidationPlanId: plan.id,
        allocatedWeightGrams: BigInt(input.allocatedWeightGrams),
        allocatedVolumeCubicCm: input.allocatedVolumeCubicCm
          ? BigInt(input.allocatedVolumeCubicCm)
          : null,
      },
    });
  }

  postalOverview(context: TenantContext, principal?: AuthPrincipal) {
    return Promise.all([
      this.db.postalOperator.findMany({
        where: { tenantId: context.tenantId },
        include: { products: true },
        orderBy: { name: 'asc' },
      }),
      this.db.postalItem.findMany({
        where: {
          tenantId: context.tenantId,
          ...(principal ? { customerId: principal.userId } : {}),
        },
        include: { product: true, events: { orderBy: { occurredAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.postalReceptacle.findMany({
        where: { tenantId: context.tenantId },
        include: { itemLinks: { include: { item: true } }, handlingUnit: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.postalDispatch.findMany({
        where: { tenantId: context.tenantId },
        include: { receptacleLinks: { include: { receptacle: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.postalConsignment.findMany({
        where: { tenantId: context.tenantId },
        include: { receptacleLinks: { include: { receptacle: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]).then(([operators, items, receptacles, dispatches, consignments]) => ({
      operators,
      items,
      receptacles,
      dispatches,
      consignments,
    }));
  }

  async createPostalOperator(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreatePostalOperatorDto,
  ) {
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const operator = await tx.postalOperator.create({
        data: {
          id,
          tenantId: context.tenantId,
          code: input.code,
          name: input.name,
          countryCode: input.countryCode,
          designated: input.designated ?? false,
          ...(input.identifiers ? { identifiers: json(input.identifiers) } : {}),
        },
      });
      await this.audit(tx, context, principal, 'postal.operator.created', 'PostalOperator', id);
      return operator;
    });
  }

  async createPostalProduct(
    context: TenantContext,
    operatorId: string,
    input: CreatePostalProductDto,
  ) {
    await this.requirePostalOperator(context, operatorId);
    return this.db.postalProduct.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        operatorId,
        code: input.code,
        name: input.name,
        category: input.category,
        tracked: input.tracked ?? true,
        registered: input.registered ?? false,
        insured: input.insured ?? false,
        signatureRequired: input.signatureRequired ?? false,
        customsRequired: input.customsRequired ?? false,
        maxWeightGrams: input.maxWeightGrams ? BigInt(input.maxWeightGrams) : null,
        ...(input.maxDimensions ? { maxDimensions: json(input.maxDimensions) } : {}),
        ...(input.serviceStandard ? { serviceStandard: json(input.serviceStandard) } : {}),
      },
    });
  }

  async createPostalItem(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreatePostalItemDto,
  ) {
    const product = await this.db.postalProduct.findFirst({
      where: {
        id: input.productId,
        tenantId: context.tenantId,
        operatorId: input.operatorId,
        status: 'ACTIVE',
      },
    });
    if (!product) throw new NotFoundException('Resource not found');
    if (product.maxWeightGrams && BigInt(input.weightGrams) > product.maxWeightGrams) {
      throw new ConflictException('Postal product weight limit exceeded');
    }
    if (product.customsRequired && !input.customsData) {
      throw new ConflictException('Postal customs data is required');
    }
    let identifier = input.s10Identifier?.toUpperCase();
    if (!identifier) {
      if (!input.serviceIndicator || !input.serial) {
        throw new ConflictException('S10 identifier or service indicator and serial are required');
      }
      identifier = buildS10Identifier(
        input.serviceIndicator,
        input.serial,
        input.originCountryCode,
      );
    }
    if (!isValidS10Identifier(identifier)) {
      throw new ConflictException('UPU S10 identifier check digit is invalid');
    }
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const item = await tx.postalItem.create({
        data: {
          id,
          tenantId: context.tenantId,
          operatorId: input.operatorId,
          productId: input.productId,
          customerId: principal.userId,
          s10Identifier: identifier,
          originCountryCode: input.originCountryCode,
          destinationCountryCode: input.destinationCountryCode,
          sender: json(input.sender),
          recipient: json(input.recipient),
          contentDescription: input.contentDescription,
          weightGrams: BigInt(input.weightGrams),
          ...(input.dimensions ? { dimensions: json(input.dimensions) } : {}),
          declaredValueMinor: BigInt(input.declaredValueMinor ?? 0),
          currency: input.currency,
          ...(input.customsData ? { customsData: json(input.customsData) } : {}),
          postageMinor: BigInt(input.postageMinor ?? 0),
          events: {
            create: {
              id: randomUUID(),
              tenantId: context.tenantId,
              standard: 'UPU_EMSEVT',
              code: 'EMA',
              description: 'Item accepted by the originating operator',
              occurredAt: new Date(),
              source: 'API',
              externalKey: `accept:${id}`,
              recordedBy: principal.userId,
            },
          },
        },
        include: { events: true, product: true },
      });
      await this.audit(tx, context, principal, 'postal.item.accepted', 'PostalItem', id);
      await this.outbox(tx, context, 'postal.item.accepted.v1', id, {
        itemId: id,
        s10Identifier: identifier,
      });
      return item;
    });
  }

  async createPostalReceptacle(context: TenantContext, input: CreatePostalReceptacleDto) {
    await this.requirePostalOperator(context, input.operatorId);
    if (input.handlingUnitId) await this.requireHandlingUnit(context, input.handlingUnitId);
    return this.db.postalReceptacle.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        operatorId: input.operatorId,
        handlingUnitId: input.handlingUnitId ?? null,
        receptacleId: input.receptacleId,
        type: input.type,
        mailCategory: input.mailCategory,
        originImpcCode: input.originImpcCode,
        destinationImpcCode: input.destinationImpcCode,
        sealNumber: input.sealNumber ?? null,
      },
    });
  }

  async addPostalItem(context: TenantContext, receptacleId: string, input: AddPostalItemDto) {
    const [receptacle, item] = await Promise.all([
      this.requireReceptacle(context, receptacleId),
      this.db.postalItem.findFirst({
        where: { id: input.itemId, tenantId: context.tenantId },
      }),
    ]);
    if (!item) throw new NotFoundException('Resource not found');
    if (receptacle.status !== 'OPEN') throw new ConflictException('Postal receptacle is closed');
    if (
      item.originCountryCode !== receptacle.originImpcCode.slice(0, 2) ||
      item.destinationCountryCode !== receptacle.destinationImpcCode.slice(0, 2)
    ) {
      throw new ConflictException('Postal item route does not match the receptacle');
    }
    return this.db.postalReceptacleItem.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        receptacleId,
        itemId: item.id,
      },
    });
  }

  async transitionReceptacle(
    context: TenantContext,
    receptacleId: string,
    input: WorkflowTransitionDto,
  ) {
    const receptacle = await this.requireReceptacle(context, receptacleId);
    const transitions: Record<string, string[]> = {
      OPEN: ['CLOSED'],
      CLOSED: ['DESPATCHED', 'OPEN'],
      DESPATCHED: ['RECEIVED'],
      RECEIVED: ['OPENED'],
    };
    if (!transitions[receptacle.status]?.includes(input.status)) {
      throw new ConflictException('Invalid postal receptacle transition');
    }
    if (
      input.status === 'CLOSED' &&
      (await this.db.postalReceptacleItem.count({
        where: { tenantId: context.tenantId, receptacleId },
      })) === 0
    ) {
      throw new ConflictException('Cannot close an empty postal receptacle');
    }
    const now = new Date();
    const changed = await this.db.postalReceptacle.updateMany({
      where: { id: receptacleId, tenantId: context.tenantId, version: input.version },
      data: {
        status: input.status,
        ...(input.status === 'CLOSED' ? { closedAt: now } : {}),
        ...(input.status === 'OPENED' ? { openedAt: now } : {}),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictException('Postal receptacle version changed');
    return this.db.postalReceptacle.findUnique({ where: { id: receptacleId } });
  }

  async createPostalDispatch(context: TenantContext, input: CreatePostalDispatchDto) {
    await this.requirePostalOperator(context, input.operatorId);
    return this.db.postalDispatch.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        operatorId: input.operatorId,
        dispatchId: input.dispatchId,
        originImpcCode: input.originImpcCode,
        destinationImpcCode: input.destinationImpcCode,
        mailCategory: input.mailCategory,
        dispatchNumber: input.dispatchNumber,
        scheduledDepartureAt: input.scheduledDepartureAt
          ? new Date(input.scheduledDepartureAt)
          : null,
      },
    });
  }

  async addPostalReceptacle(
    context: TenantContext,
    dispatchId: string,
    input: AddPostalReceptacleDto,
  ) {
    const [dispatch, receptacle] = await Promise.all([
      this.requireDispatch(context, dispatchId),
      this.requireReceptacle(context, input.receptacleId),
    ]);
    if (dispatch.status !== 'OPEN' || receptacle.status !== 'CLOSED') {
      throw new ConflictException('Open dispatch and closed receptacle are required');
    }
    if (
      dispatch.originImpcCode !== receptacle.originImpcCode ||
      dispatch.destinationImpcCode !== receptacle.destinationImpcCode ||
      dispatch.mailCategory !== receptacle.mailCategory
    ) {
      throw new ConflictException('Receptacle does not match the postal dispatch');
    }
    return this.db.postalDispatchReceptacle.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        dispatchId,
        receptacleId: receptacle.id,
        sequence: input.sequence,
      },
    });
  }

  async transitionPostalDispatch(
    context: TenantContext,
    principal: AuthPrincipal,
    dispatchId: string,
    input: WorkflowTransitionDto,
  ) {
    const dispatch = await this.db.postalDispatch.findFirst({
      where: { id: dispatchId, tenantId: context.tenantId },
      include: { receptacleLinks: true },
    });
    if (!dispatch) throw new NotFoundException('Resource not found');
    try {
      assertTransition('POSTAL_DISPATCH', dispatch.status, input.status);
    } catch (error) {
      throw new ConflictException((error as Error).message);
    }
    if (input.status === 'CLOSED' && dispatch.receptacleLinks.length === 0) {
      throw new ConflictException('Cannot close an empty postal dispatch');
    }
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const changed = await tx.postalDispatch.updateMany({
        where: { id: dispatchId, tenantId: context.tenantId, version: input.version },
        data: {
          status: input.status,
          ...(input.status === 'CLOSED' ? { closedAt: now } : {}),
          ...(input.status === 'HANDED_OVER' ? { handedOverAt: now } : {}),
          ...(input.status === 'RECEIVED' ? { receivedAt: now } : {}),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('Postal dispatch version changed');
      if (input.status === 'HANDED_OVER') {
        const links = await tx.postalDispatchReceptacle.findMany({
          where: { tenantId: context.tenantId, dispatchId },
          select: { receptacleId: true },
        });
        await tx.postalReceptacle.updateMany({
          where: { id: { in: links.map(({ receptacleId }) => receptacleId) } },
          data: { status: 'DESPATCHED', version: { increment: 1 } },
        });
      }
      await this.audit(
        tx,
        context,
        principal,
        `postal.dispatch.${input.status.toLowerCase()}`,
        'PostalDispatch',
        dispatchId,
      );
      return tx.postalDispatch.findUnique({ where: { id: dispatchId } });
    });
  }

  async createPostalConsignment(context: TenantContext, input: CreatePostalConsignmentDto) {
    await this.requirePostalOperator(context, input.operatorId);
    return this.db.postalConsignment.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        operatorId: input.operatorId,
        consignmentId: input.consignmentId,
        carrierId: input.carrierId ?? null,
        transportReference: input.transportReference ?? null,
        originImpcCode: input.originImpcCode,
        destinationImpcCode: input.destinationImpcCode,
        scheduledDepartureAt: input.scheduledDepartureAt
          ? new Date(input.scheduledDepartureAt)
          : null,
        scheduledArrivalAt: input.scheduledArrivalAt ? new Date(input.scheduledArrivalAt) : null,
      },
    });
  }

  async addReceptacleToConsignment(
    context: TenantContext,
    consignmentId: string,
    input: AddPostalReceptacleDto,
  ) {
    const [consignment, receptacle] = await Promise.all([
      this.db.postalConsignment.findFirst({
        where: { id: consignmentId, tenantId: context.tenantId },
      }),
      this.requireReceptacle(context, input.receptacleId),
    ]);
    if (!consignment) throw new NotFoundException('Resource not found');
    if (
      consignment.originImpcCode !== receptacle.originImpcCode ||
      consignment.destinationImpcCode !== receptacle.destinationImpcCode
    ) {
      throw new ConflictException('Receptacle route does not match the postal consignment');
    }
    return this.db.postalConsignmentReceptacle.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        consignmentId,
        receptacleId: receptacle.id,
        sequence: input.sequence,
      },
    });
  }

  async recordPostalEvent(context: TenantContext, principal: AuthPrincipal, input: PostalEventDto) {
    if (!input.itemId && !input.receptacleId && !input.dispatchId) {
      throw new ConflictException('Postal event requires an item, receptacle, or dispatch');
    }
    if (input.itemId) {
      const item = await this.db.postalItem.findFirst({
        where: { id: input.itemId, tenantId: context.tenantId },
      });
      if (!item) throw new NotFoundException('Resource not found');
    }
    if (input.receptacleId) await this.requireReceptacle(context, input.receptacleId);
    if (input.dispatchId) await this.requireDispatch(context, input.dispatchId);
    const itemStatusByCode: Record<string, string> = {
      EMA: 'ACCEPTED',
      EMB: 'AT_ORIGIN_OFFICE',
      EMC: 'DEPARTED_ORIGIN',
      EMD: 'ARRIVED_DESTINATION',
      EMG: 'CUSTOMS_HELD',
      EMH: 'CUSTOMS_RELEASED',
      EMJ: 'AT_TRANSIT',
      EMK: 'DEPARTED_TRANSIT',
      EMM: 'DELIVERY_ATTEMPTED',
      EMO: 'DELIVERED',
    };
    return this.db.$transaction(async (tx) => {
      const existing = await tx.postalEvent.findFirst({
        where: {
          tenantId: context.tenantId,
          standard: input.standard,
          externalKey: input.externalKey,
        },
      });
      if (existing) return existing;
      const event = await tx.postalEvent.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          itemId: input.itemId ?? null,
          receptacleId: input.receptacleId ?? null,
          dispatchId: input.dispatchId ?? null,
          standard: input.standard,
          code: input.code,
          description: input.description,
          locationCode: input.locationCode ?? null,
          occurredAt: new Date(input.occurredAt),
          source: input.source,
          externalKey: input.externalKey,
          ...(input.data ? { data: json(input.data) } : {}),
          recordedBy: principal.userId,
        },
      });
      if (input.itemId && itemStatusByCode[input.code]) {
        await tx.postalItem.update({
          where: { id: input.itemId },
          data: {
            ...(itemStatusByCode[input.code] ? { status: itemStatusByCode[input.code] } : {}),
            ...(input.code === 'EMO' ? { deliveredAt: new Date(input.occurredAt) } : {}),
            version: { increment: 1 },
          },
        });
      }
      await this.audit(tx, context, principal, 'postal.event.recorded', 'PostalEvent', event.id);
      return event;
    });
  }

  private requireLocation(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.standardLocation.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private requireParty(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.transportParty.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private requireBooking(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.freightBooking.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private requireConsignment(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.transportConsignment.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private requireDocument(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.transportDocument.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private requireHub(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.logisticsHub.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private requireHandlingUnit(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.handlingUnit.findFirst({
        where: { id, tenantId: context.tenantId },
        include: { postalReceptacle: true },
      }),
    );
  }

  private requirePlan(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.consolidationPlan.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private requirePostalOperator(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.postalOperator.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private requireReceptacle(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.postalReceptacle.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private requireDispatch(context: TenantContext, id: string) {
    return this.requireByTenant(
      this.db.postalDispatch.findFirst({ where: { id, tenantId: context.tenantId } }),
    );
  }

  private async requireByTenant<T>(candidate: Promise<T | null>): Promise<T> {
    const record = await candidate;
    if (!record) throw new NotFoundException('Resource not found');
    return record;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    context: TenantContext,
    principal: AuthPrincipal,
    action: string,
    entityType: string,
    entityId: string,
  ) {
    await tx.auditEvent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        actorId: principal.userId,
        actorType: 'USER',
        action,
        entityType,
        entityId,
        requestId: context.correlationId,
        correlationId: context.correlationId,
        authenticationMethod: 'BEARER',
      },
    });
  }

  private async outbox(
    tx: Prisma.TransactionClient,
    context: TenantContext,
    type: string,
    subject: string,
    payload: Record<string, unknown>,
  ) {
    await tx.outboxEvent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        type,
        subject,
        payload: json(payload),
        correlationId: context.correlationId,
      },
    });
  }
}

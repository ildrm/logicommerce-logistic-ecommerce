import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import type {
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
import { ContactCryptoService } from './contact-crypto.service.js';
import { StorageSigningService } from './storage-signing.service.js';

const REQUEST_TERMINAL = new Set(['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED']);
const BOOKING_VISIBLE = {
  request: { include: { stops: { orderBy: { sequence: 'asc' as const } }, cargoItems: true } },
  quote: { include: { lines: true } },
  invoice: { include: { lines: true, schedules: true, payments: true } },
  legs: {
    include: {
      carrier: true,
      assignment: {
        include: {
          driver: true,
          vehicle: true,
          checkIns: { orderBy: { reportedAt: 'desc' as const } },
        },
      },
      milestones: { orderBy: { occurredAt: 'asc' as const } },
    },
    orderBy: { sequence: 'asc' as const },
  },
  milestones: { orderBy: { occurredAt: 'asc' as const } },
  exceptions: { orderBy: { createdAt: 'desc' as const } },
  proofOfDelivery: true,
} as const;

@Injectable()
export class FreightRepository {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly contacts: ContactCryptoService,
    private readonly storage: StorageSigningService,
  ) {}

  requests(context: TenantContext, principal: AuthPrincipal, all: boolean) {
    return this.db.freightRequest.findMany({
      where: {
        tenantId: context.tenantId,
        ...(all ? {} : { requesterId: principal.userId }),
      },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
        cargoItems: true,
        estimates: { orderBy: { createdAt: 'desc' }, take: 1 },
        quotes: { orderBy: { revision: 'desc' }, take: 1, include: { lines: true } },
        booking: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async request(context: TenantContext, principal: AuthPrincipal, requestId: string, all = false) {
    const request = await this.db.freightRequest.findFirst({
      where: {
        id: requestId,
        tenantId: context.tenantId,
        ...(all ? {} : { requesterId: principal.userId }),
      },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
        cargoItems: true,
        documents: true,
        estimates: { orderBy: { createdAt: 'desc' } },
        quotes: { orderBy: { revision: 'desc' }, include: { lines: true } },
        booking: true,
      },
    });
    if (!request) throw new NotFoundException('Resource not found');
    return request;
  }

  async createRequest(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateFreightRequestDto,
  ) {
    this.validateStops(input.stops);
    if (input.businessAccountId) {
      const membership = await this.db.businessMember.findFirst({
        where: {
          tenantId: context.tenantId,
          accountId: input.businessAccountId,
          userId: principal.userId,
          account: { status: 'ACTIVE' },
        },
      });
      if (!membership) throw new ForbiddenException('Business account membership is required');
    }
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      const request = await tx.freightRequest.create({
        data: {
          id,
          tenantId: context.tenantId,
          number: `FRQ-${id.slice(0, 8).toUpperCase()}`,
          requesterId: principal.userId,
          businessAccountId: input.businessAccountId ?? null,
          serviceLevel: input.serviceLevel ?? 'STANDARD',
          preferredModes: input.preferredModes as Prisma.InputJsonValue,
          incoterm: input.incoterm ?? null,
          insuranceRequired: input.insuranceRequired ?? false,
          customsRequired: input.customsRequired ?? false,
          specialInstructions: input.specialInstructions ?? null,
          stops: {
            create: input.stops.map((stop) => ({
              id: randomUUID(),
              tenantId: context.tenantId,
              sequence: stop.sequence,
              kind: stop.kind,
              locationType: stop.locationType,
              name: stop.name,
              line1: stop.line1 ?? null,
              line2: stop.line2 ?? null,
              city: stop.city,
              region: stop.region ?? null,
              postalCode: stop.postalCode ?? null,
              countryCode: stop.countryCode,
              locationCode: stop.locationCode ?? null,
              latitude: stop.latitude ?? null,
              longitude: stop.longitude ?? null,
              timeZone: stop.timeZone ?? null,
              windowStart: stop.windowStart ? new Date(stop.windowStart) : null,
              windowEnd: stop.windowEnd ? new Date(stop.windowEnd) : null,
              contactName: stop.contactName ?? null,
              contactPhone: stop.contactPhone ? this.contacts.encrypt(stop.contactPhone) : null,
              instructions: stop.instructions ?? null,
            })),
          },
          cargoItems: {
            create: input.cargoItems.map((cargo) => ({
              id: randomUUID(),
              tenantId: context.tenantId,
              description: cargo.description,
              commodityCode: cargo.commodityCode ?? null,
              packageType: cargo.packageType,
              packageCount: cargo.packageCount,
              weightGrams: BigInt(cargo.weightGrams),
              volumeCubicCm: cargo.volumeCubicCm ? BigInt(cargo.volumeCubicCm) : null,
              dimensions: (cargo.dimensions ?? null) as Prisma.InputJsonValue,
              declaredValueMinor: cargo.declaredValueMinor ?? 0,
              currency: cargo.currency,
              hazardous: cargo.hazardous ?? false,
              hazardousDetails: (cargo.hazardousDetails ?? null) as Prisma.InputJsonValue,
              temperatureMinC: cargo.temperatureMinC ?? null,
              temperatureMaxC: cargo.temperatureMaxC ?? null,
              stackable: cargo.stackable ?? true,
            })),
          },
        },
        include: { stops: { orderBy: { sequence: 'asc' } }, cargoItems: true },
      });
      await this.audit(tx, context, principal, 'freight.request.created', 'FreightRequest', id);
      return request;
    });
  }

  async updateRequest(
    context: TenantContext,
    principal: AuthPrincipal,
    requestId: string,
    input: UpdateFreightRequestDto,
  ) {
    await this.requireOwnedRequest(context, principal, requestId, 'DRAFT');
    const changed = await this.db.freightRequest.updateMany({
      where: {
        id: requestId,
        tenantId: context.tenantId,
        requesterId: principal.userId,
        version: input.version,
      },
      data: {
        ...(input.serviceLevel ? { serviceLevel: input.serviceLevel } : {}),
        ...(input.preferredModes
          ? { preferredModes: input.preferredModes as Prisma.InputJsonValue }
          : {}),
        ...(input.incoterm !== undefined ? { incoterm: input.incoterm } : {}),
        ...(input.insuranceRequired !== undefined
          ? { insuranceRequired: input.insuranceRequired }
          : {}),
        ...(input.customsRequired !== undefined ? { customsRequired: input.customsRequired } : {}),
        ...(input.specialInstructions !== undefined
          ? { specialInstructions: input.specialInstructions }
          : {}),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictException('Freight request version changed');
    return this.request(context, principal, requestId);
  }

  async submit(context: TenantContext, principal: AuthPrincipal, requestId: string) {
    const request = await this.requireOwnedRequest(context, principal, requestId, 'DRAFT');
    const [stops, cargo] = await Promise.all([
      this.db.freightStop.count({ where: { tenantId: context.tenantId, requestId } }),
      this.db.cargoItem.count({ where: { tenantId: context.tenantId, requestId } }),
    ]);
    if (stops < 2 || cargo < 1)
      throw new ConflictException('Pickup, delivery, and cargo are required');
    return this.db.$transaction(async (tx) => {
      const updated = await tx.freightRequest.update({
        where: { id: request.id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), version: { increment: 1 } },
        include: { stops: { orderBy: { sequence: 'asc' } }, cargoItems: true },
      });
      await this.audit(
        tx,
        context,
        principal,
        'freight.request.submitted',
        'FreightRequest',
        request.id,
      );
      await this.outbox(
        tx,
        context,
        'freight.request.submitted.v1',
        `freight-request/${request.id}`,
        {
          requestId: request.id,
          number: request.number,
        },
      );
      return updated;
    });
  }

  async cancel(context: TenantContext, principal: AuthPrincipal, requestId: string) {
    const request = await this.requireOwnedRequest(context, principal, requestId);
    if (REQUEST_TERMINAL.has(request.status))
      throw new ConflictException('Request cannot be cancelled');
    return this.db.freightRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), version: { increment: 1 } },
    });
  }

  async registerDocument(
    context: TenantContext,
    principal: AuthPrincipal,
    requestId: string,
    input: UploadDocumentDto,
  ) {
    const request = await this.requireOwnedRequest(context, principal, requestId);
    if (REQUEST_TERMINAL.has(request.status) && request.status !== 'ACCEPTED') {
      throw new ConflictException('Documents cannot be added to this request');
    }
    const id = randomUUID();
    const safeName = input.fileName.replace(/[^A-Za-z0-9._-]/gu, '_');
    const objectKey = `${context.tenantId}/freight/${requestId}/${id}-${safeName}`;
    const document = await this.db.freightDocument.create({
      data: {
        id,
        tenantId: context.tenantId,
        requestId,
        kind: input.kind,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        checksum: input.checksum,
        objectKey,
        uploadedBy: principal.userId,
      },
    });
    return {
      document,
      upload: {
        method: 'PUT',
        url: this.storage.presignPut(objectKey),
        expiresInSeconds: 900,
        headers: { 'content-type': input.contentType },
      },
    };
  }

  rateCards(context: TenantContext) {
    return this.db.transportRateCard.findMany({
      where: { tenantId: context.tenantId },
      include: { rules: { orderBy: { priority: 'asc' } } },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  createRateCard(context: TenantContext, principal: AuthPrincipal, input: CreateRateCardDto) {
    return this.db.transportRateCard.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        key: input.key,
        name: input.name,
        currency: input.currency,
        effectiveAt: new Date(input.effectiveAt),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        version: 1,
        createdBy: principal.userId,
      },
    });
  }

  async createRateRule(context: TenantContext, rateCardId: string, input: CreateRateRuleDto) {
    const card = await this.db.transportRateCard.findFirst({
      where: { id: rateCardId, tenantId: context.tenantId },
    });
    if (!card) throw new NotFoundException('Resource not found');
    return this.db.transportRateRule.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        rateCardId,
        mode: input.mode,
        originCountryCode: input.originCountryCode ?? null,
        destinationCountryCode: input.destinationCountryCode ?? null,
        originLocationCode: input.originLocationCode ?? null,
        destinationLocationCode: input.destinationLocationCode ?? null,
        equipmentType: input.equipmentType ?? null,
        baseMinor: input.baseMinor,
        perKgMinor: input.perKgMinor,
        perCubicMeterMinor: input.perCubicMeterMinor ?? 0,
        minimumMinor: input.minimumMinor ?? 0,
        accessorials: (input.accessorials ?? null) as Prisma.InputJsonValue,
        priority: input.priority ?? 100,
      },
    });
  }

  async estimate(context: TenantContext, principal: AuthPrincipal, requestId: string) {
    const request = await this.requireOperationalRequest(context, requestId);
    if (!['SUBMITTED', 'UNDER_REVIEW', 'QUOTED'].includes(request.status)) {
      throw new ConflictException('Request is not ready for estimation');
    }
    const origin = request.stops[0];
    const destination = request.stops.at(-1);
    if (!origin || !destination) throw new ConflictException('Route endpoints are unavailable');
    const modes = request.preferredModes as string[];
    const now = new Date();
    const cards = await this.db.transportRateCard.findMany({
      where: {
        tenantId: context.tenantId,
        status: 'ACTIVE',
        effectiveAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { rules: { orderBy: { priority: 'asc' } } },
    });
    const weightKg = Math.ceil(
      request.cargoItems.reduce((sum, item) => sum + Number(item.weightGrams), 0) / 1000,
    );
    const volumeCubicM =
      request.cargoItems.reduce((sum, item) => sum + Number(item.volumeCubicCm ?? 0), 0) /
      1_000_000;
    const candidates = cards.flatMap((card) =>
      card.rules
        .filter(
          (rule) =>
            modes.includes(rule.mode) &&
            (!rule.originCountryCode || rule.originCountryCode === origin.countryCode) &&
            (!rule.destinationCountryCode ||
              rule.destinationCountryCode === destination.countryCode) &&
            (!rule.originLocationCode || rule.originLocationCode === origin.locationCode) &&
            (!rule.destinationLocationCode ||
              rule.destinationLocationCode === destination.locationCode),
        )
        .map((rule) => {
          const calculated =
            Number(rule.baseMinor) +
            Number(rule.perKgMinor) * weightKg +
            Number(rule.perCubicMeterMinor) * Math.ceil(volumeCubicM);
          return {
            card,
            rule,
            totalMinor: Math.max(Number(rule.minimumMinor), calculated),
          };
        }),
    );
    candidates.sort((a, b) => a.totalMinor - b.totalMinor);
    const selected = candidates[0];
    const calculation = selected
      ? {
          selectedMode: selected.rule.mode,
          rateCardId: selected.card.id,
          rateRuleId: selected.rule.id,
          weightKg,
          volumeCubicM,
          candidateCount: candidates.length,
        }
      : {
          requestedModes: modes,
          originCountryCode: origin.countryCode,
          destinationCountryCode: destination.countryCode,
          reason: 'NO_MATCHING_RATE',
        };
    const inputHash = createHash('sha256')
      .update(
        JSON.stringify({
          requestVersion: request.version,
          calculation,
          cargo: request.cargoItems.map((item) => [
            item.id,
            String(item.weightGrams),
            String(item.volumeCubicCm),
          ]),
        }),
      )
      .digest('hex');
    return this.db.$transaction(async (tx) => {
      const estimate = await tx.freightEstimate.upsert({
        where: {
          tenantId_requestId_inputHash: { tenantId: context.tenantId, requestId, inputHash },
        },
        update: {},
        create: {
          id: randomUUID(),
          tenantId: context.tenantId,
          requestId,
          rateCardId: selected?.card.id ?? null,
          status: selected ? 'ESTIMATED' : 'NEEDS_REVIEW',
          currency: selected?.card.currency ?? 'USD',
          subtotalMinor: selected?.totalMinor ?? 0,
          totalMinor: selected?.totalMinor ?? 0,
          calculation,
          inputHash,
          createdBy: principal.userId,
        },
      });
      if (request.status === 'SUBMITTED') {
        await tx.freightRequest.update({
          where: { id: requestId },
          data: { status: 'UNDER_REVIEW', version: { increment: 1 } },
        });
      }
      return estimate;
    });
  }

  async createQuote(
    context: TenantContext,
    principal: AuthPrincipal,
    requestId: string,
    input: CreateFreightQuoteDto,
  ) {
    const request = await this.requireOperationalRequest(context, requestId);
    if (!['SUBMITTED', 'UNDER_REVIEW', 'QUOTED'].includes(request.status)) {
      throw new ConflictException('Request cannot be quoted');
    }
    if (input.paymentPolicy === 'DEPOSIT' && !input.depositPercent) {
      throw new ConflictException('Deposit percentage is required');
    }
    if (input.paymentPolicy === 'NET_TERMS' && !request.businessAccountId) {
      throw new ConflictException('Net terms require a business account');
    }
    const subtotalMinor = input.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitMinor,
      0,
    );
    const totalMinor = subtotalMinor + input.taxMinor;
    const latest = await this.db.freightQuote.aggregate({
      where: { tenantId: context.tenantId, requestId },
      _max: { revision: true },
    });
    const revision = (latest._max.revision ?? 0) + 1;
    const id = randomUUID();
    return this.db.$transaction(async (tx) => {
      await tx.freightQuote.updateMany({
        where: { tenantId: context.tenantId, requestId, status: { in: ['DRAFT', 'PUBLISHED'] } },
        data: { status: 'SUPERSEDED', version: { increment: 1 } },
      });
      const quote = await tx.freightQuote.create({
        data: {
          id,
          tenantId: context.tenantId,
          requestId,
          number: `FQT-${id.slice(0, 8).toUpperCase()}-R${revision}`,
          revision,
          currency: input.currency,
          subtotalMinor,
          taxMinor: input.taxMinor,
          totalMinor,
          paymentPolicy: input.paymentPolicy,
          depositPercent: input.depositPercent ?? null,
          paymentTermsDays: input.paymentTermsDays ?? 0,
          terms: (input.terms ?? null) as Prisma.InputJsonValue,
          validUntil: new Date(input.validUntil),
          createdBy: principal.userId,
          lines: {
            create: input.lines.map((line) => ({
              id: randomUUID(),
              tenantId: context.tenantId,
              kind: line.kind,
              description: line.description,
              quantity: line.quantity,
              unitMinor: line.unitMinor,
              totalMinor: line.quantity * line.unitMinor,
              taxable: line.taxable ?? true,
              metadata: (line.metadata ?? null) as Prisma.InputJsonValue,
            })),
          },
        },
        include: { lines: true },
      });
      await this.audit(tx, context, principal, 'freight.quote.created', 'FreightQuote', id);
      return quote;
    });
  }

  async publishQuote(context: TenantContext, principal: AuthPrincipal, quoteId: string) {
    const quote = await this.requireQuote(context, quoteId);
    if (quote.status !== 'DRAFT' || quote.validUntil <= new Date()) {
      throw new ConflictException('Quote cannot be published');
    }
    return this.db.$transaction(async (tx) => {
      const published = await tx.freightQuote.update({
        where: { id: quoteId },
        data: { status: 'PUBLISHED', publishedAt: new Date(), version: { increment: 1 } },
        include: { lines: true },
      });
      await tx.freightRequest.update({
        where: { id: quote.requestId },
        data: { status: 'QUOTED', version: { increment: 1 } },
      });
      await this.audit(tx, context, principal, 'freight.quote.published', 'FreightQuote', quoteId);
      await this.outbox(tx, context, 'freight.quote.published.v1', `freight-quote/${quoteId}`, {
        quoteId,
        requestId: quote.requestId,
      });
      return published;
    });
  }

  async quote(context: TenantContext, principal: AuthPrincipal, quoteId: string, all = false) {
    const quote = await this.db.freightQuote.findFirst({
      where: {
        id: quoteId,
        tenantId: context.tenantId,
        ...(all ? {} : { request: { requesterId: principal.userId } }),
      },
      include: {
        lines: true,
        request: { include: { stops: true, cargoItems: true } },
        booking: true,
      },
    });
    if (!quote) throw new NotFoundException('Resource not found');
    return quote;
  }

  async declineQuote(context: TenantContext, principal: AuthPrincipal, quoteId: string) {
    const quote = await this.quote(context, principal, quoteId);
    if (quote.status !== 'PUBLISHED')
      throw new ConflictException('Quote is not awaiting a decision');
    return this.db.freightQuote.update({
      where: { id: quoteId },
      data: { status: 'DECLINED', declinedAt: new Date(), version: { increment: 1 } },
    });
  }

  async acceptQuote(context: TenantContext, principal: AuthPrincipal, quoteId: string) {
    const quote = await this.quote(context, principal, quoteId);
    if (quote.status !== 'PUBLISHED' || quote.validUntil <= new Date()) {
      throw new ConflictException('Quote is unavailable or expired');
    }
    const existing = await this.db.freightBooking.findFirst({
      where: { tenantId: context.tenantId, requestId: quote.requestId },
    });
    if (existing) throw new ConflictException('A quote has already been accepted');
    let paymentPolicy = quote.paymentPolicy;
    if (!quote.request.businessAccountId) paymentPolicy = 'PREPAY';
    if (quote.request.businessAccountId && paymentPolicy === 'NET_TERMS') {
      const account = await this.db.businessAccount.findFirst({
        where: {
          id: quote.request.businessAccountId,
          tenantId: context.tenantId,
          status: 'ACTIVE',
          members: { some: { userId: principal.userId } },
        },
      });
      if (!account) throw new ForbiddenException('Active business account membership is required');
      const exposure = await this.db.billingInvoice.aggregate({
        where: {
          tenantId: context.tenantId,
          businessAccountId: account.id,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { totalMinor: true, paidMinor: true },
      });
      const openMinor =
        Number(exposure._sum.totalMinor ?? 0n) - Number(exposure._sum.paidMinor ?? 0n);
      if (
        account.creditLimitMinor > 0n &&
        openMinor + Number(quote.totalMinor) > Number(account.creditLimitMinor)
      ) {
        throw new ConflictException('Business credit limit would be exceeded');
      }
    }
    const bookingId = randomUUID();
    const invoiceId = randomUUID();
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, context, 'INVOICE', 'INV');
      const bookingNumber = `FBK-${bookingId.slice(0, 8).toUpperCase()}`;
      const profile = await tx.billingProfile.findUnique({ where: { tenantId: context.tenantId } });
      const invoice = await tx.billingInvoice.create({
        data: {
          id: invoiceId,
          tenantId: context.tenantId,
          number,
          customerId: principal.userId,
          businessAccountId: quote.request.businessAccountId,
          sourceType: 'FREIGHT_BOOKING',
          sourceId: bookingId,
          currency: quote.currency,
          subtotalMinor: quote.subtotalMinor,
          taxMinor: quote.taxMinor,
          totalMinor: quote.totalMinor,
          billingSnapshot: {
            supplier: profile
              ? {
                  legalName: profile.legalName,
                  taxIdentifier: profile.taxIdentifier,
                  address: profile.address,
                }
              : { legalName: 'LogiCommerce' },
            customerId: principal.userId,
            businessAccountId: quote.request.businessAccountId,
            quoteNumber: quote.number,
          },
          dueAt: new Date(now.getTime() + quote.paymentTermsDays * 86_400_000),
          lines: {
            create: quote.lines.map((line) => ({
              id: randomUUID(),
              tenantId: context.tenantId,
              kind: line.kind,
              description: line.description,
              quantity: line.quantity,
              unitMinor: line.unitMinor,
              totalMinor: line.totalMinor,
              taxMinor: 0,
              metadata: (line.metadata ?? null) as Prisma.InputJsonValue,
            })),
          },
          schedules: {
            create: this.paymentSchedules(context.tenantId, quote, paymentPolicy, now),
          },
        },
        include: { lines: true, schedules: true },
      });
      const booking = await tx.freightBooking.create({
        data: {
          id: bookingId,
          tenantId: context.tenantId,
          requestId: quote.requestId,
          quoteId,
          number: bookingNumber,
          status: paymentPolicy === 'NET_TERMS' ? 'CONFIRMED' : 'AWAITING_PAYMENT',
          customerId: principal.userId,
          businessAccountId: quote.request.businessAccountId,
          invoiceId,
          confirmedAt: paymentPolicy === 'NET_TERMS' ? now : null,
        },
      });
      await tx.freightQuote.update({
        where: { id: quoteId },
        data: { status: 'ACCEPTED', acceptedAt: now, version: { increment: 1 } },
      });
      await tx.freightRequest.update({
        where: { id: quote.requestId },
        data: { status: 'ACCEPTED', acceptedAt: now, version: { increment: 1 } },
      });
      await this.audit(tx, context, principal, 'freight.quote.accepted', 'FreightQuote', quoteId);
      await this.outbox(tx, context, 'billing.invoice.issued.v1', `invoice/${invoiceId}`, {
        invoiceId,
        bookingId,
        customerId: principal.userId,
      });
      return { booking, invoice };
    });
  }

  bookings(context: TenantContext, principal: AuthPrincipal, all: boolean) {
    return this.db.freightBooking.findMany({
      where: { tenantId: context.tenantId, ...(all ? {} : { customerId: principal.userId }) },
      include: BOOKING_VISIBLE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async booking(context: TenantContext, principal: AuthPrincipal, bookingId: string, all = false) {
    const booking = await this.db.freightBooking.findFirst({
      where: {
        id: bookingId,
        tenantId: context.tenantId,
        ...(all ? {} : { customerId: principal.userId }),
      },
      include: BOOKING_VISIBLE,
    });
    if (!booking) throw new NotFoundException('Resource not found');
    return this.redactBooking(booking);
  }

  carriers(context: TenantContext) {
    return this.db.transportCarrier.findMany({
      where: { tenantId: context.tenantId },
      include: { _count: { select: { drivers: true, vehicles: true, legs: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createCarrier(context: TenantContext, input: CreateCarrierDto) {
    return this.db.transportCarrier.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        key: input.key,
        name: input.name,
        kind: input.kind,
        modes: input.modes as Prisma.InputJsonValue,
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ? this.contacts.encrypt(input.contactPhone) : null,
      },
    });
  }

  drivers(context: TenantContext) {
    return this.db.transportDriver
      .findMany({
        where: { tenantId: context.tenantId },
        include: { carrier: true },
        orderBy: { displayName: 'asc' },
      })
      .then((drivers) =>
        drivers.map(({ phoneCiphertext, ...driver }) => ({
          ...driver,
          phoneMasked: this.maskPhone(this.contacts.decrypt(phoneCiphertext)),
        })),
      );
  }

  async createDriver(context: TenantContext, input: CreateDriverDto) {
    if (input.carrierId) await this.requireCarrier(context, input.carrierId);
    const driver = await this.db.transportDriver.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        carrierId: input.carrierId ?? null,
        employeeRef: input.employeeRef ?? null,
        displayName: input.displayName,
        phoneCiphertext: this.contacts.encrypt(input.phone),
        licenseNumber: input.licenseNumber ?? null,
        licenseExpiresAt: input.licenseExpiresAt ? new Date(input.licenseExpiresAt) : null,
      },
    });
    const { phoneCiphertext, ...safe } = driver;
    return {
      ...safe,
      phoneMasked: this.maskPhone(this.contacts.decrypt(phoneCiphertext)),
    };
  }

  vehicles(context: TenantContext) {
    return this.db.transportVehicle.findMany({
      where: { tenantId: context.tenantId },
      include: { carrier: true },
      orderBy: { registration: 'asc' },
    });
  }

  async createVehicle(context: TenantContext, input: CreateVehicleDto) {
    if (input.carrierId) await this.requireCarrier(context, input.carrierId);
    return this.db.transportVehicle.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        carrierId: input.carrierId ?? null,
        registration: input.registration,
        equipmentType: input.equipmentType,
        capacityKg: input.capacityKg ?? null,
        capacityCubicM: input.capacityCubicM ?? null,
      },
    });
  }

  async addLeg(context: TenantContext, bookingId: string, input: CreateLegDto) {
    const booking = await this.requireOperationalBooking(context, bookingId);
    if (!['CONFIRMED', 'PLANNED'].includes(booking.status)) {
      throw new ConflictException('Booking is not available for planning');
    }
    const stops = await this.db.freightStop.count({
      where: {
        tenantId: context.tenantId,
        requestId: booking.requestId,
        id: { in: [input.originStopId, input.destinationStopId] },
      },
    });
    if (stops !== 2)
      throw new ConflictException('Leg endpoints must belong to the booking request');
    if (input.carrierId) await this.requireCarrier(context, input.carrierId);
    return this.db.$transaction(async (tx) => {
      const leg = await tx.transportLeg.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          bookingId,
          sequence: input.sequence,
          mode: input.mode,
          originStopId: input.originStopId,
          destinationStopId: input.destinationStopId,
          carrierId: input.carrierId ?? null,
          providerReference: input.providerReference ?? null,
          plannedDepartureAt: input.plannedDepartureAt ? new Date(input.plannedDepartureAt) : null,
          plannedArrivalAt: input.plannedArrivalAt ? new Date(input.plannedArrivalAt) : null,
          equipment: (input.equipment ?? null) as Prisma.InputJsonValue,
        },
      });
      await tx.freightBooking.update({
        where: { id: bookingId },
        data: { status: 'PLANNED', version: { increment: 1 } },
      });
      return leg;
    });
  }

  async assign(
    context: TenantContext,
    principal: AuthPrincipal,
    legId: string,
    input: CreateAssignmentDto,
  ) {
    const leg = await this.db.transportLeg.findFirst({
      where: { id: legId, tenantId: context.tenantId },
      include: { booking: true },
    });
    if (!leg) throw new NotFoundException('Resource not found');
    if (leg.mode !== 'ROAD')
      throw new ConflictException('Only road legs accept driver assignments');
    const [driver, vehicle] = await Promise.all([
      this.db.transportDriver.findFirst({
        where: { id: input.driverId, tenantId: context.tenantId, status: 'AVAILABLE' },
      }),
      this.db.transportVehicle.findFirst({
        where: { id: input.vehicleId, tenantId: context.tenantId, status: 'AVAILABLE' },
      }),
    ]);
    if (!driver || !vehicle) throw new ConflictException('Driver or vehicle is unavailable');
    if (
      input.carrierId &&
      (driver.carrierId !== input.carrierId || vehicle.carrierId !== input.carrierId)
    ) {
      throw new ConflictException('Driver and vehicle must belong to the selected carrier');
    }
    return this.db.$transaction(async (tx) => {
      const assignment = await tx.dispatchAssignment.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          legId,
          carrierId: input.carrierId ?? driver.carrierId ?? null,
          driverId: driver.id,
          vehicleId: vehicle.id,
          checkInIntervalMinutes: input.checkInIntervalMinutes ?? 240,
          assignedBy: principal.userId,
        },
        include: { driver: true, vehicle: true, carrier: true },
      });
      await Promise.all([
        tx.transportDriver.update({ where: { id: driver.id }, data: { status: 'ASSIGNED' } }),
        tx.transportVehicle.update({ where: { id: vehicle.id }, data: { status: 'ASSIGNED' } }),
      ]);
      await this.audit(
        tx,
        context,
        principal,
        'transport.assignment.created',
        'DispatchAssignment',
        assignment.id,
      );
      return assignment;
    });
  }

  async transitionAssignment(
    context: TenantContext,
    principal: AuthPrincipal,
    assignmentId: string,
    input: AssignmentTransitionDto,
  ) {
    const assignment = await this.requireAssignment(context, assignmentId);
    const now = new Date();
    if (input.action === 'START') {
      if (assignment.status !== 'ASSIGNED') throw new ConflictException('Assignment cannot start');
      const next = new Date(now.getTime() + assignment.checkInIntervalMinutes * 60_000);
      return this.db.$transaction(async (tx) => {
        const updated = await tx.dispatchAssignment.update({
          where: { id: assignmentId },
          data: {
            status: 'IN_TRANSIT',
            startedAt: now,
            nextCheckInAt: next,
            version: { increment: 1 },
          },
        });
        await tx.transportLeg.update({
          where: { id: assignment.legId },
          data: { status: 'IN_TRANSIT', actualDepartureAt: now },
        });
        await tx.freightBooking.update({
          where: { id: assignment.leg.bookingId },
          data: { status: 'IN_TRANSIT', dispatchedAt: now, version: { increment: 1 } },
        });
        return updated;
      });
    }
    if (!['ASSIGNED', 'IN_TRANSIT'].includes(assignment.status)) {
      throw new ConflictException('Assignment is already terminal');
    }
    return this.db.$transaction(async (tx) => {
      const terminal = input.action === 'COMPLETE' ? 'COMPLETED' : 'CANCELLED';
      const updated = await tx.dispatchAssignment.update({
        where: { id: assignmentId },
        data: {
          status: terminal,
          completedAt: now,
          nextCheckInAt: null,
          version: { increment: 1 },
        },
      });
      await Promise.all([
        tx.transportDriver.update({
          where: { id: assignment.driverId },
          data: { status: 'AVAILABLE' },
        }),
        tx.transportVehicle.update({
          where: { id: assignment.vehicleId },
          data: { status: 'AVAILABLE' },
        }),
        tx.transportLeg.update({
          where: { id: assignment.legId },
          data: {
            status: terminal,
            ...(terminal === 'COMPLETED' ? { actualArrivalAt: now } : {}),
          },
        }),
      ]);
      await this.audit(
        tx,
        context,
        principal,
        `transport.assignment.${terminal.toLowerCase()}`,
        'DispatchAssignment',
        assignmentId,
      );
      return updated;
    });
  }

  async checkIn(
    context: TenantContext,
    principal: AuthPrincipal,
    assignmentId: string,
    input: DriverCheckInDto,
  ) {
    const assignment = await this.requireAssignment(context, assignmentId);
    if (assignment.status !== 'IN_TRANSIT')
      throw new ConflictException('Assignment is not in transit');
    const existing = await this.db.driverCheckIn.findFirst({
      where: { tenantId: context.tenantId, assignmentId, externalKey: input.externalKey },
    });
    if (existing) return existing;
    const next =
      input.nextCheckInAt ??
      new Date(Date.now() + assignment.checkInIntervalMinutes * 60_000).toISOString();
    return this.db.$transaction(async (tx) => {
      const checkIn = await tx.driverCheckIn.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          assignmentId,
          coordinatorId: principal.userId,
          source: input.source,
          outcome: input.outcome,
          locationText: input.locationText,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          reportedAt: new Date(input.reportedAt),
          estimatedArrivalAt: input.estimatedArrivalAt ? new Date(input.estimatedArrivalAt) : null,
          note: input.note ?? null,
          exceptionCode: input.exceptionCode ?? null,
          nextCheckInAt: new Date(next),
          externalKey: input.externalKey,
        },
      });
      await tx.dispatchAssignment.update({
        where: { id: assignmentId },
        data: { nextCheckInAt: new Date(next), version: { increment: 1 } },
      });
      await tx.transportMilestone.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          bookingId: assignment.leg.bookingId,
          legId: assignment.legId,
          code: input.outcome === 'REACHED' ? 'DRIVER_CHECK_IN' : input.outcome,
          description: input.note ?? `Driver contact outcome: ${input.outcome}`,
          location: input.locationText,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          occurredAt: new Date(input.reportedAt),
          source: input.source,
          recordedBy: principal.userId,
          externalKey: `checkin:${input.externalKey}`,
        },
      });
      await tx.freightException.updateMany({
        where: {
          tenantId: context.tenantId,
          assignmentId,
          status: 'OPEN',
          code: 'CHECK_IN_OVERDUE',
        },
        data: { status: 'RESOLVED', resolvedBy: principal.userId, resolvedAt: new Date() },
      });
      if (['DELAY', 'EXCEPTION'].includes(input.outcome)) {
        await tx.freightException.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            bookingId: assignment.leg.bookingId,
            assignmentId,
            code: input.exceptionCode ?? input.outcome,
            severity: input.outcome === 'EXCEPTION' ? 'HIGH' : 'MEDIUM',
            description: input.note ?? `${input.outcome} reported by driver coordinator`,
            openedBy: principal.userId,
          },
        });
      }
      await this.audit(
        tx,
        context,
        principal,
        'transport.driver.checkin',
        'DispatchAssignment',
        assignmentId,
      );
      return checkIn;
    });
  }

  async milestone(
    context: TenantContext,
    principal: AuthPrincipal,
    bookingId: string,
    input: TransportMilestoneDto,
  ) {
    await this.requireOperationalBooking(context, bookingId);
    if (input.legId) {
      const leg = await this.db.transportLeg.findFirst({
        where: { id: input.legId, tenantId: context.tenantId, bookingId },
      });
      if (!leg) throw new NotFoundException('Resource not found');
    }
    return this.db.transportMilestone.upsert({
      where: {
        tenantId_bookingId_externalKey: {
          tenantId: context.tenantId,
          bookingId,
          externalKey: input.externalKey,
        },
      },
      update: {},
      create: {
        id: randomUUID(),
        tenantId: context.tenantId,
        bookingId,
        legId: input.legId ?? null,
        code: input.code,
        description: input.description,
        location: input.location ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        occurredAt: new Date(input.occurredAt),
        source: input.source,
        recordedBy: principal.userId,
        externalKey: input.externalKey,
        payload: (input.payload ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async proofOfDelivery(
    context: TenantContext,
    principal: AuthPrincipal,
    bookingId: string,
    input: ProofOfDeliveryDto,
  ) {
    const booking = await this.requireOperationalBooking(context, bookingId);
    if (!['DISPATCHED', 'IN_TRANSIT', 'EXCEPTION'].includes(booking.status)) {
      throw new ConflictException('Booking is not eligible for delivery');
    }
    if (input.documentId) {
      const document = await this.db.freightDocument.findFirst({
        where: {
          id: input.documentId,
          tenantId: context.tenantId,
          requestId: booking.requestId,
          kind: 'PROOF_OF_DELIVERY',
        },
      });
      if (!document) throw new NotFoundException('Proof-of-delivery document not found');
    }
    const deliveredAt = new Date(input.deliveredAt);
    return this.db.$transaction(async (tx) => {
      const proof = await tx.proofOfDelivery.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          bookingId,
          documentId: input.documentId ?? null,
          recipient: input.recipient,
          deliveredAt,
          note: input.note ?? null,
          recordedBy: principal.userId,
        },
      });
      await tx.freightBooking.update({
        where: { id: bookingId },
        data: { status: 'DELIVERED', deliveredAt, version: { increment: 1 } },
      });
      await tx.transportMilestone.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          bookingId,
          code: 'DELIVERED',
          description: `Delivered to ${input.recipient}`,
          occurredAt: deliveredAt,
          source: 'PROOF_OF_DELIVERY',
          recordedBy: principal.userId,
          externalKey: `pod:${proof.id}`,
        },
      });
      await this.outbox(
        tx,
        context,
        'freight.booking.delivered.v1',
        `freight-booking/${bookingId}`,
        {
          bookingId,
          proofOfDeliveryId: proof.id,
        },
      );
      return proof;
    });
  }

  async completeBooking(context: TenantContext, principal: AuthPrincipal, bookingId: string) {
    const booking = await this.requireOperationalBooking(context, bookingId);
    if (booking.status !== 'DELIVERED')
      throw new ConflictException('Proof of delivery is required');
    return this.db.$transaction(async (tx) => {
      const completed = await tx.freightBooking.update({
        where: { id: bookingId },
        data: { status: 'COMPLETED', completedAt: new Date(), version: { increment: 1 } },
      });
      await this.audit(
        tx,
        context,
        principal,
        'freight.booking.completed',
        'FreightBooking',
        bookingId,
      );
      return completed;
    });
  }

  dispatchBoard(context: TenantContext) {
    return this.db.dispatchAssignment.findMany({
      where: { tenantId: context.tenantId, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
      include: {
        driver: true,
        vehicle: true,
        carrier: true,
        leg: { include: { booking: { include: { request: { include: { stops: true } } } } } },
        checkIns: { orderBy: { reportedAt: 'desc' }, take: 5 },
        exceptions: { where: { status: 'OPEN' } },
      },
      orderBy: [{ nextCheckInAt: 'asc' }, { assignedAt: 'asc' }],
    });
  }

  private paymentSchedules(
    tenantId: string,
    quote: { totalMinor: bigint; depositPercent: number | null; paymentTermsDays: number },
    policy: string,
    now: Date,
  ) {
    const total = Number(quote.totalMinor);
    if (policy === 'DEPOSIT') {
      const deposit = Math.ceil((total * (quote.depositPercent ?? 100)) / 100);
      return [
        {
          id: randomUUID(),
          tenantId,
          kind: 'DEPOSIT',
          amountMinor: deposit,
          dueAt: now,
          sequence: 1,
        },
        {
          id: randomUUID(),
          tenantId,
          kind: 'BALANCE',
          amountMinor: total - deposit,
          dueAt: new Date(now.getTime() + Math.max(1, quote.paymentTermsDays) * 86_400_000),
          sequence: 2,
        },
      ];
    }
    return [
      {
        id: randomUUID(),
        tenantId,
        kind: policy === 'NET_TERMS' ? 'NET_BALANCE' : 'FULL',
        amountMinor: total,
        dueAt:
          policy === 'NET_TERMS'
            ? new Date(now.getTime() + quote.paymentTermsDays * 86_400_000)
            : now,
        sequence: 1,
      },
    ];
  }

  private async nextNumber(
    tx: Prisma.TransactionClient,
    context: TenantContext,
    kind: string,
    prefix: string,
  ) {
    const year = new Date().getUTCFullYear();
    const sequence = await tx.documentSequence.upsert({
      where: { tenantId_kind_year: { tenantId: context.tenantId, kind, year } },
      update: { nextValue: { increment: 1 } },
      create: { id: randomUUID(), tenantId: context.tenantId, kind, year, nextValue: 2 },
    });
    return `${prefix}-${year}-${String(sequence.nextValue - 1).padStart(6, '0')}`;
  }

  private validateStops(stops: CreateFreightRequestDto['stops']) {
    const sequences = new Set(stops.map((stop) => stop.sequence));
    if (sequences.size !== stops.length)
      throw new ConflictException('Stop sequences must be unique');
    const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
    if (ordered[0]?.kind !== 'PICKUP' || ordered.at(-1)?.kind !== 'DELIVERY') {
      throw new ConflictException('The route must start with pickup and end with delivery');
    }
    for (const stop of stops) {
      if (
        stop.windowStart &&
        stop.windowEnd &&
        new Date(stop.windowStart) >= new Date(stop.windowEnd)
      ) {
        throw new ConflictException('Stop time window is invalid');
      }
    }
  }

  private async requireOwnedRequest(
    context: TenantContext,
    principal: AuthPrincipal,
    requestId: string,
    status?: string,
  ) {
    const request = await this.db.freightRequest.findFirst({
      where: {
        id: requestId,
        tenantId: context.tenantId,
        requesterId: principal.userId,
        ...(status ? { status } : {}),
      },
    });
    if (!request) throw new NotFoundException('Resource not found');
    return request;
  }

  private async requireOperationalRequest(context: TenantContext, requestId: string) {
    const request = await this.db.freightRequest.findFirst({
      where: { id: requestId, tenantId: context.tenantId },
      include: { stops: { orderBy: { sequence: 'asc' } }, cargoItems: true },
    });
    if (!request) throw new NotFoundException('Resource not found');
    return request;
  }

  private async requireQuote(context: TenantContext, quoteId: string) {
    const quote = await this.db.freightQuote.findFirst({
      where: { id: quoteId, tenantId: context.tenantId },
    });
    if (!quote) throw new NotFoundException('Resource not found');
    return quote;
  }

  private async requireCarrier(context: TenantContext, carrierId: string) {
    const carrier = await this.db.transportCarrier.findFirst({
      where: { id: carrierId, tenantId: context.tenantId, status: 'ACTIVE' },
    });
    if (!carrier) throw new NotFoundException('Resource not found');
    return carrier;
  }

  private async requireOperationalBooking(context: TenantContext, bookingId: string) {
    const booking = await this.db.freightBooking.findFirst({
      where: { id: bookingId, tenantId: context.tenantId },
    });
    if (!booking) throw new NotFoundException('Resource not found');
    return booking;
  }

  private async requireAssignment(context: TenantContext, assignmentId: string) {
    const assignment = await this.db.dispatchAssignment.findFirst({
      where: { id: assignmentId, tenantId: context.tenantId },
      include: { leg: true },
    });
    if (!assignment) throw new NotFoundException('Resource not found');
    return assignment;
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
        payload: payload as Prisma.InputJsonValue,
        correlationId: context.correlationId,
      },
    });
  }

  private maskPhone(phone: string) {
    return phone.length <= 4
      ? '****'
      : `${'*'.repeat(Math.min(8, phone.length - 4))}${phone.slice(-4)}`;
  }

  private redactBooking<T>(booking: T): T {
    const mutable = booking as T & {
      legs?: Array<{ assignment?: { driver?: { phoneCiphertext?: string } | null } | null }>;
    };
    for (const leg of mutable.legs ?? []) {
      if (leg.assignment?.driver?.phoneCiphertext) delete leg.assignment.driver.phoneCiphertext;
    }
    return booking;
  }
}

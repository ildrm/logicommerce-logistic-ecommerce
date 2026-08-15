import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import type {
  CreatePaymentSessionDto,
  IssueCreditNoteDto,
  RefundPaymentDto,
} from './billing.dto.js';
import { PaymentProviderService } from './payment-provider.service.js';

type ProviderEvent = {
  id?: string;
  type?: string;
  eventType?: string;
  status?: string;
  payment_status?: string;
  metadata?: Record<string, string>;
  updatedAt?: string;
  refunds?: Array<{ id?: string; status?: string }>;
  data?: { object?: { id?: string; payment_status?: string; metadata?: Record<string, string> } };
};

function safeMoneyNumber(amount: bigint): number {
  const value = Number(amount);
  if (!Number.isSafeInteger(value)) {
    throw new ConflictException('Amount exceeds the supported payment range');
  }
  return value;
}

function formatMinor(amount: bigint): string {
  const sign = amount < 0n ? '-' : '';
  const absolute = amount < 0n ? -amount : amount;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly providers: PaymentProviderService,
  ) {}

  async invoices(context: TenantContext, principal: AuthPrincipal, all: boolean) {
    const accountIds = all ? [] : await this.businessAccountIds(context, principal);
    return this.db.billingInvoice.findMany({
      where: {
        tenantId: context.tenantId,
        ...(all
          ? {}
          : {
              OR: [{ customerId: principal.userId }, { businessAccountId: { in: accountIds } }],
            }),
      },
      include: {
        lines: true,
        schedules: { include: { sessions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        payments: true,
        refunds: true,
        creditNotes: true,
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async invoice(context: TenantContext, principal: AuthPrincipal, invoiceId: string, all = false) {
    const accountIds = all ? [] : await this.businessAccountIds(context, principal);
    const invoice = await this.db.billingInvoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: context.tenantId,
        ...(all
          ? {}
          : {
              OR: [{ customerId: principal.userId }, { businessAccountId: { in: accountIds } }],
            }),
      },
      include: {
        lines: true,
        schedules: { include: { sessions: { orderBy: { createdAt: 'desc' } } } },
        payments: true,
        refunds: true,
        creditNotes: true,
      },
    });
    if (!invoice) throw new NotFoundException('Resource not found');
    return invoice;
  }

  async createPaymentSession(
    context: TenantContext,
    principal: AuthPrincipal,
    invoiceId: string,
    idempotencyKey: string,
    input: CreatePaymentSessionDto,
  ) {
    if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      throw new ConflictException('A valid Idempotency-Key header is required');
    }
    const invoice = await this.invoice(context, principal, invoiceId);
    if (['PAID', 'VOID'].includes(invoice.status)) {
      throw new ConflictException('Invoice does not accept another payment');
    }
    const schedule = input.scheduleId
      ? invoice.schedules.find((candidate) => candidate.id === input.scheduleId)
      : invoice.schedules.find((candidate) => candidate.status !== 'PAID');
    if (!schedule) throw new ConflictException('No payable schedule remains');
    const remainingMinor = schedule.amountMinor - schedule.paidMinor - schedule.creditedMinor;
    if (remainingMinor <= 0n) throw new ConflictException('Payment schedule is already paid');
    const remaining = safeMoneyNumber(remainingMinor);
    const existing = await this.db.paymentSession.findFirst({
      where: { tenantId: context.tenantId, idempotencyKey },
    });
    if (existing) return existing;
    const providerSession = await this.providers.createSession({
      provider: input.provider,
      idempotencyKey,
      amountMinor: remaining,
      currency: invoice.currency,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
    });
    const created = await this.db.paymentSession.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        scheduleId: schedule.id,
        provider: input.provider,
        providerReference: providerSession.reference,
        amountMinor: remaining,
        currency: invoice.currency,
        checkoutUrl: providerSession.checkoutUrl,
        idempotencyKey,
        expiresAt: providerSession.expiresAt,
      },
    });
    if (input.provider === 'MOCK') {
      await this.processSuccessfulPayment(created.id, `mock-event-${created.id}`, {
        source: 'development-mock',
      });
      return this.db.paymentSession.findUnique({ where: { id: created.id } });
    }
    return created;
  }

  async stripeWebhook(rawBody: Buffer, signature: string) {
    const body = rawBody.toString('utf8');
    if (!this.providers.verifyStripe(body, signature)) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
    const event = this.parseProviderEvent(body);
    const object = event.data?.object;
    return this.receiveProviderEvent({
      provider: 'STRIPE',
      eventId: event.id ?? '',
      eventType: event.type ?? '',
      providerReference: object?.id ?? '',
      success:
        ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(
          event.type ?? '',
        ) && object?.payment_status === 'paid',
      failed: ['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(
        event.type ?? '',
      ),
      payload: event,
    });
  }

  async coinbaseWebhook(rawBody: Buffer, signature: string, headers: Record<string, string>) {
    const body = rawBody.toString('utf8');
    if (!this.providers.verifyCoinbase(body, signature, headers)) {
      throw new UnauthorizedException('Invalid Coinbase webhook signature');
    }
    const event = this.parseProviderEvent(body);
    return this.receiveProviderEvent({
      provider: 'COINBASE',
      eventId: `payload-${createHash('sha256').update(body).digest('hex')}`,
      eventType: event.eventType ?? '',
      providerReference: event.id ?? '',
      success: event.eventType === 'checkout.payment.success' || event.status === 'COMPLETED',
      failed:
        ['checkout.payment.failed', 'checkout.payment.expired'].includes(event.eventType ?? '') ||
        ['FAILED', 'EXPIRED'].includes(event.status ?? ''),
      payload: event,
      ...(event.refunds ? { refunds: event.refunds } : {}),
    });
  }

  async refund(
    context: TenantContext,
    principal: AuthPrincipal,
    sessionId: string,
    idempotencyKey: string,
    input: RefundPaymentDto,
  ) {
    if (idempotencyKey.trim().length < 8 || idempotencyKey.length > 160) {
      throw new ConflictException('A valid Idempotency-Key header is required');
    }
    const prior = await this.db.paymentRefund.findFirst({
      where: { tenantId: context.tenantId, idempotencyKey },
      include: { session: true },
    });
    if (prior?.providerReference || (prior && prior.status !== 'PENDING')) {
      if (prior.status === 'COMPLETED' && !prior.appliedAt) await this.applyRefund(prior.id);
      return this.db.paymentRefund.findUniqueOrThrow({ where: { id: prior.id } });
    }

    const intent =
      prior ??
      (await this.db
        .$transaction(
          async (tx) => {
            const replay = await tx.paymentRefund.findFirst({
              where: { tenantId: context.tenantId, idempotencyKey },
            });
            if (replay) return replay;
            const session = await tx.paymentSession.findFirst({
              where: { id: sessionId, tenantId: context.tenantId, status: 'COMPLETED' },
              include: { schedule: true, refunds: true },
            });
            if (!session) throw new NotFoundException('Resource not found');
            const alreadyReserved = session.refunds
              .filter((refund) => refund.status !== 'FAILED')
              .reduce((sum, refund) => sum + refund.amountMinor, 0n);
            if (BigInt(input.amountMinor) + alreadyReserved > session.amountMinor) {
              throw new ConflictException('Refund exceeds the captured payment');
            }
            const refund = await tx.paymentRefund.create({
              data: {
                id: randomUUID(),
                tenantId: context.tenantId,
                invoiceId: session.schedule.invoiceId,
                sessionId,
                idempotencyKey,
                amountMinor: input.amountMinor,
                reason: input.reason,
                status: 'PENDING',
                requestedBy: principal.userId,
              },
            });
            await tx.auditEvent.create({
              data: {
                id: randomUUID(),
                tenantId: context.tenantId,
                actorId: principal.userId,
                actorType: 'USER',
                action: 'billing.refund.requested',
                entityType: 'PAYMENT_REFUND',
                entityId: refund.id,
                reason: input.reason,
                requestId: context.correlationId,
                correlationId: context.correlationId,
                metadata: { sessionId, amountMinor: input.amountMinor },
              },
            });
            return refund;
          },
          { isolationLevel: 'Serializable' },
        )
        .catch(async (error: unknown) => {
          const concurrent = await this.db.paymentRefund.findFirst({
            where: { tenantId: context.tenantId, idempotencyKey },
          });
          if (concurrent) return concurrent;
          throw error;
        }));

    if (intent.sessionId !== sessionId) {
      throw new ConflictException('Idempotency-Key was already used for another payment');
    }
    const session = await this.db.paymentSession.findFirst({
      where: { id: sessionId, tenantId: context.tenantId, status: 'COMPLETED' },
    });
    if (!session) throw new NotFoundException('Resource not found');
    try {
      const provider = await this.providers.refund({
        provider: session.provider,
        providerReference: session.providerReference,
        amountMinor: safeMoneyNumber(intent.amountMinor),
        reason: intent.reason,
        idempotencyKey,
      });
      const refund = await this.db.paymentRefund.update({
        where: { id: intent.id },
        data: {
          providerReference: provider.reference,
          status: provider.status,
          lastError: null,
          completedAt: provider.status === 'COMPLETED' ? new Date() : null,
        },
      });
      if (provider.status === 'COMPLETED') await this.applyRefund(refund.id);
      return refund;
    } catch (error) {
      await this.db.paymentRefund.updateMany({
        where: { id: intent.id, tenantId: context.tenantId, providerReference: null },
        data: {
          lastError: error instanceof Error ? error.message.slice(0, 1000) : 'Provider error',
        },
      });
      throw error;
    }
  }

  async creditNote(
    context: TenantContext,
    principal: AuthPrincipal,
    invoiceId: string,
    input: IssueCreditNoteDto,
  ) {
    await this.invoice(context, principal, invoiceId, true);
    return this.db.$transaction(
      async (tx) => {
        const invoice = await tx.billingInvoice.findFirst({
          where: { id: invoiceId, tenantId: context.tenantId, status: { not: 'VOID' } },
          include: { schedules: { orderBy: { sequence: 'asc' } } },
        });
        if (!invoice) throw new NotFoundException('Resource not found');
        const amount = BigInt(input.amountMinor);
        if (invoice.creditedMinor + amount > invoice.totalMinor) {
          throw new ConflictException('Credit notes exceed invoice total');
        }
        const [adjustment, receivable] = await Promise.all([
          tx.financialAccount.findFirst({
            where: {
              tenantId: context.tenantId,
              code: '5000',
              currency: invoice.currency,
              active: true,
            },
          }),
          tx.financialAccount.findFirst({
            where: {
              tenantId: context.tenantId,
              code: '1100',
              currency: invoice.currency,
              active: true,
            },
          }),
        ]);
        if (!adjustment || !receivable) {
          throw new ServiceUnavailableException(
            'Finance chart is not configured for this currency',
          );
        }
        const id = randomUUID();
        const note = await tx.creditNote.create({
          data: {
            id,
            tenantId: context.tenantId,
            invoiceId,
            number: `CRN-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
            amountMinor: amount,
            reason: input.reason,
            issuedBy: principal.userId,
          },
        });
        let unallocated = amount;
        for (const schedule of invoice.schedules) {
          if (unallocated === 0n) break;
          const outstanding = schedule.amountMinor - schedule.paidMinor - schedule.creditedMinor;
          if (outstanding <= 0n) continue;
          const applied = outstanding < unallocated ? outstanding : unallocated;
          const settled =
            schedule.paidMinor + schedule.creditedMinor + applied >= schedule.amountMinor;
          await tx.invoicePaymentSchedule.update({
            where: { id: schedule.id },
            data: {
              creditedMinor: { increment: applied },
              status: settled ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
          unallocated -= applied;
        }
        if (unallocated !== 0n) {
          throw new ConflictException('Credit note exceeds the unpaid scheduled balance');
        }
        const settled = invoice.paidMinor + invoice.creditedMinor + amount >= invoice.totalMinor;
        await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: {
            creditedMinor: { increment: amount },
            status: settled ? 'PAID' : invoice.paidMinor > 0n ? 'PARTIALLY_PAID' : 'ISSUED',
            version: { increment: 1 },
          },
        });
        const journalId = randomUUID();
        await tx.journalEntry.create({
          data: {
            id: journalId,
            tenantId: context.tenantId,
            number: `CRN-${journalId.slice(0, 8).toUpperCase()}`,
            sourceType: 'CREDIT_NOTE',
            sourceId: note.id,
            description: `Credit note ${note.number} for ${invoice.number}`,
            currency: invoice.currency,
            idempotencyKey: `credit-note:${note.id}`,
            postedBy: principal.userId,
            lines: {
              create: [
                {
                  id: randomUUID(),
                  tenantId: context.tenantId,
                  accountId: adjustment.id,
                  debitMinor: amount,
                },
                {
                  id: randomUUID(),
                  tenantId: context.tenantId,
                  accountId: receivable.id,
                  creditMinor: amount,
                },
              ],
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            actorId: principal.userId,
            actorType: 'USER',
            action: 'billing.credit-note.issued',
            entityType: 'CREDIT_NOTE',
            entityId: note.id,
            reason: input.reason,
            requestId: context.correlationId,
            correlationId: context.correlationId,
            metadata: { invoiceId, amountMinor: input.amountMinor },
          },
        });
        await tx.outboxEvent.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            type: 'billing.credit-note.issued.v1',
            subject: `invoice/${invoiceId}`,
            payload: { invoiceId, creditNoteId: note.id, amountMinor: input.amountMinor },
            correlationId: context.correlationId,
          },
        });
        return note;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async document(context: TenantContext, principal: AuthPrincipal, invoiceId: string, all = false) {
    const invoice = await this.invoice(context, principal, invoiceId, all);
    return this.invoicePdf(invoice);
  }

  private async receiveProviderEvent(input: {
    provider: string;
    eventId: string;
    eventType: string;
    providerReference: string;
    success: boolean;
    failed: boolean;
    payload: ProviderEvent;
    refunds?: Array<{ id?: string; status?: string }>;
  }) {
    if (!input.eventId || !input.providerReference) {
      throw new ConflictException('Payment event identity is missing');
    }
    const session = await this.db.paymentSession.findFirst({
      where: { provider: input.provider, providerReference: input.providerReference },
    });
    if (!session) return { received: true, ignored: true };
    const event = await this.db.paymentEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: input.provider,
          providerEventId: input.eventId,
        },
      },
      update: {},
      create: {
        id: randomUUID(),
        tenantId: session.tenantId,
        sessionId: session.id,
        provider: input.provider,
        providerEventId: input.eventId,
        eventType: input.eventType,
        payloadHash: createHash('sha256').update(JSON.stringify(input.payload)).digest('hex'),
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
    if (event.status === 'PROCESSED') return { received: true, duplicate: true };
    const claimed = await this.db.paymentEvent.updateMany({
      where: { id: event.id, status: { in: ['RECEIVED', 'FAILED'] } },
      data: { status: 'PROCESSING', error: null },
    });
    if (claimed.count !== 1) {
      throw new ServiceUnavailableException('Payment event is already being processed');
    }
    try {
      if (input.success) {
        await this.processSuccessfulPayment(session.id, event.id, input.payload);
      } else if (input.failed) {
        await this.db.$transaction([
          this.db.paymentSession.updateMany({
            where: { id: session.id, status: 'PENDING' },
            data: { status: 'FAILED' },
          }),
          this.db.paymentEvent.update({
            where: { id: event.id },
            data: { status: 'PROCESSED', processedAt: new Date() },
          }),
        ]);
      } else {
        if (input.provider === 'COINBASE' && input.refunds?.length) {
          await this.reconcileCoinbaseRefunds(session.tenantId, input.refunds);
        }
        await this.db.paymentEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }
    } catch (error) {
      await this.db.paymentEvent.updateMany({
        where: { id: event.id, status: 'PROCESSING' },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message.slice(0, 1000) : 'Processing failed',
        },
      });
      throw error;
    }
    return { received: true };
  }

  private parseProviderEvent(body: string): ProviderEvent {
    try {
      const value = JSON.parse(body) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('event must be an object');
      }
      return value as ProviderEvent;
    } catch {
      throw new BadRequestException('Payment webhook payload must be valid JSON');
    }
  }

  private async reconcileCoinbaseRefunds(
    tenantId: string,
    providerRefunds: Array<{ id?: string; status?: string }>,
  ): Promise<void> {
    for (const providerRefund of providerRefunds) {
      if (!providerRefund.id) continue;
      const refund = await this.db.paymentRefund.findFirst({
        where: { tenantId, providerReference: providerRefund.id },
        select: { id: true },
      });
      if (!refund) continue;
      if (providerRefund.status === 'COMPLETED') {
        await this.db.paymentRefund.updateMany({
          where: { id: refund.id, tenantId, status: { not: 'COMPLETED' } },
          data: { status: 'COMPLETED', completedAt: new Date(), lastError: null },
        });
        await this.applyRefund(refund.id);
      } else if (providerRefund.status === 'FAILED') {
        await this.db.paymentRefund.updateMany({
          where: { id: refund.id, tenantId, status: { not: 'COMPLETED' } },
          data: { status: 'FAILED', lastError: 'Provider reported a failed refund' },
        });
      }
    }
  }

  private async processSuccessfulPayment(
    sessionId: string,
    eventId: string,
    evidence: Record<string, unknown>,
  ) {
    await this.db.$transaction(async (tx) => {
      const session = await tx.paymentSession.findUnique({
        where: { id: sessionId },
        include: { schedule: { include: { invoice: true } }, allocations: true },
      });
      if (!session) throw new NotFoundException('Payment session not found');
      if (session.allocations.length > 0) {
        if (!eventId.startsWith('mock-event-')) {
          await tx.paymentEvent.update({
            where: { id: eventId },
            data: { status: 'PROCESSED', processedAt: new Date(), error: null },
          });
        }
        return;
      }
      const invoice = session.schedule.invoice;
      const amount = session.amountMinor;
      const paidMinor = invoice.paidMinor + amount;
      const fullyPaid = paidMinor + invoice.creditedMinor >= invoice.totalMinor;
      await tx.paymentAllocation.create({
        data: {
          id: randomUUID(),
          tenantId: session.tenantId,
          invoiceId: invoice.id,
          scheduleId: session.scheduleId,
          sessionId: session.id,
          amountMinor: amount,
          currency: session.currency,
        },
      });
      await tx.paymentSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.invoicePaymentSchedule.update({
        where: { id: session.scheduleId },
        data: {
          paidMinor: { increment: amount },
          status:
            session.schedule.paidMinor + session.schedule.creditedMinor + amount >=
            session.schedule.amountMinor
              ? 'PAID'
              : 'PARTIALLY_PAID',
        },
      });
      await tx.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          paidMinor: { increment: amount },
          status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: fullyPaid ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (invoice.sourceType === 'FREIGHT_BOOKING') {
        const firstSchedule = await tx.invoicePaymentSchedule.findFirst({
          where: { invoiceId: invoice.id },
          orderBy: { sequence: 'asc' },
        });
        if (firstSchedule?.id === session.scheduleId) {
          await tx.freightBooking.updateMany({
            where: {
              id: invoice.sourceId,
              tenantId: session.tenantId,
              status: 'AWAITING_PAYMENT',
            },
            data: { status: 'CONFIRMED', confirmedAt: new Date(), version: { increment: 1 } },
          });
        }
      }
      if (invoice.sourceType === 'CARGO_INSURANCE' && fullyPaid) {
        await tx.cargoInsurancePolicy.updateMany({
          where: {
            id: invoice.sourceId,
            tenantId: session.tenantId,
            status: 'AWAITING_PAYMENT',
          },
          data: { status: 'ACTIVE', version: { increment: 1 } },
        });
      }
      const [cash, receivable] = await Promise.all([
        tx.financialAccount.findFirst({
          where: {
            tenantId: session.tenantId,
            code: '1000',
            currency: invoice.currency,
            active: true,
          },
        }),
        tx.financialAccount.findFirst({
          where: {
            tenantId: session.tenantId,
            code: '1100',
            currency: invoice.currency,
            active: true,
          },
        }),
      ]);
      if (!cash || !receivable) {
        throw new ServiceUnavailableException('Finance chart is not configured for this currency');
      }
      const journalId = randomUUID();
      await tx.journalEntry.create({
        data: {
          id: journalId,
          tenantId: session.tenantId,
          number: `PAY-${journalId.slice(0, 8).toUpperCase()}`,
          sourceType: 'PAYMENT',
          sourceId: session.id,
          description: `Payment for ${invoice.number}`,
          currency: invoice.currency,
          idempotencyKey: `payment:${session.id}`,
          postedBy: invoice.customerId ?? '00000000-0000-4000-8000-000000000000',
          lines: {
            create: [
              {
                id: randomUUID(),
                tenantId: session.tenantId,
                accountId: cash.id,
                debitMinor: amount,
              },
              {
                id: randomUUID(),
                tenantId: session.tenantId,
                accountId: receivable.id,
                creditMinor: amount,
              },
            ],
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: randomUUID(),
          tenantId: session.tenantId,
          type: 'billing.payment.received.v1',
          subject: `invoice/${invoice.id}`,
          payload: {
            invoiceId: invoice.id,
            paymentSessionId: session.id,
            amountMinor: safeMoneyNumber(amount),
            evidence,
          } as Prisma.InputJsonValue,
          correlationId: randomUUID(),
        },
      });
      if (!eventId.startsWith('mock-event-')) {
        await tx.paymentEvent.update({
          where: { id: eventId },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }
    });
  }

  private async applyRefund(refundId: string) {
    await this.db.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.findUnique({
        where: { id: refundId },
        include: { invoice: true, session: { include: { schedule: true } } },
      });
      if (!refund || refund.status !== 'COMPLETED') return;
      if (
        refund.invoice.paidMinor < refund.amountMinor ||
        refund.session.schedule.paidMinor < refund.amountMinor
      ) {
        throw new ConflictException('Refund would make an allocated payment negative');
      }
      const claimed = await tx.paymentRefund.updateMany({
        where: { id: refund.id, status: 'COMPLETED', appliedAt: null },
        data: { appliedAt: new Date() },
      });
      if (claimed.count !== 1) return;
      const paidMinor = refund.invoice.paidMinor - refund.amountMinor;
      const schedulePaidMinor = refund.session.schedule.paidMinor - refund.amountMinor;
      const invoiceSettled = paidMinor + refund.invoice.creditedMinor >= refund.invoice.totalMinor;
      const scheduleSettled =
        schedulePaidMinor + refund.session.schedule.creditedMinor >=
        refund.session.schedule.amountMinor;
      const invoiceStatus = invoiceSettled
        ? 'PAID'
        : paidMinor > 0n || refund.invoice.creditedMinor > 0n
          ? 'PARTIALLY_PAID'
          : refund.invoice.dueAt < new Date()
            ? 'OVERDUE'
            : 'ISSUED';
      const [receivable, cash] = await Promise.all([
        tx.financialAccount.findFirst({
          where: {
            tenantId: refund.tenantId,
            code: '1100',
            currency: refund.invoice.currency,
            active: true,
          },
        }),
        tx.financialAccount.findFirst({
          where: {
            tenantId: refund.tenantId,
            code: '1000',
            currency: refund.invoice.currency,
            active: true,
          },
        }),
      ]);
      if (!receivable || !cash) {
        throw new ServiceUnavailableException('Finance chart is not configured for this currency');
      }
      await tx.invoicePaymentSchedule.update({
        where: { id: refund.session.scheduleId },
        data: {
          paidMinor: schedulePaidMinor,
          status: scheduleSettled
            ? 'PAID'
            : schedulePaidMinor > 0n || refund.session.schedule.creditedMinor > 0n
              ? 'PARTIALLY_PAID'
              : 'DUE',
        },
      });
      await tx.billingInvoice.update({
        where: { id: refund.invoiceId },
        data: {
          paidMinor,
          status: invoiceStatus,
          paidAt: invoiceSettled ? refund.invoice.paidAt : null,
          version: { increment: 1 },
        },
      });
      const journalId = randomUUID();
      await tx.journalEntry.create({
        data: {
          id: journalId,
          tenantId: refund.tenantId,
          number: `REF-${journalId.slice(0, 8).toUpperCase()}`,
          sourceType: 'PAYMENT_REFUND',
          sourceId: refund.id,
          description: `Refund for ${refund.invoice.number}`,
          currency: refund.invoice.currency,
          idempotencyKey: `payment-refund:${refund.id}`,
          postedBy: refund.requestedBy,
          lines: {
            create: [
              {
                id: randomUUID(),
                tenantId: refund.tenantId,
                accountId: receivable.id,
                debitMinor: refund.amountMinor,
              },
              {
                id: randomUUID(),
                tenantId: refund.tenantId,
                accountId: cash.id,
                creditMinor: refund.amountMinor,
              },
            ],
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: randomUUID(),
          tenantId: refund.tenantId,
          type: 'billing.payment.refunded.v1',
          subject: `invoice/${refund.invoiceId}`,
          payload: {
            invoiceId: refund.invoiceId,
            paymentSessionId: refund.sessionId,
            refundId: refund.id,
            amountMinor: safeMoneyNumber(refund.amountMinor),
          },
          correlationId: randomUUID(),
        },
      });
    });
  }

  private async businessAccountIds(context: TenantContext, principal: AuthPrincipal) {
    const rows = await this.db.businessMember.findMany({
      where: { tenantId: context.tenantId, userId: principal.userId },
      select: { accountId: true },
    });
    return rows.map((row) => row.accountId);
  }

  private invoicePdf(invoice: {
    number: string;
    currency: string;
    totalMinor: bigint;
    paidMinor: bigint;
    creditedMinor: bigint;
    dueAt: Date;
    lines: Array<{ description: string; totalMinor: bigint }>;
  }) {
    const escape = (text: string) =>
      text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
    const rows = [
      `Invoice ${invoice.number}`,
      `Due ${invoice.dueAt.toISOString().slice(0, 10)}`,
      ...invoice.lines.map(
        (line) => `${line.description}: ${invoice.currency} ${formatMinor(line.totalMinor)}`,
      ),
      `Total: ${invoice.currency} ${formatMinor(invoice.totalMinor)}`,
      `Paid: ${invoice.currency} ${formatMinor(invoice.paidMinor)}`,
      `Credited: ${invoice.currency} ${formatMinor(invoice.creditedMinor)}`,
    ];
    const stream = rows
      .map((row, index) => `BT /F1 11 Tf 50 ${760 - index * 22} Td (${escape(row)}) Tj ET`)
      .join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
      .join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf);
  }
}

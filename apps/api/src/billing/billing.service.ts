import { createHash, randomUUID } from 'node:crypto';
import {
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
  data?: { object?: { id?: string; payment_status?: string; metadata?: Record<string, string> } };
};

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
    const remaining = Number(schedule.amountMinor - schedule.paidMinor);
    if (remaining <= 0) throw new ConflictException('Payment schedule is already paid');
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
    const event = JSON.parse(body) as ProviderEvent;
    const object = event.data?.object;
    return this.receiveProviderEvent({
      provider: 'STRIPE',
      eventId: event.id ?? '',
      eventType: event.type ?? '',
      providerReference: object?.id ?? '',
      success: event.type === 'checkout.session.completed' && object?.payment_status === 'paid',
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
    const event = JSON.parse(body) as ProviderEvent;
    return this.receiveProviderEvent({
      provider: 'COINBASE',
      eventId: event.id ?? '',
      eventType: event.eventType ?? '',
      providerReference: event.id ?? '',
      success: event.eventType === 'checkout.payment.success' || event.status === 'COMPLETED',
      failed:
        ['checkout.payment.failed', 'checkout.payment.expired'].includes(event.eventType ?? '') ||
        ['FAILED', 'EXPIRED'].includes(event.status ?? ''),
      payload: event,
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
              .reduce((sum, refund) => sum + Number(refund.amountMinor), 0);
            if (input.amountMinor + alreadyReserved > Number(session.amountMinor)) {
              throw new ConflictException('Refund exceeds the captured payment');
            }
            return tx.paymentRefund.create({
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
        amountMinor: Number(intent.amountMinor),
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
    const invoice = await this.invoice(context, principal, invoiceId, true);
    if (input.amountMinor > Number(invoice.totalMinor)) {
      throw new ConflictException('Credit note exceeds invoice total');
    }
    const id = randomUUID();
    return this.db.creditNote.create({
      data: {
        id,
        tenantId: context.tenantId,
        invoiceId,
        number: `CRN-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
        amountMinor: input.amountMinor,
        reason: input.reason,
        issuedBy: principal.userId,
      },
    });
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
          this.db.paymentSession.update({
            where: { id: session.id },
            data: { status: 'FAILED' },
          }),
          this.db.paymentEvent.update({
            where: { id: event.id },
            data: { status: 'PROCESSED', processedAt: new Date() },
          }),
        ]);
      } else {
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
      const fullyPaid = paidMinor >= invoice.totalMinor;
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
            session.schedule.paidMinor + amount >= session.schedule.amountMinor
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
      if (cash && receivable) {
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
      }
      await tx.outboxEvent.create({
        data: {
          id: randomUUID(),
          tenantId: session.tenantId,
          type: 'billing.payment.received.v1',
          subject: `invoice/${invoice.id}`,
          payload: {
            invoiceId: invoice.id,
            paymentSessionId: session.id,
            amountMinor: Number(amount),
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
        include: { invoice: true },
      });
      if (!refund || refund.status !== 'COMPLETED') return;
      const claimed = await tx.paymentRefund.updateMany({
        where: { id: refund.id, status: 'COMPLETED', appliedAt: null },
        data: { appliedAt: new Date() },
      });
      if (claimed.count !== 1) return;
      const paidMinor = refund.invoice.paidMinor - refund.amountMinor;
      await tx.billingInvoice.update({
        where: { id: refund.invoiceId },
        data: {
          paidMinor,
          status: paidMinor <= 0 ? 'ISSUED' : 'PARTIALLY_PAID',
          paidAt: null,
          version: { increment: 1 },
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
    dueAt: Date;
    lines: Array<{ description: string; totalMinor: bigint }>;
  }) {
    const escape = (text: string) =>
      text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
    const rows = [
      `Invoice ${invoice.number}`,
      `Due ${invoice.dueAt.toISOString().slice(0, 10)}`,
      ...invoice.lines.map(
        (line) =>
          `${line.description}: ${invoice.currency} ${(Number(line.totalMinor) / 100).toFixed(2)}`,
      ),
      `Total: ${invoice.currency} ${(Number(invoice.totalMinor) / 100).toFixed(2)}`,
      `Paid: ${invoice.currency} ${(Number(invoice.paidMinor) / 100).toFixed(2)}`,
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

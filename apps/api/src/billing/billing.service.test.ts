import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@logicommerce/database';
import { BillingService } from './billing.service.js';
import type { PaymentProviderService } from './payment-provider.service.js';

const context = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  actorId: '00000000-0000-4000-8000-000000000002',
  correlationId: 'test-correlation',
};

const principal = {
  tenantId: context.tenantId,
  userId: context.actorId,
  sessionId: '00000000-0000-4000-8000-000000000003',
  roles: ['customer'],
  permissions: ['payment.use'],
};

describe('BillingService provider events', () => {
  it('rejects signed webhook bodies that are not JSON objects', async () => {
    const providers = { verifyStripe: vi.fn().mockReturnValue(true) };
    const service = new BillingService(
      {} as DatabaseClient,
      providers as unknown as PaymentProviderService,
    );

    await expect(service.stripeWebhook(Buffer.from('[]'), 'signature')).rejects.toThrow(
      'must be valid JSON',
    );
  });

  it('gives each Coinbase payload a distinct event identity and preserves refund updates', async () => {
    const providers = { verifyCoinbase: vi.fn().mockReturnValue(true) };
    const service = new BillingService(
      {} as DatabaseClient,
      providers as unknown as PaymentProviderService,
    );
    const receive = vi.fn().mockResolvedValue({ received: true });
    Object.assign(service, { receiveProviderEvent: receive });
    const checkout = {
      id: '68f7a946db0529ea9b6d3a12',
      eventType: 'checkout.refund.success',
      status: 'PARTIALLY_REFUNDED',
      updatedAt: '2026-08-16T00:00:00Z',
      refunds: [{ id: 'refund-1', status: 'COMPLETED' }],
    };

    await service.coinbaseWebhook(Buffer.from(JSON.stringify(checkout)), 'signature', {});
    await service.coinbaseWebhook(
      Buffer.from(JSON.stringify({ ...checkout, updatedAt: '2026-08-16T00:01:00Z' })),
      'signature',
      {},
    );

    const first = receive.mock.calls[0]?.[0] as {
      eventId: string;
      failed: boolean;
      refunds: unknown[];
    };
    const second = receive.mock.calls[1]?.[0] as { eventId: string };
    expect(first.eventId).toMatch(/^payload-[a-f0-9]{64}$/u);
    expect(first.eventId).not.toBe(second.eventId);
    expect(first.failed).toBe(false);
    expect(first.refunds).toEqual(checkout.refunds);
  });

  it('treats Stripe delayed-payment success as a successful checkout', async () => {
    const providers = { verifyStripe: vi.fn().mockReturnValue(true) };
    const service = new BillingService(
      {} as DatabaseClient,
      providers as unknown as PaymentProviderService,
    );
    const receive = vi.fn().mockResolvedValue({ received: true });
    Object.assign(service, { receiveProviderEvent: receive });

    await service.stripeWebhook(
      Buffer.from(
        JSON.stringify({
          id: 'evt-1',
          type: 'checkout.session.async_payment_succeeded',
          data: { object: { id: 'cs-1', payment_status: 'paid' } },
        }),
      ),
      'signature',
    );

    expect(receive).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('routes Stripe refund updates to refund reconciliation', async () => {
    const providers = { verifyStripe: vi.fn().mockReturnValue(true) };
    const service = new BillingService(
      {} as DatabaseClient,
      providers as unknown as PaymentProviderService,
    );
    const receive = vi.fn().mockResolvedValue({ received: true });
    Object.assign(service, { receiveStripeRefundEvent: receive });

    await service.stripeWebhook(
      Buffer.from(
        JSON.stringify({
          id: 'evt-refund-1',
          type: 'refund.updated',
          data: {
            object: {
              id: 're_provider_1',
              status: 'succeeded',
              metadata: { logicommerce_refund_id: 'refund-local-1' },
            },
          },
        }),
      ),
      'signature',
    );

    const receivedEvent = receive.mock.calls[0]?.[0] as {
      eventId: string;
      eventType: string;
      providerReference: string;
      localRefundId: string;
      status: string;
      payload: Record<string, unknown>;
    };
    expect(receivedEvent).toMatchObject({
      eventId: 'evt-refund-1',
      eventType: 'refund.updated',
      providerReference: 're_provider_1',
      localRefundId: 'refund-local-1',
      status: 'succeeded',
    });
    expect(receivedEvent.payload).toMatchObject({ id: 'evt-refund-1' });
  });

  it('durably completes and applies a successful Stripe refund update', async () => {
    const refundUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const database = {
      paymentRefund: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'refund-local-1',
          tenantId: context.tenantId,
          sessionId: 'session-1',
          providerReference: 're_provider_1',
        }),
        updateMany: refundUpdate,
      },
      paymentEvent: {
        upsert: vi.fn().mockResolvedValue({ id: 'event-local-1', status: 'RECEIVED' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new BillingService(
      database as unknown as DatabaseClient,
      {} as PaymentProviderService,
    );
    const applyRefund = vi.fn().mockResolvedValue(undefined);
    Object.assign(service, { applyRefund });

    await (
      service as unknown as {
        receiveStripeRefundEvent(input: {
          eventId: string;
          eventType: string;
          providerReference: string;
          status: string;
          payload: Record<string, unknown>;
        }): Promise<unknown>;
      }
    ).receiveStripeRefundEvent({
      eventId: 'evt-refund-1',
      eventType: 'refund.updated',
      providerReference: 're_provider_1',
      status: 'succeeded',
      payload: { id: 'evt-refund-1' },
    });

    const refundChange = refundUpdate.mock.calls[0]?.[0] as { data: { status: string } };
    expect(refundChange.data.status).toBe('COMPLETED');
    expect(applyRefund).toHaveBeenCalledWith('refund-local-1');
  });

  it('completes and applies a matching asynchronous Coinbase refund', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const database = {
      paymentRefund: {
        findFirst: vi.fn().mockResolvedValue({ id: 'refund-local' }),
        updateMany,
      },
    };
    const service = new BillingService(
      database as unknown as DatabaseClient,
      {} as PaymentProviderService,
    );
    const applyRefund = vi.fn().mockResolvedValue(undefined);
    Object.assign(service, { applyRefund });

    await (
      service as unknown as {
        reconcileCoinbaseRefunds(
          tenantId: string,
          refunds: Array<{ id: string; status: string }>,
        ): Promise<void>;
      }
    ).reconcileCoinbaseRefunds('tenant-1', [{ id: 'refund-provider', status: 'COMPLETED' }]);

    expect(JSON.stringify(updateMany.mock.calls)).toContain('"status":"COMPLETED"');
    expect(applyRefund).toHaveBeenCalledWith('refund-local');
  });

  it('returns an exact payment-session replay even after the invoice is paid', async () => {
    const existing = {
      id: 'session-1',
      scheduleId: 'schedule-1',
      provider: 'STRIPE',
      status: 'COMPLETED',
    };
    const providers = { createSession: vi.fn() };
    const database = {
      businessMember: { findMany: vi.fn().mockResolvedValue([]) },
      billingInvoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-1',
          status: 'PAID',
          schedules: [{ id: 'schedule-1', status: 'PAID' }],
        }),
      },
      paymentSession: { findFirst: vi.fn().mockResolvedValue(existing) },
    };
    const service = new BillingService(
      database as unknown as DatabaseClient,
      providers as unknown as PaymentProviderService,
    );

    await expect(
      service.createPaymentSession(context, principal, 'invoice-1', 'payment-replay-1', {
        provider: 'STRIPE',
      }),
    ).resolves.toBe(existing);
    expect(providers.createSession).not.toHaveBeenCalled();
  });

  it('locks a schedule before calling a checkout provider and releases failed locks', async () => {
    const scheduleLock = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const providers = {
      createSession: vi.fn().mockRejectedValue(new Error('provider unavailable')),
    };
    const database = {
      businessMember: { findMany: vi.fn().mockResolvedValue([]) },
      billingInvoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-1',
          number: 'INV-1',
          status: 'ISSUED',
          currency: 'USD',
          schedules: [
            {
              id: 'schedule-1',
              status: 'DUE',
              amountMinor: 1_000n,
              paidMinor: 0n,
              creditedMinor: 0n,
            },
          ],
        }),
      },
      paymentSession: { findFirst: vi.fn().mockResolvedValue(null) },
      invoicePaymentSchedule: {
        updateMany: scheduleLock,
        findFirst: vi.fn().mockResolvedValue({
          id: 'schedule-1',
          status: 'DUE',
          amountMinor: 1_000n,
          paidMinor: 0n,
          creditedMinor: 0n,
        }),
      },
    };
    const service = new BillingService(
      database as unknown as DatabaseClient,
      providers as unknown as PaymentProviderService,
    );

    await expect(
      service.createPaymentSession(context, principal, 'invoice-1', 'payment-lock-1', {
        provider: 'STRIPE',
      }),
    ).rejects.toThrow('provider unavailable');
    expect(providers.createSession).toHaveBeenCalledOnce();
    expect(scheduleLock).toHaveBeenLastCalledWith({
      where: {
        id: 'schedule-1',
        tenantId: context.tenantId,
        checkoutLockKey: 'payment-lock-1',
      },
      data: { checkoutLockKey: null, checkoutLockUntil: null },
    });
  });

  it('retains the schedule lock for the lifetime of a pending checkout', async () => {
    const expiresAt = new Date('2026-08-16T01:00:00.000Z');
    const scheduleLock = vi.fn().mockResolvedValue({ count: 1 });
    const created = { id: 'session-1', status: 'PENDING', expiresAt };
    const providers = {
      createSession: vi.fn().mockResolvedValue({
        reference: 'provider-session-1',
        checkoutUrl: 'https://checkout.example/session-1',
        expiresAt,
      }),
    };
    const database = {
      businessMember: { findMany: vi.fn().mockResolvedValue([]) },
      billingInvoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-1',
          number: 'INV-1',
          status: 'ISSUED',
          currency: 'USD',
          schedules: [
            {
              id: 'schedule-1',
              status: 'DUE',
              amountMinor: 1_000n,
              paidMinor: 0n,
              creditedMinor: 0n,
            },
          ],
        }),
      },
      paymentSession: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      invoicePaymentSchedule: {
        updateMany: scheduleLock,
        findFirst: vi.fn().mockResolvedValue({
          id: 'schedule-1',
          status: 'DUE',
          amountMinor: 1_000n,
          paidMinor: 0n,
          creditedMinor: 0n,
        }),
      },
    };
    const service = new BillingService(
      database as unknown as DatabaseClient,
      providers as unknown as PaymentProviderService,
    );

    await expect(
      service.createPaymentSession(context, principal, 'invoice-1', 'payment-lock-1', {
        provider: 'STRIPE',
      }),
    ).resolves.toBe(created);
    expect(scheduleLock).toHaveBeenCalledTimes(2);
    expect(scheduleLock).toHaveBeenLastCalledWith({
      where: {
        id: 'schedule-1',
        tenantId: context.tenantId,
        checkoutLockKey: 'payment-lock-1',
      },
      data: { checkoutLockUntil: expiresAt },
    });
  });

  it('rejects reuse of payment and refund idempotency keys with different inputs', async () => {
    const database = {
      businessMember: { findMany: vi.fn().mockResolvedValue([]) },
      billingInvoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-2',
          status: 'ISSUED',
          schedules: [{ id: 'schedule-2', status: 'DUE' }],
        }),
      },
      paymentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'session-1',
          scheduleId: 'schedule-1',
          provider: 'STRIPE',
        }),
      },
      paymentRefund: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'refund-1',
          sessionId: 'session-1',
          amountMinor: 100n,
          reason: 'Original reason',
          status: 'COMPLETED',
          providerReference: 'provider-refund-1',
          appliedAt: new Date(),
        }),
      },
    };
    const service = new BillingService(
      database as unknown as DatabaseClient,
      {} as PaymentProviderService,
    );

    await expect(
      service.createPaymentSession(context, principal, 'invoice-2', 'payment-replay-1', {
        provider: 'STRIPE',
      }),
    ).rejects.toThrow('another payment request');
    await expect(
      service.refund(context, principal, 'session-2', 'refund-replay-1', {
        amountMinor: 200,
        reason: 'Changed reason',
      }),
    ).rejects.toThrow('another refund request');
  });

  it('rejects an asynchronously captured payment that exceeds the current balance', async () => {
    const transaction = {
      paymentSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'session-2',
          tenantId: context.tenantId,
          scheduleId: 'schedule-1',
          amountMinor: 30n,
          currency: 'USD',
          allocations: [],
          schedule: {
            id: 'schedule-1',
            amountMinor: 100n,
            paidMinor: 80n,
            creditedMinor: 0n,
            invoice: { id: 'invoice-1' },
          },
        }),
      },
    };
    const database = {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<void>) =>
        callback(transaction),
      ),
    };
    const service = new BillingService(
      database as unknown as DatabaseClient,
      {} as PaymentProviderService,
    );

    await expect(
      (
        service as unknown as {
          processSuccessfulPayment(
            sessionId: string,
            eventId: string,
            evidence: Record<string, unknown>,
          ): Promise<void>;
        }
      ).processSuccessfulPayment('session-2', 'event-2', {}),
    ).rejects.toThrow('exceeds the remaining schedule balance');
  });

  it('returns an exact credit-note replay and rejects changed parameters', async () => {
    const creditNote = {
      id: 'credit-1',
      invoiceId: 'invoice-1',
      amountMinor: 500n,
      reason: 'Service adjustment',
    };
    const database = {
      businessMember: { findMany: vi.fn().mockResolvedValue([]) },
      billingInvoice: {
        findFirst: vi.fn().mockResolvedValue({ id: 'invoice-1', schedules: [] }),
      },
      creditNote: { findFirst: vi.fn().mockResolvedValue(creditNote) },
    };
    const service = new BillingService(
      database as unknown as DatabaseClient,
      {} as PaymentProviderService,
    );

    await expect(
      service.creditNote(context, principal, 'invoice-1', 'credit-replay-1', {
        amountMinor: 500,
        reason: 'Service adjustment',
      }),
    ).resolves.toBe(creditNote);
    await expect(
      service.creditNote(context, principal, 'invoice-1', 'credit-replay-1', {
        amountMinor: 600,
        reason: 'Service adjustment',
      }),
    ).rejects.toThrow('another credit-note request');
  });
});

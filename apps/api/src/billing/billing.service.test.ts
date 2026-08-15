import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@logicommerce/database';
import { BillingService } from './billing.service.js';
import type { PaymentProviderService } from './payment-provider.service.js';

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

    const first = receive.mock.calls[0]?.[0] as { eventId: string; refunds: unknown[] };
    const second = receive.mock.calls[1]?.[0] as { eventId: string };
    expect(first.eventId).toMatch(/^payload-[a-f0-9]{64}$/u);
    expect(first.eventId).not.toBe(second.eventId);
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
});

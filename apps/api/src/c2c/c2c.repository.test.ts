import { describe, expect, it, vi } from 'vitest';
import { C2CRepository } from './c2c.repository.js';

const context = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  actorId: '00000000-0000-4000-8000-000000000002',
  correlationId: '00000000-0000-4000-8000-000000000003',
};
const principal = {
  userId: '00000000-0000-4000-8000-000000000002',
  tenantId: context.tenantId,
  permissions: ['c2c.trade'],
};

describe('C2C payment release durability', () => {
  it('rejects reuse of an offer idempotency key with changed parameters', async () => {
    const payments = { hold: vi.fn(), release: vi.fn() };
    const database = {
      c2COffer: {
        findFirst: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000050',
          buyerUserId: principal.userId,
          listingId: '00000000-0000-4000-8000-000000000051',
          parentOfferId: null,
          amountMinor: 10_000n,
        }),
      },
    };
    const repository = new C2CRepository(database as never, {} as never, payments as never);

    await expect(
      repository.offer(
        context,
        principal as never,
        '00000000-0000-4000-8000-000000000052',
        ' reused-offer-key ',
        { amountMinor: 12_000, paymentToken: 'tok_valid' },
      ),
    ).rejects.toThrow('another offer request');
    expect(payments.hold).not.toHaveBeenCalled();
    expect(payments.release).not.toHaveBeenCalled();
  });

  it('releases a distinct hold returned during an idempotency create race', async () => {
    const concurrent = {
      id: '00000000-0000-4000-8000-000000000050',
      buyerUserId: principal.userId,
      listingId: '00000000-0000-4000-8000-000000000051',
      parentOfferId: null,
      amountMinor: 10_000n,
      paymentProvider: 'ESCROW',
      paymentReference: 'hold-winning',
    };
    const database = {
      c2COffer: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(concurrent),
      },
      c2CListing: {
        findFirst: vi.fn().mockResolvedValue({
          id: concurrent.listingId,
          sellerUserId: '00000000-0000-4000-8000-000000000099',
          currency: 'USD',
        }),
      },
      $transaction: vi.fn().mockRejectedValue({ code: 'P2002' }),
    };
    const payments = {
      hold: vi.fn().mockResolvedValue({ provider: 'ESCROW', reference: 'hold-losing-concurrent' }),
      release: vi.fn().mockResolvedValue(undefined),
    };
    const repository = new C2CRepository(database as never, {} as never, payments as never);

    await expect(
      repository.offer(context, principal as never, concurrent.listingId, 'new-offer-key', {
        amountMinor: 10_000,
        paymentToken: 'tok_valid',
      }),
    ).resolves.toBe(concurrent);
    expect(payments.release).toHaveBeenCalledWith('hold-losing-concurrent', 'new-offer-key');
  });

  it('queues the superseded parent hold in the counter transaction', async () => {
    const parent = {
      id: '00000000-0000-4000-8000-000000000010',
      tenantId: context.tenantId,
      paymentProvider: 'ESCROW',
      paymentReference: 'hold-parent',
      paymentIdempotencyKey: 'parent-idempotency',
    };
    const releaseCreate = vi.fn().mockResolvedValue({});
    const createdOffer = { id: '00000000-0000-4000-8000-000000000011' };
    const transaction = {
      c2COffer: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(createdOffer),
      },
      c2CPaymentRelease: { create: releaseCreate },
    };
    const database = {
      c2COffer: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(parent) },
      c2CListing: {
        findFirst: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000020',
          sellerUserId: '00000000-0000-4000-8000-000000000099',
          currency: 'USD',
        }),
      },
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const payments = {
      hold: vi.fn().mockResolvedValue({ provider: 'ESCROW', reference: 'hold-new' }),
      release: vi.fn(),
    };
    const repository = new C2CRepository(database as never, {} as never, payments as never);

    await expect(
      repository.offer(
        context,
        principal as never,
        '00000000-0000-4000-8000-000000000020',
        'new-idempotency-key',
        { amountMinor: 10_000, parentOfferId: parent.id, paymentToken: 'tok_valid' },
      ),
    ).resolves.toBe(createdOffer);
    const queuedParent = releaseCreate.mock.calls[0]?.[0] as {
      data: { offerId: string; paymentReference: string; paymentIdempotencyKey: string };
    };
    expect(queuedParent.data).toMatchObject({
      offerId: parent.id,
      paymentReference: parent.paymentReference,
      paymentIdempotencyKey: parent.paymentIdempotencyKey,
    });
  });

  it('queues every losing hold in the same transaction as acceptance', async () => {
    const losingOffer = {
      id: '00000000-0000-4000-8000-000000000030',
      tenantId: context.tenantId,
      paymentProvider: 'ESCROW',
      paymentReference: 'hold-losing',
      paymentIdempotencyKey: 'losing-idempotency',
    };
    const releaseCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      c2COffer: {
        findFirst: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000031',
          tenantId: context.tenantId,
          listingId: '00000000-0000-4000-8000-000000000032',
          buyerUserId: '00000000-0000-4000-8000-000000000033',
          amountMinor: 12_000,
          paymentProvider: 'ESCROW',
          paymentReference: 'hold-winning',
          expiresAt: new Date(Date.now() + 60_000),
          listing: { sellerUserId: principal.userId, currency: 'USD' },
        }),
        findMany: vi.fn().mockResolvedValue([losingOffer]),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      c2CPaymentRelease: { createMany: releaseCreateMany },
      c2CListing: { update: vi.fn().mockResolvedValue({}) },
      c2CTransaction: { create: vi.fn().mockResolvedValue({ id: 'transaction' }) },
    };
    const database = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const repository = new C2CRepository(database as never, {} as never, {} as never);

    await repository.acceptOffer(context, principal as never, 'offer');

    const queuedLosers = releaseCreateMany.mock.calls[0]?.[0] as {
      data: Array<{ offerId: string; paymentReference: string }>;
      skipDuplicates: boolean;
    };
    expect(queuedLosers.skipDuplicates).toBe(true);
    expect(queuedLosers.data).toMatchObject([
      { offerId: losingOffer.id, paymentReference: losingOffer.paymentReference },
    ]);
  });

  it('claims and acknowledges durable release jobs idempotently', async () => {
    const releaseJob = {
      id: '00000000-0000-4000-8000-000000000040',
      paymentReference: 'hold-to-release',
      paymentIdempotencyKey: 'release-idempotency',
      attempts: 0,
    };
    const releaseUpdate = vi.fn().mockResolvedValue({});
    const database = {
      c2COffer: { findMany: vi.fn().mockResolvedValue([]) },
      c2CPaymentRelease: {
        findMany: vi.fn().mockResolvedValue([releaseJob]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: releaseUpdate,
      },
    };
    const payments = { release: vi.fn().mockResolvedValue(undefined) };
    const repository = new C2CRepository(database as never, {} as never, payments as never);

    await expect(repository.processPaymentReleases()).resolves.toBe(1);
    expect(payments.release).toHaveBeenCalledWith(
      releaseJob.paymentReference,
      releaseJob.paymentIdempotencyKey,
    );
    const acknowledged = releaseUpdate.mock.calls[0]?.[0] as {
      data: { status: string; releasedAt: Date; lockedUntil: null };
    };
    expect(acknowledged.data).toMatchObject({ status: 'RELEASED', lockedUntil: null });
    expect(acknowledged.data.releasedAt).toBeInstanceOf(Date);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { ReturnsFinanceRepository } from './returns-finance.repository.js';

const context = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  actorId: '00000000-0000-4000-8000-000000000002',
  correlationId: '00000000-0000-4000-8000-000000000003',
};
const principal = {
  userId: context.actorId,
  tenantId: context.tenantId,
  sessionId: '00000000-0000-4000-8000-000000000004',
  roles: ['returns-manager'],
  permissions: ['return.manage'],
};
const returnId = '00000000-0000-4000-8000-000000000010';
const firstLineId = '00000000-0000-4000-8000-000000000011';
const secondLineId = '00000000-0000-4000-8000-000000000012';

function returnRecord(status: string) {
  return {
    id: returnId,
    tenantId: context.tenantId,
    status,
    version: 1,
    lines: [
      { id: firstLineId, quantity: 2, receivedQuantity: 0 },
      { id: secondLineId, quantity: 1, receivedQuantity: 0 },
    ],
  };
}

describe('ReturnsFinanceRepository state transitions', () => {
  it('prevents cumulative RMAs from exceeding the ordered quantity', async () => {
    const create = vi.fn();
    const transaction = {
      order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      returnLine: {
        findMany: vi.fn().mockResolvedValue([{ orderLineId: firstLineId, quantity: 1 }]),
      },
      returnAuthorization: { create },
    };
    const database = {
      returnAuthorization: { findFirst: vi.fn().mockResolvedValue(null) },
      order: {
        findFirst: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000020',
          version: 3,
          lines: [{ id: firstLineId, quantity: 2 }],
        }),
      },
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const repository = new ReturnsFinanceRepository(database as never);

    await expect(
      repository.createReturn(context, principal, 'return-request-1', {
        orderId: '00000000-0000-4000-8000-000000000020',
        reasonCode: 'DAMAGED',
        requestedOutcome: 'REFUND',
        lines: [{ orderLineId: firstLineId, quantity: 2 }],
      }),
    ).rejects.toThrow('unreturned order quantity');
    expect(create).not.toHaveBeenCalled();
  });

  it('returns an exact RMA replay and rejects a changed idempotent command', async () => {
    const record = {
      id: returnId,
      orderId: '00000000-0000-4000-8000-000000000020',
      customerId: principal.userId,
      reasonCode: 'DAMAGED',
      requestedOutcome: 'REFUND',
      lines: [{ orderLineId: firstLineId, quantity: 1 }],
    };
    const database = {
      returnAuthorization: { findFirst: vi.fn().mockResolvedValue(record) },
      order: { findFirst: vi.fn() },
    };
    const repository = new ReturnsFinanceRepository(database as never);
    const input = {
      orderId: record.orderId,
      reasonCode: record.reasonCode,
      requestedOutcome: 'REFUND' as const,
      lines: [{ orderLineId: firstLineId, quantity: 1 }],
    };

    await expect(
      repository.createReturn(context, principal, 'return-request-1', input),
    ).resolves.toBe(record);
    await expect(
      repository.createReturn(context, principal, 'return-request-1', {
        ...input,
        reasonCode: 'CHANGED',
      }),
    ).rejects.toThrow('another return request');
    expect(database.order.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a partial receipt that would leave the RMA stuck', async () => {
    const database = {
      returnAuthorization: { findFirst: vi.fn().mockResolvedValue(returnRecord('LABEL_ISSUED')) },
      $transaction: vi.fn(),
    };
    const repository = new ReturnsFinanceRepository(database as never);

    await expect(
      repository.receiveReturn(context, returnId, {
        lines: [{ lineId: firstLineId, quantity: 2 }],
      }),
    ).rejects.toThrow('every return line exactly once');
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('claims the return version before applying received quantities', async () => {
    const lineUpdate = vi.fn();
    const transaction = {
      returnAuthorization: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
      },
      returnLine: { update: lineUpdate },
    };
    const database = {
      returnAuthorization: { findFirst: vi.fn().mockResolvedValue(returnRecord('IN_TRANSIT')) },
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const repository = new ReturnsFinanceRepository(database as never);

    await expect(
      repository.receiveReturn(context, returnId, {
        lines: [
          { lineId: firstLineId, quantity: 2 },
          { lineId: secondLineId, quantity: 1 },
        ],
      }),
    ).rejects.toThrow('changed by another operation');
    expect(lineUpdate).not.toHaveBeenCalled();
  });

  it('rejects duplicate inspection lines before inventory or finance work', async () => {
    const record = returnRecord('RECEIVED');
    record.lines[0]!.receivedQuantity = 2;
    record.lines[1]!.receivedQuantity = 1;
    const database = {
      returnAuthorization: { findFirst: vi.fn().mockResolvedValue(record) },
      $transaction: vi.fn(),
    };
    const repository = new ReturnsFinanceRepository(database as never);
    const resolution = {
      lineId: firstLineId,
      disposition: 'RESTOCK',
      resolution: 'REFUND',
      refundMinor: 100,
    };

    await expect(
      repository.inspectReturn(context, principal, returnId, {
        conditionCode: 'OPEN_BOX',
        lines: [resolution, resolution],
      }),
    ).rejects.toThrow('every return line exactly once');
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('does not create an empty or duplicate settlement period', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const create = vi.fn();
    const database = {
      journalEntry: { findMany },
      settlement: { create },
    };
    const repository = new ReturnsFinanceRepository(database as never);

    await expect(
      repository.calculateSettlement(context, {
        partnerKind: 'SELLER',
        partnerId: '00000000-0000-4000-8000-000000000020',
        periodStart: '2026-08-01T00:00:00.000Z',
        periodEnd: '2026-08-02T00:00:00.000Z',
        currency: 'usd',
        reserveMinor: 0,
        adjustmentMinor: 0,
      }),
    ).rejects.toThrow('No unsettled journals');
    const journalQuery = findMany.mock.calls[0]?.[0] as {
      where: { status: string; settlementLines: { none: object } };
    };
    expect(journalQuery.where).toMatchObject({ status: 'POSTED', settlementLines: { none: {} } });
    expect(create).not.toHaveBeenCalled();
  });

  it('fails closed rather than claiming an external settlement payout in production', async () => {
    const priorEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const database = { settlement: { findFirst: vi.fn(), update: vi.fn() } };
      const repository = new ReturnsFinanceRepository(database as never);

      await expect(repository.paySettlement(context, returnId)).rejects.toThrow(
        'settlement-payout provider',
      );
      expect(database.settlement.findFirst).not.toHaveBeenCalled();
      expect(database.settlement.update).not.toHaveBeenCalled();
    } finally {
      if (priorEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorEnvironment;
    }
  });
});

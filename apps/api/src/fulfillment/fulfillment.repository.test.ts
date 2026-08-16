import { describe, expect, it, vi } from 'vitest';
import { asnReceiptPayloadHash, FulfillmentRepository } from './fulfillment.repository.js';

const context = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  actorId: '00000000-0000-4000-8000-000000000002',
  correlationId: '00000000-0000-4000-8000-000000000003',
};
const principal = {
  userId: context.actorId,
  tenantId: context.tenantId,
  sessionId: '00000000-0000-4000-8000-000000000004',
  roles: ['warehouse-operator'],
  permissions: ['warehouse.receive'],
};
const asnId = '00000000-0000-4000-8000-000000000010';
const lineId = '00000000-0000-4000-8000-000000000011';
const rejectedReceipt = {
  lines: [{ lineId, acceptedQty: 0, rejectedQty: 3, inspection: 'FAILED' as const }],
};

describe('FulfillmentRepository ASN receiving', () => {
  it('returns an exact durable replay without changing inventory', async () => {
    const asn = {
      id: asnId,
      tenantId: context.tenantId,
      facilityId: '00000000-0000-4000-8000-000000000012',
      status: 'COMPLETED',
      lines: [],
    };
    const transaction = {
      advanceShippingNotice: { findFirst: vi.fn().mockResolvedValue(asn) },
      asnReceiptCommand: {
        findUnique: vi.fn().mockResolvedValue({
          asnId,
          payloadHash: asnReceiptPayloadHash(rejectedReceipt),
        }),
      },
      inventoryBalance: { upsert: vi.fn() },
      stockLedgerEntry: { create: vi.fn() },
    };
    const database = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const repository = new FulfillmentRepository(database as never, {} as never);

    await expect(
      repository.receiveAsn(context, principal, asnId, rejectedReceipt, ' receipt-key-123 '),
    ).resolves.toBe(asn);
    expect(transaction.inventoryBalance.upsert).not.toHaveBeenCalled();
    expect(transaction.stockLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key replay with a changed payload', async () => {
    const transaction = {
      advanceShippingNotice: {
        findFirst: vi.fn().mockResolvedValue({ id: asnId, status: 'IN_PROGRESS', lines: [] }),
      },
      asnReceiptCommand: {
        findUnique: vi.fn().mockResolvedValue({ asnId, payloadHash: 'different-payload' }),
      },
    };
    const database = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const repository = new FulfillmentRepository(database as never, {} as never);

    await expect(
      repository.receiveAsn(context, principal, asnId, rejectedReceipt, 'receipt-key-123'),
    ).rejects.toThrow('another ASN receipt');
  });

  it('rejects duplicate line IDs before opening a transaction', async () => {
    const database = { $transaction: vi.fn() };
    const repository = new FulfillmentRepository(database as never, {} as never);

    await expect(
      repository.receiveAsn(
        context,
        principal,
        asnId,
        { lines: [rejectedReceipt.lines[0]!, rejectedReceipt.lines[0]!] },
        'receipt-key-123',
      ),
    ).rejects.toThrow('only appear once');
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('durably records a rejected-only receipt and completes the ASN', async () => {
    const result = { id: asnId, status: 'COMPLETED' };
    const receiptCreate = vi.fn().mockResolvedValue({});
    const lineUpdate = vi.fn().mockResolvedValue({});
    const asnUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      advanceShippingNotice: {
        findFirst: vi.fn().mockResolvedValue({
          id: asnId,
          tenantId: context.tenantId,
          facilityId: '00000000-0000-4000-8000-000000000012',
          status: 'OPEN',
          version: 1,
          receivedAt: null,
          lines: [
            {
              id: lineId,
              variantId: '00000000-0000-4000-8000-000000000013',
              expectedQty: 3,
              receivedQty: 0,
              inspection: 'PENDING',
            },
          ],
        }),
        updateMany: asnUpdate,
        findUniqueOrThrow: vi.fn().mockResolvedValue(result),
      },
      asnReceiptCommand: { findUnique: vi.fn().mockResolvedValue(null), create: receiptCreate },
      asnLine: { update: lineUpdate, count: vi.fn().mockResolvedValue(0) },
      productVariant: { findFirst: vi.fn() },
      inventoryItem: { upsert: vi.fn() },
      inventoryBalance: { upsert: vi.fn() },
      stockLedgerEntry: { create: vi.fn() },
    };
    const database = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const repository = new FulfillmentRepository(database as never, {} as never);

    await expect(
      repository.receiveAsn(context, principal, asnId, rejectedReceipt, 'receipt-key-123'),
    ).resolves.toBe(result);
    const recordedReceipt = receiptCreate.mock.calls[0]?.[0] as {
      data: { tenantId: string; asnId: string; idempotencyKey: string; payloadHash: string };
    };
    expect(recordedReceipt.data).toMatchObject({
      tenantId: context.tenantId,
      asnId,
      idempotencyKey: 'receipt-key-123',
      payloadHash: asnReceiptPayloadHash(rejectedReceipt),
    });
    expect(lineUpdate).toHaveBeenCalledWith({
      where: { id: lineId },
      data: {
        receivedQty: 3,
        acceptedQty: 0,
        rejectedQty: 3,
        inspection: 'FAILED',
      },
    });
    const asnChange = asnUpdate.mock.calls[0]?.[0] as { data: { status: string } };
    expect(asnChange.data.status).toBe('COMPLETED');
    expect(transaction.inventoryItem.upsert).not.toHaveBeenCalled();
    expect(transaction.inventoryBalance.upsert).not.toHaveBeenCalled();
  });

  it('does not complete putaway while another ASN line is unreceived', async () => {
    const binId = '00000000-0000-4000-8000-000000000014';
    const result = { id: asnId, status: 'IN_PROGRESS' };
    const asnUpdate = vi.fn();
    const transaction = {
      asnLine: {
        findFirst: vi.fn().mockResolvedValue({
          id: lineId,
          inventoryItemId: '00000000-0000-4000-8000-000000000015',
          acceptedQty: 3,
          inspection: 'PASSED',
          putawayAt: null,
          putawayBinId: null,
          asn: {
            id: asnId,
            facilityId: '00000000-0000-4000-8000-000000000012',
            status: 'IN_PROGRESS',
          },
        }),
        update: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(1),
      },
      facilityBin: {
        findFirst: vi.fn().mockResolvedValue({
          id: binId,
          facilityId: '00000000-0000-4000-8000-000000000012',
        }),
      },
      advanceShippingNotice: {
        updateMany: asnUpdate,
        findUnique: vi.fn().mockResolvedValue(result),
      },
    };
    const database = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const repository = new FulfillmentRepository(database as never, {} as never);

    await expect(repository.putaway(context, asnId, { lineId, binId })).resolves.toBe(result);
    expect(transaction.asnLine.count).toHaveBeenCalledWith({
      where: {
        asnId,
        tenantId: context.tenantId,
        OR: [{ inspection: 'PENDING' }, { acceptedQty: { gt: 0 }, putawayAt: null }],
      },
    });
    expect(asnUpdate).not.toHaveBeenCalled();
  });
});

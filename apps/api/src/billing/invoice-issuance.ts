import { randomUUID } from 'node:crypto';
import type { Prisma } from '@logicommerce/database';

export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const sequence = await tx.documentSequence.upsert({
    where: { tenantId_kind_year: { tenantId, kind: 'INVOICE', year } },
    update: { nextValue: { increment: 1 } },
    create: { id: randomUUID(), tenantId, kind: 'INVOICE', year, nextValue: 2 },
  });
  return `INV-${year}-${String(sequence.nextValue - 1).padStart(6, '0')}`;
}

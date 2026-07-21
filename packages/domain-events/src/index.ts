export type DomainEvent<TType extends string, TData extends object> = {
  readonly id: string;
  readonly type: TType;
  readonly version: number;
  readonly tenantId: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly subject: string;
  readonly actorId: string | null;
  readonly data: TData;
};

export function createDomainEvent<TType extends string, TData extends object>(input: {
  id: string;
  type: TType;
  tenantId: string;
  correlationId: string;
  causationId?: string;
  subject: string;
  actorId?: string;
  data: TData;
  occurredAt?: Date;
}): DomainEvent<TType, TData> {
  return {
    id: input.id,
    type: input.type,
    version: 1,
    tenantId: input.tenantId,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    correlationId: input.correlationId,
    causationId: input.causationId ?? null,
    subject: input.subject,
    actorId: input.actorId ?? null,
    data: input.data,
  };
}
